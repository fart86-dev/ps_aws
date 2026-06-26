---
type: aws-op
date: 2026-06-01
account: "306331009209"
region: ap-northeast-2
category: [vpc, ec2, ebs, security-group, glue, datazone]
impact: -$43.56/월 (확정)
status: done
---

# 2026-06-01 · VPC / EC2 / SG 일괄 정리 + gp2→gp3 + 모니터링 스크립트 추가

ps_aws 프로젝트 시작점. AWS 계정 비용을 점검하면서 VPC ($38~56/월) 이 가장 큰 묶음이라는 걸 보고 그 안의 미사용 리소스부터 일괄 정리.

---

## 1) 배경

| 점검 항목 | 비용 추정 |
|---|---|
| VPC | $38 ~ $56 /월 |
| EBS gp2 (msdeveloper / spd-test) | gp3 전환 시 약 -$2~3/월 |
| 중지 EC2 / 미사용 EIP/ENI/AMI/Snapshot/SG | 잡티 |
| Glue Connection / Glue Database | 사용 0 |
| DataZone | 별도 확인 |

→ 한 번에 묶어서 sweep.

## 2) 점검

각 리소스의 "정말 안 쓰는가" 확인 후 삭제. 검증한 항목:
- Security Group 17개: 어느 ENI/Instance/ELB 에도 attach 안 됨
- VPC Endpoint: 0 호출
- EIP: associate 안 됨
- AMI/Snapshot: 어느 launch template / launch configuration 도 참조 없음
- Glue Connection/Database: 어느 Job/Crawler 도 참조 없음
- DataZone: 활성 도메인 없음 (Force Delete 필요한 잔재만 남음)

## 3) 실행 명령

> TODO(질문): 아래 작업에 사용한 실제 `aws` CLI 명령들이 보존돼 있지 않음. 셸 히스토리에 있으면 채워주세요. #todo

작업 단위:
- VPC Endpoint 삭제
- EIP release
- ENI 삭제 (orphan)
- 중지 EC2 terminate
- AMI deregister + snapshot 삭제
- Security Group 17개 삭제 (사용 처 미존재 확인 후 일괄)
- Key Pair 정리
- Glue Connection / Database 삭제

EBS 타입 변환 (msdeveloper EC2):
```bash
# gp2 → gp3 (사용 중인 EBS 무중단)
aws ec2 modify-volume --region ap-northeast-2 \
  --volume-id <vol-xxxx> --volume-type gp3
# → modify-volume 은 즉시 적용. 인스턴스 재기동 불필요.
```

EC2 인스턴스 타입 변경 (msdeveloper, t2→t3):
```bash
# 다운타임 ~45초 발생
aws ec2 stop-instances --region ap-northeast-2 --instance-ids <i-xxxx>
aws ec2 wait instance-stopped --region ap-northeast-2 --instance-ids <i-xxxx>
aws ec2 modify-instance-attribute --region ap-northeast-2 \
  --instance-id <i-xxxx> --instance-type "Value=t3.medium"
aws ec2 start-instances --region ap-northeast-2 --instance-ids <i-xxxx>
```

> TODO(질문): spd-test gp2→gp3 변환 명령. 위 modify-volume 같은 형태인지 확인. #todo

## 4) 결과 (확정 절감)

| 항목 | 효과 |
|---|---|
| 즉시 절감 (VPC/EC2/SG/EIP/ENI/AMI/Snapshot/Glue/DataZone 정리) | -$41.28/월 |
| spd-test gp3 변환 | -$2.28/월 |
| **합계** | **-$43.56/월 (확정)** |

## 5) 영향 / 보존 결정

- **AWS Security Hub + Config**: 2024-12-28 계정 마비 후 AWS 요구로 활성화. **비활성화 절대 금지.** [[../aws-inventory/protected-resources]]
- **WAF**: 2025-09 공격 대응으로 도입. 최적화는 가능하나 유지 필요.

## 6) 모니터링 스크립트 추가 (같은 날 ps_aws 프로젝트에 커밋)

이번 sweep 의 후속 점검 자동화를 위해 ps_aws 리포에 추가된 코드:

| 항목 | 파일 | 용도 |
|---|---|---|
| WAF Bot Control 토글 | `src/scripts/wafBotControl.ts` | Bot Control 룰 status/disable/enable, dry-run 기본, 백업-복원 패턴. [[../aws-runbooks/waf-bot-control-toggle]] |
| RDS 상태 점검 | `src/scripts/rdsStatus.ts` | 전체 RDS 인벤토리 + 30일 메트릭 + 8개 finding 룰 (STORAGE_WASTE / STORAGE_GP2 / STOPPED / STOPPED_LONG / ZERO_CONNECTION / CPU_LOW / SNAPSHOT_MANY / REPLICA_CROSS_AZ / ENGINE_EOL) |
| Waste 모니터 모듈 | `src/infra-monitor/waste.ts` | 중지 EC2, 미사용 EIP/EBS/ENI, 오래된 Snapshot, RDS 낭비 6종 컬렉터 |
| 주간 스케줄러 | `src/scheduler/index.ts` | `WASTE_CRON_SCHEDULE` 기본 `0 0 * * 1` (KST 월 09:00) |
| HTTP 라우트 | `src/server.ts` | `GET /infra/waste?notify=true` |
| Telegram 알림 | `src/notifiers/telegram.ts` | `sendWasteReportToTelegram` |

이 작업 이후로 "낭비 자원" 은 사람이 cli 로 찾는 게 아니라 ps_aws 가 주 1회 알린다.

## 7) 후속 (이날 결정된 TODO)

- **read replica AZ 이동 + 스토리지 축소**: → [[2026-06-03-read-replica-az-migration]] 에서 진행 (스토리지 축소는 별도 분리)
- **spd-test 체인 정리**: PostgreSQL + API Gateway + Lambda. 1년 실사용 ≈ 0. stop/삭제 결정 보류. → [[../aws-pending#spd-test-체인]]
- **dev-mshuttle 스토리지 마이그레이션**: 가이드 작성 완료. 효과 ~-$15/월. → [[../aws-runbooks/rds-shrink-migration]]
- **DataZone 도메인 강제 삭제**: 콘솔에서 Force Delete. → [[../aws-pending#datazone-force-delete]]
- **Ubuntu 16.04 → 22.04 (mshuttle EC2)**: 보안 차원, 별도 프로젝트. → [[../aws-pending#mshuttle-ubuntu-업그레이드]]
