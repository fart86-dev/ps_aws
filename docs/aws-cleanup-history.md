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

## 진행 중인 TODO

| 항목 | 기한 | 효과 |
|------|------|------|
| read replica AZ 이동 + 25GB | 2026-06-03 (수) 오전 | -$25/월 |
| spd-test 체인 stop/삭제 결정 | 미정 | TBD |
| dev-mshuttle 스토리지 마이그레이션 (수동) | 사용자 진행 | -$15/월 |
| DataZone 도메인 Force Delete (콘솔) | 사용자 진행 | - |
| Ubuntu 16.04 → 22.04 (mshuttle) | 별도 프로젝트 | 보안 |
| slsv 버킷 `serverless/ussr/` prefix 정리 | 검토 후 진행 | -$0.15/월 |
| KMS `test_key_1` schedule-key-deletion | 사용자 결정 후 | -$1/월 |
| madmin KMS pending window 종료 모니터링 | 2026-07-02 | -$1/월 확정 |
