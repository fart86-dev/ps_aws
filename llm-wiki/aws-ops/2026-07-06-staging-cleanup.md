---
type: aws-op
date: 2026-07-06
account: "306331009209"
region: ap-northeast-2
category: [staging, cleanup, cognito, lambda, cloudfront, apigateway, route53]
impact: TBD (사용자 승인 후 실행 시 산정)
status: pending
re_check_date: 2026-10-06
related:
  - [[2026-07-06-cognito-amplify-audit]]
---

# 2026-07-06 · staging 환경 폐기 정리 조사

Node 20 이하 Lambda 마이그레이션 로드맵 조사 중 사용자로부터 **"staging 은 폐기했다"** 진술 확보. staging 관련 자원 전체 감사 → 소속 리포 특정.

**상태:** 조사 완료, 실행 보류. 사용자 승인 후 별도 트리거로 진행.

---

## 1) 조사 배경

- 발단: Node 20.x 46개 함수 중 staging-user-* 14개 마이그레이션 vs 삭제 판단 필요
- 30일 invocation 조사에서 11/14 완전 0 확인 → 사용자에게 시나리오 A/B 문의
- 사용자 응답: "**staging 은 폐기했다. 전부 삭제해도 된다**"
- 무작정 삭제 금지 지시 (2026-07-02 DynamoDB 오삭제 교훈) → 3단계 확인 조사 진행

---

## 2) staging CFN 스택 매핑 (17개)

### 그룹 A: restapi 계열 (Lambda + API Gateway, 7개, 리소스 10개씩)

| CFN Stack | Runtime | LastUpdatedTime | 소속 리포 |
|---|---|---|---|
| user-biz-restapi-staging | nodejs20.x | 2025-01-02 | `psapp/user/be/user-biz-restapi` |
| user-board-restapi-staging | nodejs20.x | 2025-01-02 | `psapp/user/be/user-board-restapi` |
| user-common-restapi-staging | nodejs20.x | 2025-01-02 | `psapp/user/be/user-common-restapi` |
| user-make-restapi-staging | nodejs20.x | 2025-01-02 | `psapp/user/be/user-make-restapi` |
| user-member-restapi-staging | nodejs20.x | 2025-01-02 | `psapp/user/be/user-member-restapi` |
| user-pay-restapi-staging | nodejs20.x | 2025-01-02 | `psapp/user/be/user-pay-restapi` |
| user-runn-restapi-staging | nodejs20.x | 2025-01-02 | `psapp/user/be/user-runn-restapi` |

### 그룹 B: app 계열 (Lambda + CloudFront + custom domain, 4개, 리소스 10개씩)

| CFN Stack | Runtime | Custom Domain | 소속 리포 |
|---|---|---|---|
| user-main-app-staging | nodejs20.x | **user.mshuttle.click** | `psapp/user/fe/msr_user/server` (subDomain=www) |
| user-make-app-staging | nodejs20.x | **make.mshuttle.click** | `psapp/user/fe/ms_make/server` (msr_ 아님, ms_ 접두사) |
| user-pay-app-staging | nodejs20.x | **pay.mshuttle.click** | `psapp/user/fe/msr_pay/server` |
| user-runn-app-staging | nodejs20.x | **runn.mshuttle.click** | `psapp/user/fe/msr_runn/server` |

### 그룹 C: app 계열 (Lambda URL 만, CloudFront 없음, 3개, 리소스 9개씩)

| CFN Stack | Runtime | 소속 리포 |
|---|---|---|
| user-auth-app-staging | nodejs20.x | `psapp/user/fe/msr_auth/server` |
| user-biz-app-staging | nodejs20.x | `psapp/user/fe/msr_biz/server` |
| user-rt-app-staging | nodejs20.x | `psapp/user/fe/msr_route/server` (package name `user-rt-app`) |

### 그룹 D: Lambda 14개 리스트 밖의 추가 staging 스택 (3개)

| CFN Stack | 최종 업데이트 | 리소스 | 판정 |
|---|---|---|---|
| amplify-mshuttletest-staging-32701 | 2022-07-07 | IAM 2 + S3 1 + nested stack | Amplify Studio 자동 생성 유물. [[2026-07-06-cognito-amplify-audit]] 에서 이미 dead 판정 |
| analysis-admin-staging | 2023-05-26 | Lambda 1 + API Gateway + IAM (9개) | 로컬 리포 없음. `staging-analysis-admin` API Gateway 소속. 소유팀 확인 필요 |
| test-vpctest-restapi-staging | 2025-01-03 | Lambda 1 + API Gateway + CodeDeploy + IAM (10개) | 이름부터 test. 로컬 리포 없음 |

---

## 3) 각 스택 리소스 유형별 breakdown

