---
type: aws-op
date: 2026-07-06
account: "306331009209"
region: ap-northeast-2
category: [cognito, amplify, lambda, audit, dead-candidate]
impact: TBD (재검토 후 확정)
status: monitoring
re_check_date: 2026-10-06
related: [[../aws-inventory/protected-resources#9-rn_drapp-kinesis-로그-파이프라인-cognito-identity-pool-drapp42d078e1]]
---

# 2026-07-06 · Cognito Pool + Amplify 앱 + Node ≤20 Lambda 감사

Node.js 20 이하 Lambda 조사 → amplify-login 트리거 함수들이 붙어있는 Cognito pool 실사용 확인 → 전체 Cognito/Amplify 인벤토리 감사로 확대.

**결정: 물리 삭제는 보류. 90일 후 (2026-10-06) 재검토 시 같은 스냅샷을 다시 뽑아 활동 변화 여부로 최종 판정.**

---

## 1) 확실히 실사용 (삭제 금지)

### rn_drapp Kinesis 로그 파이프라인

- **Identity Pool**: `ap-northeast-2:6b0dc290-331e-4a13-9445-038a5c6581d9` (`drapp42d078e1_identitypool_42d078e1__dev`)
- **User Pool**: `ap-northeast-2_DSrE4OBGH` (`drapp42d078e1_userpool_42d078e1-dev`) — IP 의 CognitoIdentityProvider 로 client 참조
- **IAM Role**: `amplify-drapp-dev-152044-unauthRole` (Firehose:PutRecord)
- **Lambda (Node 18)**: `amplify-drapp-dev-152044-UpdateRolesWithIDPFunctio-ffsKuCkZs3me` — 초기 role 세팅 헬퍼 (앱 런타임 호출 아님)

**근거:** `rn_drapp/android/app/src/main/java/com/modooshuttle/drapp/Util/KinesisManager.kt:17` 에 identity pool ID 하드코딩. Kinesis Firehose 로그 전송용. **dev/production 공용 (stage 분기 없음).**

**주의:** pool 이름에 `_dev` 가 붙어있지만 production 앱도 사용. 이름과 실제 사용이 어긋난 상태.

→ 상세: [[../aws-inventory/protected-resources#9-rn_drapp-kinesis-로그-파이프라인-cognito-identity-pool-drapp42d078e1]]

---

## 2) Dead 후보 (90일 모니터 후 재판정)

### Cognito User Pool (5개)

| 이름 | Pool ID | 현재 유저 | 생성 | Client 힌트 |
|---|---|---|---|---|
| madmin | `ap-northeast-2_0pl7V4lM7` | 1 | 2018-08-03 | `pstest_userpoolapp_MOBILEHUB_570307997` — Mobile Hub 유물 |
| admin | `ap-northeast-2_IkhPq2r6X` | 0 | 2018-07-27 | client 0개 — 껍데기 |
| mshuttle | `ap-northeast-2_jqcRps37F` | 1 | 2023-10-16 | client `mshuttle` — 세팅 후 미배포 추정 |
| admin-auth | `ap-northeast-2_K5mah1s8k` | 1 | 2023-09-07 | client `admin-auth` — IP 연동 없음, 관리자 인증 준비 흔적 |
| amplify_backend_manager_d2xacr27joaurw | `ap-northeast-2_Dfsy74rcn` | 1 | 2022-07-07 | Amplify Studio (`mshuttle_test`) 관리 계정 |
| amplify_backend_manager_d2hqa244h46pds | `ap-northeast-2_dZNfoZlfe` | 2 | 2023-10-16 | Amplify Studio (`drapp`) 관리 계정 |

### Cognito Identity Pool (5개)

| 이름 | Pool ID | 현재 identity | 연결 role | 힌트 |
|---|---|---|---|---|
| madmin | `ap-northeast-2:5c36181f-6fd0-44b3-9ffb-e82abe4297a6` | 1 | `Cognito_madmin{Auth,Unauth}_Role` | Mobile Hub 유물 |
| mshuttle | `ap-northeast-2:1b1ee3eb-97c2-4c57-b242-bd03e9916680` | 0 | `Cognito_Mshuttle` + Firehose FullAccess | 2023-10 Firehose 로그 파이프라인 세팅 후 미배포 |
| drvapp | `ap-northeast-2:d4476790-267e-4228-9d1b-e52260356b4d` | 6 | `Cognito_drvapp{Auth,Unauth}_Role` + Firehose FullAccess | 2021-08 옛 세대 driver 앱 유물 |
| amplify_backend_manager_d2xacr27joaurw | `ap-northeast-2:97fc5bd8-1e1e-4547-8254-b701882c2c7c` | 1 | (Amplify Studio auth role) | mshuttle_test Studio |
| amplify_backend_manager_d2hqa244h46pds | `ap-northeast-2:8eff781e-b4f1-4b5f-8dc0-49ae7a1e58a8` | 1 | (Amplify Studio auth role) | drapp Studio |

### IAM Role (관련)

- `Cognito_madminAuth_Role`, `Cognito_madminUnauth_Role`
- `Cognito_Mshuttle` (Kinesis Firehose FullAccess)
- `Cognito_drvappAuth_Role`, `Cognito_drvappUnauth_Role` (Kinesis Firehose FullAccess)
- `ap-northeast-2_Dfsy74rcn-authRole`, `ap-northeast-2_dZNfoZlfe-authRole`

### Amplify 앱 (5개, 모두 branches 0)

| appId | 이름 | 생성 | 상태 |
|---|---|---|---|
| d2xacr27joaurw | mshuttle_test | 2022-07-07 | branches 0, updateTime = createTime |
| d2hqa244h46pds | drapp (Studio) | 2023-10-16 | branches 0, updateTime = createTime |
| djohues2e71z | drvcontr | 2021-08-05 | branches 0 |
| dmjnsply3yw1i | drvcontr (중복) | 2021-08-05 | branches 0 |
| duf6ky9z2dwze | msdriver | 2021-08-31 | branches 0 |

### Lambda (Node 12/16/18, dead 강한 정황)

| FunctionName | Runtime | LastModified | 소속 |
|---|---|---|---|
| amplify-login-{define/create/verify/custom-message}-auth-challenge-5af06d26 | nodejs12.x | 2022-07 | Amplify Studio `mshuttle_test` (Pool `Dfsy74rcn`) — 90일 invocations 0 |
| amplify-login-{define/create/verify/custom-message}-3d5a74c1 | nodejs16.x | 2023-10 | Amplify Studio `drapp` (Pool `dZNfoZlfe`) — 90일 invocations 0 |
| analysis-admin-production-warmup-plugin | nodejs12.x | 2023-07 | analysis serverless warmup |
| efstestpy-dev-warmup-plugin | nodejs12.x | 2022-03 | 이름부터 test 흔적 |

---

## 3) 판정 근거 요약 (오늘 스냅샷)

| 근거 | 값 |
|---|---|
| 로컬 코드베이스 grep (`~/{rn,sl,ps,psapp,ui,mu,mog,glue,cc,ipy,md,docs,iac}`) | pool ID / client ID / role name 매치 0건 (rn_drapp `6b0dc290` 제외) |
| CloudWatch `AWS/Cognito` SignInSuccesses 90일 datapoint | 7개 pool 전부 0 (metric 부재 = "활동 0" or "publish 없음" 구분 불가) |
| Amplify `list-branches` | 5개 앱 전부 empty array |
| amplify-login Lambda 90일 Invocations | 8개 함수 전부 0 |

---

## 4) 90일 모니터 프로토콜

**재검토일:** 2026-10-06

**재검토 시 다시 뽑을 지표 (동일 스냅샷):**

```bash
# Cognito user counts
for POOL in ap-northeast-2_0pl7V4lM7 ap-northeast-2_IkhPq2r6X ap-northeast-2_jqcRps37F ap-northeast-2_K5mah1s8k ap-northeast-2_Dfsy74rcn ap-northeast-2_dZNfoZlfe; do
  aws cognito-idp describe-user-pool --user-pool-id $POOL --region ap-northeast-2 \
    --query '[UserPool.Name, UserPool.EstimatedNumberOfUsers]' --output text
done

# Cognito identity counts
for IP in ap-northeast-2:5c36181f-6fd0-44b3-9ffb-e82abe4297a6 ap-northeast-2:1b1ee3eb-97c2-4c57-b242-bd03e9916680 ap-northeast-2:d4476790-267e-4228-9d1b-e52260356b4d ap-northeast-2:97fc5bd8-1e1e-4547-8254-b701882c2c7c ap-northeast-2:8eff781e-b4f1-4b5f-8dc0-49ae7a1e58a8; do
  aws cognito-identity list-identities --identity-pool-id $IP --max-results 60 --region ap-northeast-2 \
    --query 'length(Identities)'
done

# Lambda 90일 invocations (재검토 시점 기준)
for FN in amplify-login-define-auth-challenge-5af06d26 amplify-login-define-auth-challenge-3d5a74c1 analysis-admin-production-warmup-plugin efstestpy-dev-warmup-plugin; do
  END=$(date -u +%Y-%m-%dT%H:%M:%S) && START=$(date -u -v-90d +%Y-%m-%dT%H:%M:%S)
  aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations \
    --dimensions Name=FunctionName,Value=$FN --start-time $START --end-time $END \
    --period 7776000 --statistics Sum --region ap-northeast-2 \
    --query 'Datapoints[0].Sum' --output text
done

# Amplify branches
for APP in d2xacr27joaurw d2hqa244h46pds djohues2e71z dmjnsply3yw1i duf6ky9z2dwze; do
  aws amplify list-branches --app-id $APP --region ap-northeast-2 --query 'length(branches)'
done
```

**판정 규칙:**

- 재검토 시 위 지표가 **오늘과 동일하게 0/무변화** → **확정 dead**. 순차 삭제 진행.
- 조금이라도 변화 (identity 증가, invocations 발생, user 추가) → **살아있음 재확인**. 판정 재고.
- 판정 후 이 노트를 `status: done` 으로 변경하고 결과 섹션 추가.

---

## 5) 확실히 확인 안 된 것 (한계)

- **배포된 앱 바이너리 (Google Play / App Store) 는 확인 못 함** — 로컬 소스와 다를 수 있음
- **CloudTrail 90일 조회는 안 함** — 재검토 시 병행하면 확신도 상승
- **Cognito SignIn CloudWatch metric 부재 원인** — advanced security 미활성 시 metric 자체가 없을 수 있음
- **다른 개발자 로컬 리포 / 삭제된 옛 리포** — 확인 불가능한 영역

이 한계는 90일 모니터로 상당 부분 커버됨 (변화 없음 = 아무도 안 씀).

---

## 6) 후속 이관 항목

- [[../aws-pending#node20-이하-lambda-마이그레이션-로드맵]] (예정) — Node 20.x 46개 마이그레이션은 이 감사와 별개로 진행
