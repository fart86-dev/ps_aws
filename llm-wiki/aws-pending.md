---
type: aws-pending
last_updated: 2026-08-18
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

**점검:** 1년간 실사용 거의 0. 2026-07-30 커넥션 실측(14일)으로 재확인: 336시간 중 328시간(97.6%) 완전 0, 비영 시간 8개뿐(전부 Max 1~2).

**⚠️ 신규 발견 (2026-07-30):** `spd-test`만 서비스 관리형 EIP(`54.116.89.109`)로 고정 퍼블릭 IP를 갖고 있음 — 다른 3대는 유동 IP. 고정 IP를 요구하는 것 자체가 "외부 파트너가 화이트리스트로 참조 중"이라는 신호일 수 있음. [[aws-ops/2026-07-30-vpc-rds-privatization-design#6-미해결-질문]] Q3 참조. **RDS 사설화 로드맵 Phase 7에서 spd-test를 건드리기 전에 이 의문을 반드시 해소해야 함.**

**잠재 효과:** TBD (RDS instance 비용이 큼).

**다음 행동:** 사용자가 stop / delete / 유지 결정. 결정 시:
- stop 만: 인스턴스 시간만 절감 (storage 는 계속 과금)
- delete: 완전 절감, 단 복구 불가
- 유지하기로 하면 RDS 사설화 로드맵의 대상에 포함(순서상 dev-mshuttle 다음, production 이전)

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

## cron_serv/driver-runn-cron 하드코딩 AWS 액세스 키 — 규모 재확인 (70개+ 파일, psapp 백엔드 전체)

**상태:** 🔴 규모 확대 확인 — 사용자 결정 대기 (보안 — 회전/IAM Role 전환 필요, 대규모)

**대상 (2026-08-17 재조사로 대폭 확대):** `AKIAUOUWAIC46JCDIJF6`(fart86, `AdministratorAccess`) 기준 grep 결과 **70개 이상 파일**, `~/psapp`와 `~/sl` 양쪽 트리 전체:
- `~/psapp/admin/be/*` — admin-dev-restapi, admin-etc-restapi, admin-rtmake-restapi, admin-channel-restapi, admin-driver-restapi, admin-task-restapi, admin-runngroup-restapi, admin-pay-restapi, admin-runn-restapi, admin-rt-restapi, admin-dispatchcase-restapi, admin-board-restapi, admin-user-restapi, admin-msgmanager-restapi 등 15개+
- `~/psapp/user/be/*` — user-biz-restapi, user-common-restapi, user-make-restapi, user_serv(구세대)
- `~/psapp/serv/cron_serv/*`, `~/psapp/cron/*` — 기존에 파악한 12곳 포함
- `~/sl/*` — 구세대 모노레포(`admin_serv`, `admin_ex_serv`, `cron_serv`, `awsinfra` 등) 동일 키로 전면 오염
- 서비스 범위: RDS start/stop, S3, Kinesis, Athena, Lambda invoke, CloudWatch, WAF, SES(msg) 등 거의 모든 AWS 서비스 접점

**추가 발견:**
- `AKIAUOUWAIC46JCDIJF6` **생성일 2024-12-28** — CLAUDE.md에 기록된 "계정 마비 사고" 당일. 사고 복구 과정에서 발급된 키가 그대로 전 코드베이스에 박힌 것으로 추정(미확인, 추측 표시).
- fart86 소유의 **또 다른 활성 키 `AKIAJY6O2CCORSXENWPQ`(생성 2019-01-13, 7년+)** 존재 — 코드 grep으로는 하드코딩 위치 못 찾음. 별도 orphan 키 정리 후보([[#kms-test_key_1]]류와 유사 패턴, 사용처 확인 필요).
- `~/psapp`, `~/sl` 둘 다 2026-01~08 최근까지 커밋 활발 — **죽은 코드 아님, 실사용 중.**
- `admin-dev-restapi`의 `src/utils/rds.ts`/`file.utils.ts`는 이미 git 커밋됨(`1c2ff0b`) — 다른 리포들도 커밋 여부 개별 확인 필요(미확인).

**왜 원래 항목보다 훨씬 큰가:** 기존 khj.dev 오프보딩 조사([[aws-ops/2026-07-18-khj-dev-offboarding]])는 `cron_serv`/`driver-runn-cron` 범위만 grep했음. 2026-08-17 `admin-dev-restapi` AWS 인증 코드 확인 중 우연히 같은 키를 재발견해 전체 psapp/sl 트리로 grep 범위를 넓혔더니 실제 규모가 12곳이 아니라 70곳+ 이었음.

**키 소유자 원본 정보 (khj.dev 오프보딩 조사, 2026-07-18):**
- `AKIAUOUWAIC4676HY4KB` = **kimps**
- `AKIAUOUWAIC46JCDIJF6` = **fart86** (`AdministratorAccess`, 이번 재조사 대상)
- `AKIAUOUWAIC4WUMHB5VD` = **email**

**잠재 효과:** 장기 자격증명(그것도 `AdministratorAccess`) 하드코딩이 유출 시 계정 전체 장악 위험. 단순 로테이션이 안 되는 이유: `ms_sam` 배포 툴체인이 시크릿을 빌드타임에 webpack `BannerPlugin`으로 번들에 굽는 구조라서, 코드 수정만으론 전파 안 되고 **로테이션 전 전량 재배포 순서를 지켜야** 장애 없음.

**규모 판단 (2026-08-17):** 이건 코드 몇 줄 수정이 아니라 **psapp 백엔드 전체의 AWS 인증 방식을 IAM Role 기반으로 전환하는 별도 프로젝트** 급. RDS 사설화 로드맵(수개월 규모)과 비슷하거나 그 이상. 이 ps_aws 리포 범위 밖 — 별도 프로젝트로 분리 필요.

**다음 행동 (실행은 별도 세션/프로젝트로 분리, 2026-08-17 사용자 결정):**
1. 각 Lambda 실행 역할(IAM Role)에 필요한 권한(RDS/S3/Kinesis/Athena/Lambda invoke/CloudWatch/WAF/SES)이 이미 있는지 확인 → 없으면 부여
2. 70개+ 파일에서 `credentials: { accessKeyId, secretAccessKey }` 블록 제거 → SDK 기본 체인(role 자동 사용)으로 전환 — 패턴이 거의 동일해 codemod 스크립트 일괄 처리 가능해 보임(미검증)
3. 전량 재배포 (기존 배포 아티팩트엔 여전히 평문 키 존재 — 코드 수정만으론 무효)
4. `AKIAUOUWAIC46JCDIJF6` 모든 소비자 role 전환 확인 후 deactivate → 관찰 → delete
5. `AKIAJY6O2CCORSXENWPQ`(7년 orphan) 별도 사용처 확인 후 정리 검토
6. git 히스토리에 남은 평문 키 정리는 우선순위 낮음(로테이션되면 무력화) — 필요 시 리포별 history rewrite

**진행 상황 — `admin-dev-restapi` 파일럿 완료 (2026-08-17, production+dev 스택 모두 배포·검증 끝):**
- IAM 정책 `admin-dev-restapi-rds-dev-control` 생성(`dev-mshuttle` 전용, Describe/Start/Stop만) → `custom-lambda-role-production`과 `custom-lambda-role-dev` 양쪽에 부착 완료. production-mshuttle은 물리적으로 불가.
  - 실제 코드 사용 범위 확인: `controller/rds.ts`가 애초에 `dev-mshuttle`/`staging-mshuttle`만 허용(production 진입 자체가 코드상 불가). `staging-mshuttle`은 이미 폐기되어 미존재 → 실질 대상은 `dev-mshuttle` 하나.
- `src/utils/rds.ts`에서 하드코딩 credentials 블록 제거 → 코드 자체는 문제없었으나, **배포 후 별개의 훨씬 큰 문제(webpack `DefinePlugin`이 `process.env`를 통째로 얼려서 Lambda 기본 자격증명 체인이 깨짐 + 로컬 셸 시크릿 전체가 배포 번들에 유출)를 발견·수정** — 상세 [[aws-ops/2026-08-17-admin-dev-restapi-webpack-credential-chain-fix]], gotcha [[gotchas#awssrc-webpack-defineplugin이-processenv를-통째로-얼려서-lambda-기본-자격증명-체인을-깨뜨림]].
- **최종 결과:** production 배포(04:06:46 UTC) 정상 확인(에러 0건), dev 스택도 동일 정책 부착 후 정상 확인. `dev-mshuttle`이 양쪽 관리자 화면에 정상 표시됨.
- **후속으로 남은 것:**
  - 이 webpack DefinePlugin 패턴이 `admin-etc-restapi` 등 15개+ 리포 공통 보일러플레이트라 전부 영향 가능성 — 아래 신규 항목([[#webpack-defineplugin이-processenv-경유로-로컬-셸-시크릿-전체를-배포-번들에-유출-15개-리포-영향-가능성]]) 참조
  - 나머지 69개+ 파일(fart86 키)은 이 파일럿에서 검증된 패턴(role 권한 확인→부여, credentials 제거, **webpack 시크릿 유출 gotcha 먼저 확인**, 배포 전 로컬 빌드 검증, 다른 변경사항과 분리해서 배포)을 그대로 적용
  - `AKIAUOUWAIC46JCDIJF6` deactivate는 모든 소비자 전환 확인 후(아직 1/70+)
- **추가 (같은 날, 별건):** `admin-dev-restapi`에 신규 기능(`/eventbridge/list`, dispatch-one-time 규칙 조회 API) 추가하면서 같은 패턴(role 권한 확인→최소권한 정책 신설→assume-role 검증→dev 먼저 배포→production 배포) 한 번 더 실증. `admin-dev-restapi-eventbridge-read` 정책 신설, 양쪽 role에 부착. role/정책 전체 인벤토리는 [[aws-inventory/admin-dev-restapi-iam]], 상세 [[aws-ops/2026-08-17-admin-dev-restapi-eventbridge-endpoint]].
- **추가 발견 (2026-08-18):** `~/psapp/cron/driver-runnstatus-cron/src/utils/aws/eventBridge.ts`(및 `~/psapp/serv/cron_serv/packages/runnstatus/src/utils/aws/eventBridge.ts` 동일 파일 추정, 미확인)에 **kimps 키(`AKIAUOUWAIC4676HY4KB`, 2024-12-28 발급)**가 2군데(client 초기화 + cleanup 함수) 하드코딩. fart86 키(70개+ 파일)와 별개의 노출 건 — dispatch-one-time 규칙 정리 실패 원인 조사([[aws-ops/2026-08-18-dispatch-one-time-rule-cleanup-failure-investigation]]) 중 우연히 발견. **일단 기록만, 조치는 안 함.**

---

## webpack DefinePlugin이 process.env 경유로 로컬 셸 시크릿 전체를 배포 번들에 유출 (15개+ 리포 영향 가능성)

**상태:** 🔴 미해결 (2026-08-17 발견, `admin-dev-restapi`만 부분 완화 — AWS_ prefix만 제외, 근본 원인은 그대로)

**대상:** `~psapp`(ps_aws 리포 밖) 의 `admin-*-restapi`/`user-*-restapi` 계열이 공유하는 `webpack.config.cjs` 보일러플레이트. `admin-dev-restapi`, `admin-etc-restapi` 확인됨 — CLAUDE.md에 "동일 보일러플레이트에서 분기"라 적혀있어 **15개+ 리포 전부 같은 구조일 가능성 높음(미검증)**.

**왜:** `getEnvVar()`가 `Object.keys(process.env)`(빌드 실행자의 로컬 셸 환경변수 전체)를 `webpack.DefinePlugin({"process.env": {...}})`으로 번들에 통째로 굽는 구조. 실제 배포된 `admin-dev-restapi` 번들을 열어보니 `GITHUB_TOKEN`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `LINEAR_API_KEY`, `SERVER_KEY_NOTION`, `SERVER_KEY_GEMINI_API_KEY`, `SERVER_KEY_SLACKWEBHOOK_*`, `MYSQL_PASSWORD`, `MONGO_PASSWORD` 등 개발자 로컬 환경의 실제 시크릿 수백 개가 평문으로 배포 번들에 포함돼있었음. 상세 발견 경위 [[aws-ops/2026-08-17-admin-dev-restapi-webpack-credential-chain-fix]], gotcha [[gotchas#awssrc-webpack-defineplugin이-processenv를-통째로-얼려서-lambda-기본-자격증명-체인을-깨뜨림]].

**잠재 효과:** 이 Lambda 코드(`GetFunction`)나 S3 배포 아티팩트(`ms-sam` 버킷)에 접근 권한이 있는 사람/역할이면 누구나 GitHub 토큰, Linear API 키, 각종 서드파티 서비스 키, DB 비밀번호를 평문으로 열람 가능. 배포할 때마다(빌드 실행자가 바뀔 때마다) 내용이 갱신되며 계속 유출됨 — 일회성 사고가 아니라 **구조적으로 매 배포마다 반복**.

**다음 행동:**
1. `admin-etc-restapi` 포함 나머지 admin-*/user-*-restapi 리포 전체가 동일 `getEnvVar()` 패턴인지 확인 (`grep -n "Object.keys(process.env)" webpack.config.cjs`)
2. 확인되면 전체 리포에 근본 fix 적용 — `admin-dev-restapi`에서 검증된 패턴: `process.env`는 안 건드리고 `__BAKED_ENV__` 별도 전역 + 런타임 `Object.assign` 병합 (AWS_ prefix 제외 필수)
3. 이미 배포된 과거 아티팩트(`ms-sam` S3 버킷의 각 리포별 과거 타임스탬프 버전들)에도 이 유출이 누적돼있음 — 라이프사이클/접근 IAM 최소화 필요(운영 DB 평문 자격증명 건과 동일한 성격, [[#운영-db-평문-자격증명-processenv-로깅-사설화와-무관-즉시-조치]] 참조)
4. 유출된 것으로 확인된 개별 시크릿(GITHUB_TOKEN, LINEAR_API_KEY, SERVER_KEY_NOTION, SERVER_KEY_GEMINI_API_KEY 등)은 로테이션 검토 대상 — 실제 악용 여부와 무관하게 노출 자체가 사고

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

## AppSync `RunnUpdateInput`의 미사용 위경도 필드 제거 검토

**상태:** 🟢 진행 준비 완료 (사용자 트리거 대기, 낮은 리스크)

**대상:** `~/iac/iac_ddb_runn/src/graphql/schema.graphql`의 `updateRunn` mutation 입력 타입 `RunnUpdateInput`.

**왜:** [[aws-ops/2026-07-19-location-data-write-path-audit]]에서 OPA 8번(접근사실 자동기록) 소명 준비 중 발견. `production_dr_runn`의 `updateRunn` mutation이 `latitude`/`longitude`/`accuracy` 필드를 입력받도록 정의돼 있고 리졸버도 이를 막지 않아 **API를 직접 호출하면 위치정보 수정이 기술적으로 가능**함. 실사용 코드(3개 admin 리포 전수 확인)는 전부 조회 전용이거나 `endedAt`/`endedBy`만 바꾸는 "강제종료" 뿐이라 이 필드는 현재 어디서도 채워서 호출되지 않는 죽은 경로.

**잠재 효과:** 지금 당장 악용되는 곳은 없지만, API_KEY가 프론트 전체에 공유돼 있어 필드별 권한 분리가 안 되는 상태라 이 필드가 열려있는 것 자체가 불필요한 공격면. 제거하면 "위치정보는 조회 전용, 수정 경로 자체가 없음"을 스키마 레벨에서 보증할 수 있어 OPA 소명에도 유리.

**다음 행동:** `RunnUpdateInput`에서 `latitude`/`longitude`/`accuracy` 제거 → 스키마 배포 → 리졸버(`resolvers/runn/update.ts`)에서 해당 필드 참조 여부 확인 후 정리. dev에서 먼저 검증.

---

## 위치정보 테이블 TTL 180일 변경 — 배포 여부·시점 결정 필요 (긴급도 상향)

**상태:** 🟡 사용자 결정 대기 (코드 수정 완료, 미배포)

**대상:** `production_dr_runn`, `production_dr_runn_hist` DynamoDB 테이블. 소스: `~/iac/iac_ddb_runn/src/resolvers/{runn,runnHist}/insert.ts`.

**왜:** [[aws-ops/2026-07-20-ttl-under-retention-finding-and-fix]] — OPA examiner가 "이용·제공사실 확인자료"로 요구하는 게 바로 이 테이블이고, 법정 성격상 최소 6개월 이상 보관돼야 하는 것으로 보이는데 현재 TTL 7일로는 그 요건을 못 채움. 1차 제출(2026-04) 때는 6개월치 데이터가 있었으나 지금은 없음 — 진행 중인 under-retention 이슈.

**잠재 효과:** TTL을 180일로 늘리면 `production_dr_runn_hist`(고빈도 GPS 원본) 저장 데이터량이 현재 대비 약 26배(7→180일) 증가 — 스토리지 비용 및 테이블 크기 증가 예상, 배포 전 가늠 필요.

**다음 행동:** 배포 여부·시점 결정 → dev 환경 먼저 검증 → production 배포 → OPA 제출본(3번·12번) 텍스트 갱신.

---

## 위치정보 테이블 7일 TTL — 설계 의도 확인 필요

**상태:** 🟡 사용자 결정 대기 (낮은 우선순위, 정보 확인성)

**대상:** `production_dr_runn`, `production_dr_runn_hist`, `production_dr_runn_status`, `production_dr_runn_status_hst`(추정, 미확인).

**왜:** [[aws-ops/2026-07-20-location-data-ttl-auto-purge-discovery]]에서 OPA 12번(파기) 소명 준비 중 재발견. 4개 위치정보 테이블 리졸버(`iac_ddb_runn/src/resolvers/*/insert.ts`)가 전부 `생성시각 + 86400*7`(7일)로 TTL을 계산해서 넣고 있고, 실제로 매일 자동 삭제되고 있음. `runn`/`runnHist`는 확인 완료, `runnStatus`/`runnStatusHst`는 코드 패턴이 같아서 동일할 것으로 추정만 하고 명시적으로 확인은 안 함.

**잠재 효과:** 이 7일이 개인정보보호를 의식한 설계인지, 단순 운영 테이블 정리용으로 우연히 같은 숫자가 쓰인 건지 알 수 없음 — 알아두면 향후 리텐션 정책 변경 시(예: 익스포트 파이프라인 보관기간 조정) 실수로 깨뜨리지 않는 데 도움됨.

**다음 행동:** `runnStatus`/`runnStatusHst` insert 리졸버 TTL 확인. 설계 배경은 아는 사람이 있으면 확인, 없으면 그냥 "현재 동작이 이렇다"로 기록만 유지.

---

## RDS 완전 사설화 로드맵

**상태:** 🟡 설계 완료, Phase 0 착수 승인 대기

**대상:** RDS 4대(`production-mshuttle`, `production-mshuttle-read1`, `dev-mshuttle`, `spd-test`) 전부 `PubliclyAccessible=true`, 보안그룹에 3306/5432가 `0.0.0.0/0`으로 인터넷에 열려 있음.

**왜:** 2026-07-30 계정 점검에서 GuardDuty가 최근 10일간 악성 IP의 실제 포트 스캔 6건 탐지(`Discovery:RDS/MaliciousIPCaller`). Security Hub도 4대 전부 HIGH로 플래그. 사용자가 "완전 사설화"를 목표로 확정, 이번엔 설계 문서까지만 진행.

**핵심 난관:** Lambda 151개 중 145개가 VPC 밖에서 RDS 퍼블릭 엔드포인트로 접속 중 — SG 잠금도 RDS 사설화도 전부 이 145개 이관이 전제 조건. `mssam` 배포 툴체인엔 일괄 VPC 주입 지점이 없고, CI가 없어 배포가 전부 수동. 수개월 규모 작업으로 사용자가 인지·수용.

**로드맵:** Phase 0(관측) → 1(네트워크 신설) → 2(주체 확정+구세대 봉인) → 3(개발자 접근 경로, 하드 게이트) → 4(SG 사문화 규칙 제거) → 5(Lambda 이관, 최대 작업량) → 6(비-Lambda 이관) → **7(RDS 공개 해제, 유일한 다운타임)** → 8(SG 완전 잠금) → 9(선택, 비권장). 상세 [[aws-ops/2026-07-30-vpc-rds-privatization-design]].

**잠재 효과:** 순증 약 +$42~58/월(현재 $626 대비 +7~9%), 인터넷 노출 제거.

**다음 행동:** Phase 0(VPC Flow Logs 활성화) 착수 승인. 되돌리기 쉬움(삭제 1회), 위험 최저.

---

## RDS for MySQL 마이너 버전 지원 종료 (AWS Health 공지, 2026-08-14 수신)

**상태:** ✅ 완료 (2026-08-16)

**대상:** `production-mshuttle`, `production-mshuttle-read1` (둘 다 MySQL 8.4.5, 파라미터 그룹 `params-production-mysql84` 공유, MultiAZ 아님). `dev-mshuttle`(8.4.9)은 해당 없음, `spd-test`는 postgres라 무관.

**왜:** AWS Health 공지 — RDS for MySQL 마이너 버전 8.4.5, 8.4.6, 5.7.44-RDS.20250213/0508/0818이 **2026-10-31 표준 지원 종료**. 계정 실측(2026-08-14)으로 production 2대가 8.4.5임을 확인, 공지 대상에 해당함.

**일정:**
- 2026-10-01~: 해당 마이너 버전으로 신규 인스턴스 생성 불가 (기존 인스턴스는 무관)
- 2026-10-31 이후 예정된 유지관리 기간 중: AWS가 production-mshuttle / read1을 **자동으로** 8.4.8(또는 그 이상)로 강제 업그레이드 — **다운타임 발생**. 선제 조치 없으면 다운타임 시점·방식을 AWS 유지관리 창에 맡기게 됨.

**잠재 효과:** 메이저 버전 변경 아님(8.4.x 내 마이너 업그레이드)이라 호환성 리스크는 낮은 편이나, production 다운타임은 불가피 — 수동 선제 업그레이드로 시점을 통제할지, AWS 자동 업그레이드에 맡길지가 핵심 결정.

**소요 시간 검토 (2026-08-14):** 메이저 버전 변경이 아니라 작업량 자체는 크지 않음. 두 방식의 트레이드오프:
- **인플레이스 업그레이드(`modify-db-instance`):** 실행은 짧지만, 두 인스턴스 모두 `MultiAZ: false`라 적용 시 재부팅에 따른 실다운타임 발생(통상 수 분 단위, 정확한 시간은 실행해봐야 확인 가능). 관건은 트래픽 낮은 시간대 선택.
- **Blue/Green Deployment (AWS 권장):** 전환 순간 다운타임은 훨씬 짧지만(초 단위), green 환경 생성·복제 캐치업·검증까지 준비 시간이 반나절~하루 정도 필요. production 대상이라 롤백 안전망 있는 이쪽이 더 안전.
- **순서:** read replica(`production-mshuttle-read1`)를 source(`production-mshuttle`)보다 먼저(또는 같이) 올리는 게 일반적 권장 순서.
- **시급성 낮음:** 지원 종료(2026-10-31)까지 약 2.5개월 여유 — 지금 당장 서두를 필요는 없음.

**결정 (2026-08-16):** 인플레이스 업그레이드로 진행. dev-mshuttle이 8.4.9로 오래 안정적으로 운영된 이력을 8.4.x 라인 검증 근거로 판단, Blue/Green 없이 바로 진행하기로 함. 실행 시점은 **오늘밤~내일 새벽**(사람이 적은 시간대) — 사용자가 해당 시간대면 다운타임 영향 충분히 낮다고 판단.

**결과 (2026-08-16 실행):** 양쪽 다 8.4.9로 업그레이드 완료. 실다운타임 — replica 약 2분 37초, source 약 2분 20초. 절차·이벤트 로그 [[aws-ops/2026-08-16-rds-mysql-minor-version-upgrade]] 참조. 스냅샷 `production-mshuttle-pre-8-4-9-upgrade-2026-08-16`은 1~2주 안정화 후 정리 여부 결정 필요.

---

## 운영 DB 평문 자격증명 · process.env 로깅 (사설화와 무관, 즉시 조치)

**상태:** 🔴 즉시 조치 필요 (사설화 로드맵보다 급함)

**대상:**
- `~/psapp/cron/driver-runn-cron/handler.ts:21-27`, `~/psapp/cron/common-validate-cron/handler.ts:21`, `~/psapp/serv/cron_serv/packages/{runn,validate}/handler.ts`, `~/sl/cron_serv/packages/{runn,validate}/handler.ts` — 운영 read1 호스트 + RDS 마스터 계정(`admin`) + **평문 패스워드**가 git에 커밋
- 15개 파일에서 `console.log("process.env: ", process.env)` — 빌드타임에 주입된 전 시크릿이 매 호출마다 CloudWatch로 덤프

**왜:** 2026-07-30 RDS 사설화 설계 조사 중 발견. `ms_sam` 배포 툴체인이 시크릿을 런타임이 아니라 빌드타임에 webpack `BannerPlugin`으로 번들에 굽는 구조라, 시크릿 갱신만으로는 전파되지 않고 전량 재배포가 필요함. 상세 [[aws-ops/2026-07-30-vpc-rds-privatization-design#8-사설화와-무관하게-즉시-처리할-보안-항목]].

**잠재 효과:** RDS 마스터 계정 평문이 git 히스토리 + `ms-sam` S3 버킷의 모든 과거 배포 아티팩트에 영구 잔존. 로그그룹 접근 권한만 있으면 전 시크릿 열람 가능.

**다음 행동:**
1. `production-mshuttle` 마스터 패스워드 로테이션 — **단, 로테이션 전에 모든 소비자 재배포 준비를 마쳐야 함** (순서 잘못 잡으면 장애)
2. 애플리케이션 전용 최소권한 MySQL 계정 신설
3. 하드코딩 6곳 제거 → `process.env` 경유로 통일
4. `console.log(process.env)` 15개 파일 제거
5. `ms-sam` S3 버킷 접근 IAM 최소화 + 라이프사이클로 구 아티팩트 만료

---

## CloudShell 홈 디렉토리 삭제 예정 (ap-northeast-2, 120일 미사용)

**상태:** ⏳ 2026-08-25 시한 (AWS Health 공지, 2026-08-16 수신)

**대상:** ap-northeast-2 리전에서 CloudShell을 110일+ 미사용한 사용자들의 CloudShell 홈 디렉토리(개인 스토리지). 대상 사용자 목록은 Health Dashboard "Affected Resources" 탭(콘솔 전용, API 조회 불가 — Business/Enterprise 지원 플랜 필요, RDS Health 조회 때와 동일 제약).

**왜:** AWS가 120일 미사용 CloudShell 홈 디렉토리를 2026-08-25에 자동 삭제 예정. 저장된 개인 스크립트/파일이 있으면 유실.

**잠재 효과:** 낮음 — RDS/DynamoDB 등 실제 데이터 자산과 무관한 개인 스토리지. 이 계정 작업 방식이 로컬 CLI/aws-mcp 위주라 ap-northeast-2 CloudShell에 중요한 걸 저장해둔 사람이 있을 가능성 낮다고 판단(2026-08-16).

**다음 행동:**
- 콘솔에서 Health Dashboard "Affected Resources" 확인 → 실제로 저장해둔 게 있는 사용자 있으면 2026-08-25 전에 해당 계정으로 CloudShell 한 번 실행(삭제 취소됨)
- 아무도 안 쓰는 것 같으면 별도 조치 없이 흘려보내도 무방

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
- ✅ 2026-08-16 RDS for MySQL 마이너 버전 인플레이스 업그레이드 8.4.5 → 8.4.9 (AWS Health 지원종료 대응) → [[aws-ops/2026-08-16-rds-mysql-minor-version-upgrade]]
