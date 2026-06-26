---
type: repo-wiki
repo: ps-aws-infra-monitor
domains: []
area: infra-health
stack: [aws-sdk-v3, cloudwatch, fastify]
status: active
updated: 2026-06-25
---

# infra-health — RDS·DynamoDB·WAF 메트릭 점검

#domain/infra-health

## 이 리포에서의 처리

이 영역은 **CloudWatch 메트릭을 짧은 윈도우로 한 점 긁어서 임계값과 비교한 뒤, 임계 초과를 Telegram/Slack 으로 알리는** 것 한 가지를 한다. 시계열 분석·예측·이상 탐지는 하지 않는다.

## 파일 매핑

| 파일 | 역할 |
|---|---|
| `src/infra-monitor/rds.ts` | `monitorRDS()` — `DescribeDBInstances` + CloudWatch `CPUUtilization`/`DatabaseConnections` |
| `src/infra-monitor/dynamodb.ts` | `monitorDynamoDB()` — `ListTables` + `DescribeTable` + Consumed Read/Write + UserErrors/SystemErrors |
| `src/infra-monitor/waf.ts` | `monitorWAF()` — `ListWebACLs(Scope:REGIONAL)` + Blocked/Allowed/Counted |
| `src/infra-monitor/index.ts` | `checkInfrastructure()` — 세 모니터 병렬 호출 + 임계 검사 + 통합 결과 |
| `src/server.ts` | HTTP 라우트 — POST `/infra/monitor`, GET `/infra/monitor/:service` |
| `src/scheduler/index.ts` | 주기 트리거 (`CRON_SCHEDULE`, 기본 `*/30 * * * *`) |
| `src/notifiers/*` | 결과를 Telegram/Slack 으로 발사 |

## 데이터 흐름

```
cron tick (또는 POST /infra/monitor)
  → checkInfrastructure()
      → Promise.all([monitorRDS, monitorDynamoDB, monitorWAF])
          → 각자 SDK Describe* + CloudWatch GetMetricStatistics × N
      → 임계값 검사 → issuesFound[] 누적
  → notifiers (issues 모드면 issuesFound 있을 때만 발사)
```

## 임계값 (전부 hard-coded, `infra-monitor/index.ts`)

| 서비스 | 항목 | 임계 |
|---|---|---|
| RDS | CPU | `> 80%` |
| RDS | status | `!== "available"` |
| DynamoDB | UserErrors | `> 10` |
| DynamoDB | SystemErrors | `> 0` |
| DynamoDB | status | `!== "ACTIVE"` |
| WAF | BlockedRequests | `> 100` |

임계 변경 = 코드 수정. env 분기 없음. 이유는 [[../decisions]] "임계값을 코드에 박은 이유" 참조.

## 모니터 대상 선택

| 서비스 | 선택 규칙 |
|---|---|
| RDS | `RDS_INSTANCE_NAMES` env (쉼표 구분). 없으면 **모든 인스턴스** |
| DynamoDB | `DYNAMODB_TABLE_NAMES` env (쉼표 구분). 없으면 **모든 테이블** (2026-06-25 추가) |
| WAF | `Scope: REGIONAL` 의 모든 WebACL (하드코딩) |

## 알 수 없는 부분 / 함정

- WAF dimension `Region: GLOBAL` 하드코딩과 `Scope: REGIONAL` 의 미스매치 — [[../gotchas]] 첫 항목. 실제 알림이 울린 적이 있는지 확인 필요.
- 5분 단일 datapoint 만 사용 — CloudWatch publish 지연 시 `value: 0` fallback. [[../gotchas]] 참조.
- 개발 환경에서 `yarn dev` 만 해도 스케줄러가 켜져 실제 AWS API 호출 + 알림 발사. 개발 중 `.env` 의 토큰 비워두는 게 관례.

## 새 서비스 추가 시

[[../conventions]] "새 서비스 모니터링 추가" 5단계 절차 참조. 5군데(`infra-monitor/<svc>.ts`, `types.ts`, `infra-monitor/index.ts`, `server.ts:serviceMonitors`, `notifiers/{telegram,slack}.ts`) 모두 손대야 한다.
