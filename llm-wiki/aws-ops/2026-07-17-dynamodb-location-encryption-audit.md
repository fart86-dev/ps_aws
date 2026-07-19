---
type: aws-op
date: 2026-07-17
account: "306331009209"
region: ap-northeast-2
category: [dynamodb, s3, kms, compliance]
impact: 비용 아님 — OPA 위치정보법 실태점검 2차 제출(마감 2026-07-17) 대응
status: done
related: [[../aws-pending#dynamodb-위치정보-저장-암호화-opa-실태점검-대응]]
---

# 2026-07-17 · DynamoDB 위치정보 저장 암호화 실태 조사 (OPA 실태점검 대응)

방송미디어통신위원회(OPA 지원) 2026년도 위치정보사업자 실태점검(서면) 1차에서 "위치정보 저장 암호화 미흡" 판정. 2차 제출자료 준비 과정에서 실제 인프라의 암호화 상태를 라이브로 확인.

---

## 1) 배경

- 위치정보는 기사(driver) 앱에서만 수집. 승객에게는 수집하지 않음.
- 수집 경로: 기사 앱 → DynamoDB(`production_dr_runn`, `production_dr_runn_hist`) → PITR 기반 Export to S3 (`s3://mshuttle-data`) → Glue(stlog5)/Athena 배치 분석
- 점검자 코멘트 원문 요지: "제출하신 자료에는 위치정보를 평문으로 저장하는 것으로 확인됩니다. 안전한 암호화 알고리즘을 통해 저장되어 있는 위치정보 암호화 테이블 화면을 제출 바랍니다."

## 2) 확인한 근거

### DynamoDB SSE 상태

```bash
aws dynamodb describe-table --table-name production_dr_runn_hist --region ap-northeast-2 \
  --query 'Table.SSEDescription'
# → null
```

`production_dr_runn`, `production_dr_runn_hist` 모두 `SSEDescription: null` → **AWS 소유 키(AWS owned key) 기본 암호화만 적용**, KMS 기반 SSE 미설정.

### 실제 값 확인 (scan 1건)

```bash
aws dynamodb scan --table-name production_dr_runn_hist --region ap-northeast-2 --limit 1
```

`latitude`/`longitude`가 평문 숫자(`37.0645617`, `127.06361`)로 그대로 조회됨. 점검자가 지적한 상태와 일치.

### S3 버킷 암호화 (비교 대상)

```bash
aws s3api get-bucket-encryption --bucket mshuttle-data --region ap-northeast-2
# → SSEAlgorithm: AES256 (SSE-S3 적용됨)
```

`mshuttle-data`, `ms-sam` 둘 다 SSE-S3 적용 확인. **S3 쪽은 이미 충족, DynamoDB 원본 쪽만 미흡.**

### IaC 코드 확인

`~/iac/iac_ddb_runn/lib/constructs/dynamodb-tables.ts`의 `createTable()`에 `dynamodb.Table` 생성 시 `encryption` 옵션 자체가 없음 → 설계 단계부터 암호화가 고려되지 않았음.

### 현재 프로덕션 테이블 규모/설정 (2026-07-17 기준)

| 테이블 | 항목 수 | 크기 | Stream | PITR |
|---|---|---|---|---|
| production_dr_runn | 621 | 214KB | 활성 | 활성 |
| production_dr_runn_hist | 357,226 | 76MB | 활성 | 활성 |
| production_dr_runn_status | 16,645 | 3.4MB | - | 비활성 |
| production_dr_runn_status_hst | 5,242 | 645KB | - | 비활성 |

## 3) 검토한 옵션

### 옵션 A: SSE를 AWS 관리형 KMS 키(`alias/aws/dynamodb`)로 전환

- `update-table --sse-specification`은 기존 테이블에 대한 인플레이스 온라인 작업 — 테이블 재생성/데이터 이전 없음, 다운타임 없음 (AWS 공식 동작. 정확한 전환 소요시간은 검증 안 됨).
- 앱 코드 변경 없음 — DynamoDB API 레벨에서 암호화/복호화가 투명하게 처리됨.
- **콘솔/scan으로 조회하면 여전히 평문으로 보임** — 점검자가 지적한 "평문 노출" 자체는 해결 안 됨. "저장소 차원 암호화가 걸려있다"는 근거는 강화되지만, 점검자 요구사항 충족 여부는 불확실.
- ⚠️ **PITR 기반 Export to S3에 영향 가능성**: `production_dr_runn`, `production_dr_runn_hist` 모두 PITR 활성 상태로 매일 새벽 stlog5 파이프라인이 이 export를 소비함. AWS 관리형 CMK로 바꾸면 export를 수행하는 IAM 역할에 `kms:Decrypt` 권한이 있는지 확인 필요 — 없으면 테이블은 멀쩡해도 export가 조용히 실패할 수 있음. **미검증** — export 수행 role/메커니즘 코드를 아직 확인 안 함.
- ⚠️ Stream(둘 다 활성)을 구독하는 소비자(Lambda/AppSync 추정)도 동일하게 권한 재검토 필요. **미검증**.

### 옵션 B: 필드(컬럼) 레벨 암호화 — lat/lng 자체를 암호문으로 저장

- 손대야 할 지점 3곳: 기사 앱 쓰기 경로, 실시간 위치 조회 API(복호화 추가), Glue ETL(stlog5)의 지오분석 로직(복호화 후 연산 필요).
- 기존 축적 데이터(평문) 처리 여부도 별도 결정 필요.
- **당일(2026-07-17) 완료는 무리로 판단** — 프로덕션 다중 서비스를 동시에 건드려야 함.

## 4) 결론 (2026-07-17 시점, 이후 실행됨 — 7)~11) 참조)

사용자와 논의한 잠정 방향 (당시 미실행):
1. 전송 암호화(SSL 인증서)는 별개 항목으로 오늘 증빙 제출 가능.
2. 저장 암호화는 2차 제출 문구를 "진행 중 + 완료 목표일" 소명으로 전환하는 방향 논의 중.
3. 옵션 A(SSE→KMS 전환)는 보조 조치로 검토했으나, export/stream 권한 영향이 미검증이라 실행 보류. 실행한다면 먼저 `dev_dr_runn` 계열에 적용해 export/stream 정상 동작을 확인한 뒤 production 적용 권장.

## 5) 다음 행동

- [x] Export to S3 수행 주체 확인 → `driver-runn-cron` Lambda (하드코딩 Access Key). 상세 [[../aws-ops/2026-07-18-dynamodb-stream-consumer-audit]]
- [x] Stream 소비자 확인 → `iac_shuttle_analytics`(Flink), 현재 정지 상태(의도됨). 상세 [[../aws-ops/2026-07-18-dynamodb-stream-consumer-audit]]
- [x] 옵션 A dev 배포 완료 (2026-07-18) — 아래 6) 참조
- [x] production 드리프트 점검 완료 (2026-07-18) — 아래 7) 참조
- [x] production 배포 완료 (2026-07-18 21:37 KST) — 아래 11) 참조
- [ ] 옵션 B(필드 레벨 암호화) 착수 여부 및 완료 목표일 결정 → OPA 2차 제출 문구에 반영

