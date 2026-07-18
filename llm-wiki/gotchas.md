---
type: repo-wiki
repo: ps-aws
domains: []
stack: [aws-sdk-v3, aws-cli, cloudwatch, node-cron]
status: active
updated: 2026-07-18
---

# gotchas — 건드리면 터지는 곳

수정 전 반드시 훑을 것.

이 문서는 **src/ 코드의 함정** 과 **AWS 운영 작업의 함정** 양쪽을 다룬다. 각 항목 제목에 [AWS] 또는 [src] 가 붙어 있다.

---

## [AWS] RDS rename + waiter NotFound 함정  #gotcha

`aws rds modify-db-instance --new-db-instance-identifier <new>` 직후 `aws rds wait db-instance-available --db-instance-identifier <new>` 를 부르면, AWS 가 rename 처리 중에 일시적으로 NotFound 를 반환하는 동안 waiter 가 **즉시 실패** (재시도 없음).

실제 사고: [[aws-ops/2026-06-03-read-replica-az-migration]] — rename swap 두 번 중 첫 번째 waiter 가 NotFound 로 실패 → 두 번째 rename 이 이름 충돌 → read endpoint 3~4분 부재.

**교훈:**
- AWS rename + 표준 waiter 조합은 위험.
- 폴링 루프 (NotFound 도 재시도 케이스로 포함) 직접 짜야 함.
- dev 인스턴스는 단발 waiter 로 충분할 수도 있지만, 운영 인스턴스에서는 절대 단발 waiter 만 쓰지 말 것.

(이 함정은 자동 메모리 `feedback_aws_rds_waiter_pitfall` 에도 등록되어 있어, 다음 세션에서 동일 작업을 시작할 때 자동 환기됨.)

---

## [src] WAF 메트릭이 항상 0 으로 나올 가능성  #gotcha

`src/infra-monitor/waf.ts` 의 `getMetricData` 가 dimension 을 이렇게 박는다:

```ts
Dimensions: [
  { Name: "WebACL", Value: webAclName },
  { Name: "Region", Value: "GLOBAL" },   // ← 하드코딩
  { Name: "Rule", Value: "ALL" },
]
```

같은 파일의 `monitorWAF()` 는 `ListWebACLsCommand({ Scope: "REGIONAL" })` 로 Regional ACL 만 나열한다.

`Region: GLOBAL` 은 **CloudFront(=Global) scope** WebACL 의 CloudWatch dimension 이다. Regional ACL 의 CloudWatch dimension Region 값은 `ap-northeast-2` 같은 실제 리전 이름이다.

즉 **"Regional ACL 을 나열해서 → Global dimension 으로 메트릭 조회"** 라는 미스매치. 매트릭이 비어 결과는 항상 `value: 0` 으로 떨어진다. WAF 알림이 한 번도 울리지 않는 게 임계값 미달이 아니라 이 미스매치 때문일 수 있다.

> TODO(질문): WAF 메트릭이 실제로 0 이 아닌 값으로 들어오는 것을 확인한 적 있습니까? 운영 중인 WebACL 이 Regional 인가요 CloudFront 인가요? #todo

---

## [src] CloudWatch 5분 단일 datapoint  #gotcha

세 모니터 모두 동일 패턴:

```ts
const endTime = new Date();
const startTime = new Date(endTime.getTime() - 300 * 1000);  // 5분
GetMetricStatistics({ ..., Period: 300, Statistics: [...] })
response.Datapoints?.[0]   // 첫 점 하나만 사용
```

- 5분 윈도우 × Period 300 → 최대 1개 datapoint. 그 한 점이 없으면 `value: 0` 으로 fallback.
- 메트릭 publish 가 지연되면 (CloudWatch 는 통상 1~3분 지연) 데이터 없는 시점에 호출되어 `0` 으로 보고됨.
- **"value = 0" 의 의미가 "실제 0" 인지 "데이터 없음" 인지 코드상 구분 불가.** 알림 조건이 `> 0` / `> N` 이라 위양성보다 위음성 위험이 크다.

**현재 결정 (2026-06-25): 그대로 유지.** 점검 주기가 30분이라 한 tick 놓쳐도 다음 tick 에 잡힘. 임계 누락이 사고로 이어지는 단계가 되면 윈도우를 15~30분으로 늘리고 가장 최근 datapoint 를 골라쓰는 식으로 손본다. [[decisions]] 참조.

---

## [src] DynamoDB 모니터링이 모든 테이블을 휘적였다 → 화이트리스트 추가됨

