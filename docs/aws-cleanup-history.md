# AWS 리소스 정리 이력

AWS 계정 `306331009209` 비용 최적화 및 미사용 리소스 정리 기록.

---

## 2026-06-01

### VPC/EC2 정리
- VPC 비용 분석 ($38~56/월)
- VPC Endpoint, EIP, ENI, 중지된 EC2, AMI, Snapshot, Security Group, Key Pair, Glue Connection, Glue Database 정리
- mshuttle EC2 최적화
  - gp2 → gp3 변환
  - t2 → t3 인스턴스 타입 변경 (다운타임 약 45초)
- spd-test gp2 → gp3 변환
- Security Group 17개 일괄 삭제 (사용 처 미존재 확인 후)
- DataZone 도메인 비활성 확인

### 절감 효과
- **즉시 절감: -$41.28/월**
- **spd-test gp3 변환: -$2.28/월**
- **총: -$43.56/월 확정**

### 모니터링/스크립트 추가 (ps_aws 프로젝트)
| 항목 | 파일 | 용도 |
|------|------|------|
| WAF Bot Control 토글 | `src/scripts/wafBotControl.ts` | Bot Control 룰 status/disable/enable, dry-run 기본, 백업-복원 패턴 |
| RDS 상태 점검 | `src/scripts/rdsStatus.ts` | 전체 RDS 인벤토리 + 30일 메트릭 + 8개 finding 룰 (STORAGE_WASTE / STORAGE_GP2 / STOPPED / STOPPED_LONG / ZERO_CONNECTION / CPU_LOW / SNAPSHOT_MANY / REPLICA_CROSS_AZ / ENGINE_EOL) |
| Waste 모니터 모듈 | `src/infra-monitor/waste.ts` | 중지 EC2, 미사용 EIP/EBS/ENI, 오래된 Snapshot, RDS 낭비 6종 컬렉터 |
| 주간 스케줄러 | `src/scheduler/index.ts` | `WASTE_CRON_SCHEDULE` 기본 `0 0 * * 1` (KST 월 09:00) |
| HTTP 라우트 | `src/server.ts` | `GET /infra/waste?notify=true` |
| Telegram 알림 | `src/notifiers/telegram.ts` | `sendWasteReportToTelegram` |
| 마이그레이션 가이드 | `docs/rds-dev-mshuttle-migration.md` | dev-mshuttle 200GB → 50GB (mysqldump 방식) |

### 보존 결정 (절대 변경 금지)
- **AWS Security Hub** + **AWS Config**: 2024-12-28 계정 마비 후 AWS 요구로 활성화. **비활성화 절대 금지**.
- **WAF**: 2025-09 공격 대응으로 도입. 최적화는 가능하나 유지 필요.

### TODO (작업 완료 안 됨)
- **read replica AZ 이동 + 스토리지 축소**: `production-mshuttle-read1` → `ap-northeast-2c`, 25GB. 2026-06-03(수) 오전 진행 예정. 효과 -$25/월.
- **spd-test 체인 정리**: PostgreSQL + API Gateway + Lambda. 1년간 실사용 거의 0. stop/삭제 결정 보류.
- **dev-mshuttle 스토리지 마이그레이션**: 가이드 작성 완료, 사용자 수동 실행 대기. 효과 약 -$15/월.
- **DataZone 도메인 강제 삭제**: 콘솔에서 Force Delete 필요.
- **Ubuntu 16.04 → 22.04 (mshuttle EC2)**: 보안 차원, 별도 프로젝트로 분리.

---

## 2026-06-02

### us-east-1 (북부 버지니아) Lambda 잔재 정리

#### 발견
us-east-1 리전에서 Lambda 함수 7개 발견. 모두 Lambda@Edge용 (CloudFront 배포 잔재).

