---
type: aws-op
date: 2026-07-02
account: "306331009209"
region: ap-northeast-2
category: [dynamodb, incident, recovery, iac]
impact: -$34.32/월 (당초 -$52 대비 -$17 회수, 부분 복구)
status: done
related: [[2026-07-01-dynamodb-drv-runn-cleanup]]
---

# 2026-07-02 · DynamoDB dev 테이블 오삭제 복구 및 재발 방지

전일 [[2026-07-01-dynamodb-drv-runn-cleanup]] 에서 Phase 2/3 로 9개 테이블을 추가 삭제. 그 중 4개가 **CDK 스택 (`~/iac/iac_ddb_runn`) 관리 대상** 이었음을 배포 사후에 확인. 사용자 지적으로 IaC 확인 후 4개 복구 완료.

---

## 1) 문제

- Phase 3 dev 6개 중 4개 (`dev_dr_runn`, `dev_dr_runn_hist`, `dev_dr_runn_status`, `dev_dr_runn_status_hst`) 가 IaC 관리 대상
- CDK 스택명: `driver-tracking-api-dev`
- CDK 코드 위치: `~/iac/iac_ddb_runn/schema/tables/*.ts`
- 삭제 결과: CloudFormation drift `DRIFTED` (8개 리소스 DELETED 감지)

**놓친 지점:** 삭제 판단 시 `grep -rn` 을 `ps_aws` 리포에만 실행. IaC 리포 존재 여부를 사전 확인 안 함.

## 2) 복구 시도 순서

### 시도 A: `cdk deploy --force` — **실패**
- CFN 스택 상태 (`UPDATE_COMPLETE`) 는 리소스 존재 인식. drift 감지 별개.
- CDK deploy 는 template 변경분만 반영. AppSync Resolver asset S3 timestamp 만 업데이트되고 DynamoDB 재생성 안 됨.

### 시도 B: CLI `create-table` 로 직접 재생성 — **성공**
CDK 정의를 그대로 참조해서 AWS CLI 로 재현. CFN 은 이름 매칭으로 자기 리소스로 인식.

## 3) 재현 스키마 (CDK 정의 그대로)

### `dev_dr_runn`
```bash
aws dynamodb create-table --table-name dev_dr_runn \
  --attribute-definitions AttributeName=date,AttributeType=S AttributeName=runn_id,AttributeType=S \
  --key-schema AttributeName=date,KeyType=HASH AttributeName=runn_id,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=20 \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --tags Key=Stage,Value=dev Key=Service,Value=driver-tracking-api Key=ManagedBy,Value=cdk
aws dynamodb update-time-to-live --table-name dev_dr_runn \
  --time-to-live-specification "Enabled=true,AttributeName=ttl"
```

### `dev_dr_runn_hist` (GSI 포함)
```bash
aws dynamodb create-table --table-name dev_dr_runn_hist \
  --attribute-definitions \
    AttributeName=runn_hist_id,AttributeType=S \
    AttributeName=created_at,AttributeType=S \
    AttributeName=runn_id,AttributeType=S \
  --key-schema AttributeName=runn_hist_id,KeyType=HASH AttributeName=created_at,KeyType=RANGE \
  --global-secondary-indexes 'IndexName=runnId,KeySchema=[{AttributeName=runn_id,KeyType=HASH},{AttributeName=created_at,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=10,WriteCapacityUnits=20}' \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=20 \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --tags Key=Stage,Value=dev Key=Service,Value=driver-tracking-api Key=ManagedBy,Value=cdk
aws dynamodb update-time-to-live --table-name dev_dr_runn_hist \
  --time-to-live-specification "Enabled=true,AttributeName=ttl"
```

