---
type: aws-pending
last_updated: 2026-07-18
---

# AWS 진행 중 / 보류 / 후속 작업 통합

`aws-ops/` 의 각 작업 노트가 남긴 후속 TODO + 사용자 의사결정 대기 항목을 한 곳에.

상태:
- 🟡 사용자 결정 대기
- 🔵 별도 프로젝트로 분리
- 🟢 진행 준비 완료 (사용자 트리거 대기)
- ⏳ 시한 모니터링 (날짜 도래 대기)

---

## spd-test 체인

**상태:** 🟡 stop/삭제 결정 보류

**대상:** spd-test PostgreSQL + API Gateway + Lambda 체인.

**점검:** 1년간 실사용 거의 0.

**잠재 효과:** TBD (RDS instance 비용이 큼).

**다음 행동:** 사용자가 stop / delete / 유지 결정. 결정 시:
- stop 만: 인스턴스 시간만 절감 (storage 는 계속 과금)
- delete: 완전 절감, 단 복구 불가

(이 항목은 자동 메모리 `project_aws_spd_test_todo` 에도 등록되어 있음.)

---

## dev-mshuttle 스토리지 마이그레이션

**상태:** 🟢 진행 준비 완료 (사용자 수동 실행 대기)

**대상:** dev-mshuttle 200 GB → 50 GB.

**잠재 효과:** -$15/월 (~-$156/년).

**다음 행동:** [[aws-runbooks/rds-shrink-migration]] 따라 사용자 직접 실행. 예상 소요 1~2시간.

---

## DataZone Force Delete

**상태:** 🟢 콘솔에서 사용자 진행

**대상:** DataZone 도메인 잔재 (활성 도메인은 이미 비활성 확인).

**잠재 효과:** 정리 가치 위주.

**다음 행동:** AWS Console → DataZone → 도메인 → Force Delete.

---

## mshuttle Ubuntu 업그레이드

**상태:** 🔵 별도 프로젝트로 분리

**대상:** mshuttle EC2 OS Ubuntu 16.04 → 22.04.

**왜:** 보안 차원 (16.04 는 EOL).

**다음 행동:** ps_aws 범위 밖. 별도 인프라 프로젝트로 진행.

---

## slsv `serverless/ussr/` prefix 정리

**상태:** 🟡 검토 후 진행

**대상:** s3://slsv/serverless/ussr/ (6.3 GB)

**왜:** ussr 프로젝트 폐기 확인됨 ([[aws-ops/2026-06-02-lambda-edge-cleanup]] 의 [점검] 섹션 참조).

**잠재 효과:** ~-$0.15/월.

**다음 행동:**
```bash
# dry-run
aws s3 ls s3://slsv/serverless/ussr/ --recursive --summarize | tail
# 실 삭제
aws s3 rm s3://slsv/serverless/ussr/ --recursive
```

