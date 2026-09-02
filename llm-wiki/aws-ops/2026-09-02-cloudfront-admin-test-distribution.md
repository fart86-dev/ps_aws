---
type: aws-op
date: 2026-09-02
account: "306331009209"
region: us-east-1
category: [cloudfront]
impact: 신규 자원 생성 (dev/test 용도, 비용 영향 미미)
status: done
---

# 2026-09-02 · production-admin-drvcontr 설정을 복제해 신규 CloudFront Distribution 생성

`production-admin-drvcontr` (`E3H054W7ITS1QP`) 의 설정을 그대로 복제해 신규 Distribution 생성. Origin 경로와 대체 도메인만 변경.

---

## 1) 배경

`https://7m2vfsjd66mvqxylg3vaf6pc6y0hvkjs.lambda-url.ap-northeast-2.on.aws/` (Slack Events 수신 Lambda, [[../aws-ops/2026-09-02-lambda-lookup]] 별건 조사와는 무관) 조사 이후, 사용자가 별도로 admin 프론트엔드용 신규 CloudFront distribution 생성 요청.

원본으로 지정한 `E3H054W7ITS1QP` 는 dev-admin-* 17개 목록([[../aws-inventory/cloudfront-dev-admin]])에 속하지 않는 **production** distribution (`production-admin-drvcontr`, `drvcontr.modooshuttle.com`).

## 2) 원본 설정 (E3H054W7ITS1QP)

| 항목 | 값 |
|---|---|
| Comment | `production-admin-drvcontr` |
| Alias | `drvcontr.modooshuttle.com` |
| Origin | S3 `admin.modoo.s3.ap-northeast-2.amazonaws.com`, OriginPath `/drvcontr` |
| OAI | `origin-access-identity/cloudfront/E4GT3Q7TDT32L` |
| CloudFront Function | `admin-fe-response-production` (viewer-response) |
| CachePolicy | 관리형 CachingOptimized (`ac122819-...`) |
| CustomErrorResponse | 403 → `/index.html` 200 |
| ACM 인증서 | `*.modooshuttle.com` (us-east-1, ISSUED) |
| WAF | 없음 |
| PriceClass | All, HTTP/2, IPv6 |

S3 버킷 `admin.modoo` 정책 확인: `arn:aws:s3:::admin.modoo/*` 전체에 대해 위 OAI 로 GetObject 허용 — prefix 별 별도 정책 불필요.

## 3) 변경한 항목

- Comment: `production-admin-drvcontr` → `production-admin-test`
- OriginPath: `/drvcontr` → `/test`
- Alias: `drvcontr.modooshuttle.com` → `admin-test.modooshuttle.com` (사용자 지정)
- CallerReference: 신규 UUID

나머지 전부 동일 (OAI, Function 연결, CachePolicy, CustomErrorResponse, 인증서, WAF, PriceClass).

**주의:** `admin-fe-response-production` Function 연결은 [[../aws-inventory/protected-resources#4-cloudfront-admin-fe-response-function-association]] 보호 항목 — "새 distribution 에 추가 적용"은 허용 범위이나 사용자에게 최종 확인 받고 진행.

## 4) 실행 결과

```
CreateDistribution → Id: E3W54LLJ0M7SFV
DomainName: d2qzb9axi7zh9z.cloudfront.net
Status: InProgress (배포 전파 3~10분)
Aliases: ["admin-test.modooshuttle.com"]
```

## 5) 후속 (사용자 작업)

- [ ] DNS: `admin-test.modooshuttle.com` → `d2qzb9axi7zh9z.cloudfront.net` CNAME 등록 (사용자 직접)
- [ ] S3 `admin.modoo/test/` prefix 는 현재 비어있음 — 실제 빌드 산출물 업로드 필요
