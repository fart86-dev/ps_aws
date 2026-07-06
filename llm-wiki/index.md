---
type: repo
repo: ps-aws
domains: []
stack: [aws-cli, aws-sdk-v3, fastify, typescript, node-cron, tsx]
status: active
bus_factor: 1
updated: 2026-06-26
---

# ps-aws 위키

이 리포의 진짜 가치는 **AWS 운영 작업 이력 + 재사용 절차 + 보호 자원 목록**.

`src/` 의 Fastify+cron 앱은 후속 점검 자동화를 위한 **보조 도구**일 뿐, 주된 자산이 아님.

이 리포는 회사 표준 8개 코어 비즈니스 도메인(quotation/b2b/route/passenger/driver/control/settlement/dispatch)을 다루지 않는다 → `domains:` 빈 배열.

---

## 어디부터 보나

### 1) AWS 작업이 우선 (대부분의 작업이 여기)

- **[[aws-pending]]** ★ 진행 중 / 보류 / 후속 TODO 통합
- **[[aws-inventory/protected-resources]]** ★ 절대 건드리지 마라 — 보호 자원
- [[aws-ops/2026-06-01-vpc-ec2-cleanup]] — VPC/EC2/SG/EBS gp2→gp3 + 모니터링 스크립트 추가
- [[aws-ops/2026-06-02-lambda-edge-cleanup]] — us-east-1 Lambda@Edge 7개 정리
- [[aws-ops/2026-06-02-kms-madmin-cleanup]] — KMS + madmin StackSet 폐기
- [[aws-ops/2026-06-03-read-replica-az-migration]] — production-mshuttle-read1 AZ 이동
- [[aws-ops/2026-06-04-msdeveloper-s3-lifecycle]] — S3 라이프사이클 (-$114/월 실측)
- [[aws-ops/2026-06-04-apigw-exec-log-cleanup]] — API Gateway execution log 정리
- [[aws-ops/2026-06-16-cloudfront-admin-function-attach]] — admin-fe-request-dev 일괄 연결
- [[aws-ops/2026-07-01-pinpoint-mobilehub-cleanup]] — Pinpoint MobileHub 잔재 앱 2개 삭제 (서비스 종료 대응)
- [[aws-ops/2026-07-01-msdeveloper-s3-lifecycle-shorten]] — msdeveloper STD 30→7일 단축 (-$40/월 예상)
- [[aws-ops/2026-07-01-dynamodb-drv-runn-cleanup]] — DynamoDB drv_runn_*_production 5개 삭제 (-$25/월)
- [[aws-ops/2026-07-02-dynamodb-recovery-and-lessons]] — dev 4개 오삭제 복구 및 재발 방지 (실제 순절감 -$34/월)
- [[aws-ops/2026-07-06-cognito-amplify-audit]] — Cognito/Amplify/Node ≤20 Lambda 감사 (90일 모니터 후 재판정)
- [[aws-ops/2026-07-06-staging-cleanup]] — staging 환경 폐기 정리 조사 (스택 17개 + 스택 밖 자원, 실행 승인 대기)
- 재사용 절차:
  - [[aws-runbooks/rds-shrink-migration]] — RDS storage 축소 (dump/restore swap)
  - [[aws-runbooks/cloudfront-function-attach]] — Distribution 에 Function 일괄 연결
  - [[aws-runbooks/waf-bot-control-toggle]] — WAF Bot Control rule 토글
- 현재 상태 인벤토리:
  - [[aws-inventory/cloudfront-dev-admin]] — dev-admin-* Distribution 현황

### 2) src/ 보조 도구 (코드 만질 때만)

- [[structure]] — 디렉토리 / 레이어 / 진입점 (얇은 지도)
- [[runbook]] — 빌드·실행·환경변수
- [[conventions]] — 이 리포만의 관례·금지사항
- **[[decisions]]** — 왜 이렇게 짰나 / 과거 사고 / 임시방편
- **[[gotchas]]** — 건드리면 터지는 곳
- 영역별:
  - [[domains/infra-health]] — RDS·DynamoDB·WAF 메트릭 점검 + 알림 (실시간 트리거)
  - [[domains/cost-waste]] — 낭비 자원 검출 + 주간 리포트 (주간 트리거)
  - [[domains/waf-bot-control]] — WAF Bot Control 룰 on/off 일회성 스크립트
  - [[domains/rds-status]] — RDS 인벤토리·메트릭·findings 일회성 스크립트
  - [[domains/notifiers]] — Telegram/Slack 알림 채널 추상화

---

## 한 줄 요약

**계정 `306331009209` 의 AWS 리소스 정리 이력 + 재사용 가능한 절차 + 보호 자원 목록을 보존하는 위키. `src/` 의 Fastify+cron 앱은 그 위에서 정기 점검·알림을 자동화하는 보조 도구.**
