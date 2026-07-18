---
type: aws-op
date: 2026-07-18
account: "306331009209"
region: ap-northeast-2
category: [dynamodb, kms, flink, streams, compliance]
impact: 비용 아님 — [[2026-07-17-dynamodb-location-encryption-audit]] 후속, 암호화 변경 시 영향 범위 확정
status: investigation-done-decision-pending
related: [[2026-07-17-dynamodb-location-encryption-audit]]
---

# 2026-07-18 · DynamoDB Streams 실제 소비자 확인 (암호화 변경 영향 범위 확장)

[[2026-07-17-dynamodb-location-encryption-audit]]에서 "PITR 기반 Export / Streams 소비자 미검증"으로 남겨둔 부분을 추적. AppSync·driver-runn-cron 외에 **DynamoDB Streams를 직접 구독하는 소비자**가 하나 더 확인됨.

---

## 1) 발견: `iac_shuttle_analytics` (PyFlink, Managed Flink)

`production_dr_runn`/`production_dr_runn_hist`의 Streams를 `FlinkDynamoDBStreamsConsumer`로 **직접 구독**(AppSync 미경유). 급정거/과속/경로이탈/정류장건너뜀/장기정차 5종 실시간 감지 파이프라인.

```bash
aws kinesisanalyticsv2 describe-application --application-name production-shuttle-analytics \
  --region ap-northeast-2 \
  --query "ApplicationDetail.ApplicationConfigurationDescription.EnvironmentPropertyDescriptions.PropertyGroupDescriptions"
```

결과 (PropertyGroupId: `DynamoDBStreamsSource`):
```
drv.runn.stream.arn      = arn:aws:dynamodb:ap-northeast-2:306331009209:table/production_dr_runn/stream/2025-12-26T07:05:17.562
drv.runn.hist.stream.arn = arn:aws:dynamodb:ap-northeast-2:306331009209:table/production_dr_runn_hist/stream/2025-12-26T07:05:17.646
```

## 2) 조사 중 나왔다가 기각된 가설: "구세대 테이블명 참조 오류"

`iac_shuttle_analytics/infra/docs/251205_STREAM_ARN.md` 등 리포 내 문서가 예시로 `drv_runn_dev`/`drv_runn_hist_dev` (구세대 네이밍, `drv_` prefix)를 쓰고 있어서, 혹시 실제 배포도 [[2026-07-01-dynamodb-drv-runn-cleanup]]에서 삭제된 구세대 테이블(`drv_runn_*_production`)의 스트림을 계속 참조하다 깨진 게 아닌지 의심했음.

**라이브로 확인한 결과 기각.** 실제 배포된 PropertyGroup은 현재 세대 테이블명(`production_dr_runn`)을 정확히 가리키고 있고, 타임스탬프(2025-12-26)도 현재 테이블 생성 시점과 부합. 문서상 예시 네이밍이 오래된 것일 뿐 실배포는 정상. **다음에 이 라인을 다시 조사할 필요 없음.**

## 3) Flink 앱 가동 상태

```bash
aws kinesisanalyticsv2 list-applications --region ap-northeast-2
```

| 앱 | 상태 | 마지막 업데이트 |
|---|---|---|
| dev-shuttle-analytics | READY (정지) | 2026-05-12 |
| production-shuttle-analytics | READY (정지) | 2026-05-18 |

**사용자 확인(2026-07-18): 이 정지 상태는 의도된 것.** 프로젝트 자체가 아직 개발 중 단계(DynamoDB Sink 미구현, 현재 AppSync 알림 전송만 연결되고 상태 갱신은 로그 출력만)라 프로덕션 상시 가동 전 상태로 판단됨.

## 4) 암호화 변경([[2026-07-17-dynamodb-location-encryption-audit]] 옵션 A)과의 관계

- 지금 당장은 앱이 정지 상태라 SSE 변경의 즉시 영향은 없음.
- **다만 이 파이프라인이 재가동되는 시점에는** Streams 레코드가 테이블과 동일한 키로 암호화되므로, `FlinkRole`(IAM, `infra/template.yaml`에 정의)에 `kms:Decrypt` 권한이 있는지 확인 필요 — **미검증**.
- 결론: 옵션 A(SSE→AWS 관리형 KMS 전환)를 실행하더라도 Flink 앱이 정지 상태인 동안은 안전. 단 **Flink 앱을 재가동하기 전에는 `FlinkRole`의 KMS 권한을 반드시 재점검**해야 함 — 그 전까지 재가동하면 Streams 읽기가 조용히 실패할 수 있음.

## 5) 갱신된 전체 소비자 목록

[[2026-07-17-dynamodb-location-encryption-audit]]의 3개 소비자에 1개 추가, 총 4개:

| 소비자 | 방식 | 인증/권한 | 암호화 변경 영향 |
|---|---|---|---|
| AppSync (iac_ddb_runn) | 직접 DynamoDB R/W (JS 리졸버) | `custom-appsync-role-{stage}` | AWS 관리형 키면 투명(문서상) |
| driver-runn-cron Lambda | PITR 기반 Export to S3 (야간) | ⚠️ 하드코딩 Access Key | 미검증, CMK면 위험 큼 |
| infra ddb_status Lambda | WCU 조정 | - | 무관 |
| **iac_shuttle_analytics (Flink)** | **DynamoDB Streams 직접 구독** | `FlinkRole` | 재가동 전 KMS 권한 확인 필요 |

## 6) 다음 행동

- [ ] Flink 앱 재가동 계획이 생기면, 그 전에 `FlinkRole`의 KMS 권한 점검을 선행 조건으로 걸어둘 것
- 나머지 다음 행동은 [[2026-07-17-dynamodb-location-encryption-audit#5-다음-행동]]과 동일
