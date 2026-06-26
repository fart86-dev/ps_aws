---
type: aws-pending
last_updated: 2026-06-25
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

## (참고) 완료된 작업

- ✅ 2026-06-01 VPC/EC2/SG/EIP/ENI/AMI/Snapshot/Glue/DataZone 정리 → [[aws-ops/2026-06-01-vpc-ec2-cleanup]]
- ✅ 2026-06-02 Lambda@Edge 7개 정리 → [[aws-ops/2026-06-02-lambda-edge-cleanup]]
- ✅ 2026-06-02 KMS + madmin StackSet 폐기 → [[aws-ops/2026-06-02-kms-madmin-cleanup]]
- ✅ 2026-06-03 read replica AZ 이동 → [[aws-ops/2026-06-03-read-replica-az-migration]]
- ✅ 2026-06-04 msdeveloper S3 라이프사이클 (-$114/월 실측) → [[aws-ops/2026-06-04-msdeveloper-s3-lifecycle]]
- ✅ 2026-06-04 API Gateway execution log 2개 정리 → [[aws-ops/2026-06-04-apigw-exec-log-cleanup]]
- ✅ 2026-06-16 dev-admin-* 17개 distribution 에 admin-fe-request-dev 일괄 연결 → [[aws-ops/2026-06-16-cloudfront-admin-function-attach]]
