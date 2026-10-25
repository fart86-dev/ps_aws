---
type: aws-op
date: 2026-08-17
account: "306331009209"
region: ap-northeast-2
category: [iam, lambda, eventbridge, cloudwatch, admin_doc]
impact: admin-dev-restapi에 dispatch-one-time EventBridge 규칙 조회 API 신설, dev+production 배포 완료
status: done
---

# 2026-08-17 · admin-dev-restapi에 `/eventbridge/list` 엔드포인트 신설 (admin_doc 스펙 저작 포함)

`~ps_aws`에서 만든 CLI 도구([[../domains/dispatch-rules-status]])를 `~psapp/admin/be/admin-dev-restapi`(ps_aws 밖) 관리자 API의 HTTP 엔드포인트로 이식한 기록. `admin_doc`(OpenAPI 스펙 저작 리포, `~/docs/admin_doc`)까지 직접 작업했다.

배경: [[2026-08-17-admin-dev-restapi-webpack-credential-chain-fix]](fart86 하드코딩 키 제거 작업) 진행 중 사용자가 "이 기능을 admin-dev-restapi에 추가하고 싶다"고 요청.

---

## 1) 계층 구조 정정

처음엔 ps_aws의 `utils/` 패턴(controller가 AWS SDK 호출을 직접 utils에서 가져옴)으로 만들었으나, 사용자가 "controller, repository, service로 구성해"라고 지적 — 이 리포의 실제 관례는 `router → controller → service`(예: `JobSchdService`, `AdminService`)이고, DB 대신 외부 API(AWS SDK)를 부르는 것도 **service 계층**이 담당한다. `service/EventbridgeService.ts`(class + `export const XxxService = new Xxx()` 싱글턴 패턴)로 재작성.

## 2) `admin_doc` 스펙 저작 (`~/docs/admin_doc`, ps_aws/admin-dev-restapi 둘 다 밖의 세 번째 리포)

이 리포는 admin-dev-restapi의 `node_modules`에서 본 것과 달리 **진짜 스펙 원본**이 있는 곳이다. 구조: `doc/packages/<pkg>/_index.yaml`(태그+라우터 인덱스) → `router/<resource>.yaml`(URL→path 매핑) → `path/<Resource>/<Resource>_<Action>.yaml`(엔드포인트) → `schemas/<Resource>/`(스키마). `yarn merge:<pkg>` → 머지+Spectral 린트, `yarn roll` → rollup 번들(`dist/bin/cli.js` = `admindoc` CLI) + `dist/docs/*.yaml` 복사.

`admin-dev-restapi`의 스펙은 `etc` 패키지가 아니라 **`dev` 패키지**(`etc`의 admin/appcontr/jobschd/rds 부분 복제본, CLAUDE.md에 기록된 대로)에서 온다 — 새 엔드포인트를 추가하려면 **`etc`와 `dev` 양쪽 다** 수정해야 함.

새 리소스 `Eventbridge` 추가: `router/eventbridge.yaml`, `path/Eventbridge/Eventbridge_List.yaml`(operationId `get_eventbridge_list`), `schemas/Eventbridge/Res.Get.Eventbridge_List.yaml`. `_index.yaml`에 태그+`$include` 등록.

### 함정 1: 태그명에 하이픈이 있으면 코드 생성이 깨짐

처음 태그를 `dispatch-rules`로 지었더니, BE 생성기(`ms_dev_doc`)가 태그명을 **그대로 JS 식별자**로 씀 — `import dispatch-rules from "../controller/dispatch-rules"`, `class Dispatch-rulesRouter` — 문법 에러로 생성 자체가 실패. 기존 관례(`dispatchcase`처럼 구분자 없는 한 단어)를 따라야 함. 이후 사용자 요청으로 `eventbridge`로 한 번 더 단순화(태그/path/operationId 전부).

### 함정 2: operationId 전역 유일성은 makeopid.js로만 확인 가능

Spectral 린트는 패키지(문서) 내부 중복만 잡는다. 서비스 간 중복은 `node makeopid.js`(21개 서비스, 656개 API 스캔)로 별도 확인 필요 — `get_eventbridge_list` 유일성 확인함.

## 3) `admin-dev-restapi` 쪽 반영

로컬 검증 흐름(원격 git+ssh 버전이 아직 우리 변경분을 안 담고 있는 동안): `node ~/docs/admin_doc/dist/bin/cli.js -t be -p dev`를 admin-dev-restapi 디렉토리에서 직접 실행 — `npx admindoc`(package.json 스크립트)은 원격 `admin_doc` 버전을 쓰기 때문에 **로컬 변경이 반영 안 되고 오히려 되돌아감**(라우터 재생성 시 우리 등록분이 사라짐).