## 6) 실행 결과 — 옵션 A dev 배포 (2026-07-18)

`~/iac/iac_ddb_runn/lib/constructs/dynamodb-tables.ts`의 `createTable()`에 `encryption: dynamodb.TableEncryption.AWS_MANAGED` 추가 → `cdk diff`로 사전 확인 후 `yarn deploy:dev` 실행.

**cdk diff에서 확인된 부수 변경 (본 작업과 무관, 안전 확인됨):**
- `AppSync::ApiKey`의 `Expires`가 "may be replaced"로 표시됐으나, `aws cloudformation describe-type`으로 실제 스키마 확인 결과 `createOnlyProperties`는 `ApiId`뿐이라 **Expires는 무중단 업데이트** — CDK diff의 과잉 경고였음.
- Resolver/FunctionConfiguration `CodeS3Location`이 전부 새 타임스탬프 prefix로 바뀌었으나 파일 해시 동일(내용 무변화) — 이 리포 배포 스크립트가 매 배포마다 새 S3 prefix에 에셋을 올리는 구조라 항상 발생.

**배포 결과:** 32개 리소스, 72.87초, 무중단 완료 (`✅ driver-tracking-api-dev`).

**배포 후 검증:**
```bash
aws dynamodb describe-table --table-name dev_dr_runn_hist --region ap-northeast-2 --query 'Table.SSEDescription'
# → {"Status":"ENABLED","SSEType":"KMS","KMSMasterKeyArn":"arn:...key/27d0b5bc-69ed-4f4d-a5c4-17f193012669"}
```
- 4개 테이블(`dev_dr_runn`, `dev_dr_runn_hist`, `dev_dr_runn_status`, `dev_dr_runn_status_hst`) 전부 SSE-KMS 확인
- Stream ARN 배포 전후 동일(타임스탬프 불변) — SSE 변경이 Stream ARN에 영향 없음을 실증
- 테이블 상태 `ACTIVE`, 정상 scan 가능
- **추가 검증**: AppSync `createRunnHist`/`findAllRunnHist` mutation·query로 실제 왕복 테스트(테스트 레코드 삽입→조회→삭제) 성공 — 인프라 상태 조회를 넘어 실사용 경로까지 확인