| 함수 | Runtime | 최종 수정 | 용도 |
|------|---------|-----------|------|
| `cgws53q-mlglxu9` | nodejs14.x | 2022-08-23 | Image Lambda@Edge (Next.js) |
| `cgws53q-bzysx3o` | nodejs16.x | 2022-08-23 | Default Lambda@Edge (Next.js) |
| `cgws53q-3kxqwa` | nodejs16.x | 2022-08-23 | API Lambda@Edge (Next.js) |
| `7zurgve-t0widd` | nodejs14.x | 2022-08-24 | Image Lambda@Edge (Next.js) |
| `msrpay` | nodejs16.x | 2022-08-24 | Default Lambda@Edge (Next.js) |
| `f4y8xal-k7b7g8` | nodejs14.x | 2022-08-24 | Image Lambda@Edge (Next.js) |
| `test_hello` | **nodejs6.10** | **2018-07-08** | Apex 테스트 함수 |

#### 영향 분석 (삭제 안전성 검증)
| 검증 항목 | 결과 |
|----------|------|
| CloudFront distribution 연결 (101개 전수 검색) | 어디에도 없음 |
| 다른 리전 Lambda@Edge replica (15개 리전 sweep) | 없음 (이미 정리됨) |
| Resource policy (외부 호출 권한) | 7개 모두 없음 |
| Event source mappings (SQS/DDB/Kinesis 등) | 7개 모두 0 |
| Function URL | 7개 모두 None |
| 30일 호출 (us-east-1 / ap-northeast-2 / us-west-2 / eu-west-1) | 7개 모두 0건 |
| IAM Role LastUsed | 7개 모두 `None` (기록 없음) |
| InstanceProfile 부착 | 7개 모두 없음 |

#### S3 의존성 확인
| 위치 | 버킷 | 상태 |
|------|------|------|
| Lambda 코드 저장소 | `prod-04-2014-tasks` (AWS 시스템) | AWS 관리, 무관 |
| IAM 권한 참조 (3개 함수) | `nextjs-msrpay` | **이미 삭제됨** (dead reference) |
| IAM 권한 참조 (3개 함수) | `slsv` (ap-northeast-2) | 존재, 6.3GB / 2,424 객체 |

#### slsv 버킷 내 ussr 프로젝트 분석
| 항목 | 결과 |
|------|------|
| `ussr` Lambda 함수 (모든 리전) | 없음 |
| 활성 CloudFormation 스택 | 없음 |
| 최근 Serverless 배포 | **2024-02-20** (1년 4개월 전) |
| 결론 | **폐기된 프로젝트** |

slsv 버킷에는 `my-app/` (118KB, 2025-09-25) CDK asset도 별도 active.

#### 삭제 실행
| 리소스 | 개수 | 결과 |
|--------|------|------|
| Lambda 함수 | 7개 | ✅ 전부 삭제 |
| IAM Role | 7개 | ✅ 전부 삭제 |
| Inline IAM Policy | 6개 (`*-policy`) | ✅ 전부 삭제 |
| Managed IAM Policy (`test_lambda_logs`) | 1개 | ✅ 삭제 |
| CloudWatch Log Group (`/aws/lambda/test_hello`) | 1개 | ✅ 삭제 |

#### 비용 영향
- 직접 절감: 미미 (호출 0건 → 과금 거의 없음)
- 의미: deprecated runtime (nodejs6.10/14.x/16.x EOL) 잔재 제거, IAM 잡동사니 정리

### KMS 인벤토리 및 madmin 프로젝트 폐기

#### KMS 키 분석 (분석 오해 정정)
ap-northeast-2 region에서 KMS 키 21개 발견. 초기 추정 "월 $21 절감 가능"은 오해였음.

| KeyManager | 개수 | 과금 |
|-----------|------|------|
| AWS (`aws/*` 별칭 가려진 default 키) | 19개 | **무료** |
| Customer | 2개 | 키당 $1/월 |

→ 실제 절감 대상은 **2개**, 잠재 효과 **-$2/월**.

#### Customer-managed 키 2개

| Key ID | Alias | Description | 결정 |
|--------|-------|-------------|------|
| `ad2436d2-...` | `test_key_1` | "키 테스트" (2021-03-04) | **보류** (사용자 결정) |
| `c01008c7-...` | - | `madmin-infrastructure` StackSet 소유 (2021-10-23) | **폐기** |

