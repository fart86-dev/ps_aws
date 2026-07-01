---
type: aws-op
date: 2026-07-01
account: "306331009209"
region: ap-northeast-2
category: [s3, lifecycle, glacier]
impact: -$40/월 (예상, 실측은 24~48h 후)
status: done
follow_up: monitoring
---

# 2026-07-01 · msdeveloper 라이프사이클 STD 30일 → 7일 단축

[[aws-ops/2026-06-04-msdeveloper-s3-lifecycle]] 로 -$114/월 확보했으나 이후 dump 크기 증가 (2.7GB → 3.1GB/개) + DB 성장으로 msdeveloper 가 다시 ~$83/월 규모로 재복귀. 시간당 dump 는 사용자 실수 복구용으로 필수라 빈도는 유지, 대신 Standard 보관창을 단축해 추가 절감.

---

## 1) 배경

지난달 정책 등록 후 한 달 실측 (2026-07-01 기준):

| 지표 | 지난달 | 이번달 |
|---|---|---|
| 총 용량 | 4.52 TB | 7.8 TiB |
| STD | 0.73 TB | 2.4 TB |
| GLACIER | 3.79 TB | 6.0 TB |
| dump 크기 | 2.7 GB/개 | 3.1 GB/개 |
| msdeveloper 월 비용 | $32 | ~$83 |

원인: DB 성장에 따라 hourly dump 자체가 커짐. 정책은 정상 동작 중.

## 2) 대안 검토

시간당 dump 유지 전제하에:

| 안 | msdeveloper 예상 | 코멘트 |
|---|---|---|
| 유지 (30 STD / 120일 expire) | $83 | 현행 |
| **7 STD / 120일 expire** | **$43** | 채택 |
| 3 STD / 120일 expire | $37 | 절감 미미, 리스크 상승 |
| Deep Archive 도입 | $50+ | 최소 180일 조건 → 총 보관 늘려야 함 → 오히려 손해 |
| dump 빈도 줄이기 (6h/24h) | $10~20 | 사용자 실수 복구 RPO 요구조건 (≤1h) 위배 → 불가 |

**채택 사유:** 사용자 진술 "생각보다 조회할 일 없음" + 7일 이후는 Glacier 에서 1분~12시간 복원 가능 → 실수 신고 window (통상 24~72h) 커버.

## 3) 실행

변경 diff (30 → 7만 수정, 나머지 동일):

```json
{
  "Rules": [{
    "ID": "mysql-dump-tier-and-expire",
    "Status": "Enabled",
    "Filter": { "Prefix": "db/" },
    "Transitions": [{ "Days": 7, "StorageClass": "GLACIER" }],
    "Expiration": { "Days": 120 }
  }]
}
```

적용:
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket msdeveloper \
  --lifecycle-configuration file://lifecycle.json
aws s3api get-bucket-lifecycle-configuration --bucket msdeveloper  # 확인
```

Glacier 최소 90일 유지 조건 검증: 7 + 113 = 120일 → early deletion fee 없음.

## 4) 예상 영향

### Transition 대상
- 현재 STD 2.4 TB 중 7일 초과분 (~1.9 TB, 약 552개 객체) → Glacier 로 이동
- Transition request fee: 552 × $0.00005 ≈ **$0.03** (1회성)
- 지난번 사례 기준 워커가 수 시간~1일 내 첫 batch 실행

### 안정 상태 (transition 완료 후)

| 항목 | 용량 | 단가 | 월 비용 |
|---|---|---|---|
| Standard (최근 7일치) | 0.52 TB | $0.025/GB | $13 |
| GFR (7~120일치) | 8.4 TB | $0.0036/GB | $30 |
| **합계** | 8.9 TB | - | **$43** |

- 변경 전: $83/월
- 변경 후: $43/월 (예상)
- **예상 절감 -$40/월**

## 5) 후속 검증 (24~48h 후)

**1. 8~30일 사이 객체 storage class 확인**
```bash
aws s3api head-object --bucket msdeveloper \
  --key db/2026-06-20_00:00:01.mosher.sql --query StorageClass
# GLACIER 나오면 성공
```

**2. CloudWatch storage class 별 용량 (익일 반영)**
```bash
aws cloudwatch get-metric-statistics --namespace AWS/S3 --metric-name BucketSizeBytes \
  --start-time "$(date -u -v-2d '+%Y-%m-%dT%H:%M:%SZ')" \
  --end-time "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
  --period 86400 --statistics Average \
  --dimensions Name=BucketName,Value=msdeveloper Name=StorageType,Value=StandardStorage \
  --query 'Datapoints'
# 2.4TB → 0.5TB 로 감소하면 성공
```

**3. 7월 청구서 (8월 초 확인)**: `APN2-TimedStorage-ByteHrs` 감소 / `APN2-TimedStorage-GlacierByteHrs` 증가 정량 확인.

## 6) 롤백

```bash
# 원본 lifecycle 백업본은 세션 tmp 에 있음 (일회성)
# 다시 30일로 되돌리려면:
aws s3api put-bucket-lifecycle-configuration --bucket msdeveloper \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "mysql-dump-tier-and-expire",
      "Status": "Enabled",
      "Filter": { "Prefix": "db/" },
      "Transitions": [{ "Days": 30, "StorageClass": "GLACIER" }],
      "Expiration": { "Days": 120 }
    }]
  }'
```
단, Glacier 로 내려간 객체는 자동 복귀 안 됨 (신규 dump 부터 30일 STD 유지 시작).

## 7) 참고

- 지난 작업: [[aws-ops/2026-06-04-msdeveloper-s3-lifecycle]]
- 이번 절감 상한: 시간당 dump 라는 상수 조건 아래 최대치. 더 짜내려면 dump 압축률 개선 또는 DB 슬림화 등 앱 레벨 변경 필요 (별개 이슈).
- [[aws-inventory/protected-resources#6-msdeveloper-s3-버킷]] `db/` prefix 는 계속 보호 대상.
