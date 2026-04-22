#!/bin/bash

# AWS Cost Analysis Script
# 현재 월간 비용과 서비스별 비용 분석

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== AWS 인프라 비용 분석 ===${NC}\n"

# 오늘 날짜
TODAY=$(date +%Y-%m-%d)
# 이번 달 첫 날
MONTH_START=$(date +%Y-%m-01)

echo -e "${YELLOW}조회 기간: $MONTH_START ~ $TODAY${NC}\n"

# 1. 전체 비용 조회
echo -e "${BLUE}[1] 현재 월간 비용${NC}"
TOTAL_COST=$(aws ce get-cost-and-usage \
  --time-period Start=$MONTH_START,End=$TODAY \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --query 'ResultsByTime[0].Total.BlendedCost.Amount' \
  --output text 2>/dev/null || echo "0")

echo -e "총 비용: ${GREEN}$$TOTAL_COST${NC}\n"

# 2. 서비스별 비용 조회
echo -e "${BLUE}[2] 서비스별 비용 TOP 10${NC}"
aws ce get-cost-and-usage \
  --time-period Start=$MONTH_START,End=$TODAY \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[0].Groups[*].[Keys[0],Metrics.BlendedCost.Amount]' \
  --output table 2>/dev/null | head -15 || echo "비용 데이터를 조회할 수 없습니다"

echo ""

# 3. RDS 비용
echo -e "${BLUE}[3] RDS 상세 정보${NC}"
aws rds describe-db-instances \
  --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceClass,Engine,DBInstanceStatus]' \
  --output table 2>/dev/null || echo "RDS 정보를 조회할 수 없습니다"

echo ""

# 4. DynamoDB 비용
echo -e "${BLUE}[4] DynamoDB 테이블 정보${NC}"
aws dynamodb list-tables \
  --query 'TableNames[]' \
  --output text 2>/dev/null | while read table; do
    ITEM_COUNT=$(aws dynamodb describe-table --table-name "$table" --query 'Table.ItemCount' --output text 2>/dev/null)
    SIZE=$(aws dynamodb describe-table --table-name "$table" --query 'Table.TableSizeBytes' --output text 2>/dev/null)
    SIZE_MB=$((SIZE / 1024 / 1024))
    echo "  - $table: $ITEM_COUNT items, ${SIZE_MB}MB"
  done || echo "DynamoDB 테이블을 조회할 수 없습니다"

echo ""

# 5. 미사용 리소스 확인
echo -e "${BLUE}[5] 미사용 리소스 확인${NC}"

# 미사용 EBS 볼륨
echo -e "${YELLOW}미사용 EBS 볼륨:${NC}"
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[*].[VolumeId,Size,CreateTime]' \
  --output table 2>/dev/null | head -10 || echo "  - 조회 불가"

echo ""

# 미사용 탄력 IP
echo -e "${YELLOW}미사용 탄력 IP:${NC}"
aws ec2 describe-addresses \
  --filters Name=association-id,Values=none \
  --query 'Addresses[*].[PublicIp,AllocationId]' \
  --output table 2>/dev/null || echo "  - 없음"

echo ""
echo -e "${GREEN}=== 분석 완료 ===${NC}"