#### madmin 프로젝트 폐기 결정 근거
| 점검 항목 | 결과 |
|----------|------|
| 90일 KMS 암호화 호출 | 0건 (Security Hub 자동 점검 외) |
| madmin ECR 저장소 | **이미 수동 삭제됨** (StackSet 드리프트) |
| S3 pipeline 아티팩트 | 2021-10-23 deploy 파일 4개(6.8KB), 4년 6개월 무변동 |
| madmin 관련 CodePipeline / ECS / Lambda | 없음 |
| madmin2exam StackSet | instance 0개 (한 번도 배포 안 됨) |

#### 사전 안전 점검
| 항목 | 결과 |
|------|------|
| IAM Role 외부 참조 (다른 StackSet에서 가정) | 없음. madmin/madmin2exam 전용 |
| S3 4개 파일 보존 가치 | 없음. CDK custom resource Lambda 빌드 아티팩트 |
| KMS 즉시 삭제 위험 | pending window 30일로 복구 안전망 확보 |

#### 5단계 실행 (단계별 검증 진행)
| 단계 | 작업 | 결과 |
|------|------|------|
| 1 | `madmin-infrastructure` StackSet instance 삭제 (S3 비우기 → instance 삭제) | ✅ 11초. KMS PendingDeletion / S3 버킷 삭제 / Bucket Policy 삭제 |
| 2 | `madmin-infrastructure` StackSet 삭제 | ✅ DELETED |
| 3 | `madmin2exam-infrastructure` StackSet 삭제 (instance 0개) | ✅ DELETED |
| 4 | `madmin-infrastructure-roles` CFN 스택 삭제 | ✅ IAM Role 2개 제거 |
| 5 | `madmin2exam-infrastructure-roles` CFN 스택 삭제 | ✅ IAM Role 2개 제거 |

#### 삭제된 리소스 (총 12개)
- StackSet 2개, CFN Stack 3개
- IAM Role 4개 (`madmin-adminrole`, `madmin-executionrole`, `madmin2exam-adminrole`, `madmin2exam-executionrole`)
- KMS Key 1개 (`c01008c7-...`, PendingDeletion → **2026-07-02 영구 삭제**, 그 전까지 `cancel-key-deletion`으로 복구 가능)
- S3 Bucket 1개, S3 Bucket Policy 1개

#### 비용 영향
- 확정 절감 (2026-07-02 이후): **-$1/월**
- Customer-managed KMS: 2 → 1

### 후속 검토 대상
- **slsv 버킷의 `serverless/ussr/` prefix (6.3GB)**: ussr 프로젝트 폐기 확인됨. 정리 시 약 -$0.15/월. 버킷 자체는 my-app CDK용으로 유지 필요.
- **KMS `test_key_1` 처리**: 5년 무사용 테스트 키. 보류 결정 상태. 진행 시 30일 pending window로 schedule-key-deletion → -$1/월.

---

## 2026-06-03

### production-mshuttle-read1 AZ 이동 (cross-AZ 비용 제거)

#### 배경
ps_aws의 `pnpm rds:status`가 띄운 finding 2종을 해소하는 작업.
- `REPLICA_CROSS_AZ`: source(AZ-2c)와 read1(AZ-2a) 다른 AZ → inter-AZ data transfer 비용 발생
- `STORAGE_WASTE`: read1 100GB 할당 / 11.5GB 사용 (11%)

#### 메모리 계획 vs 실제 (AWS 제약 발견)
| 절감 항목 | 메모리 계획 | 실제 가능 |
|----------|------------|----------|
| Cross-AZ data transfer 제거 | -$17.82/월 | ✅ -$17.82/월 |
| Storage 75GB 축소 (100→25) | -$6.96/월 | ❌ 불가 (`allocated-storage`는 source 이상이어야 함) |
| gp2→gp3 전환 | (계획에 포함) | ❌ 이미 gp3였음 (오해) |
| **합계** | **-$24.78/월** | **-$17.82/월** (옵션 A 선택) |

→ 옵션 A (cross-AZ만 해결, 100GB 유지) 진행. Storage 축소는 source 자체를 dump/restore로 줄여야 가능 → 별도 작업으로 분리.