**주의:** driver-tracking-alert-api 계열(`iac_ddb_alert`, `iac_ddb_runn_analysis`)은 이번에 건드리지 않음 — 별도 CDK 스택이라 필요 시 동일 패턴으로 별도 적용 필요. 상세 10) 참조.

## 7) production 드리프트 점검 결과 (2026-07-18)

production 배포 전 필수 사전 점검으로 `detect-stack-drift` 실행.

```bash
aws cloudformation detect-stack-drift --stack-name driver-tracking-api-production --region ap-northeast-2
# → StackDriftStatus: DRIFTED, DriftedStackResourceCount: 13
```

dev(4개, AppSync FunctionConfiguration만)보다 훨씬 많은 **13개 리소스**가 드리프트 상태. 프로퍼티 단위로 전부 까본 결과:

| 리소스 | CDK 기억값 | 실제값 | 원인 |
|---|---|---|---|
| RunnHistTable (+GSI) ProvisionedThroughput | R10/W20 | R3/W15 | Auto Scaling이 현재 부하에 맞춰 조정한 값 |
| RunnStatusTable ProvisionedThroughput | R3/W3 | R5/W5 | 레거시 크론(`infra.ddb_status.on/off`, cron_serv)이 관리 중 |
| RunnStatusHstTable ProvisionedThroughput | R3/W3 | R5/W5 | 위와 동일 |
| ScalableTarget 4개 (Runn/RunnHist R/W) MinCapacity=MaxCapacity | 1~3 | 3~20 | Auto Scaling 스케줄(출퇴근 피크타임)이 현재 시간대 값으로 고정 |
| AppSync FunctionConfiguration 4개 | - | - | dev와 동일, 기존에 알려진 VTL/APPSYNC_JS 이슈 |

**결론: 구조적 드리프트(암호화·GSI·키·스트림 등)는 0건.** 전부 ProvisionedThroughput/MinCapacity/MaxCapacity 숫자뿐이며, 원인이 전부 파악된 정상적인 동적 관리(Auto Scaling + 레거시 용량 크론)에 의한 것.

**~~배포 시 리스크: cdk deploy는 드리프트 난 리소스도 템플릿의 고정값으로 되돌리므로 용량이 순간 리셋됨~~ → 정정(2026-07-18, production cdk diff로 직접 확인):**

