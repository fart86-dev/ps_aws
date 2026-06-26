---
type: repo-wiki
repo: ps-aws-infra-monitor
domains: []
area: rds-status
stack: [aws-sdk-v3, rds, cloudwatch, cost-explorer]
status: active
updated: 2026-06-25
---

# rds-status — RDS 인벤토리·메트릭·findings 점검 스크립트

#domain/rds-status

## 이 리포에서의 처리

이 영역은 **모든(또는 단일) RDS 인스턴스의 인벤토리·기본 메트릭·자동 finding 룰을 한 번 긁어서 사람 친화/JSON 으로 출력하는** 일회성 스크립트다. 정기 알림은 보내지 않는다 (그 일은 [[infra-health]] + [[cost-waste]] 영역).

## 파일

| 파일 | 역할 |
|---|---|
| `src/scripts/rdsStatus.ts` | 전체 스크립트 (474 lines) |

## 명령

```bash
yarn rds:status                          # 모든 RDS 사람 친화 출력
yarn rds:status --target dev-mshuttle    # 특정 인스턴스만
yarn rds:status --findings               # findings 만
yarn rds:status --json                   # JSON 출력 (파이프용)
yarn rds:status --cost                   # Cost Explorer 호출 포함 (각 $0.01)
yarn rds:status --days 7                 # 메트릭 윈도우 (기본 30일)
```

## 발견하는 finding 룰 (`evaluateFindings`)

| code | level | 조건 |
|---|---|---|
| `STORAGE_WASTE` | warn | 30일 최대 사용률 < 50% (단, allocated ≥ 50 GB) |
| `STORAGE_GP2` | info | `StorageType === "gp2"` |
| `STOPPED_LONG` | warn | stopped 상태 14일 이상 (이벤트 기반) |
| `STOPPED` | info | stopped 상태 14일 미만 |
| `ZERO_CONNECTION` | warn | available + max connections == 0 |
| `CPU_LOW` | info | available + max CPU < 10% |
| `SNAPSHOT_MANY` | info | 자동 스냅샷 > 15개 |
| `REPLICA_CROSS_AZ` | warn | read replica AZ ≠ source AZ |
| `ENGINE_EOL` | critical/warn | MySQL < 8 / PostgreSQL < 14 / MariaDB < 10 |

## 보안 룰 제외

스크립트 doc-comment 에 명시:

> 보안 룰(PubliclyAccessible, default SG)은 정책상 금지로 제외.

즉 이 스크립트는 **운영/비용 측면만** 다룬다. 보안 finding 은 의도적으로 비워둠.

## Cost Explorer 사용

`--cost` 플래그 시 인스턴스별 월 비용 조회. 단 코드 주석에 명시된 한계:

> 정확한 인스턴스별 비용은 Cost Allocation Tags 활성화 필요. 현재는 `Dimensions: { Key: RESOURCE_ID }` 로 시도하지만 매칭 안 될 수 있음.

CE 호출은 us-east-1 강제 (CE 엔드포인트 전용). 호출당 약 $0.01 과금.

## 출력 모드

- 사람 친화 (디폴트): 인스턴스별 카드 형식, 마지막에 총괄 행
- `--findings`: findings 가 있는 인스턴스만 코드/메시지 나열
- `--json`: 그대로 직렬화 (`InstanceReport[]`)

## 데이터 출처

| 호출 | 윈도우 |
|---|---|
| `DescribeDBInstances` | 현재 |
| `DescribeDBSnapshots(DBInstanceIdentifier)` | 전부 |
| `DescribeEvents(SourceType: "db-instance", Duration: 20160)` | 14일 |
| CloudWatch `CPUUtilization`/`DatabaseConnections`/`FreeStorageSpace`/`FreeableMemory` | `--days` (기본 30일), Period 86400 (일일) |
| `GetCostAndUsage` | 이전 캘린더 월 (`--cost` 시) |

## 함정

- 리전 `ap-northeast-2` 하드코딩 — env 무시. 다른 리전 인스턴스는 안 보임.
- ENGINE_EOL 규칙은 단순 major version 비교. AWS 의 실제 EOL 일정과 정밀히 맞지 않을 수 있음 — 룰 갱신 책임 사람에게.
- `evaluateFindings` 안의 룰 추가 시 `Finding.code` 충돌·`level` 일관성 직접 챙겨야 함 (타입은 string).