**공통 리소스 (모든 그룹):**
- AWS::Lambda::Function (staging-user-*)
- AWS::Lambda::Alias (`:live`)
- AWS::Lambda::Version
- AWS::Logs::LogGroup (`/aws/lambda/staging-user-*`)
- AWS::IAM::Role (CodeDeployServiceRole)
- AWS::CodeDeploy::Application
- AWS::CodeDeploy::DeploymentGroup

**그룹 A 추가:**
- AWS::ApiGateway::RestApi
- AWS::ApiGateway::Deployment
- AWS::ApiGateway::Stage

**그룹 B 추가:**
- AWS::CloudFront::Distribution
- AWS::Lambda::Url
- AWS::Lambda::Permission

**그룹 C 추가:**
- AWS::Lambda::Url
- AWS::Lambda::Permission

**핵심: DynamoDB / RDS / S3 (스택 안) / Cognito 없음 → 데이터 손실 위험 0.**

---

## 4) 트래픽 & DNS 스냅샷

### CloudFront 30일 Requests (그룹 B)

| Distribution | Domain | Requests 30d | Bytes 30d |
|---|---|---|---|
| E25CIIN2D5WRLD | user.mshuttle.click | **None** (datapoint 없음) | None |
| E324IWKULLFWW8 | make.mshuttle.click | **None** | None |
| EX6YXXMFMSE2F | pay.mshuttle.click | **12회** | 27KB |
| E33GL503CD5KIT | runn.mshuttle.click | **None** | None |

pay.mshuttle.click 12회 = 하루 0.4회 = 봇 스캔 or 헬스체크 수준.

### API Gateway 30일 요청 (그룹 A)
7개 REST API 전부 `None` (30일 요청 0).

### DNS 리졸브 (4개 서브도메인 여전히 CloudFront 매핑 중)
```
user.mshuttle.click    → d1ztqansz659oz.cloudfront.net
make.mshuttle.click    → dtde4s0b99sv8.cloudfront.net
pay.mshuttle.click     → d1lg18lfpys6df.cloudfront.net
runn.mshuttle.click    → d2o67glzwzg44m.cloudfront.net
```

**Route53 hosted zone `mshuttle.click.` 이 계정 내 관리** (Zone ID `Z0895009KOBO9NR73BQH`, 30개 레코드) → 스택 삭제 시 DNS 레코드도 별도 정리 필요.

---

## 5) 다른 자원 인벤토리 결과

| 자원 종류 | staging 관련 | 비고 |
|---|---|---|
| RDS instance | 0 | ✅ 안전 |
| RDS cluster | 0 | ✅ 안전 |
| DynamoDB table | 0 | ✅ 안전 |
| S3 bucket | 2 | ⚠️ `admin.mshuttle.staging` (2024-03 어드민 웹 정적 파일 929개 331MB), `amplify-mshuttletest-staging-32701-deployment` (Amplify Studio 유물) |
| API Gateway REST | 10 | 스택 안 7개 + 스택 밖 3개 (`dr-serv-staging`, `staging-analysis-admin`, `test-vpctest-restapi-staging`) |
| CloudFront Distribution | 4 | 그룹 B 매핑, 위 참조 |
| Cognito Pool | 0 | (staging 이름 포함된 것 없음) |

**`dr-serv-staging` API Gateway** (2024-03 생성, 30일 요청 0) — 어느 스택 소속인지 미확인. 소유팀 확인 필요.

---

## 6) 소속 리포 특정 방법론

각 스택은 SAM 배포 (`lambda:createdBy: SAM` 태그).

- **restapi 계열**: `psapp/user/be/user-*-restapi/scripts/samconfig.ts` 가 `${name}-${stage}` 규칙으로 스택 이름 생성. `${name}` = `psapp/user/be/<디렉토리명>` 과 동일.
- **app 계열**: `psapp/user/fe/msr_*/server/mssam.config.cjs` 가 `pkgJson.name` 을 serviceName 으로 사용. **각 package.json 의 `name` 필드가 스택 이름의 base.**

package.json → 스택 매핑:
```
msr_auth      → user-auth-app
msr_biz       → user-biz-app
msr_driver    → driver-drapp-app
msr_link      → common-shorturl-app
msr_orgcontr  → user-b2b-app  (staging 배포 없음)
msr_pay       → user-pay-app
msr_psn       → psn-psnapp-app
msr_route     → user-rt-app
msr_runn      → user-runn-app
msr_user      → user-main-app
ms_make       → user-make-app  (msr_ 아니라 ms_ 접두사, 예외)
```

**부가 정보:**
- `~/sl/user_serv/packages/*` monorepo 는 2026-05-29 마지막 커밋, `~/psapp/user/be/*` 개별 리포는 2026-06-27~29 커밋. **monorepo → 개별 리포 이관 완료 상태로 보임**. staging 실배포는 개별 리포 쪽으로 봐야 함.
- CFN 스택 LastUpdatedTime 2025-01-02 이후 배포 없음 = 1년 반 유휴 = staging 폐기 진술 일치.

---

## 7) 삭제 실행 방식 (권장)

