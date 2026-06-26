---
type: aws-op
date: 2026-06-03
account: "306331009209"
region: ap-northeast-2
category: [rds, read-replica, data-transfer]
impact: -$17.82/월 (-$214/년) 확정
status: done
---

# 2026-06-03 · production-mshuttle-read1 AZ 이동 (cross-AZ data transfer 제거)

ps_aws 의 `pnpm rds:status` finding `REPLICA_CROSS_AZ` 를 해소하는 작업. 옛 read1 (AZ-2a) 을 source 와 같은 AZ-2c 로 옮겨 inter-AZ data transfer 비용 제거.

⚠️ rename + waiter 함정에 걸려 운영 영향이 메모리 예상보다 컸음 (3~4분 read endpoint 부재). 교훈은 아래 [5) 사고/교훈].

---

## 1) 배경

| Finding | 내용 |
|---|---|
| `REPLICA_CROSS_AZ` | source (AZ-2c) ↔ read1 (AZ-2a) inter-AZ data transfer 발생 |
| `STORAGE_WASTE` | read1 100GB 할당 / 11.5GB 사용 (11%) |

### 메모리 계획 vs 실제 가능 (AWS 제약 발견)

| 절감 항목 | 메모리 계획 | 실제 가능 |
|---|---|---|
| Cross-AZ data transfer 제거 | -$17.82/월 | ✅ -$17.82/월 |
| Storage 75GB 축소 (100→25) | -$6.96/월 | ❌ **불가** (`allocated-storage` 는 source 이상이어야 함) |
| gp2→gp3 전환 | (계획에 포함) | ❌ 이미 gp3 였음 (오해) |
| **합계** | **-$24.78/월** | **-$17.82/월** (옵션 A 선택) |

→ 옵션 A (cross-AZ 만 해결, 100GB 유지) 진행. Storage 축소는 source 자체를 dump/restore 로 줄여야 가능 → [[../aws-pending#production-mshuttle-source-storage-축소]] 로 분리.

## 2) 점검

| 항목 | 결과 |
|---|---|
| source backup retention | 7일 ✅ (read replica 생성 prerequisite) |
| source storage encryption | True (KMS `226af992` = aws/rds default) |
| 옛 read1 활동 | DatabaseConnections 평균 2~3 / 피크 8 / ReadIOPS 평균 50 (활발) |
| 작업 시간대 | 07:20 KST 오전 = 저트래픽 시간대 |
| Parameter group | source `params-production-mysql84` → 새 replica 가 자동 inherit |
| Security Group | sg-a8fee9c1 동일 |

## 3) 실행 명령 (5단계)

```bash
REGION=ap-northeast-2
SRC=production-mshuttle

# Step 1: 새 replica 생성 (AZ-2c, 100GB gp3)
aws rds create-db-instance-read-replica --region $REGION \
  --db-instance-identifier production-mshuttle-read1-new \
  --source-db-instance-identifier $SRC \
  --availability-zone ap-northeast-2c \
  --db-instance-class <기존 read1 과 동일 class> \
  --storage-type gp3 \
  --no-multi-az
# 11분 (07:22~07:33). parameter group params-production-mysql84 자동 inherit.

# Step 2: replica lag 확인
aws rds describe-db-instances --region $REGION \
  --db-instance-identifier production-mshuttle-read1-new \
  --query 'DBInstances[0].StatusInfos'
# lag 0초 확인 (07:34)

# Step 3a: 옛 read1 rename → -old
aws rds modify-db-instance --region $REGION \
  --db-instance-identifier production-mshuttle-read1 \
  --new-db-instance-identifier production-mshuttle-read1-old \
  --apply-immediately

# ⚠️ Step 3a 직후 waiter
aws rds wait db-instance-available --region $REGION \
  --db-instance-identifier production-mshuttle-read1-old
# ← 이 waiter 가 rename 직후 NotFound 응답에 즉시 실패. (사고 원인)

# Step 3b: 새 -new rename → read1
aws rds modify-db-instance --region $REGION \
  --db-instance-identifier production-mshuttle-read1-new \
  --new-db-instance-identifier production-mshuttle-read1 \
  --apply-immediately

# Step 4: 새 read1 connection 정상 전환 확인
# (운영 앱이 production-mshuttle-read1 hostname 사용 → 자동 전환됨)

# Step 5: 옛 -old 삭제
aws rds delete-db-instance --region $REGION \
  --db-instance-identifier production-mshuttle-read1-old \
  --skip-final-snapshot \
  --delete-automated-backups
# 1분 38초 (07:53~07:54)
```

## 4) 결과 (시각 + 결과)

| 단계 | 시각 (KST) | 결과 |
|---|---|---|
| 1. 새 replica 생성 | 07:22~07:33 | ✅ 11분, parameter group 자동 inherit |
| 2. replica lag 확인 | 07:34 | ✅ 0초 |
| 3. rename swap | 07:35~07:39 | ⚠️ waiter 함정으로 부분 실패 → 긴급 복구 |
| 4. 새 read1 connection 정상 전환 | 07:43 | ✅ 자동 (rename 후 4분) |
| 5. 옛 -old 삭제 | 07:53~07:54 | ✅ 1분 38초 |

**총 소요: 약 32분**

## 5) 사고 / 교훈

### 운영 영향 (정직한 보고)
- **read endpoint 부재 시간: 07:35 ~ 07:39 (약 3~4분)**
- 메모리 예상 "~1분 끊김" 보다 길었음
- 그동안 앱의 read 쿼리는 DNS 실패 가능

### 원인
- `aws rds wait db-instance-available` 이 rename 직후 NotFound 응답에 **즉시 실패** (재시도 없음)
- Step 3a 의 waiter 실패 → Step 3b 가 첫 rename 완료 전 실행 → `DBInstanceAlreadyExists` 충돌

### 교훈 (gotcha)
**AWS rename + waiter 조합은 위험.** waiter 대신 폴링 루프 (NotFound 도 재시도에 포함) 사용 권장.

[[../gotchas#rds-rename-waiter-함정]] 에 정리됨.

### 옛 read1-old 잔존 connection 분석
- rename 후 옛 -old 에 1 connection 잔존 (운영 앱은 새 read1 로 정상 전환됨)
- 운영 코드는 `production-mshuttle-read1` hostname 사용 → 새 인스턴스로 연결됨
- 옛 인스턴스의 1 connection 은 사람/agent 가 옛 endpoint 를 직접 알고 접속한 것 → 운영 영향 없음
- → 옛 -old 즉시 삭제로 처리

## 6) 영향

- **-$17.82/월 (-$214/년)** — Inter-AZ Data Transfer 제거

### ps_aws 모니터링 finding 해소
- `REPLICA_CROSS_AZ`: ✅ 해소
- `STORAGE_WASTE`: ❌ 미해소 (source 축소 별도 작업 필요)

## 7) 후속

- **source `production-mshuttle` storage 축소**: 100GB → 25GB. dev-mshuttle 과 동일한 dump/restore 방식 필요. read replica 100GB 제약도 함께 해소됨. 잠재 -$6.96/월. → [[../aws-runbooks/rds-shrink-migration]] (dev 가이드 참고), [[../aws-pending#production-mshuttle-source-storage-축소]]
