---
type: repo-wiki
repo: ps-aws
domains: []
stack: [aws-cli, fastify, typescript]
status: active
updated: 2026-06-26
---

# structure — 지도

## 이 리포의 두 축

```
┌─────────────────────────────────────────────────────┐
│ ① AWS 운영 이력 / 절차 / 보호 자원  ← 주된 자산     │
│    llm-wiki/aws-ops/                                │
│    llm-wiki/aws-runbooks/                           │
│    llm-wiki/aws-inventory/                          │
│    llm-wiki/aws-pending.md                          │
├─────────────────────────────────────────────────────┤
│ ② src/ Fastify+cron 보조 도구  ← 그 위 자동화      │
│    HTTP 라우트 + 30분 주기 cron + Telegram/Slack    │
│    waf:bot / rds:status 일회성 스크립트             │
└─────────────────────────────────────────────────────┘
```

위키 진입점은 [[index]].

---

## ① AWS 자료 디렉토리

```
llm-wiki/
├── index.md                       # 메타 + 목차
├── aws-pending.md                 # ★ 진행 중 / 보류 / 후속 TODO 통합
├── aws-ops/                       # 작업 단위 이력 (시간순)
│   ├── 2026-06-01-vpc-ec2-cleanup.md
│   ├── 2026-06-02-lambda-edge-cleanup.md
│   ├── 2026-06-02-kms-madmin-cleanup.md
│   ├── 2026-06-03-read-replica-az-migration.md
│   ├── 2026-06-04-msdeveloper-s3-lifecycle.md
│   ├── 2026-06-04-apigw-exec-log-cleanup.md
│   └── 2026-06-16-cloudfront-admin-function-attach.md
├── aws-runbooks/                  # 재사용 절차 (명령어 모음)
│   ├── rds-shrink-migration.md
│   ├── cloudfront-function-attach.md
│   └── waf-bot-control-toggle.md
└── aws-inventory/                 # 현재 상태 스냅샷
    ├── protected-resources.md     # ★ 절대 건드리지 마라
    └── cloudfront-dev-admin.md
```

각 `aws-ops/*.md` 노트 형식:
1. **배경** — 무엇을 / 왜
2. **점검** — 안전성 검증 항목
3. **실행** — 사용한 `aws` 명령 (모르면 `> TODO(질문): ... #todo`)
4. **결과** — 무엇이 어떻게 됐나
5. **영향** — 비용 / 운영
6. **후속** — 후속 TODO 링크 (→ [[aws-pending]])

---

## ② src/ 진입점 (실행 가능)

| 진입점 | 트리거 | 파일 |
|---|---|---|
| HTTP 서버 (`pnpm dev` / `pnpm start`) | 사용자/외부 cron 이 HTTP 호출 | `src/index.ts` → `src/server.ts:startServer` |
| 내부 cron 스케줄러 | 서버 시작 시 자동 기동 (끄는 토글 없음) | `src/scheduler/index.ts:startScheduler` |
| WAF Bot Control 토글 | 사람이 손으로 (`pnpm waf:bot ...`) | `src/scripts/wafBotControl.ts` |
| RDS 상태 점검 | 사람이 손으로 (`pnpm rds:status ...`) | `src/scripts/rdsStatus.ts` |

`src/index.ts` 는 6줄로 `.env` 로드 + `startServer(PORT)` 만 부른다.

### 레이어

```
HTTP 라우트 (server.ts)
   │
   ├─→ infra-monitor/        ← AWS SDK 호출 + 메트릭 → 도메인 타입 변환
   │     ├─ rds.ts           CloudWatch CPU/Connections + DescribeDBInstances
   │     ├─ dynamodb.ts      CloudWatch Read/Write/Errors + ListTables/DescribeTable
   │     ├─ waf.ts           CloudWatch Blocked/Allowed/Counted + ListWebACLs
   │     ├─ waste.ts         EC2/EBS/EIP/ENI/Snapshot/RDS 낭비 컬렉터 6종
   │     └─ index.ts         3개 모니터 통합 + 임계값 검사 → InfraMonitorResult
   │
   ├─→ notifiers/            ← Notifier 인터페이스 + 채널별 구현
   │     ├─ types.ts         Notifier 인터페이스 (name/isConfigured/sendFullReport/sendIssueAlert)
   │     ├─ telegram.ts      Telegram Bot API + waste 리포트 (Telegram 전용)
   │     ├─ slack.ts         Slack chat.postMessage (waste 리포트는 미지원)
   │     └─ index.ts         active 채널 자동 감지 + 양쪽 동시 전송
   │
   └─→ scheduler/            ← node-cron 두 작업 (인프라 점검 + 낭비 점검)
         └─ index.ts

scripts/                     ← bash 헬퍼 (백그라운드 기동 / 비용 분석 / 리소스 점검)
src/types.ts                 ← 도메인 타입 (MetricData, RDSMetrics, DynamoDBMetrics, WAFMetrics, WasteItem, ...)
src/types/node-cron.d.ts     ← node-cron 타입 보강
```

### 디렉토리 트리

```
src/
├── index.ts                       (6 lines, dotenv + startServer)
├── server.ts                      (138 lines, Fastify 라우트 + shutdown)
├── types.ts                       (70 lines, 도메인 타입)
├── types/node-cron.d.ts
├── infra-monitor/
│   ├── index.ts                   (64 lines, 통합 + 임계값)
│   ├── rds.ts                     (81 lines)
│   ├── dynamodb.ts                (80 lines)
│   ├── waf.ts                     (83 lines)
│   └── waste.ts                   (317 lines, 컬렉터 6종)
├── notifiers/
│   ├── types.ts                   (8 lines)
│   ├── index.ts                   (108 lines)
│   ├── telegram.ts                (213 lines)
│   └── slack.ts                   (204 lines)
├── scheduler/
│   └── index.ts                   (85 lines)
└── scripts/
    ├── wafBotControl.ts           (307 lines, 일회성)
    └── rdsStatus.ts               (474 lines, 일회성)

scripts/                           (bash, 백그라운드 기동 + AWS CLI 점검)
backups/waf-acl/                   (waf:bot disable 시 자동 백업 저장 경로)
```

### HTTP 라우트 인벤토리

| Method | Path | 핸들러 | 알림 |
|---|---|---|---|
| GET | `/health` | server.ts | — |
| POST | `/infra/monitor?notify=true\|issues\|false` | `checkInfrastructure` | 양쪽 (`issues` 기본) |
| GET | `/infra/monitor/:service` (rds/dynamodb/waf) | `serviceMonitors[svc]` | 없음 |
| GET | `/infra/waste?notify=true\|false` | `collectWaste` | Telegram 만 (`false` 기본) |

---

## 환경변수 진실 위치

`.env.example` 와 실제 코드 디폴트 사이에 불일치 있음. 정리는 [[runbook]].

## (참고) `docs/` 폴더는 위키로 이관됨

이전에 `docs/aws-cleanup-history.md` / `docs/rds-dev-mshuttle-migration.md` / `docs/cloudfront-dev-admin.md` 에 흩어져 있던 자료는 모두 위 `aws-ops/` `aws-runbooks/` `aws-inventory/` 에 흡수되어 단일 진실로 정리됨. (`docs/process-management.md` 는 src/ 운영 가이드라 별도 판단)