2026-06-25 부터 `DYNAMODB_TABLE_NAMES` env 가 RDS 와 동일 패턴으로 추가됨 (`src/infra-monitor/dynamodb.ts`).

- env 지정 시: 그 테이블만 점검
- env 미지정: 모든 테이블 점검 (이전 동작)

신규 운영 환경에서는 `.env` 에 화이트리스트를 채우는 게 기본. 안 채우면 계정 안 모든 테이블이 점검 대상이 되어 30분 주기에 호출 수가 비선형으로 늘 수 있다.

---

## [src] 스케줄러 끄는 방법이 없다  #gotcha

`startServer(port, enableScheduler = true)` 의 두 번째 인자가 `true` 가 기본이며, `src/index.ts` 는 첫 번째 인자만 넘긴다.

→ 로컬에서 `yarn dev` 하면 매 30분 실제 AWS API 가 깨어나서 메트릭을 긁고, env 가 설정돼 있으면 **개발 로컬에서 Telegram/Slack 알림이 발사된다.** 끄는 env 토글 없음.

개발 시에는 `.env` 의 `TELEGRAM_BOT_TOKEN`/`SLACK_BOT_TOKEN` 을 비워두는 게 안전. 또는 `startServer(PORT, false)` 로 임시 변경.

---

## [src] 부팅 직후 점검이 없다  #gotcha

`node-cron.schedule()` 은 다음 cron tick 이 와야 처음 실행된다. `*/30 * * * *` 이라면 시작 직후 0~30분 동안은 점검이 없다. "서버 살아있는지" 확인은 `GET /health` 로만 가능.

---

## [src] RDS unit 이 항상 "%"  #gotcha

`src/infra-monitor/rds.ts:getMetricData` 가 unit 을 항상 `"%"` 로 박는다. `DatabaseConnections` 도 `unit: "%"` 가 된다. 알림 메시지 포맷터(`telegram.ts`, `slack.ts`)는 unit 을 다시 직접 박으므로 사용자에겐 안 보이지만, `MetricData.unit` 을 신뢰하는 새 코드를 짜면 깨진다.

---

## [src] 패키지 매니저는 pnpm 고정

2026-06-25 결정: pnpm 으로 통일. `package.json` 의 `"packageManager": "pnpm@10.30.1"` 필드로 강제. README/위키 모두 `pnpm <cmd>` 표기로 정리됨.

yarn 으로 install 하면 lockfile 무시 + 다른 dep 트리가 생성되므로 절대 yarn/npm 사용하지 말 것.

---

## [src] stopped EC2 의 estimatedMonthlySavingUSD = 0  #gotcha

`src/infra-monitor/waste.ts:findStoppedEC2` 가 절감액을 `0` 으로 박고 주석은 "EBS는 별도 항목으로 잡힘" 이라고 한다.

그러나 `findUnattachedEBS` 는 `status: "available"` (어디에도 attach 안 된 것)만 잡는다. stopped EC2 의 root EBS 는 **인스턴스에 attach 된 채로** 있으므로 unattached 컬렉터에서 안 잡힌다 → 결국 어디서도 절감액으로 카운트되지 않는다.

stopped EC2 들이 매월 EBS 비용을 그대로 내는데, 보고서 합계에는 0 으로 들어간다.

---

## [src] 리전 hard-coding 이 모듈마다 다르다  #gotcha

| 모듈 | 동작 |
|---|---|
| `infra-monitor/{rds,dynamodb,waf}.ts` | SDK 디폴트. `AWS_REGION` env 가 진실 |
| `infra-monitor/waste.ts` | `AWS_REGION ?? "ap-northeast-2"` |
| `scripts/rdsStatus.ts` | `ap-northeast-2` 하드코딩 (env 무시) |
| `scripts/wafBotControl.ts` | `us-east-1` 하드코딩 (CloudFront scope 전용이므로 의도된 것) |
| `scripts/rdsStatus.ts` Cost Explorer | `us-east-1` 강제 (CE 전용 엔드포인트, 정상) |

`AWS_REGION` 을 다른 값으로 설정해도 `rdsStatus` 는 ap-northeast-2 만 본다. 다른 리전 자원을 가진 계정으로 옮기면 침묵하는 버그.

---

## [AWS+src] WAF Bot Control 의 prod 사고 위험  #gotcha

`wafBotControl.ts` 의 `--target` 디폴트는 `all` (= dev + prod 동시).

```bash
pnpm waf:bot disable --confirm    # ← --target 안 적으면 prod 도 같이 disable
```

운영 ACL 을 손으로 부수기 쉽다. 항상 `--target dev` 를 명시한다.

