---
type: aws-op
date: 2026-09-08
account: "306331009209"
region: ap-northeast-2
category: [cloudwatch, appsync, cost]
impact: 설정 변경 (driver-tracking 계열 AppSync 4개 CloudWatch Logs 로깅 완전 비활성화. RequestSummary 로그 소실 — 요청 단위 상세 추적 불가, 기본 메트릭은 유지)
status: done
---

# 2026-09-08 · CloudWatch 무료 한도 초과 원인 조사 — 1차 진단 오판 정정 → AppSync 로깅 완전 비활성화

## 1) 배경

사용자가 CloudWatch Free Tier 소진 임박을 발견, 원인 조사 요청.

## 2) 조사 결과

**Cost Explorer 로 CloudWatch 사용량 항목별 분해** (최근 3개월, ap-northeast-2):

| 항목 | 사용량 | 무료 한도 | 상태 |
|---|---|---|---|
| Alarms | 5개 | 10개 | 여유 |
| Custom Metrics | 8~9개 | 10개 | 여유 |
| API Requests | 수천 | 100만 | 여유 |
| Dashboards | 1개 | 3개 | 여유 |
| **Logs 수집량 (`APN2-DataProcessing-Bytes`)** | **월 8~12GB** | **5GB** | **160~240% 초과, 월 ~$6 청구 중** |

로그 수집량만 유일하게 초과 — 이게 사실상 전부.

**337개 로그 그룹 전수 조사** (`AWS/Logs IncomingBytes`, 90일):

`/aws/appsync/apis/eslvk6cwovf7xa5ycfbrm6vukm` (AppSync API `driver-tracking-api-production`) 하나가 **평일 350~600MB/일, 주말 40~200MB/일**로 6월 초부터 조사 시점까지 거의 3개월간 동일한 패턴 지속. 30일 합계 약 10.8GB — 다른 300여 개 로그 그룹을 다 합쳐도 이보다 작음. 사실상 이 API 하나가 초과분 전체의 원인.

**근본 원인**: `fieldLogLevel: NONE` (필드 단위 상세 로깅은 꺼져 있음)이지만 `excludeVerboseContent: false`라서, AppSync가 매 요청마다 남기는 요약 로그에 **요청/응답 payload 전체와 매핑 템플릿 컨텍스트가 통째로** 포함됨. `driver-tracking-api-production`은 기사 실시간 위치 추적용(WebSocket 구독+mutation)이라 요청 빈도 자체가 높아, verbose 로그가 겹쳐 대용량화.

**최근 배포와는 무관함 확인**: 이 API의 CloudFormation 스택(`driver-tracking-api-production`)은 2026-07-18에 마지막 업데이트됐으나, 로그량 일별 추이(6/10~9/8, 90일)를 보면 배포 전후로 아무 변화 없이 동일한 주간 패턴이 계속됨 → 최근 배포가 원인이 아니라 애초부터 있던 설정 문제.

**참고**: S3 `ms-file` 조사([[2026-09-07-ms-file-search-console-noindex]])와 무관한 별건.

## 3) 1차 조치 (틀렸음 — 아래 5)에서 정정)

`UpdateGraphqlApi` (apiId: `eslvk6cwovf7xa5ycfbrm6vukm`) 로 `logConfig.excludeVerboseContent` 를 `false` → `true` 로 변경. `fieldLogLevel`(`NONE`), `cloudWatchLogsRoleArn`, `authenticationType`(`API_KEY`) 등 기존 설정은 유지한 채 적용.

**이 조치는 검증 없이 "이론상 맞다"는 추론만으로 적용했고, 실제로는 거의 효과가 없었다** — 5)번 참조.

## 4) 자매 API 전수 점검 (같은 날 진행)

이 계정의 AppSync API 6개 전부 `GetGraphqlApi`로 `logConfig` 확인:

| API | fieldLogLevel | excludeVerboseContent (수정 전) | 조치 |
|---|---|---|---|
| `driver-tracking-api-production` | NONE | false | 위 3) — 이후 5)에서 로깅 완전 차단으로 대체 |
| `driver-tracking-alert-api-production` | NONE | false | `true`로 수정 → 이후 5)에서 로깅 완전 차단으로 대체 |
| `driver-tracking-api-dev` | ERROR | false | `true`로 수정 → 이후 5)에서 로깅 완전 차단으로 대체 |
| `driver-tracking-alert-api-dev` | NONE | false | `true`로 수정 → 이후 5)에서 로깅 완전 차단으로 대체 |
| `appsync-driver-api-production` | ERROR | true (이미 정상) | 조치 불필요 |
| `drv_runn` | - | 로깅 자체 비활성 | 조치 불필요 |

