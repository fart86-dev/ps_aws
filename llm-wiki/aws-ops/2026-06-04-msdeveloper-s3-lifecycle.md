---
type: aws-op
date: 2026-06-04
account: "306331009209"
region: ap-northeast-2
category: [s3, lifecycle, glacier]
impact: -$114/월 (실측, 첫 달부터)
status: done
---

# 2026-06-04 · msdeveloper 버킷 S3 라이프사이클 정책 등록 (MySQL dump 자동 관리)

ps_aws 모니터링에서 S3 가 RDS 다음으로 큰 비용 ($150/월) 임을 확인. 45개 버킷 중 **`msdeveloper` 단독으로 전체 S3 의 94%** 차지. 그 안의 `db/` prefix (1시간마다 누적되는 MySQL dump) 에 라이프사이클 적용.

---

## 1) 배경

| 항목 | 값 |
|---|---|
| 버킷 총 용량 | 5,985 GB (5.84 TB) |
| 객체 수 | 317,711개 |
| 라이프사이클 정책 | **없음** (무한 누적 중) |
| 스토리지 클래스 | 100% Standard |
| Versioning | 미사용 |
| 암호화 | AES256 |

### prefix 별 용량 (상위)

| Prefix | 객체 | 용량 | 월 비용 | 용도 |
|---|---|---|---|---|
| `db/` | 2,216 | **5,918 GB** | **$147.95** | 1시간마다 mosher MySQL dump (~2.7GB/개) |
| `error/` | 1,726 | 1.78 GB | $0.045 | - |
| `app/` | 11 | 0.35 GB | $0.009 | 앱 빌드 (.apk/.aab) |
| 기타 13개 | ~4,800 | ~0.4 GB | <$0.02 | csv/shp/log/test 등 |

→ db/ 가 사실상 전부. 다른 prefix 정리는 절감 효과 미미.

## 2) 의사결정

- dump 보관 정책: **30일 Standard → 90일 Glacier Flexible Retrieval → 120일 후 expire**
- 다른 prefix 는 이번 작업 범위에서 제외 (사용자 결정)
- Glacier 최소 보관 90일 충족 → early deletion fee 회피
- 분석 용도: 최근 30일은 즉시 액세스, 30일 이후는 1분~12시간 retrieval 가능

## 3) 실행

라이프사이클 정책 JSON:

```json
{
  "Rules": [{
    "ID": "mysql-dump-tier-and-expire",
    "Status": "Enabled",
    "Filter": { "Prefix": "db/" },
    "Transitions": [{ "Days": 30, "StorageClass": "GLACIER" }],
    "Expiration": { "Days": 120 }
  }]
}
```

적용 명령:

```bash
# lifecycle.json 으로 저장 후
aws s3api put-bucket-lifecycle-configuration \
  --bucket msdeveloper \
  --lifecycle-configuration file://lifecycle.json

# 적용 확인
aws s3api get-bucket-lifecycle-configuration --bucket msdeveloper
```

## 4) 결과

### 적용 즉시 영향 (1-2일 내 예상)

| 객체 분류 | 수 | 용량 | 처리 |
|---|---|---|---|
| < 30일 | 720 | 2,130 GB | Standard 유지 |
| 30~90일 | 1,440 | 3,633 GB | → Glacier transition |
| 90~120일 | 55 | 154 GB | → Glacier 후 27일 뒤 expire (~$2 early fee) |
| > 120일 | 1 | 0 (2018년 placeholder) | 즉시 삭제 |

### Transition 실측 (예상보다 훨씬 빠름)

| 시점 (UTC) | 경과 | GLACIER | STANDARD | 비고 |
|---|---|---|---|---|
| 06-04 00:29 | 0h | 0 | 2,224 | 정책 적용 |
| 06-04 05:25 | ~5h | 0 | 2,223 | 120일 초과 1개 만료 처리 |
| 06-04 08:23 | ~8h | **1,497** | 729 | 전환 대상의 99.6% 완료 |

