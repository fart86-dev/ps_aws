---
type: aws-op
date: 2026-06-16
account: "306331009209"
region: us-east-1
category: [cloudfront, cloudfront-functions]
impact: 운영 일관성 (비용 영향 없음)
status: done
---

# 2026-06-16 · dev-admin-* 17개 Distribution 에 admin-fe-request-dev Function 일괄 연결

dev admin 프론트엔드 CloudFront Distribution 17개 중 11개에 누락돼 있던 viewer-request 단계의 `admin-fe-request-dev` CloudFront Function 을 일괄 연결.

기존 `admin-fe-response-dev` association 은 그대로 보존 (절대 변경 금지 제약).

---

## 1) 배경

CloudFront Functions (admin 전용, dev 스테이지):

| Function | Stage | Runtime | LastModified | 용도 |
|---|---|---|---|---|
| `admin-fe-request-dev` | LIVE | cloudfront-js-2.0 | 2026-02-10 | viewer-request 단계에서 admin FE 요청 가공 |
| `admin-fe-response-dev` | LIVE | cloudfront-js-2.0 | 2026-02-25 | viewer-response 단계에서 admin FE 응답 가공 |

> staging/production 동등 함수는 별도 존재 (`admin-fe-request-staging`, `admin-fe-request-production` 등).

dev-admin-* Distribution 17개 중 req-dev 연결됐던 것은 6개뿐 → 나머지 11개에 일괄 추가 필요.

## 2) 점검 (작업 전 상태)

| # | Distribution ID | Comment | 이전 req-dev | 이전 res-dev |
|---:|---|---|:---:|:---:|
| 1 | E23FOHA3I3WJ5V | dev-admin-console | ✅ | ✅ |
| 2 | E33WR5QDEHNJRP | dev-admin-drvcontr | ❌ | ❌ |
| 3 | E16HW5A2AVMAVW | dev-admin-qt | ✅ | ✅ |
| 4 | E23LDX6E0OLEDA | dev-admin-rt | ✅ | ✅ |
| 5 | E758DNDPQOYO7 | dev-admin-dr | ❌ | ✅ |
| 6 | E30P3JTZNQBOUL | dev-admin-etc | ❌ | ❌ |
| 7 | E2LNAHQY2V4X7I | dev-admin-bizmanager | ❌ | ❌ |
| 8 | E2RK8RNT3BQULZ | dev-admin-drcal | ✅ | ✅ |
| 9 | E1SL9QI648KY10 | dev-admin-rtmaker | ❌ | ✅ |
| 10 | E1DU50E44GQV1G | dev-admin-indct | ✅ | ✅ |
| 11 | E1A0KS1TUIAQHX | dev-admin-cald | ❌ | ❌ |
| 12 | E1FGCFBYJSLSVN | dev-admin-dev | ❌ | ❌ |
| 13 | E23NP9QVJCUV70 | dev-admin-docs | ❌ | ❌ |
| 14 | E3QE9CBS3LMBBE | dev-admin-msgmanager | ❌ | ✅ |
| 15 | E1QHOAFRVLCLF9 | dev-admin-task | ✅ | ✅ |
| 16 | E1DK1ZZPO38ODT | dev-admin-mstour | ❌ | ✅ |
| 17 | E3GP36CXL66ELO | dev-admin-psn | ❌ | ✅ |

→ req-dev 미연결 11개가 이번 작업 대상.

## 3) 실행 (재사용 절차)

상세 명령은 [[../aws-runbooks/cloudfront-function-attach]] 참고. 요약:

1. `get-distribution-config` → 현재 `DefaultCacheBehavior.FunctionAssociations` 읽기
2. 백업: `cf-backup/${ID}.json` (job tmp 디렉토리)
3. `{EventType: viewer-request, FunctionARN: admin-fe-request-dev}` append
4. 기존 association (특히 `admin-fe-response-dev` viewer-response) 는 그대로 유지
5. `update-distribution --if-match $ETAG` 로 적용 → `Status: InProgress` 반환 (배포 전파 대기)

처리 결과:

| Distribution ID | Comment | 처리 후 |
|---|---|---|
| E33WR5QDEHNJRP | dev-admin-drvcontr | req-dev 추가 |
| E758DNDPQOYO7 | dev-admin-dr | req-dev 추가 (res-dev 보존) |
| E30P3JTZNQBOUL | dev-admin-etc | req-dev 추가 |
| E2LNAHQY2V4X7I | dev-admin-bizmanager | req-dev 추가 |
| E1SL9QI648KY10 | dev-admin-rtmaker | req-dev 추가 (res-dev 보존) |
| E1A0KS1TUIAQHX | dev-admin-cald | req-dev 추가 |
| E1FGCFBYJSLSVN | dev-admin-dev | req-dev 추가 |
| E23NP9QVJCUV70 | dev-admin-docs | req-dev 추가 |
| E3QE9CBS3LMBBE | dev-admin-msgmanager | req-dev 추가 (res-dev 보존) |
| E1DK1ZZPO38ODT | dev-admin-mstour | req-dev 추가 (res-dev 보존) |
| E3GP36CXL66ELO | dev-admin-psn | req-dev 추가 (res-dev 보존) |

## 4) 결과

| 항목 | 개수 | 비고 |
|---|---:|---|
| 총 dev-admin-* distribution | 17 | |
| `admin-fe-request-dev` 연결됨 | 17 | **전체 적용 완료 (2026-06-16)** |
| `admin-fe-response-dev` 연결됨 | 10 | (이번 작업 범위 아님) |
| `admin-fe-response-dev` 미연결 | 7 | drvcontr, etc, bizmanager, cald, dev, docs (※ dr/rtmaker/msgmanager/mstour/psn 는 연결됨) |

상세 현황표는 [[../aws-inventory/cloudfront-dev-admin]].

## 5) 영향

- 비용 변화 없음 (CloudFront Function 은 실행 횟수 과금이라 정량적 차이는 미미)
- 운영 일관성 확보: 17개 모두 viewer-request 단계 함수 적용 (admin FE 요청 가공 동등)

## 6) 롤백 절차 (필요 시)

```bash
# 백업본의 DistributionConfig 를 그대로 적용. 단, ETag 는 현재 값을 새로 받아야 함.
CURR_ETAG=$(aws cloudfront get-distribution-config --id $ID --query ETag --output text)
jq '.DistributionConfig' cf-backup/${ID}.json > rollback.json
aws cloudfront update-distribution --id $ID --if-match $CURR_ETAG \
  --distribution-config file://rollback.json
```

## 7) 후속

- 7개 미연결 distribution 에 `admin-fe-response-dev` 도 추가 적용할지는 별도 결정 필요 (이번 작업 범위 아님).
