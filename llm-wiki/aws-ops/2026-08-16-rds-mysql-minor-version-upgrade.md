---
type: aws-op
date: 2026-08-16
account: "306331009209"
region: ap-northeast-2
category: [rds, mysql, engine-upgrade]
impact: AWS Health 필수 마이너 버전 지원종료(2026-10-31) 선제 대응
status: done
---

# 2026-08-16 · production-mshuttle / read1 MySQL 8.4.5 → 8.4.9 인플레이스 업그레이드

AWS Health 공지(8.4.5, 8.4.6, 5.7.44-RDS.20250213/0508/0818 → 2026-10-31 표준 지원 종료) 대응. 배경 [[../aws-pending#rds-for-mysql-마이너-버전-지원-종료-aws-health-공지-2026-08-14-수신]], 절차 원본 [[../aws-runbooks/rds-mysql-minor-version-upgrade]]. 이 문서는 실제 실행 로그.

목표 버전 **8.4.9** (AWS 최소 요구 8.4.8보다 한 단계 위 — dev-mshuttle이 이미 8.4.9로 안정 운영된 이력을 검증 근거로 채택, 2026-08-16 사용자 결정). 방식 **인플레이스**, replica 먼저 → source 나중.

---

## 1) 사전 점검 (완료)

| 항목 | production-mshuttle | production-mshuttle-read1 |
|---|---|---|
| PendingModifiedValues | `{}` | `{}` |
| Status | available | available |
| Version | 8.4.5 | 8.4.5 |
| Replication | — | `replicating`, `Normal: true` |

## 2) Step 1: production-mshuttle 수동 스냅샷 (완료)

```bash
REGION=ap-northeast-2

aws rds create-db-snapshot --region $REGION \
  --db-instance-identifier production-mshuttle \
  --db-snapshot-identifier production-mshuttle-pre-8-4-9-upgrade-2026-08-16

aws rds wait db-snapshot-completed --region $REGION \
  --db-snapshot-identifier production-mshuttle-pre-8-4-9-upgrade-2026-08-16
```

> **함정 메모:** 스냅샷/인스턴스 identifier는 `.`(마침표)를 허용하지 않음 (letters/digits/hyphens만). runbook 초안의 `...pre-8.4.9-upgrade...`는 `InvalidParameterValue`로 거부됨 → `pre-8-4-9-upgrade`로 정정. 향후 버전 문자열을 identifier에 쓸 때 참고.

**결과:** `production-mshuttle-pre-8-4-9-upgrade-2026-08-16`, `Status: available`, `Progress: 100%` (2026-08-16 확인).

---

## 3) Step 2: read replica 업그레이드 (8.4.5 → 8.4.9)

```bash
aws rds modify-db-instance --region $REGION \
  --db-instance-identifier production-mshuttle-read1 \
  --engine-version 8.4.9 \
  --apply-immediately
```

폴링:

```bash
while true; do
  STATUS=$(aws rds describe-db-instances --region $REGION \
    --db-instance-identifier production-mshuttle-read1 \
    --query "DBInstances[0].DBInstanceStatus" --output text)
  echo "$(date '+%H:%M:%S') read1 status: $STATUS"
  [ "$STATUS" = "available" ] && break
  sleep 15
done
```

**결과:** ✅ 완료. 실제 엔진 업그레이드는 14:11:17~14:13:20 UTC(약 2분)에 끝났으나, `DBInstanceStatus`가 `upgrading` → `configuring-enhanced-monitoring` → `available`로 넘어가는 데 총 약 40분 소요(14:10 시작 ~ 14:5x경 available). `describe-events`로 확인한 실제 다운타임 구간: `The downtime started`(14:10:19) ~ `DB instance restarted`(14:12:56), 약 2분 37초. **`MonitoringInterval: 0`(enhanced monitoring 미사용)인데도 `configuring-enhanced-monitoring` 상태를 오래 거쳐감 — 원인 불명, gotcha 후보로 기록** (아래 [9) 관찰 사항] 참조).

---

## 4) Step 3: replica 버전 + 복제 상태 확인

```bash
aws rds describe-db-instances --region $REGION \
  --db-instance-identifier production-mshuttle-read1 \
  --query "DBInstances[0].{Version:EngineVersion,Status:DBInstanceStatus,Replication:StatusInfos}"
```

기대값: `Version: 8.4.9`, `Status: available`, `StatusInfos[0].Status: replicating`, `Normal: true`.

**결과:** ✅ 전부 기대값과 일치 (`Version: 8.4.9`, `Status: available`, `replicating`, `Normal: true`). source 진행해도 안전.

---

## 5) Step 4: production-mshuttle (source) 업그레이드 (8.4.5 → 8.4.9)

⚠️ 이 단계에서 실다운타임 발생 (단일 AZ 재부팅).

```bash
aws rds modify-db-instance --region $REGION \
  --db-instance-identifier production-mshuttle \
  --engine-version 8.4.9 \
  --apply-immediately
```

폴링:

```bash
while true; do
  STATUS=$(aws rds describe-db-instances --region $REGION \
    --db-instance-identifier production-mshuttle \
    --query "DBInstances[0].DBInstanceStatus" --output text)
  echo "$(date '+%H:%M:%S') production-mshuttle status: $STATUS"
  [ "$STATUS" = "available" ] && break
  sleep 15
done
```

**결과:** ✅ 완료. 실다운타임(`DB instance shutdown` 14:18:22 ~ `DB instance restarted` 14:20:42): **약 2분 20초**. 엔진 업그레이드 자체는 14:20:47 "finished". 이후 `DBInstanceStatus`가 `upgrading` → `configuring-enhanced-monitoring` → `modifying`(Monitoring Interval 60 복원, Performance Insights 재활성화, 파라미터 그룹 갱신) → `available`로 전환되는 데 총 약 30분 소요 — replica와 같은 패턴(실다운타임은 짧지만 상태 반영에 시간이 걸림, [9) 관찰 사항] 참조).

