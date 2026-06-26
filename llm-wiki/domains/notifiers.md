---
type: repo-wiki
repo: ps-aws-infra-monitor
domains: []
area: notifiers
stack: [telegram-bot-api, slack-web-api]
status: active
updated: 2026-06-25
---

# notifiers — Telegram/Slack 알림 채널

#domain/notifiers

## 이 리포에서의 처리

이 영역은 **하나의 `Notifier` 인터페이스를 두고 Telegram·Slack 두 구현을 두며, env 로 활성된 채널 모두에 동시 전송하는** 구조다. 큐·재시도·rate limit 처리는 없다. 단발 fetch.

## 파일 매핑

| 파일 | 역할 |
|---|---|
| `src/notifiers/types.ts` | `Notifier` 인터페이스 (8 lines) |
| `src/notifiers/telegram.ts` | Telegram Bot HTTP API 직접 호출 (213 lines) — 인프라 리포트 + waste 리포트 |
| `src/notifiers/slack.ts` | Slack `chat.postMessage` (204 lines) — 인프라 리포트만 |
| `src/notifiers/index.ts` | `getActiveNotifiers()` + `sendFullReport`/`sendIssueAlert`/`sendWasteReport` (108 lines) |

## Notifier 인터페이스

```ts
interface Notifier {
  name: string;
  isConfigured(): boolean;
  sendFullReport(result: InfraMonitorResult): Promise<boolean>;
  sendIssueAlert(result: InfraMonitorResult): Promise<boolean>;
}
```

- `isConfigured()` 가 `true` 인 채널만 active.
- Telegram: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` 양쪽 필요.
- Slack: `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` 양쪽 필요.

## 발사 규칙

`sendFullReport`/`sendIssueAlert`:
- active 채널이 0개면 `console.warn` 만 찍고 끝.
- active 채널 N개면 `Promise.all` 로 동시 발사. 한 채널 실패가 다른 채널에 영향 안 줌 (`.catch` 분리).
- 결과는 콘솔에 `✅`/`❌` 로 채널별 로그.

`sendWasteReport`:
- Telegram 만 호출. Slack 미지원.
- `options.onlyIfItems` 가 `true` 면 항목 0건 시 skip + 콘솔만 출력. 스케줄러는 이 옵션 사용.
- Telegram 도 미설정이면 콘솔에 JSON dump.

## 포맷 차이

| 항목 | Telegram | Slack |
|---|---|---|
| API | Bot API HTTP | `chat.postMessage` |
| 인증 | `bot<TOKEN>` URL path | `Authorization: Bearer <TOKEN>` 헤더 |
| 포맷 | `parse_mode: "HTML"`, `<b>`/`<code>` | Block Kit (`type: header/section/divider`) |
| 이모지 | 메시지 본문 내 직접 | header text 안에 직접 |
| 시간 | `new Date().toLocaleString("ko-KR")` | 동일 |

## 채널 추가 절차

1. `src/notifiers/<channel>.ts` 작성 — `Notifier` 인터페이스 구현, `<channel>Notifier` export
2. `src/notifiers/index.ts:allNotifiers` 배열에 추가
3. waste 리포트도 필요하면 `<channel>.ts` 에 `send<Channel>WasteReport` 함수 추가 + `sendWasteReport` 갱신
4. env 변수명 컨벤션: `<CHANNEL>_BOT_TOKEN`/`<CHANNEL>_CHANNEL_ID` (또는 채널 종속 명칭)

## 함정

- **양쪽 활성 시 양쪽 모두 보낸다** ([[../decisions]] 참조). 중복 알림 싫으면 한쪽 env 비우거나 동작 자체를 수정.
- Telegram `parse_mode: "HTML"` 인데 사용자가 `<` 같은 문자가 포함된 메시지를 만들면 HTML 파싱 에러 → Telegram API 가 4xx. escape 처리 없음.
- Slack 의 `blocks` 가 100 블록 / 50KB 제한. 인프라 인스턴스가 매우 많아지면 분할 필요 (현재 무방비).
- rate limit 처리 없음 — Telegram(초당 30) / Slack(초당 1) 을 초과하면 그냥 실패 처리.
- 재시도 없음. 한 번 실패하면 다음 cron tick 까지 알림 없음.

## 의도적으로 안 한 것

- 큐잉·재시도·rate limit — "단순 단발 알림" 으로 설계. 신뢰성을 더 끌어올려야 한다는 요구가 들어오면 그때 검토.
- Slack waste 리포트 — Telegram 만으로 충분하다는 판단. 의도된 한계 ([[../decisions]] 참조).
