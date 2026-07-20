---
type: aws-op
date: 2026-07-20
account: "306331009209"
region: ap-northeast-2
category: [dynamodb, compliance]
impact: 비용 아님 — OPA 실태점검 "목적 달성 시 파기"(12번), "보유기간"(3번) 대응
status: done
related: [[../aws-ops/2026-07-19-location-data-write-path-audit]]
---

# 2026-07-20 · 위치정보 DynamoDB TTL 자동 파기 재발견

## 배경

OPA 실태점검 12번 항목("목적 달성 시 파기 — 소스코드 및 파기결과 제출") 소명 준비 중, "코드는 미리 짜둘 수 있는 거 아니냐"는 지적을 계기로 현재 파기가 실제로 어떻게 이뤄지는지 재확인. 기존엔 "수동 파기(관리자가 콘솔에서 직접 선택 후 삭제)"로 알고 있었으나 틀렸음.

## 발견

`production_dr_runn`, `production_dr_runn_hist` 둘 다 **DynamoDB TTL이 이미 켜져 있고(`describe-time-to-live` → `ENABLED`, 속성명 `ttl`), 실제로 매일 자동 삭제되고 있음**.

소스: `~/iac/iac_ddb_runn/src/resolvers/{runn,runnHist}/insert.ts` — 레코드 생성(PutItem) 시점에 아래 로직으로 `ttl` 값을 계산해 아이템에 포함시킴(GitHub 커밋 `61f9ee8c4a83d97f7586e377bc35802ad510b5bb` 기준):

```js
const now = util.time.nowISO8601();
const nowUnixMs = util.time.parseISO8601ToEpochMilliSeconds(now);
const nowUnixSecondPlusAlpha = Math.floor(nowUnixMs / 1000) + 86400 * 7; // 생성시각 + 7일
...
item: { ...item, ttl: nowUnixSecondPlusAlpha }
```

**즉 위치정보 레코드는 생성된 지 7일 뒤 DynamoDB가 자동으로 삭제한다.** CloudWatch `TimeToLiveDeletedItemCount` 지표로 실제 삭제량도 확인: `production_dr_runn`은 하루 수십 건, `production_dr_runn_hist`(GPS 원본, 고빈도)는 피크일 하루 약 2만 건.

`runnStatus`/`runnStatusHst` 리졸버(`~/iac/iac_ddb_runn/src/resolvers/runnStatus{,Hst}/insert.ts`)도 동일하게 `+86400*7` 패턴 — 위치정보 테이블 4개 전부(runn/runnHist/runnStatus/runnStatusHst) 동일한 7일 TTL 정책으로 통일돼 있는 것으로 보임(runnStatus 계열은 이번엔 상세 확인 안 함).

## 의미

- 이용약관에 적힌 "개인위치정보 보유기간 5년"은 **실제 시스템 동작(7일)과 완전히 다름** — 시행령상 최대 허용치(1년)를 지키기 위한 "보유기간을 몇 년으로 할지" 정책 결정은 사실 불필요했고, 문제는 약관 문구가 실제 운영과 안 맞는 것이었음.
- OPA 12번("파기 소스코드·파기결과 제출") 요구사항은 이미 존재하는 이 TTL 로직 + CloudWatch 지표로 그대로 충족 가능 — 신규 구현 불필요.
- [[aws-ops/2026-07-17-dynamodb-location-encryption-audit]]에서 익스포트 파이프라인(S3/Athena)이 "7일 보관 정책"을 쓰는 걸 이미 확인했었는데, 그게 바로 이 DynamoDB 소스 테이블의 TTL과 정확히 같은 숫자였음 — 당시엔 두 사실을 연결 짓지 못했음.

## 후속 확인 필요 (미완료)

- [ ] `runnStatus`/`runnStatusHst`도 동일 7일 TTL인지 명시적으로 확인
- [ ] 이 7일 TTL이 의도된 개인정보보호 조치인지, 단순 운영 테이블 정리 목적으로 우연히 겹친 것인지 — 설계 배경을 아는 사람이 있으면 확인(현재는 코드만으로 추정)
- [ ] 이용약관 문구를 "7일"로 정확히 맞출지, 여유를 둔 값(예: 1개월)으로 할지는 OPA 제출 문서 쪽 사업자 결정 대기 — `~/ps/docs/2차 제출본/점검항목_현황.md` 참조(이 리포 밖 문서, 일반 경로로 표기)