### 함정 3: macOS 대소문자 무시 파일시스템 vs tsc의 대소문자 검사

생성기가 만든 `controller/eventbridge.ts`/`router/eventbridge.ts`(소문자)와 내가 먼저 만든 `EventbridgeService.ts` 참조용 파일명이 대소문자만 다르면(`dispatchRules.ts` vs `dispatchrules.ts`), macOS 파일시스템은 같은 파일로 취급해 조용히 덮어쓰지만 **tsc는 대소문자 불일치를 에러로 잡는다**(`TS1261`). `mv a a.tmp && mv a.tmp b` 2단계로 실제 대소문자를 바꿔야 함.

### 함정 4: 이 리포는 dev/production 배포 메커니즘이 서로 다름

- `deploy:dev` = `CDK_STAGE=dev npx cdk deploy` — **AWS CDK**(`cdk/bin/app.ts`, `ms_cdk`의 `MsRestApi` construct)
- `deploy:prod` = `npx vite-node scripts/deploy.ts --stage production` → 내부적으로 **SAM** (`sam deploy --config-env production`)

둘 다 최종적으로 같은 `.aws-sam/build`(webpack 산출물)를 자산으로 쓰지만, 오케스트레이션 도구 자체가 다르다. `sam deploy`는 changeset 프리뷰 후 **`[y/N]` 인터랙티브 확인**이 있음(`echo y | ...`로 넘김) — CDK 쪽은 `--require-approval never`로 이미 스킵.

`pnpm build:dev`/`pnpm admindoc`이 원격 `admin_doc`을 쓰므로, 로컬 admin_doc으로 먼저 검증할 땐 **`pnpm admindoc` 단계를 건너뛰고 수동으로**: `node ./secret.cjs <stage>` → 로컬 cli.js로 라우터 재생성 → `webpack --env stage=<stage>`. 사용자가 `admin_doc`을 커밋+태그 갱신(`package.json`의 `admin_doc` git+ssh 참조를 `0.5.69T13`으로 갱신)한 이후로는 `pnpm admindoc`(원격)이 다시 안전해짐 — 실제로 재확인함.

## 4) IAM

이 엔드포인트는 EventBridge `ListRules`/`ListTargetsByRule` + CloudWatch `GetMetricStatistics`(읽기 전용)가 필요. 기존 `custom-lambda-role-{dev,production}`엔 이 권한이 전혀 없었음(RDS 때와 같은 패턴).

정책 `admin-dev-restapi-eventbridge-read` 신설(읽기 전용 3개 액션, `Resource: "*"` — List류라 리소스 레벨 제한 불가) → `custom-lambda-role-dev`, `custom-lambda-role-production` 양쪽에 부착. assume-role로 실제 API 3개(ListRules 6건, ListTargetsByRule, GetMetricStatistics) 호출 성공 확인 후 배포.

## 5) 배포 결과

- **dev**: `CDK_STAGE=dev npx cdk deploy --require-approval never` — `UPDATE_COMPLETE`, 41초. 배포 후 에러 로그 0건.
- **production**: `echo y | npx vite-node scripts/deploy.ts --stage production` — `UPDATE_COMPLETE`. 배포 후 에러 로그 0건.

둘 다 배포 전 로컬 `tsc --noEmit` + 실제 `webpack --env stage=<stage>` 빌드 + 산출물 grep(credential 경로/MYSQL_HOST/신규 코드 포함 여부) 검증을 거쳤다 — [[2026-08-17-admin-dev-restapi-webpack-credential-chain-fix]]에서 얻은 "배포 요청 전 로컬 검증" 원칙을 그대로 적용.

## 6) IAM 정책 최종 상태

`custom-lambda-role-production`/`custom-lambda-role-dev` 둘 다 아래 2개 정책이 신규 부착됨 — 상세 인벤토리는 [[../aws-inventory/admin-dev-restapi-iam]] 참조.

- `admin-dev-restapi-rds-dev-control` — RDS Describe/Start/Stop, `dev-mshuttle` 전용
- `admin-dev-restapi-eventbridge-read` — EventBridge List류 + CloudWatch GetMetricStatistics, 읽기 전용

## 7) 관련

- [[../domains/dispatch-rules-status]] — 원본 ps_aws CLI 도구
- [[2026-08-17-admin-dev-restapi-webpack-credential-chain-fix]] — 같은 날 발견한 webpack 시크릿 유출/자격증명 체인 버그
- [[../aws-inventory/admin-dev-restapi-iam]] — role/정책 인벤토리
