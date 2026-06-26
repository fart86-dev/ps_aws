---
type: aws-op
date: 2026-06-02
account: "306331009209"
region: ap-northeast-2
category: [kms, cloudformation-stackset, iam, s3]
impact: -$1/월 (2026-07-02 KMS 영구 삭제 후 확정)
status: done-pending-kms
---

# 2026-06-02 · KMS 인벤토리 + madmin 프로젝트 폐기

ap-northeast-2 KMS 키 21개의 실제 과금 구조 파악 후 madmin 관련 잔재(StackSet 2개 + CFN Stack 3개 + IAM 4개 + KMS 1개 + S3 1개) 일괄 폐기.

---

## 1) 배경 & 오해 정정

초기 추정 "KMS 키 21개 × $1 = -$21/월" 은 **오해**. 실제 과금 구조:

| KeyManager | 개수 | 과금 |
|---|---|---|
| AWS (`aws/*` 별칭 가려진 default 키) | 19개 | **무료** |
| Customer | 2개 | 키당 $1/월 |

→ 실제 절감 대상 **2개**, 잠재 효과 **-$2/월**.

### Customer-managed 키 2개

| Key ID | Alias | Description | 결정 |
|---|---|---|---|
| `ad2436d2-...` | `test_key_1` | "키 테스트" (2021-03-04) | **보류** (사용자 결정) → [[../aws-pending#kms-test_key_1]] |
| `c01008c7-...` | - | `madmin-infrastructure` StackSet 소유 (2021-10-23) | **폐기 (이번 작업)** |

## 2) 점검 (madmin 폐기 결정 근거)

| 점검 항목 | 결과 |
|---|---|
| 90일 KMS 암호화 호출 | 0건 (Security Hub 자동 점검 외) |
| madmin ECR 저장소 | **이미 수동 삭제됨** (StackSet 드리프트) |
| S3 pipeline 아티팩트 | 2021-10-23 deploy 파일 4개 (6.8KB), 4년 6개월 무변동 |
| madmin 관련 CodePipeline / ECS / Lambda | 없음 |
| madmin2exam StackSet | instance 0개 (한 번도 배포 안 됨) |

### 사전 안전 점검

| 항목 | 결과 |
|---|---|
| IAM Role 외부 참조 (다른 StackSet 에서 가정) | 없음. madmin/madmin2exam 전용 |
| S3 4개 파일 보존 가치 | 없음. CDK custom resource Lambda 빌드 아티팩트 |
| KMS 즉시 삭제 위험 | pending window 30일로 복구 안전망 확보 |

## 3) 실행 (5단계, 단계별 검증)

> TODO(질문): 각 단계에서 쓴 실제 `aws cloudformation delete-stack-instances` / `delete-stack-set` / `delete-stack` / `schedule-key-deletion` 명령 전문 보존 안 됨. #todo

표준 형태:

```bash
# Step 1: StackSet instance 삭제 (S3 비우기 → instance 삭제)
# StackSet instance 가 KMS PendingDeletion / S3 버킷 삭제 / Bucket Policy 삭제 까지 한 번에 처리
aws s3 rm s3://<madmin-pipeline-bucket>/ --recursive
aws cloudformation delete-stack-instances \
  --stack-set-name madmin-infrastructure \
  --regions ap-northeast-2 \
  --accounts 306331009209 \
  --no-retain-stacks

# Step 2: StackSet 삭제
aws cloudformation delete-stack-set --stack-set-name madmin-infrastructure

# Step 3: madmin2exam StackSet 삭제 (instance 0개라 즉시)
aws cloudformation delete-stack-set --stack-set-name madmin2exam-infrastructure

# Step 4: madmin-infrastructure-roles CFN 스택 삭제 (IAM Role 2개 제거)
aws cloudformation delete-stack --stack-name madmin-infrastructure-roles

# Step 5: madmin2exam-infrastructure-roles CFN 스택 삭제 (IAM Role 2개 제거)
aws cloudformation delete-stack --stack-name madmin2exam-infrastructure-roles
```

KMS 키는 Step 1 의 StackSet instance 삭제와 함께 자동으로 PendingDeletion 상태로 전환 (30일 window).

## 4) 결과

5단계 모두 ✅ 성공.

### 삭제된 리소스 (총 12개)

- StackSet 2개, CFN Stack 3개
- IAM Role 4개 (`madmin-adminrole`, `madmin-executionrole`, `madmin2exam-adminrole`, `madmin2exam-executionrole`)
- KMS Key 1개 (`c01008c7-...`, PendingDeletion → **2026-07-02 영구 삭제**)
- S3 Bucket 1개, S3 Bucket Policy 1개

### 복구 (Pending window 안)

만약 잘못 삭제했다면 영구 삭제 전까지 복구 가능:
```bash
aws kms cancel-key-deletion --key-id c01008c7-...
```

→ 2026-07-02 까지가 마지막 복구 기회.

## 5) 영향

| 시점 | 효과 |
|---|---|
| 즉시 (2026-06-02) | Customer-managed KMS 2 → 1 |
| 확정 (2026-07-02 이후) | **-$1/월** |

## 6) 후속

- **KMS pending window 종료 모니터링**: 2026-07-02. 영구 삭제 후 -$1/월 확정. → [[../aws-pending#madmin-kms-pending-window]]
- **KMS `test_key_1` 처리**: 5년 무사용 테스트 키. 보류 상태. 진행 시 schedule-key-deletion 으로 -$1/월. → [[../aws-pending#kms-test_key_1]]