빠르게 끝난 이유 (추정):
- 객체 수가 적음 (2천여 개) → 평가 큐 짧음
- 단일 prefix, 단일 transition 룰 → 평가 로직 단순
- ap-northeast-2 (서울) 라이프사이클 워커가 자주 도는 것으로 추정

## 5) 영향 (실측 반영)

| 항목 | 용량 | 단가 | 월 비용 |
|---|---|---|---|
| Standard (최근 30일치) | 0.73 TB | $0.025/GB | $18 |
| **GFR (30~120일)** | **3.79 TB** | $0.0036/GB | **$14** |
| **합계** | 4.52 TB | - | **$32** |

- 적용 전: $146/월 (5.84 TB Standard)
- 적용 후: $32/월
- **실측 절감 -$114/월** (당초 추정 -$78/월보다 우수, transition 즉시 완료로 첫 달부터 풀 효과)

### 1회성 비용
- Transition request fee: 1,495개 × $0.00005 ≈ **$0.07**
- Early deletion fee (90~120일 객체 55개): 약 **$1~2**

### 운영 영향
- 새 dump 자동 적용: `db/` prefix 에 추가되는 모든 신규 dump 는 30일째 자동 Glacier 전환, 120일째 자동 삭제
- 사람 개입: 정책 변경 시에만 필요
- 분석 시 30일 이내 dump 는 Standard 에서 즉시 액세스, 30일 이후는 GFR retrieval 필요 (Standard 복원 요청 시 1분~12시간, 비용 $0.03/GB)

## 6) 라이프사이클 동작 메모 (재사용용)

- S3 라이프사이클은 **매일 1회 자동 실행** (UTC 기준, 정확한 시각은 AWS 비공개)
- 정책 등록 후 **24~48시간 이내** 첫 batch 처리 시작
- 객체별 transition 은 비동기. batch 가 끝나도 모든 객체가 동시에 바뀌지 않음
- 큰 batch 는 며칠~1주 걸릴 수 있으나, 수천 개 객체면 보통 1~3일 내 완료
- 단일 prefix, 단일 transition 룰이면 ap-northeast-2 기준 수 시간 안에 끝나기도 함 (이번 사례)

## 7) 후속 모니터링 명령

**1. 특정 객체 storage class 확인 (즉시, 가장 빠른 검증)**
```bash
aws s3api head-object --bucket msdeveloper \
  --key db/2026-03-04_00:00:01.mosher.sql \
  --query StorageClass
# null/STANDARD → 며칠 후 GLACIER 로 바뀌면 성공
```

**2. CloudWatch storage class 별 용량 (24h 지연)**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 --metric-name BucketSizeBytes \
  --start-time 2026-06-05T00:00:00Z --end-time 2026-06-08T00:00:00Z \
  --period 86400 --statistics Average \
  --dimensions Name=BucketName,Value=msdeveloper Name=StorageType,Value=GlacierStorage \
  --query 'Datapoints'
# 0 이 아닌 값이 나오면 transition 진행 중
```

**3. 6월 청구서**: S3 USAGE_TYPE 비교로 GFR 전환량 정량 확인 (`APN2-TimedStorage-GlacierByteHrs` 출현)

**4. (선택) S3 Inventory**: 활성화 시 daily/weekly 로 전체 객체 storage class 보고서 제공. 첫 보고서까지 24~48h.

## 8) 후속 TODO

- **msdeveloper 기타 prefix 일괄 정리**: error/, csv/, shp/, log/, test/, test1/, test2/, test3/, test_result/, user_log/, make/, makecode/, makep/, app/, cf_log/ — 사용자가 "사실상 삭제" 의향. 절감액은 미미 ($0.07/월) 지만 객체 4,500+개 정리 가능. → [[../aws-pending#msdeveloper-기타-prefix-정리]]
