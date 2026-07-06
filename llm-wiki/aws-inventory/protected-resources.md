---
type: aws-inventory
category: protected
last_verified: 2026-06-25
status: active
---

# 절대 건드리지 마라 — 보호 자원 목록

비용 절감 검토 / 정리 sweep / 자동 컬렉터 어디에서도 **자동 제외**해야 하는 자원.

각 항목마다 "왜 건드리면 안 되는가" 와 "건드릴 수 있는 범위" 를 명시.

---

## 1) AWS Security Hub

**상태:** 활성 유지 (모든 region).

**왜:** 2024-12-28 계정 마비 사건 이후 AWS 측이 해제 조건으로 활성 유지 요구. 비활성 시 다시 마비 위험.

**건드릴 수 있는 범위:**
- ❌ 비활성화 (`disable-security-hub`)
- ⚠️ 표준 (CIS, AWS Foundational) 추가/제거는 사용자 확인 필수
- ✅ Finding 의 workflow status 조정 (suppress/notify 등) 은 허용 — 보안 정책 변경 아님

**ps_aws 코드 영향:** `waste.ts`, `rdsStatus.ts` 의 findings 룰에서 SH 종료를 권고하지 않음. 비용 보고서에서도 SH 비용은 "절감 대상 아님" 표시 필요.

---

## 2) AWS Config

**상태:** 활성 유지 (모든 region).

**왜:** Security Hub 와 같은 사유 (2024-12-28 사건).

**건드릴 수 있는 범위:**
- ❌ Recorder/Delivery Channel 중지
- ⚠️ Recording 범위 축소 (resource type / region) 는 사용자 확인 필수
- ✅ Rule 추가 / 평가 결과 조회 등은 자유

---

## 3) WAF Web ACL (운영 보호용)

**상태:** 활성 유지. 2025-09 공격 대응으로 도입.

| Web ACL Name | ID | Scope | Region | 용도 |
|---|---|---|---|---|
| DEV_PACK_BY_GIMYO | d9603538-...1a5c | CLOUDFRONT | us-east-1 | dev admin/api 보호 |
| PROD_PACK_TEMP | f6ab75c2-...43a0a | CLOUDFRONT | us-east-1 | prod 보호 |

**건드릴 수 있는 범위:**
- ❌ Web ACL 자체 삭제 / Disassociate
- ❌ 관리 그룹 일괄 제거
- ✅ **Bot Control rule 1개만 일시 토글** → `pnpm waf:bot disable --target dev --confirm` ([[../aws-runbooks/waf-bot-control-toggle]])
- ⚠️ 신규 rule 추가는 가능하나 traffic 영향 미리 측정

---

## 4) CloudFront `admin-fe-response-*` Function Association

**상태:** dev / staging / production 의 일부 distribution 에 viewer-response 단계로 연결.

**왜:** admin FE 응답 가공이 운영 의존. 끊으면 admin 화면 깨질 가능성.

**건드릴 수 있는 범위:**
- ❌ 기존 association 제거
- ❌ Function 자체 삭제 (`admin-fe-response-dev`, `-staging`, `-production`)
- ✅ 새 distribution 에 추가 적용은 가능 (작업 절차 [[../aws-runbooks/cloudfront-function-attach]])
- ✅ Function 코드 업데이트 (사용자 확인 후) → publish

**현황표:** [[cloudfront-dev-admin]] 의 res-dev 컬럼 ✅ 가 그 association.

---

## 5) `production-mshuttle` RDS 일가족

| Identifier | Role | 주의 |
|---|---|---|
| `production-mshuttle` | source (writer) | 운영 DB — 무중단 외 변경 금지 |
| `production-mshuttle-read1` | read replica (AZ-2c, 100GB) | 2026-06-03 AZ 이동 완료 |
| `production-mshuttle` 자동 스냅샷 | 7일 retention | 함부로 삭제 금지 |

**건드릴 수 있는 범위:**
- ❌ stop / delete / class downgrade — 사용자 명시 지시 없이는 금지
- ❌ Parameter group `params-production-mysql84` 함부로 변경
- ⚠️ Storage 축소는 dump/restore swap + 무중단 마이그레이션 필요 → [[../aws-runbooks/rds-shrink-migration]] 의 production 섹션
- ✅ 모니터링 메트릭 조회, 정기 점검 (`pnpm rds:status`)

---

## 6) `msdeveloper` S3 버킷

**상태:** mosher 운영 MySQL dump 1시간마다 누적되는 버킷. 라이프사이클 적용됨 ([[../aws-ops/2026-06-04-msdeveloper-s3-lifecycle]]).

**왜:** dump 가 분석/복원 자원. 통째로 비우면 복구 수단 손실.

