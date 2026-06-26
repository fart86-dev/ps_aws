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

## ps_aws 코드에서 이 목록을 어떻게 다루나

- `src/scripts/wafBotControl.ts` 의 `disable` 은 위 (3) 의 "허용 범위" 안에서만 동작 (rule 1개만 제거).
- `src/scripts/rdsStatus.ts` 의 findings 룰은 `production-mshuttle` 에도 같은 finding 을 적용하지만 자동 조치는 안 함 (보고만).
- `src/infra-monitor/waste.ts` 는 RDS/EBS/EC2/EIP/ENI/Snapshot 의 "낭비 후보" 를 보고하지만 운영 자원도 후보로 잡힐 수 있음 → **알림은 통지 목적**, 자동 조치는 절대 없음.

새 자동 조치 코드 / 신규 sweep 스크립트를 추가할 때 위 8개 항목을 자동 제외 리스트에 반드시 포함.
