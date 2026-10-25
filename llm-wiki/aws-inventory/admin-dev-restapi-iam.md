---
type: repo-wiki
domains: []
area: admin-dev-restapi-iam
stack: [iam, lambda]
status: active
updated: 2026-08-18
---

# admin-dev-restapi-iam — `custom-lambda-role-{production,dev}` 현재 상태

#domain/admin-dev-restapi-iam

`~psapp/admin/be/admin-dev-restapi`(ps_aws 밖)의 Lambda 실행 역할. 2026-08-17에 두 차례(RDS 하드코딩 키 제거, EventBridge 엔드포인트 신설) 작업하며 직접 만든 정책들이라 스냅샷으로 남긴다. 배경: [[../aws-ops/2026-08-17-admin-dev-restapi-webpack-credential-chain-fix]], [[../aws-ops/2026-08-17-admin-dev-restapi-eventbridge-endpoint]].

## ⚠️ role 자체 — admin-dev-restapi 전용이 아니라 57개+54개 Lambda가 공유하는 계정 공용 role

**2026-08-17 재조사로 확정.** `custom-lambda-role-production`/`-dev`는 admin-dev-restapi 전용 role이 아니라, `~psapp` 전역의 **거의 모든 admin-*/user-*-restapi, user-*-app, common-*-cron, driver-*-cron Lambda가 공유하는 계정 공용 실행 role**이다.

| Role | 생성일 | 이 role을 쓰는 함수 수 (2026-08-17 `list-functions` 실측) |
|---|---|---|
| `custom-lambda-role-production` | 2024-07-29 | **57개** |
| `custom-lambda-role-dev` | 2024-07-29 | **54개** |
| `custom-lambda-role-staging` | 2024-08-14 | 14개 (user-*-app/restapi staging만) |
| `custom-lambda-prune-role-production` | 2024-07-29 | 1개 (`production-utils-prune-func`) |
| `custom-lambda-warmup-role-production` | 2024-07-30 | 1개 (`production-utils-warmup-func`) |
| `custom-lambda-prune-role-dev`, `custom-lambda-warmup-role-dev`, `custom-appsync-role-{dev,production}` | 2024-07-29/30 | 0개 (현재 아무 함수도 안 씀) |

**함의:** 오늘 이 role들에 부착한 `admin-dev-restapi-rds-dev-control`, `admin-dev-restapi-eventbridge-read` 두 정책은 admin-dev-restapi 하나가 아니라 **저 57개 + 54개 함수 전부에 동일하게 적용된다.** 이름은 "admin-dev-restapi-*"이지만 실제 부여 범위는 이 role을 쓰는 모든 함수. 다행히:
- RDS 정책은 `Resource`가 `dev-mshuttle` ARN 하나로 고정돼 있어 — 어떤 함수가 이 권한을 (의도치 않게) 쓰더라도 **production-mshuttle은 절대 못 건드림**. 영향은 "더 많은 함수가 dev-mshuttle을 start/stop할 수 있게 됨"으로 제한.
- EventBridge/CloudWatch 정책은 읽기 전용(List/Describe/GetMetricStatistics)이라 상태를 바꾸는 위험은 없음. 다만 `Resource: "*"`라 계정 전체 EventBridge 규칙/CloudWatch 메트릭 조회가 저 111개 함수 전부에 열린 상태.

정책 이름을 함수 범위와 맞게 재명명하거나, 정말 admin-dev-restapi 전용으로 좁히려면 **admin-dev-restapi만의 전용 role을 새로 만들어 Lambda의 `Role`을 바꾸는 별도 작업**이 필요함 — 지금은 계정 공용 role에 얹은 상태. 정책 자체를 지금 좁히거나 옮기는 작업은 이번엔 안 함(문서화만).

전체 role 목록(290개, 서비스 연결형 27개 제외 263개)과 IAM 사용자/그룹 전체 그림은 [[iam-overview]] 참조.

## 부착된 관리형 정책 (2026-08-17 기준)

