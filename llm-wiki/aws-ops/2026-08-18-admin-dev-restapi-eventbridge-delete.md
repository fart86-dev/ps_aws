---
type: aws-op
date: 2026-08-18
account: "306331009209"
region: ap-northeast-2
category: [iam, lambda, eventbridge, admin_doc]
impact: admin-dev-restapi에 dispatch-one-time EventBridge 규칙 삭제 API 신설, dev+production 배포 완료
status: done
---

# 2026-08-18 · admin-dev-restapi에 `DELETE /eventbridge` 삭제 엔드포인트 신설

[[2026-08-17-admin-dev-restapi-eventbridge-endpoint]]에서 만든 `/eventbridge/list` 조회 API에 이어, 조회한 규칙(특히 [[2026-04-22-dispatch-one-time-rule-not-cleaned-up]]처럼 정리 로직이 실패해 남은 고아 규칙)을 admin에서 직접 지울 수 있게 삭제 API를 추가한 기록.

## 1) 스코프 확정 — 삭제만, 등록(생성)은 제외

사용자가 "리스트 불러왔으니 지우거나 등록하는 기능도 가능하지 않냐"고 제안. 검토 후:
- **삭제**: 정리 로직이 실패해서 남은 규칙을 치우는 명확한 사용처 존재(방금 발견한 2026-04-22 고아 규칙 2개). IAM도 리소스 ARN으로 좁게 스코프 가능해 안전.
- **등록**: `~psapp/cron/driver-runnstatus-cron`이 이미 갖고 있는 배차 등록 로직(`registerOneTimeEvent`)과 중복. Lambda Input 페이로드를 잘못 넣으면 실제 기사 SMS 발송/운행상태 갱신이 오염될 위험이 커서 **완전히 보류**하기로 사용자가 명시적으로 결정.

삭제 API의 안전 가드도 하나 더 확인: CloudWatch로 "아직 발동 안 한 규칙(Invocations=0)"은 삭제를 막을지 물어봤는데, **제한 없이 전부 삭제 가능**하게 하기로 결정(admin 판단에 맡김, UI에서 발동 여부를 보여주되 API 자체는 안 막음).

## 2) admin_doc 스펙 추가