`BOT_RULE_NAME = "AWS-AWSManagedRulesBotControlRuleSet"` 와 `TARGETS = { dev: { ... id: ... }, prod: { ... id: ... } }` 가 하드코딩. ACL 이름·ID 가 바뀌면 침묵 실패.

작업 절차: [[aws-runbooks/waf-bot-control-toggle]].

---

## [AWS] WAF / Security Hub / Config 비활성 절대 금지  #gotcha

비용 절감 검토에서 자동 제외해야 하는 서비스. 2024-12-28 계정 마비 사건 이후 AWS 측이 해제 조건으로 활성 유지 요구. 보호 자원 전체 목록은 [[aws-inventory/protected-resources]].

`wafBotControl` 의 `disable` 은 **WAF 전체 비활성이 아니라 Bot Control 룰만 제거** 하는 것이므로 허용 범위. 단 WAF Web ACL 자체나 Security Hub / Config 비활성은 절대 금지.

---

## [src] `node-cron` 검증 실패 시 조용히 안 켜진다  #gotcha

```ts
if (!cron.validate(CRON_SCHEDULE)) {
  console.error(`Invalid cron schedule: ${CRON_SCHEDULE}`);
  return;
}
```

cron 표현식이 잘못되면 `console.error` 만 찍고 함수가 return. 서버는 정상 기동하므로 `/health` 도 `scheduler.running: false` 가 나오긴 하는데 운영자가 응답 본문을 확인하지 않으면 모름.

---

## [src] `.env` 와 `app.log` 같은 런타임 파일이 커밋 흔적  #gotcha

`git status` 기준 `.env`, `.pid`, `app.log` 가 워킹트리에 있고 `.gitignore` 도 일부만 잡고 있을 가능성. 새 `.env` 작성 후 commit 전 확인할 것. (이 위키 작성 시점의 `.gitignore` 검증은 별도)

> TODO(질문): `.env` 가 과거에 commit 된 적 있나요? `git log -- .env` 결과를 한 번 점검할 가치가 있습니다. #todo

---

## [src] `RDS_INSTANCE_NAMES` 가 비어 있으면 모든 RDS 점검  #gotcha

`monitorRDS` 는 env 미지정 시 `null` → 모든 인스턴스 점검. 운영 RDS 가 늘어나면 자동으로 알림 폭이 커진다. 의도 여부 확인 필요.

---

## [AWS] RDS read replica 의 allocated-storage 는 source 이상  #gotcha

`create-db-instance-read-replica --allocated-storage <N>` 에서 N 이 source 의 allocated 보다 작으면 거부됨.

→ "read replica 만 작은 크기로 만들어서 스토리지 절감" 은 불가. 줄이려면 **source 자체를 축소**해야 함 → [[aws-runbooks/rds-shrink-migration]].

[[aws-ops/2026-06-03-read-replica-az-migration]] 에서 메모리 계획 (-$24.78/월) → 실제 가능 (-$17.82/월) 로 줄어든 원인.

---

## [AWS] S3 라이프사이클 transition 타이밍은 가변적  #gotcha

공식 문서 추정 "정책 등록 후 24~48시간 내 첫 batch 처리 시작" 이지만 **단일 prefix + 단일 transition 룰 + 객체 수천 개** 정도면 ap-northeast-2 기준 수 시간 만에 거의 완료되기도 함 ([[aws-ops/2026-06-04-msdeveloper-s3-lifecycle]] 실측).

반대로 큰 batch / 복합 룰은 며칠~1주 걸릴 수 있음. 시간 가정에 기대지 말고 `head-object` 로 직접 storage class 확인.

---

## [AWS] CloudFront update-distribution 은 ETag + 전체 config 교체  #gotcha

`update-distribution` 은 PATCH 가 아니라 **PUT-스타일 전체 교체**. 즉:
1. `get-distribution-config` 로 `DistributionConfig` + `ETag` 받기
2. **DistributionConfig 전체** 를 수정한 채로
3. `--if-match $ETAG` 로 update

기존 `FunctionAssociations` 의 다른 항목 (특히 `admin-fe-response-*`) 을 빼먹은 채 보내면 **그 association 이 사라짐.** 무조건 append 하는 형태로 jq pipeline 짤 것 ([[aws-runbooks/cloudfront-function-attach]]).