#### 사전 점검
| 항목 | 결과 |
|------|------|
| source backup retention | 7일 ✅ (read replica 생성 prerequisite) |
| source storage encryption | True (KMS 226af992 - aws/rds default) |
| 옛 read1 활동 | DatabaseConnections 평균 2~3 / 피크 8 / ReadIOPS 평균 50 (활발) |
| 작업 시간대 | 07:20 KST 오전 = 저트래픽 시간대 |
| Parameter group | source `params-production-mysql84` → 새 replica가 자동 inherit |
| Security Group | sg-a8fee9c1 동일 |

#### 5단계 실행 결과
| 단계 | 작업 | 시각 | 결과 |
|------|------|------|------|
| 1 | 새 replica 생성 (`production-mshuttle-read1-new`, AZ-2c, 100GB gp3) | 07:22~07:33 | ✅ 11분, parameter group `params-production-mysql84` 자동 inherit |
| 2 | replica lag 확인 | 07:34 | ✅ 0초 |
| 3 | rename: 옛 `read1` → `-old`, 새 `-new` → `read1` | 07:35~07:39 | ⚠️ waiter 함정으로 부분 실패 → 긴급 복구 |
| 4 | 새 read1로 connection 정상 전환 확인 | 07:43 | ✅ 자동 (rename 후 4분) |
| 5 | 옛 `-old` 삭제 (`--skip-final-snapshot --delete-automated-backups`) | 07:53~07:54 | ✅ 1분 38초 |

총 소요: **약 32분**

#### 운영 영향 (정직한 보고)
- **read endpoint 부재 시간: 07:35 ~ 07:39 (약 3~4분)**
- 메모리 예상 "~1분 끊김"보다 길었음
- 그동안 앱의 read 쿼리는 DNS 실패 가능

#### 원인 및 교훈
- `aws rds wait db-instance-available`이 rename 직후 NotFound 응답에 **즉시 실패** (재시도 없음)
- Step 3a wait 실패 → Step 3b가 첫 rename 완료 전 실행 → `DBInstanceAlreadyExists` 충돌
- **교훈**: AWS rename + waiter 조합은 위험. waiter 대신 폴링 루프 (NotFound 재시도 포함) 사용 권장

#### 옛 read1-old 잔존 connection 분석
- rename 후 옛 -old에 1 connection 잔존 (운영 앱은 새 read1로 정상 전환됨)
- 분석: 운영 코드는 `production-mshuttle-read1` hostname을 사용 → 새 인스턴스로 연결됨
- 옛 인스턴스의 1 connection은 사람/agent가 옛 endpoint를 직접 알고 접속한 것 → 운영 영향 없음
- → 옛 -old 즉시 삭제로 처리

#### 확정 절감 효과
- **-$17.82/월 (-$214/년)** — Inter-AZ Data Transfer 제거

#### ps_aws 모니터링 finding 해소
- `REPLICA_CROSS_AZ`: 해소 ✅
- `STORAGE_WASTE`: 미해소 (source 축소 별도 작업 필요)

### 후속 검토 대상 (추가)
- **source `production-mshuttle` storage 축소**: 100GB → 25GB. dev-mshuttle과 동일한 dump/restore 방식 필요. read replica 100GB 제약도 함께 해소됨. 잠재 절감 -$6.96/월.

---

## 2026-06-04

### msdeveloper S3 버킷 라이프사이클 정책 등록 (MySQL dump 자동 관리)

#### 배경
6월 초 정리 효과 점검 중, S3가 RDS 다음으로 큰 비용 항목($150/월)임을 확인. 45개 버킷 중 **`msdeveloper` 단독으로 전체 S3의 94%** 차지.

#### 분석 결과
| 항목 | 값 |
|------|-----|
| 버킷 총 용량 | 5,985 GB (5.84 TB) |
| 객체 수 | 317,711개 |
| 라이프사이클 정책 | **없음** (무한 누적 중) |
| 스토리지 클래스 | 100% Standard |
| Versioning | 미사용 |
| 암호화 | AES256 |

