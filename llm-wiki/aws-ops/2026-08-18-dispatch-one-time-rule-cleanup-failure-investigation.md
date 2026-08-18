---
type: aws-op
date: 2026-08-18
account: "306331009209"
region: ap-northeast-2
category: [eventbridge, lambda, investigation]
impact: dispatch-one-time-2026-04-22 규칙 2개가 안 지워진 원인 조사, EventBridge 삭제 API 신설의 계기가 됨
status: done
---

# 2026-08-18 · `dispatch-one-time-2026-04-22-*` 규칙이 안 지워진 이유 조사

사용자가 "예전 EventBridge 보면 2026-04-22 데이터가 안 사라지고 계속 있는데 냅둬도 되나"라고 질문해서 조사. 결과가 [[2026-08-18-admin-dev-restapi-eventbridge-delete]](삭제 API 신설)의 직접적인 계기가 됨.

## 1) 정상 동작: 규칙은 발동 후 자기 자신을 삭제한다

`[[../domains/dispatch-rules-status]]`에 예전에 "발동 후에도 자동 삭제가 안 되는 classic Rule"이라고 적어뒀던 설명은 **부정확했다** — 정정 필요(아직 반영 안 함, #todo).

실제로는 `~psapp/cron/driver-runnstatus-cron/src/utils/aws/eventBridge.ts`의 `cleanupOneTimeEvent()`가 `RemoveTargets` + `DeleteRule`로 자기 규칙을 지운다. 호출부는 `controller/dispatch/msg.ts`의 `checkRunn`/`checkStatus` 3번째 단계(`DispatchMessageHelper.cleanupRule()`). 실측: 2026-08-18 기준 계정에 남은 `dispatch-one-time-*` 규칙 140개 중 137개가 당일(오늘) 것, 1개는 8/7 테스트용, **2026-04-22 것 2개만 예외적으로 잔존** — 지난 4개월치 규칙은 거의 다 정상적으로 자기 삭제됨.

## 2) 왜 2개만 안 지워졌나 — 정리 로직이 실행 전 단계에서 죽었을 가능성

`checkRunn`/`checkStatus` 처리 순서: `1) getAndUpdateStatus() → 2) SMS 발송 → 3) cleanupRule() → 4) 다음 스케줄링`. **`cleanupRule()`은 3번째 단계**라서, 1번(`getAndUpdateStatus`, try/catch 없음)에서 예외가 나면 그 아래로 실행이 안 내려가 정리 자체가 스킵된다. 재시도 정책도 `MaximumRetryAttempts: 0`, DLQ도 없어서 흔적 없이 조용히 죽는다.

CloudWatch `AWS/Events` 메트릭(`Invocations=1, FailedInvocations=0`, 두 규칙 다 동일)은 "EventBridge가 Lambda 호출엔 성공했다"는 뜻일 뿐, Lambda 내부 로직이 끝까지 에러 없이 돌았는지는 보장 못 한다.

**확증은 못 함** — CloudWatch Logs는 91일 보존이라 4월 로그가 이미 사라졌고, `AWS/Lambda` `Errors`/`Invocations` 메트릭도 그 시점 데이터가 안 잡힘(원인 불명, 조회 자체가 빈 배열 반환). 코드 구조상 가장 유력한 설명이라는 정도로만 기록.

## 3) 부수 발견 — 같은 파일에 kimps 키가 하드코딩돼 있음

`eventBridge.ts`의 `initEvtBridgeClient()`와 `cleanupOneTimeEvent()` 양쪽에 `accessKeyId: "AKIAUOUWAIC4676HY4KB"`가 하드코딩돼 있음. [[../aws-inventory/iam-overview]]에서 확인한 `kimps`의 2024-12-28 발급 키와 동일 — fart86 키(`aws-pending.md`에 이미 추적 중)와 같은 패턴의 별도 노출 건. **일단 기록만, 조치는 안 함** — [[../aws-pending]]에 추가 필요(#todo).

## 4) 결론

이 정리 실패는 정상적인 "설계상 안 지워지는 규칙"이 아니라 **정리 로직 자체의 결함(에러 시 스킵)으로 새는 케이스**다. 실제 운영에는 지장 없음(재발동도 안 되고 비용도 없음)이지만, 이런 고아 규칙을 admin에서 수동으로 치울 수 있어야 한다는 필요가 확인돼 [[2026-08-18-admin-dev-restapi-eventbridge-delete]] 작업으로 이어짐.

## 5) 관련

- [[2026-08-18-admin-dev-restapi-eventbridge-delete]] — 이 조사가 계기가 된 삭제 API 신설
- [[../domains/dispatch-rules-status]] — "자동 삭제 안 됨" 설명 정정 필요(#todo)
- [[../aws-pending]] — kimps 키 하드코딩 발견분 추가 필요(#todo)
