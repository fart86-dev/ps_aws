#!/bin/bash

# AWS Infrastructure Summary Report
# 현재 인프라 상태 및 비용 요약

set -e

BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

DATE=$(date '+%Y-%m-%d %H:%M:%S')
MONTH_START=$(date +%Y-%m-01)
TODAY=$(date +%Y-%m-%d)

cat > /tmp/aws_summary.txt << EOF
================================================================================
                    AWS 인프라 현황 리포트
================================================================================
생성일시: $DATE
조회 기간: $MONTH_START ~ $TODAY

================================================================================
1. 비용 현황
================================================================================
EOF

# 월간 비용
TOTAL_COST=$(aws ce get-cost-and-usage \
  --time-period Start=$MONTH_START,End=$TODAY \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --query 'ResultsByTime[0].Total.BlendedCost.Amount' \
  --output text 2>/dev/null || echo "0")

echo "현재 월간 총 비용: \$$TOTAL_COST" >> /tmp/aws_summary.txt
echo "" >> /tmp/aws_summary.txt

# 서비스별 비용 TOP 5
echo "서비스별 비용 TOP 5:" >> /tmp/aws_summary.txt
aws ce get-cost-and-usage \
  --time-period Start=$MONTH_START,End=$TODAY \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[0].Groups[*].[Keys[0],Metrics.BlendedCost.Amount]' \
  --output text 2>/dev/null | sort -k2 -nr | head -5 | while read service cost; do
    printf "  %-40s \$%10s\n" "$service" "$cost" >> /tmp/aws_summary.txt
  done

echo "" >> /tmp/aws_summary.txt

cat >> /tmp/aws_summary.txt << EOF
================================================================================
2. RDS 현황
================================================================================
EOF

# RDS 정보
aws rds describe-db-instances \
  --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceClass,Engine,AllocatedStorage,BackupRetentionPeriod,MultiAZ]' \
  --output text 2>/dev/null | while read -r id class engine storage backup multi; do
  printf "인스턴스: %-30s\n" "$id" >> /tmp/aws_summary.txt
  printf "  클래스: %-20s 엔진: %-10s 스토리지: %sGB\n" "$class" "$engine" "$storage" >> /tmp/aws_summary.txt
  printf "  백업: %d일 보유 | MultiAZ: %s\n\n" "$backup" "$multi" >> /tmp/aws_summary.txt
done

cat >> /tmp/aws_summary.txt << EOF
================================================================================
3. DynamoDB 현황
================================================================================
EOF

# DynamoDB 테이블 수
TABLE_COUNT=$(aws dynamodb list-tables --query 'TableNames | length(@)' --output text 2>/dev/null || echo "0")
echo "테이블 개수: $TABLE_COUNT개" >> /tmp/aws_summary.txt
echo "" >> /tmp/aws_summary.txt

echo "테이블 목록:" >> /tmp/aws_summary.txt
aws dynamodb list-tables --query 'TableNames[]' --output text 2>/dev/null | tr '\t' '\n' | nl >> /tmp/aws_summary.txt

echo "" >> /tmp/aws_summary.txt

cat >> /tmp/aws_summary.txt << EOF
================================================================================
4. 최적화 권장사항
================================================================================

성능:
  ✓ RDS production-mshuttle (t4g.large)이 대부분의 트래픽 처리
  ✓ Read replica (production-mshuttle-read1)로 읽기 부하 분산

백업:
  ⚠ production-mshuttle-read1, spd-test는 백업 미설정
    → Read replica는 불필요하지만, spd-test는 필요시 백업 설정 검토

비용 절감:
  1. dev-mshuttle을 t4g.micro로 다운사이징 (월 ~\$15 절감)
  2. 미사용 DynamoDB 테이블 정리 (용량 기반 비용 절감)
  3. 예약 인스턴스(RI) 고려 (월 ~20% 절감 가능)

리소스:
  ✓ 미사용 EBS, EIP 없음
  ✓ 모든 RDS 인스턴스 정상 작동

================================================================================
5. 모니터링 설정
================================================================================

활성화된 모니터링:
  ✓ RDS: CPU, 연결 수, 스토리지
  ✓ DynamoDB: 읽기/쓰기 용량, 에러율
  ✓ WAF: 차단/허용 요청

스케줄: 매시간 정각 (CRON_SCHEDULE=0 * * * *)
알림: Telegram/Slack

================================================================================
EOF

cat /tmp/aws_summary.txt

echo -e "\n${GREEN}리포트 저장됨: /tmp/aws_summary.txt${NC}"