---

## 6) Step 5: 검증

```bash
aws rds describe-db-instances --region $REGION \
  --db-instance-identifier production-mshuttle \
  --query "DBInstances[0].EngineVersion"

aws rds describe-db-instances --region $REGION \
  --db-instance-identifier production-mshuttle-read1 \
  --query "DBInstances[0].{Version:EngineVersion,Replication:StatusInfos}"
```

**결과:** ✅ 양쪽 다 `8.4.9` 확인. `production-mshuttle-read1`은 `available`, 복제 `Normal: true`. (mysql 클라이언트로 실접속한 `SELECT VERSION()` 검증은 미실행 — AWS API 상 버전/상태/복제로 충분히 확인됐다고 판단해 생략.)

---

## 7) 결과 요약

| 단계 | 시각 (UTC) | 결과 |
|---|---|---|
| 사전 점검 | 2026-08-16 | ✅ PendingModifiedValues 양쪽 빈 상태 확인 |
| Step 1. 스냅샷 | 2026-08-16 | ✅ `production-mshuttle-pre-8-4-9-upgrade-2026-08-16` 완료 |
| Step 2. replica 업그레이드 | 14:10:19(다운타임 시작)~14:12:56(재시작) | ✅ 실다운타임 약 2분 37초, 상태 반영까지 총 약 40분 |
| Step 3. replica 검증 | | ✅ 8.4.9, available, replicating Normal |
| Step 4. source 업그레이드 | 14:18:22(shutdown)~14:20:42(restarted) | ✅ 실다운타임 약 2분 20초, 상태 반영까지 총 약 30분 |
| Step 5. 최종 검증 | | ✅ 양쪽 8.4.9, available, 복제 정상 |

**다운타임 (source, 실측):** 약 2분 20초 (14:18:22 ~ 14:20:42 UTC)

## 8) 관찰 사항

- **실제 다운타임(수 분)과 `DBInstanceStatus`가 `available`로 반영되기까지 걸리는 시간(수십 분) 사이에 큰 격차가 있음.** 두 인스턴스 모두 `engine version upgrade finished` 이벤트 직후 실질적으로 서비스 가능한 상태였을 가능성이 높지만, `configuring-enhanced-monitoring` / `modifying`(Monitoring Interval·Performance Insights·파라미터 그룹 재적용) 단계를 거치며 API 상 상태 전환에 시간이 걸림. runbook의 "예상 시간 30분~1시간"은 벗어나지 않았지만 각 단계(Step 2/4)만 보면 예상(5~15분)의 2~3배. 다음 업그레이드 계획 시 참고.
- **스냅샷/인스턴스 identifier에 `.`(마침표) 사용 불가** — [[../aws-runbooks/rds-mysql-minor-version-upgrade]]에도 기록.

## 9) 후속

- [x] [[../aws-pending#rds-for-mysql-마이너-버전-지원-종료-aws-health-공지-2026-08-14-수신]] 상태를 완료로 갱신
- [ ] 스냅샷 `production-mshuttle-pre-8-4-9-upgrade-2026-08-16`은 검증 안정화 후(예: 1~2주) 정리 여부 결정 — 보관 중엔 storage 비용 발생
- [ ] 애플리케이션 쪽 정상 동작(에러 로그, 커넥션) 사후 모니터링 필요