같은 계정에 있던 Kinesis Firehose 활성 스트림 10개도 확인 — Firehose의 CloudWatch 로깅은 배달 실패 시에만 기록되는 구조라 AppSync와 성격이 다르고, 실측 로그량도 전부 수 KB 이하(무시 가능) → 조치 불필요. `user_car_move`/`user_trs_move`/`user_noti`/`user_log_search` 등 로그 그룹은 대응 스트림이 이미 삭제된 고아 로그 그룹으로 확인(기존 "[[aws-pending#cloudwatch-고아-log-group-sweep]]" 항목과 동일 종류, 별건).

## 5) 오판 정정 — `excludeVerboseContent`는 효과 없었음, 진짜 원인은 요청량 자체

**검증 방법**: 수정 전날(9/7 01:00~06:30 UTC)과 수정 후 같은 시간대(9/8 01:00~06:30 UTC, `excludeVerboseContent:true` 적용 이후)를 `AWS/Logs`의 `IncomingBytes`+`IncomingLogEvents`로 이벤트당 평균 바이트 비교:

| | 이벤트 수 | 총 바이트 | 이벤트당 평균 |
|---|---|---|---|
| 수정 전 (9/7) | 158,796 | 53.2MB | **335 bytes** |
| 수정 후 (9/8) | 259,740 | 86.6MB | **333 bytes** |

이벤트당 평균 크기가 사실상 동일 — `excludeVerboseContent`는 아무 효과가 없었다.

**진짜 원인**: `fieldLogLevel: NONE`이면 애초에 verbose 내용(헤더/컨텍스트/매핑 템플릿)이 실리는 `Tracing`/`RequestMapping`/`ResponseMapping` 로그 자체가 생성되지 않는다 — `excludeVerboseContent`는 그 로그 타입들에만 영향을 주는 옵션이라, `NONE` 상태에서는 애초에 손댈 게 없었다. 매 요청마다 무조건 찍히는 `RequestSummary`(요청ID/지연시간/상태, 건당 ~330바이트)만 있었고, 이건 verbose 옵션과 무관하게 계속 발생 — **이 API의 로그량은 요청 수 자체(시간당 4~5만 건 수준의 실시간 위치 업데이트)에 비례하는 구조라 로깅 레벨을 아무리 낮춰도 줄지 않는다.**

**교훈**: "이 설정이 원인일 것이다"라는 추론만으로 조치를 완료 처리하지 말 것 — 적용 후 반드시 전/후 실측으로 검증. 이번엔 검증을 나중에(사용자가 재차 질문한 뒤에) 해서 오판을 뒤늦게 발견함. gotcha로 등록: [[../gotchas#aws-appsync-excludeverbosecontent는-fieldloglevel-none일-때-효과가-없음--진짜-원인은-요청량]].

## 6) 최종 조치 — CloudWatch Logs 로깅 완전 비활성화

로깅 레벨을 더 낮출 방법이 없으므로(`NONE`이 최저), 유일한 실제 해법은 로깅 자체를 끄는 것. `UpdateGraphqlApi` 호출 시 `logConfig` 파라미터를 아예 생략하면 로깅이 완전히 꺼짐을 트래픽 없는 `driver-tracking-alert-api-dev`로 먼저 검증(`GetGraphqlApi` 응답에서 `logConfig` 키 자체가 사라짐 확인) 후, 사용자 승인 받아 4개 API 전부 동일 적용:

- `driver-tracking-api-production` ✅
- `driver-tracking-alert-api-production` ✅
- `driver-tracking-api-dev` ✅
- `driver-tracking-alert-api-dev` ✅ (검증용으로 먼저 적용됨)

**잃는 것**: CloudWatch Logs의 `RequestSummary`(요청ID/지연시간/에러 유무) — 요청 단위 상세 추적 완전 소실.
**유지되는 것**: `AWS/AppSync` 네임스페이스의 기본 메트릭(`Latency`, `4XXError`, `5XXError`, `Requests`)은 로깅 설정과 무관하게 계속 자동 수집 — 에러율/지연 같은 큰 그림 모니터링은 안 끊김.
**남은 것**: `*-AppSyncApiApiLogsRoleB99A-*` IAM role 4개는 이제 미사용이지만 CDK 관리 리소스라 그대로 둠(삭제 안 함).

## 7) 후속

- [ ] 익일(2026-09-09) 이후 `driver-tracking-api-production` 로그 그룹에 신규 로그가 실제로 안 들어오는지 확인 (retention 지나면 로그 그룹 자체가 비워짐)
- [ ] 다음 달 Cost Explorer `APN2-DataProcessing-Bytes` 가 5GB 무료 한도 이내로 들어오는지 확인
- [ ] 4개 API 모두 로깅 꺼진 뒤에도 장애 발생 시 디버깅 정보 부족이 실제로 문제가 되는지 관찰 — 문제되면 `fieldLogLevel: ERROR` 정도로 최소 재활성화 검토