운영 admin FE 응답 가공이 끊기면 화면이 깨질 수 있음 → [[aws-inventory/protected-resources#4-cloudfront-admin-fe-response-function-association]].

---

## [AWS] KMS 삭제는 pending window 30일이 유일한 안전망  #gotcha

`schedule-key-deletion` 후 default 30일 (`--pending-window-in-days 7~30`) 안에는 `cancel-key-deletion` 으로 복구 가능. 30일 지나면 영구 삭제 — **복구 불가.**

암호화된 자원 (RDS storage, S3 SSE-KMS 오브젝트 등) 이 그 키로 잠겨 있으면 그 자원도 같이 사망 → 사전 점검에서 "이 키로 잠긴 자원이 정말 없는가" 확인 필수.

[[aws-ops/2026-06-02-kms-madmin-cleanup]] 에서 madmin KMS 1개 PendingDeletion (2026-07-02 영구 삭제 예정) → 그 전까지가 마지막 복구 기회.

---

## [AWS] `aws ec2 modify-instance-attribute --instance-type` 은 stopped 상태에서만  #gotcha

`InvalidInstanceState` 로 거부됨. stop → modify → start 순서 필수. 운영 인스턴스는 다운타임 발생 (45초~수 분).

반면 `aws ec2 modify-volume --volume-type gp2→gp3` 는 **무중단** 으로 가능 ([[aws-ops/2026-06-01-vpc-ec2-cleanup]] 참조). 두 명령의 동작이 다르다는 점이 자주 헷갈림.

---

## [AWS] Lambda@Edge 함수의 진실 위치는 us-east-1  #gotcha

CloudFront 가 글로벌이라 다른 리전 콘솔에서 Lambda 가 안 보이는 것 같지만, 실제 origin 함수는 **반드시 us-east-1** 에 생성됨. 다른 리전에는 자동 replica 만 깔린다.

ap-northeast-2 sweep 만 하면 us-east-1 의 Lambda@Edge 잔재가 안 보임 → 모든 리전 점검 시 us-east-1 별도 sweep 필요 ([[aws-ops/2026-06-02-lambda-edge-cleanup]] 참조).

---

## [AWS] DynamoDB 위치정보 테이블에 필드 레벨 암호화 없음  #gotcha

`production_dr_runn`, `production_dr_runn_hist` (기사 GPS 위경도)는 `SSEDescription: null` — AWS 소유 키 기본 암호화만 걸려있고, 필드 레벨 암호화는 없음. `scan`/콘솔로 조회하면 lat/lng가 그대로 평문 숫자로 보임. IaC(`~/iac/iac_ddb_runn/lib/constructs/dynamodb-tables.ts`)에도 `encryption` 옵션 자체가 없어 설계 단계부터 고려되지 않았음.

**연쇄 위험**: 두 테이블 모두 PITR 활성 상태로 매일 새벽 Export to S3 → Glue(stlog5)/Athena 분석 파이프라인이 소비 중. SSE를 AWS 소유 키에서 KMS 관리형/고객관리형 키로 바꾸면, export를 수행하는 IAM role과 DynamoDB Streams 소비자(AppSync/Lambda 추정)에 `kms:Decrypt` 권한이 있는지 먼저 확인해야 함 — 없으면 테이블 자체는 멀쩡한데 야간 export가 조용히 실패할 수 있음.

OPA 위치정보법 실태점검 2026년도 2차 대응 중 발견 (마감 2026-07-17, 아직 미해결). 상세 [[aws-ops/2026-07-17-dynamodb-location-encryption-audit]], 결정 대기 [[aws-pending#dynamodb-위치정보-저장-암호화-opa-실태점검-대응]].

---

## [AWS] `production_dr_runn`/`_hist`의 Streams를 Flink가 직접 구독 중 (현재 정지)  #gotcha

AppSync/익스포트 Lambda 말고 **`iac_shuttle_analytics`(Managed Flink, PyFlink)**가 `FlinkDynamoDBStreamsConsumer`로 두 테이블의 DynamoDB Streams를 직접 구독한다. 실시간 급정거/과속/경로이탈 등 안전 알림 파이프라인.

`dev-shuttle-analytics`, `production-shuttle-analytics` 둘 다 현재 `ApplicationStatus: READY`(정지) — **2026-07-18 사용자 확인: 의도된 상태** (아직 개발 중, DynamoDB Sink 미구현).

**주의:** 이 앱을 재가동하기 전에, 그 시점의 테이블 SSE 설정에 맞춰 `FlinkRole`의 KMS 권한이 되어있는지 반드시 먼저 확인할 것 — 안 하면 Streams 읽기가 조용히 실패할 수 있음(미검증 상태로 남아있음). 상세 [[aws-ops/2026-07-18-dynamodb-stream-consumer-audit]].

**삽질 방지 메모:** 리포 내 문서(`251205_STREAM_ARN.md`)가 예시로 구세대 테이블명(`drv_runn_dev`)을 써놔서 "혹시 구세대 삭제 때(2026-07-01) 같이 죽은 거 아닌가" 의심할 수 있는데, 실제 배포된 Stream ARN은 현재 세대(`production_dr_runn`)를 정확히 가리키고 있음을 라이브로 확인함(2025-12-26 갱신). 이 가설은 이미 기각됨 — 다시 조사하지 말 것.

---

## [AWS] `driver-tracking-api-production`은 상시 드리프트 상태 — 단, 배포해도 용량은 안 건드림  #gotcha

이 스택은 DynamoDB 테이블에 Application Auto Scaling(출퇴근 피크 스케줄)과, 일부 테이블(`RunnStatus`/`RunnStatusHst`)은 별도 레거시 크론(`infra.ddb_status.on/off`, cron_serv 계열)까지 얹어서 용량을 실시간으로 바꾸는 구조다. CDK 템플릿이 기억하는 `ProvisionedThroughput`/`ScalableTarget MinCapacity·MaxCapacity`는 "정지 상태" 기준 고정값이라, **살아있는 스택은 항상 CloudFormation 드리프트 상태**다(2026-07-18 확인: 13개 리소스, 전부 용량 숫자, 구조적 드리프트는 없음 — [[aws-ops/2026-07-17-dynamodb-location-encryption-audit#7-production-드리프트-점검-결과-2026-07-18]]).

**처음엔 "배포하면 이 용량들이 CDK 고정값으로 리셋된다"고 오판했으나(→ 정정, 2026-07-18):** CloudFormation 스택 업데이트는 라이브 상태가 아니라 **직전 템플릿 vs 새 템플릿**을 비교해서 실제 API 호출을 만든다. `readCapacity`/`writeCapacity`처럼 이번 코드 변경에서 건드리지 않은 속성은, 템플릿 문자열상 값이 그대로라 CloudFormation이 아예 업데이트 대상에서 제외한다 — **드리프트가 있어도 그 속성을 템플릿에서 안 건드리면 배포해도 안 건드려짐.** 실제로 SSE 암호화만 추가한 배포의 change set에서 ProvisionedThroughput 변경은 0건이었음(dev·production 둘 다 확인).

**결론:** 이 스택에 배포할 때 "용량이 리셋되나"를 매번 걱정할 필요는 없다 — **템플릿에서 capacity 관련 속성 자체를 건드리는 배포일 때만** 실제로 영향이 있다. 그런 배포라면 드리프트 점검 + 저트래픽 시간대 고려가 여전히 유효.

`cdk diff`(change set 기반, "accurate replacement information")를 배포 전에 항상 먼저 떠서 실제로 뭐가 바뀌는지 확인하는 습관이 `detect-stack-drift`보다 더 직접적인 답을 준다 — drift는 "차이가 있다"만 알려주고, diff가 "이번에 실제로 뭘 바꿀지"를 알려준다.

dev 스택(`driver-tracking-api-dev`)은 Auto Scaling 미적용이라 이 드리프트 패턴 자체가 없다 — production만의 특성.

---

## [AWS] `iam delete-user`는 그룹 제거만으론 안 됨 — 직접 붙은 정책까지 다 떼야 함  #gotcha

IAM 사용자 삭제 순서를 그룹 탈퇴 → 액세스키 삭제 → SSH키 삭제 → `delete-user`로 진행하면, **사용자에게 관리형/인라인 정책이 직접(그룹 아닌) 붙어있을 경우 `DeleteConflict` 에러로 막힌다.**

`khj.dev` 오프보딩([[aws-ops/2026-07-18-khj-dev-offboarding]])에서 실제로 겪음 — 그룹 4개·키 6개까지 다 정리했는데 `delete-user`가 "must detach all policies first"로 실패. `list-attached-user-policies` + `list-user-policies`로 직접 붙은 정책(관리형 5개, 인라인 4개)을 먼저 확인해서 전부 detach/delete해야 함.

**IAM 사용자 삭제 전 체크리스트 (순서대로):**
1. `list-groups-for-user` → 전부 `remove-user-from-group`
2. `list-attached-user-policies` → 전부 `detach-user-policy`
3. `list-user-policies`(인라인) → 전부 `delete-user-policy`
4. `list-access-keys` → 전부 `delete-access-key`
5. `list-ssh-public-keys` → 전부 `delete-ssh-public-key`
6. `list-mfa-devices` → 있으면 `deactivate-mfa-device`
7. `get-login-profile` → 있으면 `delete-login-profile`
8. `delete-user`

퇴사자 오프보딩처럼 반복될 작업이라 순서를 기억해둘 것.
