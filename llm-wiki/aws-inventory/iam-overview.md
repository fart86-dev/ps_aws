---
type: repo-wiki
domains: []
area: iam-overview
stack: [iam]
status: active
updated: 2026-08-17
---

# iam-overview — 계정 306331009209 IAM 현황 (2026-08-17 실측 스냅샷)

#domain/iam-overview

**문서화 전용.** 사용자가 "iam이 현재 어떻게 구성되어있는지 기억 안 남 → 자세하게 정리"라고 요청해서 작성. 아래는 전부 `list-users`/`list-groups`/`list-roles`/`list-functions` 실시간 조회 결과이고, **어떤 IAM 설정도 변경하지 않았다.**

---

## 1) 사용자 15명

| 사용자 | 생성일 | 마지막 콘솔 로그인 | 그룹 | 직접 부착 정책 | 액세스 키 | MFA |
|---|---|---|---|---|---|---|
| **admin** | 2017-06-22 | 2017-09-06 (9년째 미사용) | 없음 | Route53Domains/Route53/DMS-Redshift-S3/CloudFront/CloudWatchReadOnly/ACM/CloudWatchLogs/IAMUserChangePassword/S3ReadOnly/**S3FullAccess** (10개) | 2개 (2018-01, **2024-12-28**) | ✅ |
| **antoni0922** | 2023-01-02 | 2023-03-27 (미사용) | 없음 | 없음 | **0개** | ❌ |
| **chang** | 2021-09-17 | 2023-04-11 | code, analytics | CloudWatchLogsFullAccess | 2개 (2023-04, 2026-05-18) | ❌ |
| **dev** | 2023-06-05 | 2023-06-13 (미사용) | code, analytics, datastore | 없음 | 1개 (2023-06) | ❌ |
| **dev_fe** | 2023-01-25 | 로그인 이력 없음 | 없음 | Mshuttle_AllowS3FileUpload | 1개 (2023-01) | ❌ |
| **email** | 2020-02-10 | 로그인 이력 없음(서비스 계정 추정) | noti | 없음 | 1개 (**2024-12-28**) | ✅ |
| **fart86** | 2017-12-12 | 2018-03-05 (8년째 콘솔 미사용) | **superadmin** | **AdministratorAccess** | **2개** (2019-01 orphan, **2024-12-28** 하드코딩 유출 키) | ✅ |
| **jejen205** | 2023-01-02 | 2026-08-13 (최근 활동) | infra, event, doc_secrets, code, security, noti, analytics, **dev** (8개) | 없음(그룹으로만) | 1개 (2023-01) | ❌ |
| **jmy0303** | 2021-09-10 | 2023-06-02 | code, analytics, datastore | 없음 | 1개 (2021-09) | ❌ |
| **kimps** | 2021-06-11 | 2026-07-30 (최근 활동, 나) | infra, event, app_data_store, log, doc_secrets, code, security, analytics, datastore, **dev** (10개) | mquicksight, EFSReadOnly, KinesisFirehoseFullAccess, **AdministratorAccess**, VPCReadOnly, DataZoneFullAccess, AdministratorAccess-Amplify, EFSClientFullAccess (8개) | 2개 (2021-08, **2024-12-28**) | ✅ |
| **kimpstest** | 2019-05-29 | 로그인 이력 없음 | log | 없음 | 2개 (**2024-12-28**, 2019-05) | ❌ |
| **mshuttle** | 2019-06-17 | 2019-06-20 (7년째 미사용) | analytics | 없음 | 1개 (2019-06) | ❌ |
| **oper** | 2020-11-10 | 로그인 이력 없음(서비스 계정 추정) | oper | 없음 | 2개 (2020-11, 2025-04) | ❌ |
| **rok** | 2018-09-28 | 2021-05-23 (5년째 미사용) | rok_acc | AWSDeepRacerCloudFormationAccessPolicy, **IAMFullAccess** | 1개 (2018-09) | ❌ |
| **ses-smtp-user.20201021-105828** | 2020-10-21 | 로그인 이력 없음(SES SMTP 자격증명 전용) | 없음 | 인라인: AmazonSesSendingAccess | 1개 (2020-10) | ❌ |

### 눈에 띄는 점

- **`AdministratorAccess` 보유자 2명**: `kimps`(직접 부착) + `fart86`(그룹 `superadmin` 경유). 둘 다 활성 키를 갖고 있고, `fart86`은 콘솔 로그인이 8년째 없는데도 관리자 권한 활성 키가 살아있음.
- **2024-12-28 일괄 키 생성**: `admin`, `email`, `fart86`, `kimps`, `kimpstest` 5명이 전부 이 날짜에 새 액세스 키를 발급받았다 — [[../gotchas#awssrc-로컬-sdk-자격증명-체인이-kimps의-개인-키를-씀]]에 기록된 **2024-12-28 계정 마비 사고** 직후 키 로테이션과 시점이 일치한다. 이 중 `fart86`의 `AKIA****DIJF6`가 바로 [[../aws-pending]]에 기록된, `~psapp`/`~sl` 70개+ 파일에 하드코딩된 채 발견된 그 키.
- **`fart86`의 2019-01 키(`AKIA****XENWPQ`)**: 7년째 활성 상태인 orphan 키. 어디서 쓰는지 미확인 — 로테이션/폐기 대상 후보.
- **`rok`**: 5년째 미사용 계정인데 `IAMFullAccess`(다른 사용자/역할의 권한을 임의로 바꿀 수 있는 사실상 관리자급 권한)를 여전히 보유.
- **`antoni0922`**: 액세스 키 0개, 그룹 0개, 정책 0개 — 사실상 빈 계정. 콘솔 로그인도 2023-03이 마지막.
- **`jejen205`, `kimps`만 `dev` 그룹 소속** — 이 그룹이 사실상 "AWS 콘솔에서 실제로 인프라 작업하는 두 사람"을 나타냄(아래 그룹 섹션 참조).
- MFA 활성화된 사용자는 4명뿐(`admin`, `email`, `fart86`, `kimps`). 나머지 11명은 MFA 없음 — `IAMFullAccess`를 가진 `rok`도 미적용.

---

## 2) 그룹 14개

| 그룹 | 생성일 | 멤버 | 부착 정책 (주요 권한) |
|---|---|---|---|
| **superadmin** | 2017-12-12 | fart86 | AdministratorAccess는 아니고, EC2FullAccess/RDSFullAccess/S3FullAccess/LambdaFullAccess/CloudFront/APIGateway/ACM 등 사실상 광범위 Full access 조합 (10개) — `fart86`은 이 그룹 정책과 별개로 **직접 AdministratorAccess도 부착**돼 있어 그룹 정책은 사실상 의미 없음 |
| **dev** | 2021-08-27 | jejen205, kimps | Route53/APIGateway/CloudFront/**IAMFullAccess**/CloudWatch/RDSReadOnly/S3/EventBridge/CloudFormation/**LambdaFullAccess** (10개) — 두 사람의 일상적 인프라 작업 권한 세트 |
| **analytics** | 2019-06-17 | jejen205, kimps, chang, jmy0303, mshuttle, dev(사용자) | Athena, QuickSight, IAMFullAccess(QuickSight용 List만 필요한데 Full 부여), Athena Full |
| **code** | 2021-08-22 | jejen205, kimps, chang, jmy0303, dev(사용자) | CodeDeploy/CodeCommit |
| **datastore** | 2021-10-18 | kimps, jmy0303, dev(사용자) | 커스텀 정책 `datastore` (상세 미조사) |
| **log** | 2019-05-29 | kimps, kimpstest | Kinesis Firehose/Kinesis/CloudWatchLogs/Lambda/Glue/KMS/S3 — 전부 FullAccess급 |
| **infra** | 2023-05-09 | jejen205, kimps | AutoScaling, Support |
| **event** | 2025-05-02 | jejen205, kimps | SNS/SQS/EventBridge/EventBridgeScheduler — 전부 FullAccess |
| **security** | 2025-09-16 | jejen205, kimps | WAFFullAccess |
| **doc_secrets** | 2026-07-18 (가장 최근 생성) | jejen205, kimps | Textract, SecretsManagerReadWrite |
| **noti** | 2020-02-10 | email, jejen205 | SES Full/ReadOnly |
| **app_data_store** | 2022-05-23 | kimps | AppSync 4종(Schema/Invoke/CloudWatchLogs/Administrator) + DynamoDBFullAccess |
| **oper** | 2020-11-10 | oper(사용자) | 커스텀 정책 `oper` (상세 미조사) |
| **rok_acc** | 2018-09-28 | rok | Route53/APIGateway/CloudFront/CloudWatchLogs/Lambda/APIGatewayInvoke/S3 — 전부 FullAccess급, `rok` 전용 그룹 |

### 눈에 띄는 점

- **`jejen205`, `kimps` 두 사람이 사실상 이 계정의 실질 운영자**: 이 둘만 `dev`/`infra`/`event`/`security`/`doc_secrets`/`code`/`analytics` 7개 그룹을 공유하며 겹친다. 나머지 그룹(`rok_acc`, `oper`, `app_data_store`, `noti`, `log`)은 1~2명 전용 그룹.
- **그룹 정책이 전반적으로 FullAccess 위주** — 세분화된 최소 권한(least-privilege) 설계가 아니라 "그룹당 서비스 하나, 그 서비스는 Full" 패턴. 오늘 admin-dev-restapi에서 신설한 [[admin-dev-restapi-iam]]의 리소스 스코프 정책과는 설계 철학이 다름(그룹=사람용 콘솔 권한, Lambda role 정책=서비스용 최소 권한으로 이원화돼 있는 셈).
- `analytics`, `dev` 그룹 둘 다 `IAMFullAccess`를 포함 — 그룹 멤버는 원칙적으로 자기 자신 포함 모든 IAM 사용자/역할/정책을 변경할 수 있는 권한을 가짐(사실상 관리자급).

---

## 3) 역할(Role) — 290개 중 263개가 서비스별 자동 생성 role

- 서비스 연결 역할(`/aws-service-role/*` 경로) **27개** — AWS가 자동 관리, 사람이 손댈 일 없음.
- 그 외 role **263개** — 대부분 CDK/CloudFormation/SAM/Amplify가 스택 배포마다 자동 생성한 서비스 실행 role(스택명-Role 패턴). 개별 role 263개 전수조사는 이번 스코프 밖 — 필요 시 이름 패턴으로 검색.

### Lambda 실행 role 중 계정 공용 role (2026-08-17 `list-functions` 156개 함수 실측, role별 그룹핑)

| Role | 공유 함수 수 |
|---|---|
| `custom-lambda-role-production` | **57** |
| `custom-lambda-role-dev` | **54** |
| `custom-lambda-role-staging` | 14 |
| `amplify-login-lambda-5af06d26` / `amplify-login-lambda-3d5a74c1` | 4 + 4 |
| `custom-lambda-prune-role-production` | 1 |
| `custom-lambda-warmup-role-production` | 1 |
| 나머지 (analysis-admin-*, ps-slack-*, driver-tracking-*, ps-evt-* 등 스택별 전용 role) | 각 1~2 |

`custom-lambda-role-{production,dev,staging}` 3개가 156개 함수 중 125개(80%)를 커버하는 **계정 전역 공용 실행 role**이다. 오늘 admin-dev-restapi 작업으로 이 role들(production/dev)에 정책 2건을 추가했는데, 실제로는 이 57개+54개 함수 전체에 적용된다 — 상세 영향 분석은 [[admin-dev-restapi-iam]] 참조.

---

## 4) 종합 관찰 (사실 기록, 조치 아님)

1. **AdministratorAccess 2명 + IAMFullAccess 다수** — `kimps`/`fart86`가 관리자, `rok`(5년 미사용)과 `dev`/`analytics` 그룹 멤버(`jejen205`/`kimps`/`chang`/`jmy0303`/`mshuttle`/`dev`)가 IAMFullAccess 보유. IAMFullAccess는 사실상 스스로에게 AdministratorAccess를 부여할 수 있어 관리자와 실질적 차이가 작음.
2. **2024-12-28 마비 사고 이후 키 로테이션이 부분적** — 5명 신규 키 발급은 됐지만, `fart86`의 2019년 orphan 키처럼 로테이션 전 오래된 키가 병존. 신규 키(`AKIA****DIJF6`)가 오히려 70개+ 파일에 하드코딩되어 유출된 상태([[../aws-pending]] 추적 중, 미해결).
3. **미사용/휴면 계정 다수** — `antoni0922`(빈 계정), `mshuttle`(7년 미로그인), `rok`(5년), `admin`(9년) 등 콘솔 로그인 수년째 없는 계정이 절반 가까이. 활성 액세스 키는 대부분 유지된 채.
4. **MFA 미적용이 다수(11/15)** — 특히 `AdministratorAccess`를 가진 두 계정(`kimps`, `fart86`) 다 MFA는 있음. `IAMFullAccess`를 가진 `rok`은 MFA 없음.
5. **실질 운영자는 2명(`jejen205`, `kimps`)** — 계정 전체 사용자 15명 중 최근 활동(2026년) 이력이 있는 건 이 둘뿐. 나머지는 서비스 계정(`email`, `oper`, `ses-smtp-user`) 아니면 휴면.

---

## 관련

- [[admin-dev-restapi-iam]] — 오늘 신설한 Lambda 정책 2건이 이 공용 role들에 미치는 실제 영향 범위
- [[protected-resources]] — 절대 건드리면 안 되는 자원 목록(Security Hub/Config/WAF)
- [[../gotchas]] — 2024-12-28 계정 마비 사고 배경
- [[../aws-pending]] — fart86 키 하드코딩 제거 작업 진행 상황
