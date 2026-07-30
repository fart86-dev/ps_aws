---
type: aws-op
date: 2026-07-20
account: "306331009209"
region: ap-northeast-2
category: [dynamodb, compliance, security]
impact: 비용 아님 — OPA 실태점검 12번 대응, 잠재적 법정 최소보관 미달 이슈
status: in-progress
related: [[../aws-ops/2026-07-20-location-data-ttl-auto-purge-discovery]]
---

# 2026-07-20 · TTL 7일이 "확인자료" 법정 최소 보관기간에 미달할 수 있음 — 코드 수정(미배포)

## 배경

[[../aws-ops/2026-07-20-location-data-ttl-auto-purge-discovery]]에서 `production_dr_runn`/`production_dr_runn_hist`가 생성 후 7일 뒤 TTL로 자동 삭제됨을 확인, "파기가 잘 되고 있다"는 좋은 소식으로만 기록했었음. 그런데 이용약관상 "5년"으로 잘못 적혀있던 문제(OPA 3번)를 정리하던 중, **"이용·제공사실 확인자료"가 정확히 무엇을 가리키는지** 재확인하다가 반대 방향의 문제를 발견.

## 발견

1차 제출본(`~/ps/docs/1차 제출본/(2026년) 실태점검표...pdf`, 17p) 증빙자료를 보면 "이용·제공사실 확인자료"로 제출된 스크린샷 제목이 **"테이블: production_dr_runn"** — 즉 examiner가 요구하는 "확인자료"의 실체는 바로 이 DynamoDB 테이블임.

위치정보법 제23조: 개인위치정보는 목적 달성 시 즉시 파기하되, **제16조제2항에 따라 기록·보존해야 하는 "확인자료"는 예외**. examiner도 명시적으로 "6개월 이전의 확인자료" 증빙을 요구 — 즉 이 확인자료는 (개인위치정보 자체의 "최대 1년" 상한과 반대로) **최소 6개월 이상 보관**돼야 하는 것으로 보임.

1차 제출 시점(2026-04 초 추정) 증빙자료2는 **2025-10-15**자 `production_dr_runn` 레코드를 "6개월 이전" 샘플로 제출 — 그 시점엔 6개월 넘는 데이터가 실제로 존재했음. **지금(2026-07-20)은 TTL 7일 때문에 그런 데이터가 존재할 수 없음.**

TTL이 정확히 언제부터 `production_dr_runn`/`_hist`에 적용(enable)됐는지 CloudTrail `lookup-events`(90일 제한, ap-northeast-2 리전 — DynamoDB는 리전 서비스라 us-east-1이 아님)로 조회했으나 해당 기간(4/21~) 내 이벤트 없음 → 그 이전에 켜졌다는 뜻. 코드상 TTL 로직(`+86400*7`) 자체는 predecessor 모노레포(`~/sl/drvtracker`) 기준 **2025-06-19** 커밋(`d429769`, "ttl, capacity unit, esbuild plugin")에 처음 등장 — 다만 이건 "코드에 ttl 속성을 쓰기 시작한 시점"이지 "테이블에서 TTL 처리가 실제로 켜진 시점"과는 다를 수 있음(둘은 별개 설정). 정확한 enable 시점은 S3 원본 로그 추가 조사가 필요하며 **미완료**.

## 조치(2026-07-20)

`~/iac/iac_ddb_runn/src/resolvers/{runn,runnHist}/insert.ts`의 TTL 계산을 `+86400*7`(7일) → `+86400*180`(180일, 약 6개월)로 수정. **배포하지 않음** — 소스만 로컬 수정(git 커밋도 안 함, uncommitted). OPA 제출용 캡쳐만 미리 준비(`~/ps/docs/2차 제출본/캡쳐/12e_source_ttl_180day_change_unreleased.jpg`).

## 다음 행동

- [ ] TTL 180일 변경 배포 여부·시점 결정(사용자) — 배포 시 dev 먼저 검증 권장, `production_dr_runn_hist`는 고빈도 테이블이라 보관기간 6배 늘어나면 스토리지 비용 증가폭 가늠 필요(현재 대비 약 26배: 7일→180일)
- [ ] TTL이 정확히 언제 enable됐는지 S3 CloudTrail 원본 로그로 추가 확인(2025-06~2026-04 구간, ap-northeast-2 리전)
- [ ] `runnStatus`/`runnStatusHst`도 같은 확인자료 성격인지, TTL을 같이 조정해야 하는지 확인 안 됨
- [ ] 배포 후: OPA 제출본(docx) 12번·3번 항목 텍스트를 "7일" 기준에서 "180일/6개월" 기준으로 다시 정리
