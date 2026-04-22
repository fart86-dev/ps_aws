#!/bin/bash

# AWS Resource Optimization Check
# 사용되지 않거나 최적화 가능한 리소스 식별

set -e

BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${BLUE}=== AWS 리소스 최적화 분석 ===${NC}\n"

# 1. RDS 인스턴스 상세 분석
echo -e "${BLUE}[1] RDS 인스턴스 상세 분석${NC}"
aws rds describe-db-instances \
  --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceClass,Engine,StorageType,AllocatedStorage,DBInstanceStatus,MultiAZ]' \
  --output text | while read -r id class engine storage alloc status multi; do
  echo -e "${YELLOW}$id${NC}"
  echo "  클래스: $class | 엔진: $engine | 스토리지: ${storage}(${alloc}GB) | 상태: $status | MultiAZ: $multi"
done

echo ""

# 2. RDS 느린 쿼리 로그 확인
echo -e "${BLUE}[2] RDS 자동 백업 정책${NC}"
aws rds describe-db-instances \
  --query 'DBInstances[*].[DBInstanceIdentifier,BackupRetentionPeriod,PreferredBackupWindow]' \
  --output table

echo ""

# 3. DynamoDB 상세 정보
echo -e "${BLUE}[3] DynamoDB 테이블 상세 정보${NC}"
aws dynamodb list-tables --query 'TableNames[]' --output text 2>/dev/null | while read table; do
  INFO=$(aws dynamodb describe-table --table-name "$table" 2>/dev/null)
  STATUS=$(echo "$INFO" | jq -r '.Table.TableStatus')
  SIZE=$(echo "$INFO" | jq -r '.Table.TableSizeBytes')
  ITEMS=$(echo "$INFO" | jq -r '.Table.ItemCount')
  READ_CAP=$(echo "$INFO" | jq -r '.Table.BillingModeSummary.BillingMode // "PROVISIONED"')

  SIZE_MB=$((SIZE / 1024 / 1024))
  echo -e "${YELLOW}$table${NC} (상태: $STATUS)"
  echo "  크기: ${SIZE_MB}MB | 항목: $ITEMS | 결제 모드: $READ_CAP"
done

echo ""

# 4. Lambda 함수 목록
echo -e "${BLUE}[4] Lambda 함수 정보${NC}"
aws lambda list-functions --query 'Functions[*].[FunctionName,Runtime,LastModified,CodeSize]' --output table 2>/dev/null || echo "Lambda 함수 없음"

echo ""

# 5. EC2 인스턴스
echo -e "${BLUE}[5] EC2 인스턴스 정보${NC}"
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name,LaunchTime]' \
  --output table 2>/dev/null | head -20 || echo "EC2 인스턴스 없음"

echo ""

# 6. 사용 중지된 리소스
echo -e "${BLUE}[6] 사용 중지된 리소스${NC}"

echo -e "${YELLOW}중지된 EC2 인스턴스:${NC}"
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=stopped" \
  --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,StateTransitionReason]' \
  --output table 2>/dev/null || echo "  없음"

echo ""

# 7. 비용 최적화 추천
echo -e "${BLUE}[7] 비용 최적화 추천${NC}"
echo -e "${YELLOW}권장사항:${NC}"
echo "  1. RDS dev-mshuttle을 t4g.micro로 다운사이징 검토"
echo "  2. DynamoDB 테이블 중 사용량 0인 테이블 정리 검토"
echo "  3. 미사용 EBS 스냅샷 확인 및 삭제"
echo "  4. S3 버킷 스토리지 정책 검토 (이전 버전 삭제 등)"

echo ""
echo -e "${GREEN}=== 분석 완료 ===${NC}"
