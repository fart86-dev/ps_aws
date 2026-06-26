---
type: repo-wiki
repo: ps-aws-infra-monitor
domains: []
area: cost-waste
stack: [aws-sdk-v3, ec2, rds, cloudwatch]
status: active
updated: 2026-06-25
---

# cost-waste — 낭비 자원 탐지

#domain/cost-waste

## 이 리포에서의 처리

이 영역은 **주 1회(기본 월요일 KST 09:00) EC2/EBS/EIP/ENI/Snapshot/RDS 의 잔재를 긁어 카테고리별로 분류하고 월 절감 추정액과 함께 Telegram 으로 보내는** 것이다. 실제 삭제는 하지 않는다. **읽기 전용 + 알림.**

## 파일 매핑

| 파일 | 역할 |
|---|---|
| `src/infra-monitor/waste.ts` | 컬렉터 6종 + `collectWaste()` 통합 |
| `src/scheduler/index.ts:runWasteCheck` | `WASTE_CRON_SCHEDULE` 트리거 (기본 `0 0 * * 1`) |
| `src/server.ts` GET `/infra/waste` | 수동 트리거 + `?notify=true` 시 Telegram 발사 |
| `src/notifiers/telegram.ts:sendWasteReportToTelegram` | 카테고리별 그룹화 메시지 |
| `src/notifiers/index.ts:sendWasteReport` | Telegram만 호출, `{ onlyIfItems: true }` 옵션으로 빈 리포트 스킵 |

## 컬렉터 6종

| 카테고리 | 컬렉터 | 기준 |
|---|---|---|
| `stopped-ec2` | `findStoppedEC2` | `WASTE_STOPPED_EC2_DAYS` (기본 14) 일 이상 stopped |
| `idle-eip` | `findIdleEIPs` | `AssociationId` 없는 EIP |
| `unattached-ebs` | `findUnattachedEBS` | volume status = `available` |
| `unattached-eni` | `findUnattachedENIs` | status=available + `RequesterManaged: false` |
| `old-snapshot` | `findOldSnapshots` | `WASTE_OLD_SNAPSHOT_DAYS` (기본 365) 일 이상 묵힘 |
| `rds-storage-waste` / `rds-storage-gp2` / `rds-replica-cross-az` | `findRDSWaste` | 사용률 < `WASTE_RDS_STORAGE_PCT` (50%) 또는 gp2 사용 또는 replica AZ ≠ source AZ |

## 가격 모델 (코드 내장, 서울 리전 근사)

`waste.ts:PRICE` 객체. 단위: USD/월.

| 항목 | 단가 |
|---|---|
| EIP idle | 3.6 |
| EBS gp3 | 0.0912 /GB |
| EBS gp2 | 0.114 /GB |
| EBS io1/io2 | 0.142 /GB |
| Snapshot | 0.05 /GB |

업데이트는 코드 수정으로. **AWS 가격 변경 시 수동 sync 필요** — 자동 추적 안 함.

## 절감액 누적 규칙

- `stopped-ec2` 는 `estimatedMonthlySavingUSD: 0` 으로 박혀 있다 — [[../gotchas]] "stopped EC2 의 절감액 = 0" 참조 (root EBS 가 어디서도 카운트 안 됨).
- `unattached-eni` 도 `0` (실제 비용 없음).
- `rds-replica-cross-az` 는 `0` (DT 변동이라 단정 어려움이라 주석 명시).
- 나머지는 실제 추정.
- 합계는 `totalEstimatedSavingsUSD = sum(estimatedMonthlySavingUSD)`. 알림 메시지 헤더에 노출.

## 알림 동작

- 스케줄러는 `sendWasteReport(report, { onlyIfItems: true })` — 항목 0건이면 알림 안 보냄.
- 수동 `GET /infra/waste?notify=true` 는 빈 리포트도 보낸다 (`✅ 잔재 없음 — 깔끔합니다`).

## 함정 / 알 수 없는 부분

- 가격이 코드 리터럴이라 [[../runbook]] env 와 어긋날 때 갱신 책임이 사람에게 있음.
- `findUnattachedENIs` 가 `RequesterManaged: true` 를 거르긴 하지만 일부 managed ENI 는 description 으로만 식별되는 경우가 있다 — 화이트리스트가 부정확하면 노이즈.
- RDS Storage 사용률 계산은 30일 윈도우의 `FreeStorageSpace Minimum` 사용. 30일 사이 잠깐 솟은 사용량이 있어도 보수적으로 평가됨.