**주의:** 같은 버킷의 `my-app/` prefix 는 CDK asset 활성 → 절대 건드리지 말 것. [[aws-inventory/protected-resources#7-slsv-s3-버킷의-my-app-prefix]]

---

## KMS `test_key_1`

**상태:** 🟡 사용자 결정 후 schedule-key-deletion

**대상:** Customer-managed CMK, 2021-03-04 생성, 5년 무사용.

**잠재 효과:** -$1/월 (Customer KMS 1개당 과금).

**다음 행동:** 사용자 결정 시:
```bash
# 30일 pending window
aws kms schedule-key-deletion --key-id ad2436d2-... --pending-window-in-days 30
# 후회하면
aws kms cancel-key-deletion --key-id ad2436d2-...
```

[[aws-inventory/protected-resources#8-kms-test_key_1]] 도 참조.

---

## Cognito/Amplify dead 후보 90일 재검토

**상태:** ⏳ 2026-10-06 재검토 대기

**대상:** Cognito User Pool 6개, Identity Pool 5개, Amplify 앱 5개, Node 12/16 Lambda 8개 + 부속 IAM role. rn_drapp 이 실사용하는 `drapp42d078e1` (IP `6b0dc290` + UP `DSrE4OBGH`) 는 **제외**.

**왜:** 2026-07-06 감사에서 코드 참조 0 / SignIn 0 / Amplify branches 0 / Lambda invocations 0 확인. 하지만 배포 앱 바이너리·연 1회 배치 등 반증 시나리오 배제 못 함 → 90일 무변화 관찰로 확신도 확보.

**잠재 효과:** 비용 절감 미미 (Cognito free tier), dead resource + 보안 표면 정리 가치.

**다음 행동:**
- 2026-10-06 도래 시 [[aws-ops/2026-07-06-cognito-amplify-audit#4-90일-모니터-프로토콜]] 의 지표 재수집
- 모든 지표 0/무변화 → 순차 삭제 (Amplify 앱 → Lambda → User Pool → Identity Pool → IAM role)
- 변화 있으면 판정 재고
- 결과를 [[aws-ops/2026-07-06-cognito-amplify-audit]] 에 append

---

## Node 20.x 이하 Lambda 마이그레이션 로드맵

**상태:** 🟡 계획 수립 후 진행

**대상:** ap-northeast-2 Lambda 58개 (Node 12: 6, Node 16: 4, Node 18: 2, Node 20: 46).

**왜:** Node 12/16/18 은 이미 EOL 완료 (2023-03 / 2024-06 / 2025-04). Node 20 은 2026-04 지원 축소 진행 중.

**즉시 확인 후보 (EOL 완료 12개):**
- Node 12/16 amplify-login 8개 + amplify-drapp UpdateRoles 1개 → 위 감사 항목 재검토와 병행
- `analysis-admin-production-warmup-plugin` (Node 12), `analysis-geo-production-warmup-plugin-default` (Node 18, **2026-04 최근 수정 = 활성**) → warmup 코드 살아있는지 확인 후 마이그레이션 or 삭제
- `efstestpy-dev-warmup-plugin` (Node 12) → test 흔적, 삭제 후보

**Node 20.x 46개:**
- production 계열 18개 마이그레이션 우선순위 최상
- dev 계열 11개 순차
- staging 계열 14개 → 사용자가 "staging 폐기" 확정 (2026-07-06). 별도 정리 항목 [[aws-ops/2026-07-06-staging-cleanup]] 참조
- 특기: `production-ps-channel-meets*` 3개는 2026-05 신규 배포인데도 Node 20 → 신규 프로젝트 런타임 선택 표준 부재

**다음 행동:**
- staging 14개 → [[#staging-환경-폐기-정리]] 로 이관
- production 18개는 각 리포 소유팀 확인 후 마이그레이션 티켓 발행 (ps_aws 범위 밖)

---

## staging 환경 폐기 정리

**상태:** 🟡 조사 완료, 실행 승인 대기

**대상:** staging CFN 스택 17개 (그룹 A restapi 7, 그룹 B CloudFront app 4, 그룹 C Lambda URL app 3, 그룹 D 추가 3) + 스택 밖 `admin.mshuttle.staging` S3 + `dr-serv-staging` API Gateway + Route53 `mshuttle.click` staging 레코드.

**왜:** 사용자 진술 "staging 폐기" 확보 (2026-07-06). 30일 실 트래픽 0, 1년 반 배포 없음, 데이터 저장소 스택 안에 없음 = 위험 낮은 정리 후보. 다만 CloudFront 4개가 여전히 `mshuttle.click` 서브도메인 (user/make/pay/runn) 에 매핑 중이라 DNS 정리 병행 필요.

**잠재 효과:** 비용 절감 미미 (Lambda 무트래픽, CloudFront 사용량 0), dead resource 정리 + Node 20 이하 카운트 감소 (14/46 → 32/46) + `mshuttle.click` DNS clean.

**다음 행동:**
- 사용자 승인 후 [[aws-ops/2026-07-06-staging-cleanup#7-삭제-실행-방식-권장]] 절차대로 진행
- 미해결 5개 확인 항목 답변 확보 필요:
  1. 4개 서브도메인 (user/make/pay/runn) 정말 폐기?
  2. `admin.mshuttle.staging` S3 폐기 범위?
  3. `dr-serv-staging` API Gateway 소속?
  4. 그룹 D 3개 함께 처리?
  5. 실행 트리거 시점 (지금 vs 90일 재검토 병행)

**주의:** 반드시 스택 단위 `delete-stack` 사용. 개별 함수/리소스 삭제 금지 (2026-07-02 DynamoDB 오삭제 사고 재발 방지). 상세 [[aws-ops/2026-07-06-staging-cleanup]].

---

## madmin KMS pending window

**상태:** ⏳ 2026-07-02 영구 삭제 모니터링

**대상:** KMS Key `c01008c7-...` ([[aws-ops/2026-06-02-kms-madmin-cleanup]] 결과).

**현 상태:** PendingDeletion (2026-06-02 ~ 2026-07-02 30일 window).

**잠재 효과:** -$1/월 확정 (영구 삭제 후).

**다음 행동:**
- 2026-07-02 도래 시 확정 절감 -$1/월 보고
- 그 전까지 복구 필요하면: `aws kms cancel-key-deletion --key-id c01008c7-...`

---

## production-mshuttle source storage 축소

**상태:** 🔵 별도 프로젝트로 분리

**대상:** production-mshuttle (writer) 100 GB → 25 GB.

**왜:** 사용량 대비 낭비. read replica 100GB 제약도 함께 해소됨.

**잠재 효과:** -$6.96/월.

**다음 행동:**
- 운영 DB → 무중단 마이그레이션 필수 (DMS 또는 blue-green)
- read replica (production-mshuttle-read1) 재생성도 같이 계획
- 절차 base: [[aws-runbooks/rds-shrink-migration]] 의 production 섹션
- 별도 프로젝트로 분리 필요 (이 ps_aws 리포 범위 밖)

---

## msdeveloper 기타 prefix 정리

**상태:** 🟡 사용자 확인 후

**대상:** msdeveloper 버킷의 `error/`, `csv/`, `shp/`, `log/`, `test/`, `test1/`, `test2/`, `test3/`, `test_result/`, `user_log/`, `make/`, `makecode/`, `makep/`, `app/`, `cf_log/`.

**왜:** 사용자가 "사실상 삭제" 의향 표시 (2026-06-04).

**잠재 효과:** ~$0.07/월 (절감 미미), 객체 4,500+개 정리 가치.

**다음 행동:** 각 prefix 별로 확인 후 일괄 삭제. 사용자 명시 승인 필요. db/ 는 절대 손대지 말 것 ([[aws-inventory/protected-resources#6-msdeveloper-s3-버킷]]).

---

## CloudWatch 고아 Log Group sweep

**상태:** 🟡 검토 후 진행

**대상:** `API-Gateway-Execution-Logs_*` 외에 `/aws/codebuild/*`, `/aws/apigateway/*` 등의 원본 없는 로그 그룹.

**왜:** [[aws-ops/2026-06-04-apigw-exec-log-cleanup]] 처럼 원본 리소스는 삭제됐는데 로그 그룹만 남은 경우 다른 분류에도 존재 가능.

**다음 행동:** sweep 스크립트 작성 → 매칭 안 되는 그룹 list → 사용자 확인 후 일괄 삭제.

> TODO(질문): sweep 자동화 우선순위 결정 필요. 손으로 sweep 한 번 더 돌릴지, ps_aws 에 컬렉터 추가할지. #todo

---

## CloudWatch Logs retention 정책

**상태:** 🟡 정책 결정 후

**대상:** 거의 모든 로그 그룹 (retention 미설정 = 무기한 누적).

**왜:** 무기한 누적은 비용 + 컴플라이언스 양쪽 문제.

**잠재 효과:** TBD (전체 누적량 측정 후).

**다음 행동:** 정책 결정 → 일괄 적용.
- dev 환경: 7~30일 권장
- production: 90일 권장
- 결정 후 `aws logs put-retention-policy --log-group-name <name> --retention-in-days N` 일괄.

---

## DynamoDB analysis_alert 계열 5개 (Phase 2/3 잔여)

**상태:** 🟡 담당자 확인 후 (재검토)

**대상 (여전히 삭제된 상태, 재생성 판단 필요):**
- production 3개: `production_dr_runn_analysis_alert`, `_analysis_alert_hst`, `_analysis_alert_log`
- dev 2개: `dev_dr_runn_analysis_alert`, `_analysis_alert_log`

**왜:** 2026-07-02 사고 (Phase 2/3 삭제 → CDK 관리 4개 오삭제 및 복구) 시점에 삭제됨. 이 5개는 CDK 관리 밖으로 확인. 어디서 만들어졌는지 (다른 CDK/SAM/Terraform / 수동?) 확인 필요.

**잠재 이슈:**
- 소유 앱/리포에서 참조 코드 있으면 지금부터 에러 발생 중일 수 있음
- 담당자가 "쓸 예정 있었음" 하면 어떤 스키마로 재생성할지 확인 필요

**다음 행동:**
- driver-app 담당자 확인: "analysis_alert 기능 상태와 소유 리포"
- 사용 예정 없으면 이 항목 종료 (판정 유효)
- 사용 예정 있으면: 소유 IaC 확인 → 재배포 or 수동 재생성

관련: [[aws-ops/2026-07-02-dynamodb-recovery-and-lessons]]

---

## DynamoDB Phase 4 — 활성 4개 On-demand 전환 검토

**상태:** 🟡 트래픽 패턴 분석 후

**대상:** `production_dr_runn`, `production_dr_runn_hist`, `production_dr_runn_status`, `production_dr_runn_status_hst`.

**왜:** PROVISIONED 20 WCU 인데 실사용 평균 0.76 WCU 등 프로비저닝 과다.

**잠재 효과:** 추정 -$20~30/월. On-demand 는 사용량 기반이라 스파이크 있으면 오히려 비쌀 수 있어 반드시 CloudWatch 로 트래픽 패턴 (peak vs baseline) 확인 필요.

**다음 행동:** 각 테이블별 30일 ConsumedRead/WriteCapacityUnits peak/avg 분석 → On-demand 예상 비용 계산 → 이득 확인 후 전환.

전환 명령 (참고): `aws dynamodb update-table --table-name X --billing-mode PAY_PER_REQUEST`

---

## DynamoDB 위치정보 저장 암호화 (OPA 실태점검 대응)

**상태:** ✅ 완전 종료 (2026-07-19) — dev+production 배포, 익일 새벽 익스포트 검증까지 전부 완료. 남은 건 OPA 제출용 캡쳐뿐 (규제 대응 — 비용 항목 아님)

**진행:**
- 2026-07-18 dev 4개 테이블 SSE→KMS(AWS 관리형) 전환 완료 및 검증 완료(AppSync mutation/query 왕복 테스트까지 통과). 상세 [[aws-ops/2026-07-17-dynamodb-location-encryption-audit#6-실행-결과--옵션-a-dev-배포-2026-07-18]].
- 2026-07-18 production `detect-stack-drift` 완료 — 13개 리소스 드리프트지만 전부 ProvisionedThroughput/MinCapacity 등 **용량 숫자**뿐(Auto Scaling + 레거시 용량 크론에 의한 정상 동적 관리), 구조적 드리프트 0건.
- 2026-07-18 `cdk diff --context stage=production`(change set 기준)으로 재확인 — **용량 관련 변경은 없음.** CloudFormation은 직전 템플릿 대비 실제 바뀐 속성만 반영하므로, 이번처럼 `encryption`만 추가한 배포는 드리프트 난 용량을 안 건드림(처음엔 "리셋된다"고 오판했다가 정정). 상세 [[aws-ops/2026-07-17-dynamodb-location-encryption-audit#7-production-드리프트-점검-결과-2026-07-18]].
- **배포 타이밍:** 오늘 저녁 배포 예정. 용량 리스크는 없는 것으로 확인됐으나, 주말 저트래픽 타이밍은 일반적인 안전 관행으로 유지.
- **추가 발견:** `iac_ddb_alert`/`iac_ddb_runn_analysis`(analysis_alert 계열, 위경도 포함)도 동일하게 `encryption` 옵션 누락. 현재 해당 테이블은 라이브로 존재하지 않아 당장 영향 없음 — 재배포 결정 시([[#dynamodb-analysis_alert-계열-5개-phase-2-3-잔여]]) 같이 처리 필요. 상세 [[aws-ops/2026-07-17-dynamodb-location-encryption-audit#10-추가-발견--iac_ddb_alertiac_ddb_runn_analysis도-동일-gap-2026-07-18]].
- OPA 제출용 캡쳐 방법/주의사항은 [[aws-ops/2026-07-17-dynamodb-location-encryption-audit#8-opa-제출용-증빙-캡쳐-방법-production-적용-후에만-유효]] 참조 — production 배포 완료로 이제 캡쳐 유효.
- **제출기한(2026-07-17) 경과 인지 상태** — 사용자가 기한이 지난 뒤 이 건을 인지했음을 확인(2026-07-18). 배포/제출은 그대로 진행하되 기한 경과 자체는 별도 리스크로 남음(OPA 커뮤니케이션 필요 여부는 ps_aws 위키 범위 밖, docs 프로젝트 쪽에서 트래킹).

**대상:** `production_dr_runn`, `production_dr_runn_hist` (기사 GPS 위경도 원본). `SSEDescription: null` = AWS 소유 키 기본 암호화만 적용, 필드 레벨 암호화 없음. scan 결과 lat/lng 평문 확인됨.

**왜:** OPA 2026년도 실태점검 1차에서 "위치정보 저장 암호화 미흡" 판정, 2차 보완자료 제출기한 2026-07-17. 상세 조사 [[aws-ops/2026-07-17-dynamodb-location-encryption-audit]], 소비자 확장 조사 [[aws-ops/2026-07-18-dynamodb-stream-consumer-audit]].

**확인된 소비자 4곳** (암호화 변경 전 전부 영향 점검 필요):
1. AppSync (iac_ddb_runn) — `custom-appsync-role-{stage}`, 실시간 R/W
2. driver-runn-cron Lambda — ⚠️ 하드코딩 Access Key로 PITR 기반 야간 Export to S3
3. infra ddb_status Lambda — WCU 조정, 암호화 무관
4. iac_shuttle_analytics (Managed Flink) — Streams 직접 구독, **현재 정지 상태(의도됨, 2026-07-18 확인)**

**옵션:**
- A) SSE를 AWS 관리형 KMS 키로 전환 — 온라인 무중단, 앱 코드 변경 없음. 단 위 1)~4) 소비자의 KMS 권한 영향 **미검증** (Flink는 재가동 전에만 확인하면 됨, 지금은 정지 상태라 안전). 콘솔 조회 시 평문 노출 자체는 안 풀림.
- B) 필드 레벨(lat/lng) 암호화 — AppSync가 Lambda 없이 JS 리졸버로 DynamoDB에 직접 연결된 구조라, JS 런타임에 crypto 미지원 시 리졸버를 Lambda 데이터소스로 바꾸는 아키텍처 변경까지 필요할 수 있음(미검증). 기사 앱 쓰기 경로, 실시간 조회 API, Glue ETL(stlog5) 동시 수정 필요. 당일 완료 불가로 판단, OPA 제출은 "진행 중 + 목표일" 소명 방향 논의 중.

**다음 행동:**
- [x] `driver-tracking-api-production` 스택 `detect-stack-drift` 실행 완료 → 구조적 드리프트 없음, 용량 드리프트뿐이고 이번 배포와는 무관함 확인
- [x] `cdk diff --context stage=production` 실행 완료 → SSESpecification 4개만, 안전
- [x] production 배포 실행 (2026-07-18 21:37 KST)
- [x] 배포 후 driver-runn-cron 야간 export 정상 동작 확인 (2026-07-19 01:00 KST) — S3/Athena/데이터 무결성 전부 확인
- [ ] iac_shuttle_analytics(Flink) 재가동 계획이 생기면 그 전에 `FlinkRole`의 KMS 권한 선확인
- [ ] analysis_alert 계열 재배포 결정 시 `iac_ddb_alert`/`iac_ddb_runn_analysis`에도 `encryption` 옵션 추가
- [ ] production 캡쳐 → OPA 2차 제출 문서 첨부, 제출 문구 확정
- [ ] 옵션 B 착수 여부/완료 목표일 결정 → OPA 2차 제출 문구 확정

---

## cron_serv/driver-runn-cron 하드코딩 AWS 액세스 키 — 소유자 특정 완료

**상태:** 🟡 사용자 결정 대기 (보안 — 회전/IAM Role 전환 필요)

**대상:** `~/sl/cron_serv`, `~/psapp/serv/cron_serv`, `~/psapp/cron/driver-runn-cron`의 12개 이상 파일에 AWS Access Key/Secret이 하드코딩.

**왜:** khj.dev 오프보딩([[aws-ops/2026-07-18-khj-dev-offboarding]]) 조사 중 실제 키 ID로 전수 검색해서 소유자 특정:
- `AKIAUOUWAIC4676HY4KB` = **kimps** (`runnstatus/handler.ts`, `runnstatus/eventBridge.ts`)
- `AKIAUOUWAIC46JCDIJF6` = **fart86** (`infra/config.ts`, `board/aws.ts`, `evtgateway/aws.ts`, `watch/*`, **`runn/S3Export.ts`(위치정보 야간 익스포트)**, `runn/athena.ts`, `runn/s3.ts`, `driver-runn-cron` 4개 파일 등 12곳 이상)
- `AKIAUOUWAIC4WUMHB5VD` = **email** (`cron-common/SendEmailService.ts`)

fart86은 `AdministratorAccess` 보유 — 위치정보 DynamoDB export 파이프라인이 이 계정 키로 동작 중이라는 뜻.

**잠재 효과:** 장기 자격증명 하드코딩은 유출 시 계정 전체 장악 위험. IAM Role 기반(Lambda 실행 역할)으로 전환하는 게 표준.

**다음 행동:**
- 각 Lambda(driver-runn-cron 등)를 실행 역할(IAM Role) 기반으로 전환 — 코드에서 `accessKeyId`/`secretAccessKey` 하드코딩 제거
- 전환 전까지는 최소한 해당 키 로테이션 주기 확인
- `fart86`이 실제 활성 서비스 계정인지, 아니면 이 계정도 정리 대상인지 확인 필요(khj.dev처럼 콘솔 로그인은 오래전(2018)이라 사람 사용은 아닌 것으로 보이나 액세스키는 활발히 쓰임 — 서비스 계정으로 판단됨)

---

## 루트 계정 일상 IAM 작업 사용 관행 점검 필요

**상태:** 🟡 사용자 결정 대기 (보안 관행)

**대상:** AWS 루트(root) 계정.

**왜:** [[aws-ops/2026-07-19-iam-grant-revoke-cloudtrail-audit]]에서 OPA 5번(관리자 계정 소명) 소명용 부여·말소 이력을 CloudTrail 원본 로그로 조사하던 중 발견. `jejen205`에게 `AdministratorAccess`를 신규 부여(2026-06-17 11:32 KST)하고, `khj.dev` 퇴사자 계정 1차 정리(2026-05-26 16:01~16:03 KST)를 수행한 주체가 **둘 다 루트 계정**이었음. GuardDuty의 "루트 자격증명 사용" 낮음등급 경고 2건(ConsoleLogin, DescribeRegions)이 바로 이 시점들과 일치.

**잠재 효과:** 루트 MFA는 활성화, 액세스키는 미발급 상태(`AccountAccessKeysPresent: 0`)라 키 유출 등 즉각적인 심각 리스크는 아님. 다만 일상적 IAM 변경(그룹 편입, 정책 연결)을 관리자 개인 계정이 아닌 루트로 수행하는 관행 자체가 문제 — 누가/왜 루트로 로그인했는지 감사 추적이 IAM 사용자 기반보다 약하고, 루트는 통상 계정 생성·결제설정 등 최소 용도로만 써야 함이 AWS 권고.

**다음 행동:**
- 06-17, 05-26 루트 로그인 주체 확인(콘솔 로그인 이력 대조, 담당자 확인)
- 재발 방지책 검토: 루트 로그인 시 즉시 알림(Slack/Telegram), 또는 루트 자격증명 자체를 물리적으로 접근 어렵게 보관
- OPA 제출본에는 기재하지 않기로 결정(2026-07-19) — 별도 사내 보안 이슈로 트래킹

---

## (참고) 완료된 작업

- ✅ 2026-06-01 VPC/EC2/SG/EIP/ENI/AMI/Snapshot/Glue/DataZone 정리 → [[aws-ops/2026-06-01-vpc-ec2-cleanup]]
- ✅ 2026-06-02 Lambda@Edge 7개 정리 → [[aws-ops/2026-06-02-lambda-edge-cleanup]]
- ✅ 2026-06-02 KMS + madmin StackSet 폐기 → [[aws-ops/2026-06-02-kms-madmin-cleanup]]
- ✅ 2026-06-03 read replica AZ 이동 → [[aws-ops/2026-06-03-read-replica-az-migration]]
- ✅ 2026-06-04 msdeveloper S3 라이프사이클 (-$114/월 실측) → [[aws-ops/2026-06-04-msdeveloper-s3-lifecycle]]
- ✅ 2026-06-04 API Gateway execution log 2개 정리 → [[aws-ops/2026-06-04-apigw-exec-log-cleanup]]
- ✅ 2026-06-16 dev-admin-* 17개 distribution 에 admin-fe-request-dev 일괄 연결 → [[aws-ops/2026-06-16-cloudfront-admin-function-attach]]
- ✅ 2026-07-01 Pinpoint MobileHub 잔재 앱 2개 삭제 → [[aws-ops/2026-07-01-pinpoint-mobilehub-cleanup]]
- ✅ 2026-07-01 msdeveloper STD 30→7일 단축 (-$40/월 예상) → [[aws-ops/2026-07-01-msdeveloper-s3-lifecycle-shorten]]
- ✅ 2026-07-01 DynamoDB drv_runn_*_production 5개 삭제 (-$25/월) → [[aws-ops/2026-07-01-dynamodb-drv-runn-cleanup]]
- ✅ 2026-07-02 DynamoDB dev 4개 오삭제 복구 및 재발 방지 (순 절감 -$34/월) → [[aws-ops/2026-07-02-dynamodb-recovery-and-lessons]]
