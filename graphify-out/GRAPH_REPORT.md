# Graph Report - .  (2026-07-30)

## Corpus Check
- Corpus is ~43,293 words - fits in a single context window. You may not need a graph.

## Summary
- 407 nodes · 613 edges · 22 communities (14 shown, 8 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.84)
- Token cost: 0 input · 339,228 output

## Community Hubs (Navigation)
- Infra Monitor 컬렉터 (src/infra-monitor)
- RDS 사설화 설계 & 후속 Pending
- 프로젝트 지침 & CloudFront 보호자원
- 루트 package.json 매니페스트
- DynamoDB 오삭제 사고 & staging 정리
- rdsStatus.ts 점검 스크립트
- IAM 오프보딩 & 빌드타임 시크릿 노출
- wafBotControl.ts 토글 스크립트
- npm 의존성 선언
- TypeScript 컴파일 설정
- waste.ts 낭비자원 탐지
- 위치정보 TTL & 쓰기경로 감사 (OPA)
- RDS Phase 로드맵 & 스토리지 축소
- msdeveloper S3 라이프사이클
- node-cron 타입 선언
- 스택 단위 삭제 원칙
- 운영 스크립트: check-costs.sh
- 운영 스크립트: check-resources.sh
- 운영 스크립트: dev-bg.sh
- 운영 스크립트: start-bg.sh
- 운영 스크립트: stop.sh
- 운영 스크립트: summary.sh

