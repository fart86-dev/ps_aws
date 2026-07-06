---
type: aws-pending
last_updated: 2026-07-01
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