**건드릴 수 있는 범위:**
- ❌ 버킷 전체 비우기 / 삭제
- ❌ `db/` prefix 손수 삭제 (라이프사이클이 자동 expire 함)
- ❌ versioning 활성 (현재 미사용 — 활성 시 비용 폭증 위험)
- ⚠️ 라이프사이클 정책 수정은 사용자 확인 필수 (30→Glacier, 120일 expire 규칙)
- ✅ `error/`, `csv/`, `app/` 등 다른 prefix 정리는 검토 후 가능 ([[../aws-pending#msdeveloper-기타-prefix-정리]])

---

## 7) `slsv` S3 버킷의 `my-app/` prefix

**상태:** CDK asset 활성 사용 (2025-09-25 갱신).

**왜:** 버킷 내 다른 prefix (`serverless/ussr/`) 는 정리 후보지만 `my-app/` 은 살아있음.

**건드릴 수 있는 범위:**
- ❌ `my-app/` prefix 삭제
- ❌ 버킷 전체 삭제
- ✅ `serverless/ussr/` prefix 정리는 가능 ([[../aws-pending#slsv-serverless-ussr-prefix-정리]])

---

## 8) KMS `test_key_1`

**상태:** Customer-managed CMK, 2021-03-04 생성. 5년 무사용.

**왜:** "보류" 결정 ([[../aws-ops/2026-06-02-kms-madmin-cleanup]]). 사용자 명시 결정 전까지 유지.

**건드릴 수 있는 범위:**
- ❌ `schedule-key-deletion` 자동 실행 금지 (사용자 결정 필요)
- ✅ alias / tags 조회는 자유

---

## 9) rn_drapp Kinesis 로그 파이프라인 (Cognito Identity Pool `drapp42d078e1`)

**상태:** rn_drapp Android 앱이 실사용 (production 포함).

**왜:** `rn_drapp/android/app/src/main/java/com/modooshuttle/drapp/Util/KinesisManager.kt:17` 에 identity pool ID 하드코딩. 앱이 이 pool 로 unauthenticated identity 발급 → Kinesis Firehose 로그 전송. **pool 이름에 `_dev` 가 붙어있지만 dev/production 공용** (stage 분기 없음, Firehose stream 이름만 stage 별로 다름).

**상세 리소스:**

| 리소스 | ID / 이름 | 역할 |
|---|---|---|
| Cognito Identity Pool | `ap-northeast-2:6b0dc290-331e-4a13-9445-038a5c6581d9` (`drapp42d078e1_identitypool_42d078e1__dev`) | credential 발급 진입점 — **rn_drapp 실사용** |
| Cognito User Pool | `ap-northeast-2_DSrE4OBGH` (`drapp42d078e1_userpool_42d078e1-dev`) | 위 IP 의 auth provider 로 client 2개 (`19g22f6ca77vnfrtk3un25tl8c`, `h6vki0u7p3fa5df06p9k55c7j`) 등록. 앱은 user pool 인증 flow 를 안 쓰지만 IP 설정 참조 관계 존재 |
| IAM Role (authenticated) | `amplify-drapp-dev-152044-authRole` | (미사용 flow) |
| IAM Role (unauthenticated) | `amplify-drapp-dev-152044-unauthRole` | rn_drapp guest identity 의 실행 권한 — Firehose:PutRecord |

**건드릴 수 있는 범위:**
- ❌ Identity Pool `6b0dc290` 삭제 — production 앱 Kinesis 로그 파이프라인 즉시 파괴
- ❌ IAM Role `amplify-drapp-dev-152044-{auth,unauth}Role` 삭제
- ❌ User Pool `DSrE4OBGH` 즉시 삭제 — IP 의 CognitoIdentityProvider 설정이 이 pool 의 client 를 참조 중. 정 지우려면 IP 에서 provider 제거 먼저
- ✅ 관련 Lambda `amplify-drapp-dev-152044-UpdateRolesWithIDPFunctio-...` (Node 18) 은 초기 role 세팅용 헬퍼로 판단 → 별도 판정 후 함수만 삭제 가능성 있음 (CFN 관리 대상 여부 사전 확인 필수)

**신형 앱 관계:** rtn_drapp (신형) 에는 이 pool 참조 없음. 신형 앱 완전 이관 시 재검토 대상.

**관련 위키:** [[../aws-ops/2026-07-06-cognito-amplify-audit]] (예정)

---

## ps_aws 코드에서 이 목록을 어떻게 다루나

- `src/scripts/wafBotControl.ts` 의 `disable` 은 위 (3) 의 "허용 범위" 안에서만 동작 (rule 1개만 제거).
- `src/scripts/rdsStatus.ts` 의 findings 룰은 `production-mshuttle` 에도 같은 finding 을 적용하지만 자동 조치는 안 함 (보고만).
- `src/infra-monitor/waste.ts` 는 RDS/EBS/EC2/EIP/ENI/Snapshot 의 "낭비 후보" 를 보고하지만 운영 자원도 후보로 잡힐 수 있음 → **알림은 통지 목적**, 자동 조치는 절대 없음.

새 자동 조치 코드 / 신규 sweep 스크립트를 추가할 때 위 9개 항목을 자동 제외 리스트에 반드시 포함.