## God Nodes (most connected - your core abstractions)
1. `ps-aws Wiki Index` - 21 edges
2. `Gotchas` - 20 edges
3. `보호 자원 목록 (절대 건드리지 마라)` - 17 edges
4. `compilerOptions` - 12 edges
5. `scripts` - 11 edges
6. `collectWaste()` - 10 edges
7. `RDS Full Privatization Design (2026-07-30)` - 9 edges
8. `Decisions Log` - 9 edges
9. `InfraMonitorResult` - 8 edges
10. `checkInfrastructure()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `ps-aws Agent Guide` --semantically_similar_to--> `ps-aws 프로젝트 지침 (CLAUDE.md)`  [INFERRED] [semantically similar]
  AGENTS.md → CLAUDE.md
- `waste.ts 낭비 자원 컬렉터` --semantically_similar_to--> `CRON_SCHEDULE 정기 점검 스케줄러`  [INFERRED] [semantically similar]
  llm-wiki/aws-ops/2026-06-01-vpc-ec2-cleanup.md → README.md
- `ps-aws Agent Guide` --references--> `wafBotControl.ts Bot Control 토글`  [INFERRED]
  AGENTS.md → llm-wiki/aws-ops/2026-06-01-vpc-ec2-cleanup.md
- `AWS Agent Toolkit 규칙` --conceptually_related_to--> `ps-aws Agent Guide`  [INFERRED]
  llm-wiki/aws-agent-toolkit-rules.md → AGENTS.md
- `ps-aws 프로젝트 지침 (CLAUDE.md)` --references--> `AWS Infrastructure Monitor (Fastify 서버)`  [INFERRED]
  CLAUDE.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **OPA 위치정보법 실태점검 2차 대응 묶음** — llm_wiki_aws_ops_2026_07_17_dynamodb_location_encryption_audit_location_encryption_audit, llm_wiki_aws_ops_2026_07_17_dynamodb_location_encryption_audit_opa_location_law_inspection, llm_wiki_aws_ops_2026_07_18_dynamodb_stream_consumer_audit_stream_consumer_audit, llm_wiki_aws_ops_2026_07_18_guardduty_enable_guardduty_enable, llm_wiki_aws_inventory_protected_resources_guardduty [EXTRACTED 1.00]
- **DynamoDB 오삭제 사고 → 복구 → 삭제 원칙 정착** — llm_wiki_aws_ops_2026_07_01_dynamodb_drv_runn_cleanup_drv_runn_cleanup, llm_wiki_aws_ops_2026_07_02_dynamodb_recovery_and_lessons_dynamodb_recovery, llm_wiki_aws_ops_2026_07_02_dynamodb_recovery_and_lessons_iac_repo_precheck_rule, llm_wiki_aws_ops_2026_07_06_staging_cleanup_staging_cleanup, llm_wiki_aws_ops_2026_07_06_staging_cleanup_stack_level_deletion_rule [EXTRACTED 1.00]
- **msdeveloper S3 dump 라이프사이클 비용 프로그램** — llm_wiki_aws_ops_2026_06_04_msdeveloper_s3_lifecycle_msdeveloper_s3_lifecycle, llm_wiki_aws_ops_2026_06_04_msdeveloper_s3_lifecycle_mysql_dump_tier_and_expire_rule, llm_wiki_aws_ops_2026_07_01_msdeveloper_s3_lifecycle_shorten_lifecycle_shorten, llm_wiki_aws_inventory_protected_resources_msdeveloper_s3_bucket [EXTRACTED 1.00]
- **OPA Location-Information Inspection Response Campaign** — llm_wiki_aws_ops_2026_07_18_khj_dev_offboarding_khj_dev_offboarding, llm_wiki_aws_ops_2026_07_19_iam_grant_revoke_cloudtrail_audit_iam_grant_revoke_cloudtrail_audit, llm_wiki_aws_ops_2026_07_19_location_data_write_path_audit_location_data_write_path_audit, llm_wiki_aws_ops_2026_07_20_location_data_ttl_auto_purge_discovery_ttl_auto_purge_discovery, llm_wiki_aws_ops_2026_07_20_ttl_under_retention_finding_and_fix_ttl_under_retention_finding, llm_wiki_aws_pending_dynamodb_location_encryption [EXTRACTED 1.00]
- **Privatization Phase Dependency Chain (Observe, Gate, Migrate, Cut Over)** — llm_wiki_aws_ops_2026_07_30_vpc_rds_privatization_design_phase0_observability, llm_wiki_aws_ops_2026_07_30_vpc_rds_privatization_design_phase3_developer_access, llm_wiki_aws_ops_2026_07_30_vpc_rds_privatization_design_phase5_lambda_vpc_migration, llm_wiki_aws_ops_2026_07_30_vpc_rds_privatization_design_phase7_rds_public_disable, llm_wiki_aws_ops_2026_07_30_vpc_rds_privatization_design_rds_privatization_roadmap [EXTRACTED 1.00]
- **src/ Monitoring Tool Surface (Monitors, Waste, Scripts, Notifiers)** — llm_wiki_domains_infra_health_infra_health_domain, llm_wiki_domains_cost_waste_cost_waste_domain, llm_wiki_domains_rds_status_rds_status_domain, llm_wiki_domains_waf_bot_control_waf_bot_control_domain, llm_wiki_domains_notifiers_notifiers_domain [EXTRACTED 1.00]

## Communities (22 total, 8 thin omitted)

### Community 0 - "Infra Monitor 컬렉터 (src/infra-monitor)"
Cohesion: 0.06
Nodes (47): cloudWatchClient, dynamodbClient, getMetricData(), monitorDynamoDB(), checkInfrastructure(), cloudWatchClient, getMetricData(), monitorRDS() (+39 more)

### Community 1 - "RDS 사설화 설계 & 후속 Pending"
Cohesion: 0.05
Nodes (63): AWS Agent Toolkit Setup (2026-07-20), aws-mcp MCP Server (mcp-proxy-for-aws), agent-toolkit Writes to the macOS User Account, Not the Project, Augment Default VPC With Private Subnets (Not a New VPC), NAT Gateway Is Mandatory, Exposure Cause Is PubliclyAccessible=true, Not Public Subnets, RDS Full Privatization Design (2026-07-30), RDS Split-Horizon DNS (+55 more)

### Community 2 - "프로젝트 지침 & CloudFront 보호자원"
Cohesion: 0.06
Nodes (49): AWS 작업 시 절대 규칙, dry-run → --confirm 게이트, ps-aws Agent Guide, llm-wiki 작업 시작 내비게이션, ps-aws 프로젝트 지침 (CLAUDE.md), PID 파일 기반 백그라운드 프로세스 수명주기, 프로세스 관리 가이드, AWS Agent Toolkit 규칙 (+41 more)

### Community 3 - "루트 package.json 매니페스트"
Cohesion: 0.08
Nodes (24): description, devDependencies, tsx, @types/node, typescript, main, name, packageManager (+16 more)

### Community 4 - "DynamoDB 오삭제 사고 & staging 정리"
Cohesion: 0.12
Nodes (23): 자동 sweep 제외 리스트 규칙, GuardDuty ap-northeast-2 (보호 자원), Deletion Protection 자동 해제 판단, 2026-07-01 DynamoDB drv_runn_* 5개 삭제, CLI 재생성 후 CFN drift 재동기화, 비용 관점 프레이밍의 위험성, 2026-07-02 DynamoDB dev 테이블 오삭제 복구, IaC 리포 사전 확인 체크리스트 (+15 more)

### Community 5 - "rdsStatus.ts 점검 스크립트"
Cohesion: 0.14
Nodes (22): rdsClient, Args, buildReport(), ce, cw, evaluateFindings(), Finding, gb() (+14 more)

### Community 6 - "IAM 오프보딩 & 빌드타임 시크릿 노출"
Cohesion: 0.11
Nodes (21): app_data_store Group Restructure (Separation of Concerns), delete-user Requires Detaching Directly Attached Policies, doc_secrets IAM Group (Textract + SecretsManager), khj.dev IAM Offboarding (2026-07-18), IAM Grant/Revoke CloudTrail Raw-Log Audit (2026-07-19), lookup-events 90-Day Limit + IAM Events Live in us-east-1, Filter on requestParameters.userName, Not userIdentity, Routine IAM Changes Performed by Root Account (+13 more)

### Community 7 - "wafBotControl.ts 토글 스크립트"
Cohesion: 0.16
Nodes (20): Action, actionDisable(), actionEnable(), actionStatus(), Args, BACKUP_DIR, backupFilePath(), client (+12 more)

### Community 8 - "npm 의존성 선언"
Cohesion: 0.11
Nodes (19): @aws-sdk/client-cloudwatch, @aws-sdk/client-cost-explorer, @aws-sdk/client-dynamodb, @aws-sdk/client-ec2, @aws-sdk/client-rds, @aws-sdk/client-wafv2, dotenv, fastify (+11 more)

### Community 9 - "TypeScript 컴파일 설정"
Cohesion: 0.11
Nodes (18): dist, ES2020, node_modules, src, compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib (+10 more)

### Community 10 - "waste.ts 낭비자원 탐지"
Cohesion: 0.18
Nodes (18): collectWaste(), cw, daysAgo(), ebsPricePerGB(), ec2, findIdleEIPs(), findOldSnapshots(), findRDSWaste() (+10 more)

### Community 11 - "위치정보 TTL & 쓰기경로 감사 (OPA)"
Cohesion: 0.17
Nodes (15): Location Data Write-Path Exhaustive Audit (2026-07-19), production_dr_runn_hist Is Structurally Append-Only, RunnUpdateInput Unused latitude/longitude/accuracy Fields, Single Shared AppSync API_KEY (No Per-Field Authorization), 7-Day TTL Policy (created_at + 86400*7), Location Data DynamoDB TTL Auto-Purge Rediscovery (2026-07-20), CloudWatch TimeToLiveDeletedItemCount as Purge Evidence, Use/Provision Confirmation Data Minimum-Retention Requirement (+7 more)

### Community 12 - "RDS Phase 로드맵 & 스토리지 축소"
Cohesion: 0.21
Nodes (12): Phase 0 — VPC Flow Logs Observability, Phase 3 — Developer Access Path (Hard Gate), Phase 7 — RDS Public Access Removal (Only Downtime Window), Phase 0-9 Privatization Roadmap, SSM Port Forwarding Jump Host, dev-mshuttle Storage Migration 200GB to 50GB, production-mshuttle Source Storage Shrink 100GB to 25GB, Final Snapshot Retention Cost (+4 more)

### Community 13 - "msdeveloper S3 라이프사이클"
Cohesion: 0.32
Nodes (8): msdeveloper S3 버킷 (보호 자원 6), 2026-06-04 API Gateway execution log 정리, CloudWatch Logs retention 미설정 누적 문제, 2026-06-04 msdeveloper S3 라이프사이클 등록, mysql-dump-tier-and-expire 라이프사이클 룰, S3 라이프사이클 실행 동작 메모, 2026-07-01 msdeveloper STD 30일→7일 단축, 시간당 dump RPO 제약

## Ambiguous Edges - Review These
- `dry-run by Default, --confirm to Mutate` → `Send to Every Configured Channel`  [AMBIGUOUS]
  llm-wiki/conventions.md · relation: conceptually_related_to
- `Scheduler Starts With the Server (No Off Switch)` → `5-Minute Single Datapoint Falls Back to Zero`  [AMBIGUOUS]
  llm-wiki/decisions.md · relation: conceptually_related_to

## Knowledge Gaps
- **112 isolated node(s):** `name`, `version`, `description`, `type`, `main` (+107 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `dry-run by Default, --confirm to Mutate` and `Send to Every Configured Channel`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Scheduler Starts With the Server (No Off Switch)` and `5-Minute Single Datapoint Falls Back to Zero`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `ps-aws Wiki Index` connect `RDS 사설화 설계 & 후속 Pending` to `위치정보 TTL & 쓰기경로 감사 (OPA)`, `RDS Phase 로드맵 & 스토리지 축소`, `IAM 오프보딩 & 빌드타임 시크릿 노출`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `보호 자원 목록 (절대 건드리지 마라)` connect `프로젝트 지침 & CloudFront 보호자원` to `DynamoDB 오삭제 사고 & staging 정리`, `msdeveloper S3 라이프사이클`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `Gotchas` connect `RDS 사설화 설계 & 후속 Pending` to `위치정보 TTL & 쓰기경로 감사 (OPA)`, `RDS Phase 로드맵 & 스토리지 축소`, `IAM 오프보딩 & 빌드타임 시크릿 노출`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _112 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Infra Monitor 컬렉터 (src/infra-monitor)` be split into smaller, more focused modules?**
  _Cohesion score 0.05921325051759834 - nodes in this community are weakly interconnected._