`cdk diff --context stage=production`을 실제 change set(정확한 replacement 정보 포함) 기준으로 떠보니 **ProvisionedThroughput/용량 관련 변경은 전혀 없고, dev와 동일하게 SSESpecification 4개 + ApiKey Expires + Resolver S3 포인터뿐**이었음.

**정정 이유:** CloudFormation의 스택 업데이트는 "라이브 리소스 상태 vs 템플릿"이 아니라 **"직전 템플릿 vs 새 템플릿"을 비교**해서 실제로 보낼 API 호출을 결정한다. 이번 변경은 `encryption` 한 줄만 추가했고 `readCapacity`/`writeCapacity` 값 자체는 템플릿상 안 바뀌었으므로, CloudFormation은 그 속성을 아예 업데이트 대상에 포함시키지 않는다. `detect-stack-drift`가 보여주는 "라이브 값과 템플릿 값의 차이"는 실제 배포 동작과는 별개 정보 — **드리프트가 있어도, 그 속성을 템플릿에서 건드리지 않는 배포라면 드리프트는 되돌아가지 않는다.**

**따라서 이번 배포는 용량 리스크 없이 안전.** (주말 저트래픽 타이밍은 그래도 일반적인 안전 관행으로는 유효하나, 이 배포 자체의 필수조건은 아니었음.)

## 8) OPA 제출용 증빙 캡쳐 방법 (production 적용 후에만 유효)

**콘솔 경로:** DynamoDB → Tables → 테이블 선택(예: `production_dr_runn_hist`) → **Additional settings** 탭 → **Encryption** 섹션

- 여기서 `Key type: AWS managed key` / Key ARN이 보이고, `SSEType`이 **KMS**로 표시되면 정상 적용된 것. (`describe-table`의 `SSEDescription.SSEType`도 동일 확인 가능 — 미적용 시 이 필드 자체가 비어 있음.)
- CLI 보조 증빙: `aws dynamodb describe-table --table-name <table> --query 'Table.SSEDescription'`

**주의 (이 캡쳐만으로는 미흡할 수 있음):**
- **dev에서 캡쳐해도 무효.** OPA는 실서비스(production) 기준으로 점검하므로, production 배포 후에 캡쳐해야 함(11) 완료 후 지금은 유효).
- 이 화면은 **저장소 차원 암호화**(SSE) 증빙일 뿐, Items 탭에서 개별 항목을 열면 위경도 값은 여전히 평문 숫자로 보임(SSE는 권한 있는 접근에는 투명하게 복호화되는 방식이라 원래 그러함). 점검자가 지적한 "평문 노출" 자체를 없애는 건 [[../aws-pending#dynamodb-위치정보-저장-암호화-opa-실태점검-대응]]의 옵션 B(필드 레벨 암호화)이며, 이번 옵션 A 캡쳐만으로 충분한지는 불확실.

## 9) 다음 행동 갱신 (2026-07-18, 배포 전 시점 스냅샷)

- [x] production 드리프트 점검 완료 → 구조적 드리프트 없음, 용량 관련만(위 7) 참조)
- [x] `cdk diff --context stage=production` 실행 완료 → SSESpecification 4개만, 용량 변경 없음 확인(위 7) 정정 내용 참조)
- [x] production 배포 완료 (2026-07-18 21:37 KST) — 아래 11) 참조
- [x] 익일 새벽 driver-runn-cron export 정상 동작 확인 (2026-07-19) — 아래 12) 참조
- [ ] production 캡쳐 → OPA 2차 제출 문서에 첨부, 제출 문구 확정

## 10) 추가 발견 — `iac_ddb_alert`/`iac_ddb_runn_analysis`도 동일 gap (2026-07-18)