### 스택 단위 삭제 (개별 함수 삭제 금지)

**2026-07-02 DynamoDB 오삭제 사고 교훈:** IaC 관리 대상 리소스를 개별 삭제하면 스택 drift 발생 및 재현 어려움. **반드시 `delete-stack` 으로 스택 전체를 지운다.**

```bash
# 각 스택 삭제 예시 (dry-run 없음, 스택 삭제는 change-set 부적합 → 대신 리소스 목록 사전 확인)
STACK=user-runn-restapi-staging

# 1. 리소스 목록 확인
aws cloudformation list-stack-resources --stack-name $STACK --region ap-northeast-2

# 2. termination-protection 해제 확인
aws cloudformation describe-stacks --stack-name $STACK --region ap-northeast-2 \
  --query 'Stacks[0].EnableTerminationProtection'

# 3. 삭제 (승인 필수)
aws cloudformation delete-stack --stack-name $STACK --region ap-northeast-2

# 4. 완료 대기
aws cloudformation wait stack-delete-complete --stack-name $STACK --region ap-northeast-2

# 5. 잔재 확인 (Lambda / API Gateway / CloudFront 등)
aws lambda get-function --function-name staging-user-runn-restapi --region ap-northeast-2 2>&1 | head -3
```

### 실행 순서 (안전 순)

1. **그룹 D 3개 (Lambda 14개 밖)** 부터 — 소속 확인 완료된 dead 우선
   - `amplify-mshuttletest-staging-32701` (Amplify Studio 유물, cognito audit 에서 dead 확정)
   - `analysis-admin-staging` (2023-05 이후 무배포)
   - `test-vpctest-restapi-staging` (2025-01 이후 무배포, 이름부터 test)
2. **그룹 A 7개** (restapi) — API Gateway 만 있고 CloudFront 없음, DNS 이슈 없음
3. **그룹 C 3개** (Lambda URL 만) — CloudFront 없음
4. **그룹 B 4개** (CloudFront + custom domain) — Route53 정리 병행 필요
   - CloudFront Distribution 을 disable → 완료 대기 → 스택 삭제 순
   - 삭제 후 Route53 CNAME/A 레코드 (`user/make/pay/runn.mshuttle.click`) 삭제

### 스택 밖 잔재 정리

- `admin.mshuttle.staging` S3 버킷 (929개 331MB) — **폐기 대상 여부 사용자 확인 필요**
- `dr-serv-staging` API Gateway (스택 소속 불명) — **소유팀 확인 필요**
- Route53 30개 레코드 중 staging 관련만 선별 정리

### 리포 정리 (병행)

각 리포에서 staging 관련 파일/설정 정리:
- `psapp/user/be/user-*-restapi/scripts/samconfig.ts` — staging 스테이지 참조 제거
- `psapp/user/fe/{msr_*,ms_make}/server/.env.staging` — 삭제
- `psapp/user/fe/{msr_*,ms_make}/server/mssam.config.cjs` — staging 분기 제거 (혹시 있으면)
- 각 리포 CI/CD 워크플로 — staging 배포 job 제거

---

## 8) 안전 신호 / 주의 신호 요약

### ✅ 안전 신호
- RDS/DynamoDB/데이터 저장소 스택 안에 없음
- 30일 실 트래픽 사실상 0
- 1년 반 배포 없음
- 각 스택 = 독립 (다른 스택 참조 없음)
- 사용자 진술 (staging 폐기) 과 데이터 일치

### ⚠️ 주의 신호
- Route53 hosted zone (mshuttle.click) 30개 레코드 → 정리 병행 필요
- CloudFront 4개 = 실 서브도메인 매핑 → DNS dangling 방지
- `admin.mshuttle.staging` S3 (스택 밖, 어드민 웹 정적 파일) → 확인 필요
- `analysis-admin-staging` + `test-vpctest-restapi-staging` + `dr-serv-staging` → 소유팀 확인 필요

---

## 9) 미해결 확인 항목 (사용자 답변 대기)

1. **`mshuttle.click` 4개 서브도메인 (user/make/pay/runn)** — 정말 폐기 확정인가? (pay 12회 정황도 봇 스캔 판정)
2. **`admin.mshuttle.staging` S3** — 폐기 범위 안?
3. **`dr-serv-staging` API Gateway** — 소속 팀?
4. **그룹 D 추가 3개 스택** — 함께 폐기?
5. **삭제 실행 트리거 시점** — 지금? 90일 재검토와 병행?

답변 확보 후 실행 시 이 노트에 `## 10) 실행 결과` 섹션 추가.

---

## 10) 관련 위키

- [[2026-07-06-cognito-amplify-audit]] — Cognito/Amplify 감사 (amplify-mshuttletest 여기서도 dead 판정)
- [[../aws-pending#staging-환경-폐기-정리]] (신규 추가)
- [[../aws-inventory/protected-resources]] — 이 정리 대상은 보호 자원과 무관 (교차 확인 완료)