### `dev_dr_runn_status`, `dev_dr_runn_status_hst` (Stream 없음)
```bash
# status
aws dynamodb create-table --table-name dev_dr_runn_status \
  --attribute-definitions AttributeName=date,AttributeType=S AttributeName=status_id,AttributeType=S \
  --key-schema AttributeName=date,KeyType=HASH AttributeName=status_id,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=3,WriteCapacityUnits=3 \
  --tags Key=Stage,Value=dev Key=Service,Value=driver-tracking-api Key=ManagedBy,Value=cdk

# status_hst
aws dynamodb create-table --table-name dev_dr_runn_status_hst \
  --attribute-definitions AttributeName=status_hst_id,AttributeType=S AttributeName=created_at,AttributeType=S \
  --key-schema AttributeName=status_hst_id,KeyType=HASH AttributeName=created_at,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=3,WriteCapacityUnits=3 \
  --tags Key=Stage,Value=dev Key=Service,Value=driver-tracking-api Key=ManagedBy,Value=cdk
```
+ TTL 활성화 각각

## 4) 데이터 복원

`dev_dr_runn_status` 만 19 items 백업 존재 → batch-write-item 으로 재적재.

```bash
# 백업: ~/aws-backups/2026-07-02-dev_dr_runn_status.json (1.4 MB)
# 25개씩 청킹 후 aws dynamodb batch-write-item
```

## 5) CFN 스택과 sync

1. CLI 로 만든 리소스에는 `ManagedBy=cdk` 태그 누락 → drift `MODIFIED`
2. `aws dynamodb tag-resource --resource-arn <arn> --tags Key=ManagedBy,Value=cdk` 로 태그 추가
3. drift 재감지 → **DynamoDB 4개 전부 IN_SYNC**

## 6) 잔존 drift (별도 이슈)

`AppSync::FunctionConfiguration` 4개가 `FunctionVersion [REMOVE]` 로 MODIFIED. 이는 CDK template 에는 옛 VTL 방식 속성이 남아있고 실제는 APPSYNC_JS 로 동작하는 상태. **이번 사고 이전부터 존재하던 drift** 로 판단. → `iac_ddb_runn` 리포 별도 이슈로 이관.

## 7) 실질 절감액 재계산

| 항목 | 삭제분 | 복구분 | 순 절감 |
|---|---|---|---|
| Phase 1 (drv_runn_*_production 5개) | -$25.00 | 0 | -$25.00 |
| Phase 2 (production analysis_alert 3개) | -$5.58 | 0 | -$5.58 |
| Phase 3 CDK 관리 dev 4개 | -$17.32 | +$17.32 | 0 |
| Phase 3 dev analysis_alert 2개 (CDK 밖) | -$3.72 | 0 | -$3.72 |
| **합계** | -$51.62 | +$17.32 | **-$34.30/월** |

## 8) 교훈 (재발 방지)

1. **IaC 리포 존재 여부는 삭제 판단 사전 필수 체크리스트**. `~/iac/`, `~/cdk/`, `~/terraform/` 등 흔한 위치 우선 검색.
2. `grep -rn` 을 대상 리포에만 하면 놓친다. 최소 홈 디렉토리 IaC 계열 위치까지 확인.
3. **DeletionProtection 걸린 자원은 삭제 판단 재고 신호.** 자동 해제 후 진행하지 말고 왜 걸려있는지 조사.
4. CloudFormation 이 관리하는 리소스 여부는 `aws cloudformation list-stack-resources --stack-name <추정>` 또는 리소스 태그 (`aws:cloudformation:stack-name`) 로 즉시 확인 가능. 삭제 전 태그 확인이 저비용 안전장치.
5. **비용 관점 프레이밍의 위험성.** dev/test 인프라는 "지금 안 씀 = 앞으로도 안 씀" 이 아님. 삭제 대안 (내용만 지우기 / On-demand 전환 / 유지) 을 명확히 나열하고 선택하도록 해야 함.

## 9) 이전 위키 정정

[[2026-07-01-dynamodb-drv-runn-cleanup]] 의 판정 "이전 세대 잔재" 는 Phase 1 5개에만 정확. Phase 2/3 는:
- Phase 2 3개: CDK 밖, 실제 미사용 (판정 유효)
- Phase 3 4개: **CDK 관리 대상 (판정 오류)** → 복구됨
- Phase 3 2개 (analysis_alert): CDK 밖 (판정 유효)

이 노트가 그 정정.