`iac_ddb_alert`, `iac_ddb_runn_analysis` (analysis_alert 계열 — 사고/경고 데이터에 위경도 포함, [[../aws-pending#dynamodb-analysis_alert-계열-5개-phase-2-3-잔여]] 참조)의 `lib/constructs/dynamodb-tables.ts`에도 `iac_ddb_runn`이 갖고 있던 것과 동일하게 `encryption` 옵션이 없음.

```bash
grep -n "encryption" ~/iac/iac_ddb_alert/lib/constructs/dynamodb-tables.ts
grep -n "encryption" ~/iac/iac_ddb_runn_analysis/lib/constructs/dynamodb-tables.ts
# → 둘 다 결과 없음
```

**현재 영향 없음:** 해당 테이블들은 2026-07-02 정리 때 삭제되어 현재 라이브로 존재하지 않음(재배포 여부 미결정, [[../aws-pending#dynamodb-analysis_alert-계열-5개-phase-2-3-잔여]]).

**TODO:** analysis_alert 계열을 재배포하기로 결정되면, 그 코드에도 `encryption: dynamodb.TableEncryption.AWS_MANAGED`를 미리 추가해서 같은 미흡이 재발하지 않도록 할 것.

## 11) 실행 결과 — 옵션 A production 배포 (2026-07-18 21:37 KST)

배포 직전 재점검(스택 상태 `CREATE_COMPLETE` 안정, `cdk diff` 재실행으로 낮에 확인한 것과 diff 동일함 재확인) 후 `yarn deploy:prod` 실행.

**배포 결과:** 32개 리소스, 67.85초, 무중단 완료 (`✅ driver-tracking-api-production`).

**배포 후 검증:**
```bash
aws dynamodb describe-table --table-name production_dr_runn_hist --region ap-northeast-2 --query 'Table.SSEDescription'
# → {"Status":"ENABLED","SSEType":"KMS","KMSMasterKeyArn":"arn:...key/27d0b5bc-69ed-4f4d-a5c4-17f193012669"}
```
- 4개 테이블(`production_dr_runn`, `production_dr_runn_hist`, `production_dr_runn_status`, `production_dr_runn_status_hst`) 전부 SSE-KMS 확인 (dev와 동일한 AWS 관리형 키 공유)
- Stream ARN 배포 전후 완전 동일(`.../stream/2025-12-26T07:05:17...`) — [[../aws-ops/2026-07-18-dynamodb-stream-consumer-audit]]에서 확인한 Flink 하드코딩 ARN도 안전
- 테이블 상태 `ACTIVE`, 배포 후 15분간 SystemErrors 0건

**남은 것:** OPA 제출용 콘솔 캡쳐만 남음. 8) 참조 — 이제 production 캡쳐가 유효함.

## 12) 익일 새벽 driver-runn-cron export 검증 (2026-07-19 01:00 KST)

배포(2026-07-18 21:37 KST) 이후 첫 야간 익스포트 사이클 정상 동작 확인.

```bash
aws s3 ls s3://mshuttle-data/dynamodb/prod/runn_hist/2026/07/18/ --recursive
# → _started, manifest-files.json/md5, manifest-summary.json/md5, data/*.json.gz 전부 01:00:09~01:02:11 KST 생성
```

- `runn`, `runn_hist` 둘 다 S3 PITR export 정상 완료 (manifest + gzip 데이터 파일 생성)
- Athena 외부 테이블 재생성 정상: `dr_runn_2026_07_18`, `runn_hist_2026_07_18` 둘 다 최신 테이블 목록에 존재 (7일 보관 정책대로 07-13~07-18 유지 중)
- 데이터 무결성: `SELECT count(*) FROM runn_hist_2026_07_18` → **21,973건** 정상 조회
- 익스포트 수행 주체는 하드코딩된 `fart86` 키([[../aws-pending#cron_servdriver-runn-cron-하드코딩-aws-액세스-키--소유자-특정-완료]] 참조) — `AdministratorAccess` 보유라 KMS 권한 문제 없이 정상 동작

**결론: 저장 암호화(SSE-KMS) 변경이 익스포트 파이프라인에 전혀 영향을 주지 않음을 실측으로 확인. 이 건은 완전히 종료.**

관련: [[../aws-pending#dynamodb-위치정보-저장-암호화-opa-실태점검-대응]]
