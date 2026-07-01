---
type: aws-op
date: 2026-07-01
account: "306331009209"
region: us-east-1
category: [pinpoint, mobilehub, cleanup]
impact: 잔재 정리 (비용 절감 없음)
status: done
---

# 2026-07-01 · Amazon Pinpoint MobileHub 잔재 앱 2개 삭제

AWS Health 메일 (Pinpoint 2026-10-30 서비스 종료 안내) 을 계기로 계정 내 Pinpoint 리소스 점검. 확인 결과 2018년 (지금은 폐기된) AWS MobileHub 가 자동 생성한 껍데기 앱 2개만 존재 → 즉시 삭제.

---

## 1) 확인된 리소스

| App Name | App ID | 리전 | 생성일 | 활성 채널 |
|---|---|---|---|---|
| `pstest20180731202212_MobileHub` | `3760bdda4afc4a928c2895f10f2f0126` | us-east-1 | 2018-07-31 | IN_APP (Version 0) |
| `pstest20180820220220_MobileHub` | `6ade7988b018441db8658fa23ea94afc` | us-east-1 | 2018-08-20 | IN_APP (Version 0) |

ap-northeast-2 / ap-northeast-1 / ap-southeast-1 / us-west-2 / eu-west-1 은 0건.

---

## 2) 미사용 판정 근거 (3중 검증)

- **앱 설정**: 태그·설명 없음. name/id/CreationDate 만.
- **캠페인 / 세그먼트 / 여정 / 템플릿**: 전부 0.
- **Event stream**: 두 앱 모두 `NotFoundException` (분석 파이프라인 미연결).
- **활성 채널**: IN_APP 만 `Enabled: true, Version: 0` — MobileHub 기본값이며 "설정 저장된 적 없음" 상태. Email/SMS/Push/APNs/FCM 전부 미설정.
- **CloudTrail 최근 90일**:
  - `mobiletargeting.amazonaws.com` 이벤트: **0건**
  - `pinpoint.amazonaws.com` 이벤트: 2026-07-01 조사 시점의 read-only 조회 (`kimps` 사용자, aws-cli) 만 존재. 실서비스 호출 없음.
- **코드 참조**: `llm-wiki/`, `src/`, `scripts/` 어디에도 pinpoint / mobiletargeting 문자열 없음.

→ 2018년 MobileHub 가 남긴 껍데기. 8년간 어떤 클라이언트도 사용 안 함.

---

## 3) 실행

```bash
aws pinpoint delete-app \
  --application-id 3760bdda4afc4a928c2895f10f2f0126 \
  --region us-east-1

aws pinpoint delete-app \
  --application-id 6ade7988b018441db8658fa23ea94afc \
  --region us-east-1
```

두 호출 모두 삭제된 앱의 `ApplicationResponse` 를 반환.

**검증:**
```bash
aws pinpoint get-apps --region us-east-1
# → { "ApplicationsResponse": { "Item": [] } }
```

---

## 4) AWS Health 메일 대응 결과

| Pinpoint 기능 | 사용 여부 | 대체 서비스 필요? |
|---|---|---|
| Engagement (endpoint/segment/campaign/journey) | 사용 안 함 | 불필요 |
| 이벤트 수집 / 모바일 분석 | 사용 안 함 | 불필요 |
| 이메일 발송 | Pinpoint 로는 사용 안 함 (SES 는 별도로 이미 프로덕션 운영) | 이관 대상 아님 |
| In-App messaging | 껍데기만 켜져 있음 | 삭제로 해소 |

→ **마이그레이션 필요 없음**. 2026-10-30 서비스 종료와 무관하게 이번에 잔재 정리 완료.

---

## 5) 참고

- Pinpoint 서비스 종료 공지: 2026-10-30 (AWS Health Dashboard 원본 메일)
- 참고 문서: <https://docs.aws.amazon.com/console/pinpoint/migration-guide>
- 관련 기록: [[aws-inventory/protected-resources]] 에는 영향 없음 (Pinpoint 는 보호 자원 목록 밖).