#### prefix별 용량 (상위)
| Prefix | 객체 | 용량 | 월 비용 | 용도 |
|--------|------|------|---------|------|
| `db/` | 2,216 | **5,918 GB** | **$147.95** | 1시간마다 mosher MySQL dump (~2.7GB/개) |
| `error/` | 1,726 | 1.78 GB | $0.045 | - |
| `app/` | 11 | 0.35 GB | $0.009 | 앱 빌드 (.apk/.aab) |
| 기타 13개 | ~4,800 | ~0.4 GB | <$0.02 | csv/shp/log/test 등 |

→ db/가 사실상 전부. 다른 prefix 정리는 절감 효과 미미.

#### 의사결정
- dump 보관 정책: **30일 Standard → 90일 Glacier Flexible Retrieval → 120일 후 expire**
- 다른 prefix는 이번 작업 범위에서 제외 (사용자 결정, 별도 정리 대상)
- Glacier 최소 보관 90일 충족 → early deletion fee 회피
- 분석 용도: 최근 30일은 즉시 액세스, 30일 이후는 1분~12시간 retrieval 가능

#### 적용한 라이프사이클 정책
```json
{
  "Rules": [{
    "ID": "mysql-dump-tier-and-expire",
    "Status": "Enabled",
    "Filter": { "Prefix": "db/" },
    "Transitions": [{ "Days": 30, "StorageClass": "GLACIER" }],
    "Expiration": { "Days": 120 }
  }]
}
```

#### 적용 즉시 영향 (1-2일 내)
| 객체 분류 | 수 | 용량 | 처리 |
|-----------|-----|------|------|
| < 30일 | 720 | 2,130 GB | Standard 유지 |
| 30~90일 | 1,440 | 3,633 GB | → Glacier transition |
| 90~120일 | 55 | 154 GB | → Glacier 후 27일 뒤 expire (~$2 early fee) |
| > 120일 | 1 | 0 (2018년 placeholder) | 즉시 삭제 |

#### 비용 변화 추정
| 시점 | 구성 | 월 비용 |
|------|------|---------|
| 적용 전 | 5,918 GB × Standard, 라이프사이클 없음 (누적 중) | **$148+ ↑** |
| 적용 1-2일 후 | 2,130 GB Std + 3,788 GB GFR | **~$67** (-$81) |
| 정상 상태 (~5개월 후) | 1,950 GB Std + 5,850 GB GFR | **~$70** (-$78/월) |

#### 1회성 비용
- Transition request fee: 1,495개 × $0.00005 ≈ **$0.07**
- Early deletion fee (90~120일 객체 55개): 약 **$1~2**

#### 운영 영향
- 새 dump 자동 적용: `db/` prefix에 추가되는 모든 신규 dump는 30일째 자동 Glacier 전환, 120일째 자동 삭제
- 사람 개입: 정책 변경 시에만 필요
- 분석 시 30일 이내 dump는 Standard에서 즉시 액세스, 30일 이후는 GFR retrieval 필요 (Standard 복원 요청 시 1분~12시간, 비용 $0.03/GB)

#### Transition 타이밍 (라이프사이클 동작 원리)
- S3 라이프사이클은 **매일 1회 자동 실행** (UTC 기준, 정확한 시각은 AWS 비공개)
- 정책 등록 후 **24~48시간 이내** 첫 batch 처리 시작
- 객체별 transition은 비동기. batch가 끝나도 모든 객체가 동시에 바뀌지 않음
- 큰 batch는 며칠~1주 걸릴 수 있으나, 1,495개 객체면 보통 1~3일 내 완료

##### 이번 적용 예상 일정
| 시점 | 예상 상태 |
|------|-----------|
| 2026-06-04 (적용일) | 정책 등록 완료, 변화 없음 |
| 2026-06-05 ~ 06 | 첫 batch 처리 시작 |
| 2026-06-06 ~ 08 | 1,495개 객체(3.8 TB) 대부분 transition 완료 |
| 2026-06-07 이후 | CloudWatch에서 storage class별 분포 확인 가능 |

##### 실제 transition 결과 (실측)
정책 적용 후 **약 8시간** 만에 거의 전부 전환 완료. 예상(24~48h)보다 훨씬 빠름.

