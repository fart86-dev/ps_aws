---
type: repo-wiki
repo: ps-aws
domains: []
stack: [fastify, tsx, node-cron]
status: active
updated: 2026-06-26
---

# runbook — 빌드·실행·환경 (src/ 보조 도구 전용)

> 이 문서는 **src/ Fastify+cron 앱** 의 빌드·실행 가이드. AWS 작업 자체의 절차는 [[aws-runbooks/]] 폴더 참조.

## 전제

- Node.js 18+
- AWS 자격증명: `~/.aws/credentials` 또는 `AWS_PROFILE` env. 코드 어디서도 access key를 받지 않는다.
- 패키지 매니저: **pnpm 고정.** `package.json` 의 `"packageManager": "pnpm@10.30.1"` 필드로 강제. `pnpm-lock.yaml` 만 commit 되고 `yarn.lock` 은 없다. yarn/npm 사용 금지.

## 일상 명령

| 목적 | 명령 |
|---|---|
| 포그라운드 개발 (hot reload) | `pnpm dev` (= `tsx watch src/index.ts`) |
| **백그라운드 dev** (권장) | `pnpm dev:bg` → `app.log` + `.pid` 생성 |
| 빌드 (TypeScript → dist/) | `pnpm build` (= `tsc`) |
| 프로덕션 실행 | `pnpm start` (= `node dist/index.js`) |
| 백그라운드 프로덕션 | `pnpm start:bg` |
| 종료 (백그라운드 양쪽) | `pnpm stop` (= `kill $(cat .pid)`) |
| 로그 보기 | `pnpm logs` (= `tail -f app.log`) |
| 타입 검사만 | `pnpm type-check` |
| WAF Bot Control | `pnpm waf:bot <status\|disable\|enable> [--target dev\|prod\|all] [--confirm]` |
| RDS 상태 | `pnpm rds:status [--target <id>] [--findings] [--json] [--cost] [--days N]` |

> 백그라운드 스크립트(`scripts/dev-bg.sh`)는 `npx tsx ...` 를 직접 부른다 — `tsx watch` 가 아니라 `tsx` 단발 실행이므로 코드 수정 시 자동 재시작되지 않는다. 의도된 차이인지 확인 필요. #todo

## 포트

- 기본 `9500` (env `PORT` 로 변경)

## 환경변수

`.env.example` 와 실제 코드 디폴트 사이에 불일치가 있다. **코드 디폴트가 진실**(서버는 `.env` 가 없어도 기동된다).

| 변수 | 코드 디폴트 | `.env.example` | 의미 |
|---|---|---|---|
| `PORT` | `9500` | `9500` | HTTP 포트 |
| `TELEGRAM_BOT_TOKEN` | (없음) | placeholder | 있으면 Telegram 채널 활성 |
| `TELEGRAM_CHAT_ID` | (없음) | placeholder | 있으면 Telegram 채널 활성 |
| `SLACK_BOT_TOKEN` | (없음) | placeholder | 있으면 Slack 채널 활성 |
| `SLACK_CHANNEL_ID` | (없음) | placeholder | 있으면 Slack 채널 활성 |
| `CRON_SCHEDULE` | `*/30 * * * *` | `0 * * * *` | 인프라 점검 스케줄 |
| `NOTIFY_MODE` | `issues` | `issues` | `issues` \| `full` \| `none` |
| `RDS_INSTANCE_NAMES` | (전부) | 예시 2개 | 쉼표 구분, 모니터 대상 RDS 화이트리스트 |
| `DYNAMODB_TABLE_NAMES` | (전부) | 예시 2개 | 쉼표 구분, 모니터 대상 DynamoDB 테이블 화이트리스트 |
| `WASTE_CRON_SCHEDULE` | `0 0 * * 1` (월 KST 09:00) | 없음 | 낭비 점검 스케줄 |
| `WASTE_STOPPED_EC2_DAYS` | `14` | 없음 | stopped EC2 기준일 |
| `WASTE_OLD_SNAPSHOT_DAYS` | `365` | 없음 | 오래된 snapshot 기준일 |
| `WASTE_RDS_STORAGE_PCT` | `50` | 없음 | RDS storage 낭비 임계 % |
| `AWS_REGION` | `ap-northeast-2` (waste.ts만 기본) | 없음 | 다른 모듈은 AWS SDK 디폴트 region 따름 |

비밀값은 본문에 적지 않는다. 실제 값은 운영자가 별도 안전 채널로 관리.

## 알림 채널 동작 규칙

- `Notifier.isConfigured()` 가 `true` 인 채널만 동작.
- **양쪽이 활성이면 양쪽 모두에 동시 전송** (`Promise.all`). 한 쪽만 보내고 싶으면 다른 쪽 env 를 비운다.
- `waste` 리포트는 **Telegram만** 지원. Slack 미구현.

## 스케줄러 동작

- 서버가 켜지면 **자동으로** `startScheduler()` 가 호출된다 (`startServer(port, enableScheduler=true)`). 끄는 env 토글 없음.
- 첫 실행은 cron tick 이 와야 한다 — 서버 부팅 직후 즉시 1회 점검은 없다.
- 인프라 점검(`CRON_SCHEDULE`) + 낭비 점검(`WASTE_CRON_SCHEDULE`) 두 작업이 별개로 등록.

## 백업 위치

- `backups/waf-acl/<target>-<aclName>-<timestamp>.json` — `waf:bot disable --confirm` 실행 시 자동 저장. `waf:bot enable` 의 기본 복원 소스.

## AWS 리전 사용

| 모듈 | 리전 |
|---|---|
| `infra-monitor/rds.ts`, `dynamodb.ts`, `waf.ts` | AWS SDK 디폴트 (보통 `AWS_REGION` env 또는 `~/.aws/config`) |
| `infra-monitor/waste.ts` | `process.env.AWS_REGION ?? "ap-northeast-2"` |
| `scripts/rdsStatus.ts` | `ap-northeast-2` hard-coded |
| `scripts/wafBotControl.ts` | `us-east-1` hard-coded (CloudFront scope 전용) |
| `scripts/rdsStatus.ts` Cost Explorer | `us-east-1` 강제 (CE는 us-east-1 only) |

리전 일관성 없음 — 자세한 함정은 [[gotchas]] 참고.