`etc`/`dev` 두 패키지 다 `doc/packages/<pkg>/path/Eventbridge/Eventbridge.yaml`(delete verb) 신설, `router/eventbridge.yaml`에 `/eventbridge` 라우트 추가. [[../gotchas#etcdev-패키지-이원화--한쪽만-고치면-소비자에-안-반영됨-gotcha]]에서 이미 기록해둔 대로 두 패키지 다 반복 작업 필요.

- `operationId: remove_eventbridge_rule`(delete verb) — 이 리포의 delete 계열 네이밍 관례(`remove_admin`)를 따름
- 응답은 커스텀 스키마 없이 기존 `Common.DeleteRes.yaml`(`{ result: boolean, message?: string }`) 재사용
- `yarn merge:etc` + `yarn merge:dev` 린트 0건, `makeopid.js`로 전역 operationId 확인 — `dev`/`etc` 간 중복은 있으나 기존 `get_eventbridge_list`와 동일하게 의도된 것(같은 스펙을 두 패키지가 각자 서빙)
- `yarn roll`로 `dist/bin/cli.js` 재빌드

## 3) admin-dev-restapi 반영

- `EventbridgeService.remove(ruleName)` 신설: `dispatch-one-time-` 접두사 아니면 즉시 거부 → `ListTargetsByRule` → 타겟 있으면 `RemoveTargets` → `DeleteRule`. `~psapp/cron/driver-runnstatus-cron/src/utils/aws/eventBridge.ts`의 `cleanupOneTimeEvent`와 사실상 동일한 로직(다만 이쪽은 IAM role 기반, 그쪽은 액세스 키 하드코딩 — [[../gotchas]] 별도 항목 참조)
- `controller/eventbridge.ts`에 `remove_eventbridge_rule` 핸들러 추가
- 로컬 `node ~/docs/admin_doc/dist/bin/cli.js -t be -p dev`로 라우터 재생성(공식 `pnpm admindoc`은 아직 admin_doc 원격 태그가 이번 변경을 안 담고 있어 그대로는 반영 안 됨 — 이후 admin_doc 쪽 커밋/태그가 갱신되면 다시 안전)

## 4) IAM

정책 `admin-dev-restapi-eventbridge-delete` 신설:
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

`custom-lambda-role-{dev,production}` 양쪽에 부착 — 두 role 다 [[../aws-inventory/admin-dev-restapi-iam]]에 기록된 대로 각각 57개/54개 함수가 공유하는 계정 공용 role이라, 이 삭제 권한도 그 함수 전부에 적용됨. 다만 `Resource`가 `dispatch-one-time-*` ARN 패턴 하나로 고정돼 있어 다른 이름의 EventBridge 규칙(계정 전체 130개+ 규칙 중 대부분)은 물리적으로 삭제 불가.

### 검증 방식

- `call_boto3` 도구는 assume-role 임시자격증명을 직접 못 써서, `iam:SimulatePrincipalPolicy`로 두 role 각각에 대해 `dispatch-one-time-*` 이름의 가상 리소스는 `allowed`, 다른 이름은 `implicitDeny`인지 확인.
- 실제 삭제 동작 자체는 더미 규칙(`dispatch-one-time-2099-01-01-99999-verifytest`, 2099년 스케줄이라 절대 안 터짐)을 만들어 직접 `RemoveTargets`+`DeleteRule`로 지워봄(내 자격증명으로, role 권한 자체와는 별개 확인).
- 배포 후 dev/production Lambda(`dev-admin-dev-restapi`, `production-admin-dev-restapi`) 각각에 `lambda:Invoke`로 `DELETE /eventbridge?ruleName=...` 이벤트를 직접 넣어봄 — 인증 토큰 없이 호출해 **401 Unauthorized**(라우팅·컨트롤러가 정상 연결됐고, 인증 없인 거부된다는 뜻 — 500 크래시가 아님)를 확인. 실제 JWT로 전체 성공 경로까지는 검증 못 함(로그인 플로우 밖).

## 5) 로컬 빌드 검증 → 배포

[[2026-08-17-admin-dev-restapi-webpack-credential-chain-fix]]에서 얻은 "배포 요청 전 로컬 검증" 원칙 그대로: `tsc --noEmit` 클린 → `webpack --env stage=<stage>` 빌드 → 산출물(`​.aws-sam/build/handler.js`)에 `remove_eventbridge_rule`/`RemoveTargetsCommand`/`DeleteRuleCommand` 포함 여부 grep 확인 → 배포.

- **dev**: `CDK_STAGE=dev npx cdk deploy --require-approval never` — `UPDATE_COMPLETE`, 41초.
- **production**: `echo y | npx vite-node scripts/deploy.ts --stage production` — `UPDATE_COMPLETE`.
- production 배포 후 15분 CloudWatch Logs Insights로 에러 로그 검색 — 0건.

## 6) 부수 발견 — `spec/index.json`(레포 루트)이 로컬 codegen으로는 자동 갱신 안 됨

`src/spec/spec.json`은 로컬 `cli.js -t be -p dev` 실행 시 갱신되지만, 레포 루트의 `spec/index.json`(git 추적, `server.ts`가 로컬 개발 서버에서 `readFileSync("./spec/index.json")`로 읽음)은 이 CLI 호출로는 안 건드려짐 — 어떤 스크립트가 이걸 채우는지 명확히 확인 못 함(이전 커밋엔 같이 갱신돼 있었음). webpack 빌드는 `src/spec/spec.json`을 `.aws-sam/build/spec/index.json`으로 복사해 배포 산출물엔 영향 없지만, 레포 루트 파일이 방치되면 로컬 `pnpm dev` 서버가 구버전 스펙을 읽을 수 있어 수동으로 `cp src/spec/spec.json spec/index.json`으로 동기화함. #gotcha 후보 — 다음에 admin-dev-restapi 작업할 때 재확인 필요.

## 7) 관련

- [[2026-08-17-admin-dev-restapi-eventbridge-endpoint]] — 조회(`/eventbridge/list`) 엔드포인트 원본 작업
- [[../aws-inventory/admin-dev-restapi-iam]] — role/정책 전체 인벤토리(삭제 정책 포함)
- [[../domains/dispatch-rules-status]] — ps_aws 쪽 원본 CLI 도구
