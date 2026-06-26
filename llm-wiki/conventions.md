---
type: repo-wiki
repo: ps-aws-infra-monitor
domains: []
stack: [typescript, fastify, aws-sdk-v3]
status: active
updated: 2026-06-25
---

# conventions — 이 리포만의 규칙

## 언어·코드

- TypeScript `strict: true`. `module: ESNext`, `moduleResolution: bundler`. ESM (`"type": "module"`).
- 들여쓰기 2 spaces. 세미콜론 사용. 큰따옴표.
- 모든 사용자 노출 문구·로그·알림은 **한국어**.

## 알림 메시지 톤

- 이모지 적극 사용 (`✅ ⚠️ 🚨 🔒 📊 🛑 💸 💾 🔌 🗄️ 📦 ⬆️ 🔁 🧹`).
- Telegram 은 `parse_mode: "HTML"`. `<b>`, `<code>` 만 쓴다 (`*` markdown 아님).
- Slack 은 Block Kit (`type: header/section/divider`).
- 시간 포맷: `new Date().toLocaleString("ko-KR")`.

## 새 서비스 모니터링 추가

기존 패턴 그대로 따른다. `notifiers` 와 라우팅이 자동으로 잡아주지 않으므로 **세 군데 다 등록 필요.**

1. `src/infra-monitor/<svc>.ts` 작성 — `monitor<Svc>(): Promise<<Svc>Metrics[]>` 시그니처
2. `src/types.ts` 에 `<Svc>Metrics` 인터페이스 + `InfraMonitorResult` 에 필드 추가
3. `src/infra-monitor/index.ts` 의 `Promise.all` 과 임계값 검사 블록에 추가
4. `src/server.ts` 의 `serviceMonitors` 맵에 등록 → `/infra/monitor/<svc>` 라우트가 자동 생성
5. 알림 포맷 함수를 `notifiers/telegram.ts` + `notifiers/slack.ts` 양쪽에 추가

## CloudWatch 호출 패턴

기본 시그니처:

```ts
{ Namespace, MetricName, Dimensions, StartTime, EndTime, Period: 300, Statistics: [...] }
```

- 윈도우는 **5분 단일 datapoint** 사용 (`Datapoints?.[0]` 만 꺼냄). 시계열 평균이 아님. → 함정. [[gotchas]] 참조.
- 통계: RDS는 `Average`, DynamoDB는 `Sum`, WAF는 `Sum`.
- 데이터포인트 누락 시 `value: 0, timestamp: new Date()` 로 fallback. **`0` 이 "데이터 없음" 인지 "실제로 0" 인지 구분 불가.**

## 임계값 (전부 hard-coded)

| 항목 | 임계 | 위치 |
|---|---|---|
| RDS CPU | 80% | `infra-monitor/index.ts` |
| DynamoDB UserErrors | 10 | `infra-monitor/index.ts` |
| DynamoDB SystemErrors | 0 | `infra-monitor/index.ts` |
| WAF Blocked | 100 | `infra-monitor/index.ts` |

env 로 빼내지 않는다. 변경하려면 코드 수정.

## 일회성 스크립트 (`src/scripts/`) 패턴

- destructive 동작은 **`--confirm` 없으면 dry-run** 기본. (`wafBotControl` 의 `disable`/`enable`)
- 백업이 필요한 동작은 작업 직전 **JSON 통째로 `backups/` 에 저장**, 같은 스크립트가 그 파일을 읽어 복원.
- CLI 파싱은 자체 구현 (`process.argv.slice(2)` + 수동 flag 처리). yargs 같은 라이브러리 쓰지 않는다.

## 에러 처리 규칙

- `infra-monitor/index.ts` 의 `Promise.all` 은 각 모니터를 `.catch` 로 감싸 **실패한 서비스만 빈 배열로 떨어뜨리고 나머지는 계속.** issues 배열에 `"<svc> monitoring failed: ..."` 푸시.
- HTTP 핸들러는 catch 후 `reply.code(500).send({ error })` — 스택트레이스 노출하지 않음.
- 일회성 스크립트는 `main().catch(err => { console.error(...); process.exit(1) })` 패턴.

## 금지

- `AWS_SECRET_ACCESS_KEY` 등 자격증명 직접 받지 않는다. SDK 기본 체인만 사용.
- `app.log`, `.pid`, `.env` 같은 런타임 파일은 커밋하지 않는다 (실제로 일부 흔적이 있긴 함 — [[gotchas]] 참조).
- `wafBotControl` 으로 prod 를 만지는 일은 **반드시 `--target prod` + `--confirm` 명시.** 기본 `--target all` 이라 사고 위험.
- WAF / Security Hub / Config 의 **비활성화 절대 금지** (계정 정책상 강제 — [[decisions]]).

## 폴더 사용

- `backups/waf-acl/` — `waf:bot disable` 자동 백업. 손으로 지우지 말 것 (rollback 소스).
- `dist/` — `tsc` 산출물. 커밋 안 됨.
- `docs/` — 운영 기록 (정리 이력, 마이그레이션 가이드 등). 이 위키와 별개의 사용 이력 로그.
