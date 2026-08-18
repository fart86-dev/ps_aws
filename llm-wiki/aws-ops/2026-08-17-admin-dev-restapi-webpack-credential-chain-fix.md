---
type: aws-op
date: 2026-08-17
account: "306331009209"
region: ap-northeast-2
category: [iam, lambda, webpack, security]
impact: fart86 하드코딩 키 제거 파일럿 1건 완료(production+dev 스택 모두) + 별도의 심각한 시크릿 유출 구조 발견(미해결)
status: partial (admin-dev-restapi rds.ts는 완료, 유출 구조 자체는 15개+ 리포 공통이라 미해결)
---

# 2026-08-17 · admin-dev-restapi RDS 하드코딩 키 제거 → webpack 시크릿 유출/자격증명 체인 버그 발견 및 수정

`~/psapp/admin/be/admin-dev-restapi`(ps_aws 리포 밖, `~psapp`)에서 fart86 하드코딩 키([[../aws-pending#cron_servdriver-runn-cron-하드코딩-aws-액세스-키--규모-재확인-70개-파일-psapp-백엔드-전체]] 참조) 제거를 시도하다가, 훨씬 큰 별개의 문제(webpack이 로컬 셸 시크릿 전체를 배포 번들에 굽는 구조)를 발견하고 해결한 기록.

**교훈 요약:** 이론적으로 맞다고 확신한 fix를 사용자에게 프로덕션 배포로 검증시키지 말 것. 로컬 빌드 → 산출물 직접 검증 → 그 다음에 배포 요청. (2026-08-17 사용자 피드백으로 명시적으로 지적받음.)

---

## 1) 배경

`~/psapp/admin/be/admin-dev-restapi/src/utils/rds.ts`가 `RDSClient` 생성 시 fart86의 `AdministratorAccess` 액세스키를 평문으로 하드코딩. 이미 배포된 Lambda(`custom-lambda-role-production`)로 전환하면 되겠다 싶어 진행.

## 2) IAM 쪽 준비 (성공)

1. 실제 코드 사용 범위 확인: `controller/rds.ts`가 `dev-mshuttle`/`staging-mshuttle`만 허용(production 진입 자체 불가), `staging-mshuttle`은 이미 폐기되어 미존재 → 실질 대상은 `dev-mshuttle` 하나.
2. 최소권한 정책 `admin-dev-restapi-rds-dev-control` 생성 (`rds:DescribeDBInstances`/`StartDBInstance`/`StopDBInstance`, Resource를 `dev-mshuttle` ARN 하나로 고정) → `custom-lambda-role-production`에 부착.
3. assume-role + `iam simulate-principal-policy`로 dev 허용/production 차단 검증 (dev-mshuttle 실제 상태는 안 건드림).
4. `src/utils/rds.ts`에서 하드코딩 credentials 블록 제거, `tsc --noEmit` 통과 확인.

여기까지는 정상 진행. 문제는 배포 이후.

## 3) 1차 배포 실패 — CredentialsProviderError

배포 후 `dev-mshuttle`이 관리자 화면 목록에서 안 보임(에러가 앱 코드에서 조용히 삼켜져서 증상만 보임). CloudWatch(`/aws/lambda/production-admin-dev-restapi`) 확인:

```
CredentialsProviderError: Could not load credentials from any providers
    at ... credential-provider-node/dist-es/defaultProvider.js:66
    at async describeInstance (webpack://admin-dev-restapi/src/utils/rds.ts:91:20)
```

IAM 권한 문제가 아니라 **SDK가 자격증명을 아예 못 읽는** 문제였음.

## 4) 근본 원인 — webpack DefinePlugin이 process.env를 통째로 얼림

`webpack.config.cjs`의 `getEnvVar()`:

```js
const raw = Object.keys(process.env).reduce((env, key) => {
  env[key] = process.env[key];
  return env;
}, {});
// ...
new webpack.DefinePlugin({ "process.env": {...raw, ...envVars, NODE_ENV} })
```

`Object.keys(process.env)` = **빌드를 실행한 사람의 로컬 셸 환경변수 전체** (`.env.production` 파일이 아님). 이게 `DefinePlugin`으로 번들에 리터럴 객체로 통째로 박힘.

실제 배포된 `.aws-sam/build/handler.js`를 열어보니:
```js
const accessKeyId = ({"SERVER_KEY_NOTION":"secret_...", "GITHUB_TOKEN":"ghp_...", "LINEAR_API_KEY":"lin_api_...", ... 수백 개 로컬 shell env ...})["AWS_ACCESS_KEY_ID"]
```

`process.env`를 객체 형태(`"process.env": {...}`)로 DefinePlugin에 넘기면, **`process.env` 참조 자체가 이 얼어붙은 객체로 치환됨** — dot-notation(`process.env.KEY`)뿐 아니라 bracket 접근(`process.env[dynamicKey]`, AWS SDK 내부 패턴)과 `process.env`를 통째로 넘기는 경우까지 전부. 빌드 머신 셸엔 `AWS_ACCESS_KEY_ID` 같은 게 없으니(이 계정은 `~/.aws/credentials` 파일 방식, env var 아님) 그 키는 얼어붙은 객체에 없고, 결과는 `undefined` → 모든 provider 실패.

**더 심각한 별도 발견:** 이 번들엔 `GITHUB_TOKEN`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `LINEAR_API_KEY`, `SERVER_KEY_NOTION`, `SERVER_KEY_GEMINI_API_KEY`, `SERVER_KEY_SLACKWEBHOOK_*`, `MYSQL_PASSWORD`, `MONGO_PASSWORD` 등 **실제 시크릿 수백 개가 개발자 로컬 셸에서 그대로 평문으로 배포 번들에 새겨짐.** `admin-etc-restapi`의 `webpack.config.cjs`도 동일 패턴 확인 — CLAUDE.md에 "동일 보일러플레이트에서 분기"라 적혀있어 **admin-\*/user-\*-restapi 15개+ 리포 전부 같은 구조일 가능성 높음(미검증).**

## 5) 2차 시도 — 부분 fix (AWS_ prefix만 제외) → DB 연결 파괴 직전

1차 대응: `raw` 생성 시 `AWS_`로 시작하는 키만 필터링. 배포했지만 **동일한 에러 재현** — `process.env` 자체가 여전히 통째로 치환되고 있어서, `AWS_ACCESS_KEY_ID`가 얼어붙은 객체 안에 없다는 사실 자체는 안 바뀜(같은 실패).

이걸 고치려고 `"process.env.KEY"` 형태(개별 dotted-key)로 DefinePlugin 정의를 바꿨는데, **로컬 빌드로 검증하는 과정에서** `src/db/client.ts`가 `env.MYSQL_HOST` 형태로(= `process.env`를 통째로 넘겨받아 나중에 속성 접근) DB 커넥션 정보를 읽는다는 걸 발견. 이 방식으로 가면 `process.env` 자체가 더 이상 치환 안 되니 **DB 연결이 통째로 깨질 뻔함** — 배포 전 로컬 빌드 검증으로 잡음.

## 6) 최종 fix — process.env를 아예 안 건드리고 런타임에 병합

`process.env`는 DefinePlugin으로 손대지 않고, 빌드타임 설정값은 별도 전역 `__BAKED_ENV__`로만 주입:

```js
// webpack.config.cjs
return { __BAKED_ENV__: JSON.stringify({ ...raw(AWS_ 제외), ...envVars, NODE_ENV }) };
```

```ts
// src/handler.ts 최상단, bootstrap() 호출보다 먼저
declare const __BAKED_ENV__: Record<string, string>;
Object.assign(process.env, __BAKED_ENV__);
```

이러면:
- Lambda가 실제로 주입하는 값(`AWS_ACCESS_KEY_ID` 등)은 `Object.assign`이 덮어쓰지 않아 그대로 유지
- `.env.production` 값(`MYSQL_HOST` 등)은 런타임 `process.env`에 병합되어 기존 코드(`env.MYSQL_HOST` 패턴)도 그대로 동작

## 7) 배포 전 로컬 검증 (2026-08-17, 사용자 피드백 이후 도입)

배포를 요청하기 전에 반드시 로컬에서:
1. `tsc --noEmit`
2. `webpack --env stage=production` 실제 빌드
3. 빌드 산출물(`~.aws-sam/build/handler.js`)을 직접 grep해서:
   - `Object.assign(process.env, {...})`이 `bootstrap()` 호출보다 먼저 오는지
   - AWS 자격증명 경로가 `process.env[ENV_KEY]` 그대로인지(얼어붙지 않았는지)
   - `MYSQL_HOST` 등이 baked 객체에 정상 존재하는지
   - `AWS_ACCESS_KEY_ID`가 baked 객체에 없는지
4. **가장 강한 검증**: assume-role로 받은 `custom-lambda-role-production`의 임시 자격증명만 있고 로컬 셸 자격증명은 전혀 없는 환경(`env -i` 상당)에서, 빌드 산출물에서 뽑은 baked 객체를 실제로 병합한 뒤 `@aws-sdk/client-rds`로 `dev-mshuttle`/`production-mshuttle` 둘 다 실제 호출 — dev 성공, production AccessDenied 확인.

## 8) 배포 및 결과

2026-08-17 04:06:46 UTC 배포. 배포 전환 순간 에러 1건(전환 과정 잔재로 판단) 이후 `CredentialsProviderError` 0건. `dev-mshuttle`이 관리자 화면에 정상 표시됨(사용자 확인).

## 8-1) dev 스택도 동일 조치 (2026-08-17, 이어서 진행)

`admin-dev-restapi-dev` 스택(Lambda `dev-admin-dev-restapi`, role `custom-lambda-role-dev`)도 존재 확인 — production과 완전히 분리된 별도 스택. 여기도 배포했더니 credential 에러는 사라졌지만 `custom-lambda-role-dev`에 RDS 권한이 전혀 없어 `AccessDenied` 발생.

기존에 만든 `admin-dev-restapi-rds-dev-control`(dev-mshuttle 전용, 최소권한) 정책을 재사용해서 `custom-lambda-role-dev`에도 부착 — 새 정책 안 만들고 기존 것 재사용. IAM 정책 부착은 즉시 적용되므로 재배포 불필요, 바로 정상 동작 확인됨.

**최종 상태:** production/dev 두 스택 모두 정상 동작.

## 9) 남은 것 (미해결, 별도 트랙 필요)

- **시크릿 유출 자체는 이 fix로 해결 안 됨.** `__BAKED_ENV__`엔 여전히 `GITHUB_TOKEN`, `LINEAR_API_KEY`, `SERVER_KEY_*` 등 로컬 셸의 다른 시크릿들이 통째로 들어가 번들에 배포됨. `AWS_` prefix만 제외했을 뿐.
- 이 `getEnvVar()` 패턴이 `admin-etc-restapi`에도 동일 확인됨 — **15개+ admin-\*/user-\*-restapi 리포 전체 영향 가능성.** 각 리포별 확인 및 동일 fix(또는 더 근본적으로 "로컬 셸 전체가 아니라 CI/CD가 명시적으로 제공하는 값만 사용"으로 구조 개선) 필요.
- 이번 fix는 `admin-dev-restapi` 1건에만 적용. 나머지 리포들은 `rds.ts` 같은 하드코딩 키 제거 시 **이 gotcha([[../gotchas#awssrc-webpack-defineplugin이-processenv를-통째로-얼려서-lambda-기본-자격증명-체인을-깨뜨림]])를 반드시 먼저 확인**해야 같은 실패를 반복 안 함.

## 10) 관련

- [[../aws-pending#cron_servdriver-runn-cron-하드코딩-aws-액세스-키--규모-재확인-70개-파일-psapp-백엔드-전체]] — 원본 하드코딩 키 이슈, 이번 건은 그 중 1개 리포의 파일럿
- [[../gotchas]] — webpack DefinePlugin 함정 신규 등록