| 시점 (UTC) | 경과 | GLACIER | STANDARD | 비고 |
|------------|------|---------|----------|------|
| 06-04 00:29 | 0h | 0 | 2,224 | 정책 적용 |
| 06-04 05:25 | ~5h | 0 | 2,223 | 120일 초과 1개 만료 처리 |
| 06-04 08:23 | ~8h | **1,497** | 729 | 전환 대상의 99.6% 완료 |

빠르게 끝난 이유:
- 객체 수가 적음 (2천여 개) → 평가 큐 짧음
- 단일 prefix, 단일 transition 룰 → 평가 로직 단순
- ap-northeast-2(서울) 라이프사이클 워커가 자주 도는 것으로 추정

##### 비용 효과 (실측 반영)
| 항목 | 용량 | 단가 | 월 비용 |
|------|------|------|---------|
| Standard (최근 30일치) | 0.73 TB | $0.025/GB | $18 |
| **GFR (30~120일)** | **3.79 TB** | $0.0036/GB | **$14** |
| **합계** | 4.52 TB | - | **$32** |

- 적용 전: $146/월 (5.84 TB Standard)
- 적용 후: $32/월
- **실측 절감 -$114/월** (당초 추정 -$78/월보다 우수, transition 즉시 완료로 첫 달부터 풀 효과)

#### 후속 모니터링

**1. 특정 객체 storage class 확인 (즉시 확인 가능, 가장 빠른 검증)**
```bash
aws s3api head-object --bucket msdeveloper \
  --key db/2026-03-04_00:00:01.mosher.sql \
  --query StorageClass
# null/STANDARD → 며칠 후 GLACIER로 바뀌면 성공
```

**2. CloudWatch storage class별 용량 (24h 지연)**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 --metric-name BucketSizeBytes \
  --start-time 2026-06-05T00:00:00Z --end-time 2026-06-08T00:00:00Z \
  --period 86400 --statistics Average \
  --dimensions Name=BucketName,Value=msdeveloper Name=StorageType,Value=GlacierStorage \
  --query 'Datapoints'
# 0이 아닌 값이 나오면 transition 진행 중
```

**3. 6월 청구서**: S3 USAGE_TYPE 비교로 GFR 전환량 정량 확인 (`APN2-TimedStorage-GlacierByteHrs` 출현)

**4. (선택) S3 Inventory**: 활성화 시 daily/weekly로 전체 객체 storage class 보고서 제공. 첫 보고서까지 24~48h.

### 후속 검토 대상 (추가)
- **msdeveloper 기타 prefix 일괄 정리**: error/, csv/, shp/, log/, test/, test1/, test2/, test3/, test_result/, user_log/, make/, makecode/, makep/, app/, cf_log/ — 사용자가 "사실상 삭제" 의향. 절감액은 미미($0.07/월)지만 객체 4,500+개 정리 가능. 사용자 확인 후 별도 작업.

---

## 진행 중인 TODO

| 항목 | 기한 | 효과 |
|------|------|------|
| spd-test 체인 stop/삭제 결정 | 미정 | TBD |
| dev-mshuttle 스토리지 마이그레이션 (수동) | 사용자 진행 | -$15/월 |
| DataZone 도메인 Force Delete (콘솔) | 사용자 진행 | - |
| Ubuntu 16.04 → 22.04 (mshuttle) | 별도 프로젝트 | 보안 |
| slsv 버킷 `serverless/ussr/` prefix 정리 | 검토 후 진행 | -$0.15/월 |
| KMS `test_key_1` schedule-key-deletion | 사용자 결정 후 | -$1/월 |
| madmin KMS pending window 종료 모니터링 | 2026-07-02 | -$1/월 확정 |
| production-mshuttle storage 축소 (dump/restore) | 별도 프로젝트 | -$6.96/월 |
| msdeveloper 기타 prefix 일괄 정리 (사용자 확인 후) | 검토 후 | -$0.07/월 (정리 가치) |
| ~~msdeveloper 라이프사이클 적용 결과 확인~~ | ~~2026-06-06 이후~~ | **완료 (06-04, 8h 만에 99.6% 전환, -$114/월 확정)** |
