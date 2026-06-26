---
type: aws-inventory
category: cloudfront
account: "306331009209"
region: us-east-1
last_verified: 2026-06-16
status: active
---

# CloudFront dev-admin-* Distribution 및 Function 연결 현황

dev 환경 admin 프론트엔드 CloudFront Distribution 과 CloudFront Function 연결 상태.

조회/갱신 명령은 [[../aws-runbooks/cloudfront-function-attach]] 참조.

---

## CloudFront Functions (admin 전용, dev 스테이지)

| Function | Stage | Runtime | LastModified | 용도 |
|---|---|---|---|---|
| `admin-fe-request-dev` | LIVE | cloudfront-js-2.0 | 2026-02-10 | viewer-request 단계에서 admin FE 요청 가공 |
| `admin-fe-response-dev` | LIVE | cloudfront-js-2.0 | 2026-02-25 | viewer-response 단계에서 admin FE 응답 가공 |

> staging/production 동등 함수는 별도 존재 (`admin-fe-request-staging`, `admin-fe-request-production` 등).
> production 의 `admin-fe-response-production` 은 [[protected-resources#4-cloudfront-admin-fe-response-function-association]] — 절대 변경 금지.

---

## dev-admin-* Distribution 17개 · Function 연결 현황

| # | Distribution ID | Comment | Alias | req-dev | res-dev |
|---:|---|---|---|:---:|:---:|
| 1 | E23FOHA3I3WJ5V | dev-admin-console | console.mosher.co.kr | ✅ | ✅ |
| 2 | E33WR5QDEHNJRP | dev-admin-drvcontr | drvcontr.mosher.co.kr | ✅ | ❌ |
| 3 | E16HW5A2AVMAVW | dev-admin-qt | admin-qt.mosher.co.kr | ✅ | ✅ |
| 4 | E23LDX6E0OLEDA | dev-admin-rt | admin-rt.mosher.co.kr | ✅ | ✅ |
| 5 | E758DNDPQOYO7 | dev-admin-dr | admin-dr.mosher.co.kr | ✅ | ✅ |
| 6 | E30P3JTZNQBOUL | dev-admin-etc | admin-etc.mosher.co.kr | ✅ | ❌ |
| 7 | E2LNAHQY2V4X7I | dev-admin-bizmanager | admin-bizmanager.mosher.co.kr | ✅ | ❌ |
| 8 | E2RK8RNT3BQULZ | dev-admin-drcal | admin-drcal.mosher.co.kr | ✅ | ✅ |
| 9 | E1SL9QI648KY10 | dev-admin-rtmaker | admin-rtmaker.mosher.co.kr | ✅ | ✅ |
| 10 | E1DU50E44GQV1G | dev-admin-indct | admin-indct.mosher.co.kr | ✅ | ✅ |
| 11 | E1A0KS1TUIAQHX | dev-admin-cald | admin-cald.mosher.co.kr | ✅ | ❌ |
| 12 | E1FGCFBYJSLSVN | dev-admin-dev | admin-dev.mosher.co.kr | ✅ | ❌ |
| 13 | E23NP9QVJCUV70 | dev-admin-docs | admin-docs.mosher.co.kr | ✅ | ❌ |
| 14 | E3QE9CBS3LMBBE | dev-admin-msgmanager | admin-msgmanager.mosher.co.kr | ✅ | ✅ |
| 15 | E1QHOAFRVLCLF9 | dev-admin-task | admin-task.mosher.co.kr | ✅ | ✅ |
| 16 | E1DK1ZZPO38ODT | dev-admin-mstour | admin-mstour.mosher.co.kr | ✅ | ✅ |
| 17 | E3GP36CXL66ELO | dev-admin-psn | admin-psn.mosher.co.kr | ✅ | ✅ |

- req-dev = `admin-fe-request-dev` 연결 여부 (DefaultCacheBehavior 기준)
- res-dev = `admin-fe-response-dev` 연결 여부 (DefaultCacheBehavior 기준)

### 요약

| 항목 | 개수 | 비고 |
|---|---:|---|
| 총 dev-admin-* distribution | 17 | |
| `admin-fe-request-dev` 연결됨 | 17 | **전체 적용 완료 (2026-06-16)** |
| `admin-fe-response-dev` 연결됨 | 10 | |
| `admin-fe-response-dev` 미연결 | 7 | drvcontr, etc, bizmanager, cald, dev, docs (※ dr/rtmaker/msgmanager/mstour/psn 는 연결됨) |

## 관련

- 적용 이력: [[../aws-ops/2026-06-16-cloudfront-admin-function-attach]]
- 작업 절차: [[../aws-runbooks/cloudfront-function-attach]]
- 보호 자원: [[protected-resources]]