| 정책 | production | dev | 성격 |
|---|---|---|---|
| `custom-lambda-policy-production`/`-dev` | ✅ | ✅ | Lambda invoke, SNS, SQS, S3(GetObject/PutObject/AbortMultipartUpload `*`, ListBucket `modoo.admin.oper`) |
| `mysql-mshuttle-log-{production,dev}-producer` | ✅ | ✅ | (이름상 로그 프로듀서 — 상세 미조사) |
| `custom-appsync-policy-{production,dev}` | ✅ | ✅ | AppSync (상세 미조사) |
| `custom-cloudwatch-policy-{production,dev}` | ✅ | ✅ | `logs:*` (CloudWatch **Logs**, Metrics 아님) |
| `AWSCodeDeployRoleForLambda` (AWS 관리형) | ✅ | ✅ | blue/green 배포용 |
| `admin-dev-restapi-rds-dev-control` **(신규, 2026-08-17)** | ✅ | ✅ | `rds:DescribeDBInstances`/`StartDBInstance`/`StopDBInstance`, Resource = `dev-mshuttle` ARN 하나로 고정. production-mshuttle 물리적으로 불가 |
| `admin-dev-restapi-eventbridge-read` **(신규, 2026-08-17)** | ✅ | ✅ | `events:ListRules`/`ListTargetsByRule`, `cloudwatch:GetMetricStatistics`, 읽기 전용, `Resource: "*"`(List류라 리소스 레벨 제한 불가) |
| `admin-dev-restapi-eventbridge-delete` **(신규, 2026-08-18)** | ✅ | ✅ | `events:RemoveTargets`/`DeleteRule`, `Resource`를 `arn:...:rule/dispatch-one-time-*`로 고정 — 다른 이름의 규칙은 물리적으로 삭제 불가 |

인라인 정책(dev만 확인): `custom-bedrock-policy-dev`(`bedrock:InvokeModel`), `custom-marketplace-policy-dev`, `custom-transcribe-policy-dev`. production도 동일 인라인 정책 3종 보유(2026-08-17 앞선 조사에서 확인, [[../aws-ops/2026-08-17-admin-dev-restapi-eventbridge-endpoint]] 참조).

## 신규 정책 2건 상세

### `admin-dev-restapi-rds-dev-control`
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AdminDevRestapiRdsDevControl",
    "Effect": "Allow",
    "Action": ["rds:DescribeDBInstances", "rds:StartDBInstance", "rds:StopDBInstance"],
    "Resource": "arn:aws:rds:ap-northeast-2:306331009209:db:dev-mshuttle"
  }]
}
```

### `admin-dev-restapi-eventbridge-read`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EventBridgeRulesReadOnly",
      "Effect": "Allow",
      "Action": ["events:ListRules", "events:ListTargetsByRule"],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchMetricsReadOnly",
      "Effect": "Allow",
      "Action": "cloudwatch:GetMetricStatistics",
      "Resource": "*"
    }
  ]
}
```

위 두 정책 다 assume-role로 실제 API 호출까지 검증 완료(dev 대상 허용, production-mshuttle 거부 — RDS 쪽만 해당, EventBridge/CloudWatch는 계정 전역이라 대상 제한 없음).

### `admin-dev-restapi-eventbridge-delete` (2026-08-18)
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AdminDevRestapiEventbridgeDeleteOneTime",
    "Effect": "Allow",
    "Action": ["events:RemoveTargets", "events:DeleteRule"],
    "Resource": "arn:aws:events:ap-northeast-2:306331009209:rule/dispatch-one-time-*"
  }]
}
```

`IAM SimulatePrincipalPolicy`로 검증(`call_boto3`는 assume-role 임시자격증명을 직접 못 써서 이번엔 이 방식 사용) — `dispatch-one-time-*` 이름 규칙은 두 액션 다 `allowed`, 그 외 이름의 규칙은 `implicitDeny` 확인. 배포 후에도 dev/production 양쪽 Lambda를 `lambda:Invoke`로 직접 호출해 `DELETE /eventbridge` 라우팅이 붙어있는지 확인(인증 토큰 없이 호출 → 401 Unauthorized 반환 = 라우팅·컨트롤러 정상, 크래시 아님). 상세: [[../aws-ops/2026-08-18-admin-dev-restapi-eventbridge-delete]].

**등록(생성) 기능은 사용자 요청으로 완전히 보류** — `driver-runnstatus-cron`의 기존 배차 등록 로직(`registerOneTimeEvent`)과 중복되고, Lambda Input 페이로드를 잘못 넣으면 실제 기사 SMS/상태갱신이 오염될 리스크가 커서 이번 스코프에서 제외.

## 남은 것 / 다음에 볼 것

- `mysql-mshuttle-log-*-producer`, `custom-appsync-policy-*`의 실제 정책 문서 내용 미조사 — 필요 시 `aws iam get-policy-version`으로 확인
- 두 role이 이 admin-dev-restapi 외 다른 Lambda와 공유되는지 미확인 — `aws lambda list-functions --query "Functions[?Role=='<role-arn>']"`로 확인 가능
- fart86 하드코딩 키 70개+ 파일 제거 작업([[../aws-pending#cron_servdriver-runn-cron-하드코딩-aws-액세스-키--규모-재확인-70개-파일-psapp-백엔드-전체]])을 다른 리포에도 적용할 때, 그 리포들의 role에도 동일하게 "필요한 권한부터 최소 스코프로 신설 → 부착 → assume-role 검증" 패턴을 반복하게 될 것 — 이번 2개 정책이 그 실증 사례
