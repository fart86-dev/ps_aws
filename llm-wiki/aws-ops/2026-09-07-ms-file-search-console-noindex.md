---
type: aws-op
date: 2026-09-07
account: "306331009209"
region: us-east-1 (CloudFront) / ap-northeast-2 (S3)
category: [cloudfront, s3, seo]
impact: 응답 헤더 추가 (트래픽/비용 영향 없음)
status: done
---

# 2026-09-07 · ms-file.modooshuttle.com Search Console "내용 없이 색인 생성" 조사 및 noindex 처리

## 1) 배경

Google Search Console 이 `https://ms-file.modooshuttle.com/` 에 대해 "내용 없이 페이지 색인이 생성됨" 보고. 사용자가 S3 `ms-file` 버킷 속성/연결 리소스 변경 이력을 문의하며 발견.

## 2) 조사 결과

**속성 변경 이력**: `ms-file` 버킷 자체는 CloudTrail 90일 조회 기준 최근 변경 이벤트 없음(`LookupEvents` ResourceName 조회 0건). 다만 현재 설정(정책으로 `Principal:"*"` GetObject 전체 공개 허용, Public Access Block 4개 항목 전부 false)은 S3 기본 생성 상태가 아니므로 **과거 어느 시점엔 변경된 것은 확실** — 단, 90일 이전이라 이 계정의 Event History 로는 시점/주체 특정 불가 (Athena 장기 로그 조회 필요).

**연결 리소스 (`ms-file.modooshuttle.com` 기준)**:
- Route53 CNAME `ms-file.modooshuttle.com` → `d3ql7gj9jbdsmo.cloudfront.net` (hosted zone `Z29J5GDPJSSCIE`)
- CloudFront `E304FNZHY2JE32` (prod) — Origin: S3 `ms-file.s3.ap-northeast-2.amazonaws.com`, OriginPath `/prod`, `LastModifiedTime: 2024-10-29`
- (참고) `E3L626A6YER0YP` (dev, `ms-file.mosher.co.kr`) — 같은 버킷, OriginPath `/dev`, `LastModifiedTime: 2024-10-29`

CloudTrail 90일 조회 결과 위 리소스(distribution 2개, Route53 zone, S3 버킷) 전부 이벤트 0건 → **최근 2개월 사이 변경 없음**.

**근본 원인 (구조적, 최근 변경 아님)**: CloudFront `DefaultRootObject` 가 비어 있어 `/` 요청이 origin path 그대로 S3 키 `prod/` 로 전달됨. 이 키는 S3 콘솔이 자동 생성하는 **0바이트 디렉터리 마커 객체** (`ContentType: application/x-directory`, `LastModified: 2023-09-26`). 즉 `/` 요청이 200 OK + 빈 본문을 반환 → GSC 의 "색인은 되나 내용 없음" 증상과 정확히 일치. 2023년부터 존재하던 구조이며, 구글이 뒤늦게 크롤링/색인한 것으로 판단.

## 3) 조치

`ms-file` 은 문서/이미지/폰트 저장용 파일 CDN이라 애초에 검색 노출이 불필요 → prod 배포 전체 응답에 `X-Robots-Tag: noindex, nofollow` 헤더를 붙여 검색엔진 색인을 차단.

- CloudFront Response Headers Policy 신규 생성: `ms-file-noindex` (Id: `c054ddb4-e079-4219-9672-0d31f68eaee5`), Custom Header `X-Robots-Tag: noindex, nofollow` (Override)
- prod 배포 `E304FNZHY2JE32` 의 `DefaultCacheBehavior.ResponseHeadersPolicyId` 에 연결 → `UpdateDistribution` 실행, `Status: InProgress`

dev 배포(`E3L626A6YER0YP`, `ms-file.mosher.co.kr`)는 이번 조치 범위에서 제외 (요청 범위 아님).

## 4) 후속

- [ ] 배포 전파 완료 후 `curl -I https://ms-file.modooshuttle.com/` 로 `X-Robots-Tag` 헤더 반영 확인
- [ ] GSC 는 재크롤링 후 반영 — 급하면 Search Console에서 URL 삭제(제거) 요청 병행 가능
- [ ] dev 배포에도 동일 조치 필요 여부는 사용자 판단 대기
- [ ] S3 정책의 과거 변경 시점/주체가 필요해지면 CloudTrail Athena 쿼리로 장기 이력 조회 필요 (90일 Event History 초과)
