---
type: repo-wiki
repo: ps-aws-infra-monitor
domains: []
area: dispatch-rules-status
stack: [aws-sdk-v3, eventbridge, cloudwatch]
status: active
updated: 2026-08-18
---

# dispatch-rules-status — dispatch-one-time-* EventBridge 규칙 점검 스크립트

#domain/dispatch-rules-status

## 배경

배차 시스템이 `driver-runnstatus-cron-{production,dev}` Lambda를 특정 시각에 딱 한 번 호출하도록 EventBridge 규칙(`dispatch-one-time-<날짜>-<dispatchId>-<랜덤>[-test]`, cron에 year까지 고정)을 만든다.

**정정(2026-08-18):** 이 규칙은 원래 발동 후 **자기 자신을 삭제한다**(`driver-runnstatus-cron`의 `cleanupOneTimeEvent` — `checkRunn`/`checkStatus` 처리 3단계). "자동 disable/delete가 안 되는 classic Rule"이라던 이전 설명은 틀렸다. 다만 그 정리 로직이 처리 1단계(`getAndUpdateStatus`, try/catch 없음)에서 예외가 나면 스킵되는 결함이 있어, 드물게 발동 후에도 규칙이 안 지워진 채 남는다 — 조사 상세는 [[../aws-ops/2026-08-18-dispatch-one-time-rule-cleanup-failure-investigation]]. 실제 발동 여부는 여전히 규칙 상태(`State`)가 아니라 CloudWatch `Invocations` 메트릭으로만 확인 가능(정리가 성공하면 규칙 자체가 사라지므로).

이렇게 남은 고아 규칙은 admin-dev-restapi의 `DELETE /eventbridge`(2026-08-18 신설, [[../aws-ops/2026-08-18-admin-dev-restapi-eventbridge-delete]])로 수동 삭제 가능.

2026-08-17 수동 조사에서 이 패턴을 처음 발견 (9개 중 3개가 예정 시각과 어긋남, 그 중 2개만 실제 발동 확인됨 — 상세 [[../aws-pending]] 조사 경위는 이 위키 대화 이력 참조). 반복 조사가 필요할 걸로 판단해 스크립트화.

## 파일

| 파일 | 역할 |
|---|---|
| `src/infra-monitor/dispatchRules.ts` | **함수 파일** — `getDispatchRulesStatus(prefix?)` 실제 조회 로직 |
| `src/scripts/dispatchRulesStatus.ts` | **실행 파일** — 위 함수 호출 + 사람 친화 출력만 |

2026-08-17 결정: 처음엔 CLI 플래그(`--json`/`--stale`/`--prefix`) + `GET /infra/dispatch-rules` Fastify 라우트까지 만들었다가, 사용성 단순화 요청으로 **함수 파일 + 실행 파일 2개로만** 정리. Fastify 라우트는 제거.

## 명령

```bash
pnpm dispatch:rules   # 플래그 없음, 바로 전체 결과 출력
```

## 하는 일

1. `dispatch-one-time` prefix로 EventBridge 규칙 전부 조회 (`ListRulesCommand`, 페이지네이션)
2. 규칙명에서 날짜/dispatchId 파싱, cron 표현식(`cron(Min Hour Day Month ? Year)`)에서 발동 예정 시각(UTC/KST) 파싱
3. target Lambda의 Input JSON에서 기사명(`nm`)/action/statusId 추출
4. **CloudWatch `AWS/Events` `Invocations`/`FailedInvocations` 메트릭으로 실제 발동 여부 확인** — 이게 핵심. `State: ENABLED`만으로는 발동 여부를 알 수 없음
5. 4가지 상태로 분류:
   - `upcoming` — 아직 예정 시각 전
   - `fired` — 발동 이력 있음 (정상 완료, 이제 잔재)
   - `overdue-no-invocation` — 예정 시각 지났는데 발동 이력 0건 (확인 필요 — 생성이 예정 시각보다 늦었을 가능성)
   - `unparseable` — cron 표현식이 단순 고정값 패턴이 아님 (수동 확인 필요)

## 데이터 출처

| 호출 | 용도 |
|---|---|
| `ListRulesCommand` (EventBridge) | 규칙 나열 |
| `ListTargetsByRuleCommand` (EventBridge) | target Lambda ARN + Input JSON |
| `GetMetricStatisticsCommand` (CloudWatch, `AWS/Events` 네임스페이스, `RuleName` 디멘션) | 실제 발동 이력 (`Invocations`/`FailedInvocations`, Period 86400, Sum) |

## 함정

- **regex 기반 cron 파서**: `cron(Min Hour Day Month ? Year)` 형태의 완전 고정값 패턴만 파싱한다. 범위(`1-5`)나 리스트(`1,15`), 반복 규칙이 섞인 cron은 `unparseable`로 떨어짐 — 이 스크립트는 "일회성 배차 이벤트"만 대상으로 설계됨. 일반 반복 cron 규칙에는 안 맞음.
- **규칙명 파싱도 regex 고정**: `dispatch-one-time-YYYY-MM-DD-<숫자dispatchId>-<나머지>` 형태를 벗어나면 `namedDate`/`dispatchId`가 `null`로 떨어짐.
- CloudWatch 조회 윈도우는 발동 예정 시각 하루 전 ~ 지금(파싱 실패 시 400일 전 ~ 지금)으로 넉넉하게 잡음 — 메트릭 보존 기간(약 15개월) 안에서는 안전하지만, 그보다 오래된 규칙은 놓칠 수 있음.
- 로컬 실행 시 자격증명은 SDK 기본 체인 — 실제로 어떤 키가 쓰이는지는 [[../gotchas#awssrc-src-로컬-실행-시-sdk-기본-자격증명-체인이-실제로-kimps-개인-장기-액세스-키를-씀]] 참조.
