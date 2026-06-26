---
type: aws-op
date: 2026-06-04
account: "306331009209"
region: ap-northeast-2
category: [cloudwatch-logs, api-gateway]
impact: -$0.008/월 (미미, 정리 가치 중심)
status: done
---

# 2026-06-04 · CloudWatch API Gateway execution log 정리 (2개 로그 그룹)

S3 비용 정리 후 CloudWatch Logs 도 점검. 사용자 지적 — "production 은 수집 안 하고 dev 만 수집하는 경우가 어딨나" — 에 따라 dev/production 양쪽 환경 코드 비교 후 dev 측 잔재 2개 정리.

---

## 1) 배경 & 1차 매칭

| 로그 그룹 | API Gateway | 상태 | 크기 | retention | 마지막 활동 |
|---|---|---|---|---|---|
| `API-Gateway-Execution-Logs_nswetbzg0b/dev` | **없음 (삭제된 API)** | 고아 | 164 MiB | 없음 | 2023-12-29 (2.4년 전) |
| `API-Gateway-Execution-Logs_hrg3jdkzz4/dev` | `driver-app-restapi-dev` (CFN 스택) | 운영 중 | 117 MiB | 없음 | 2025-11-04 (7개월 전) |

- `nswetbzg0b`: REST API/HTTP API 양쪽 모두 등록 없음 → 원본 API Gateway 가 삭제된 상태
- `hrg3jdkzz4`: driver 앱 dev 환경 API 는 존재하나 7개월간 로그 없음

## 2) 점검 (dev vs production 코드 비교)

`~/sl/ms_drapp_serv` 의 `template.yaml` / `template.apigw.yaml` 분석:
- 같은 SAM 템플릿으로 `STAGE` 파라미터만 다르게 dev/staging/production 배포
- `MethodSettings.LoggingLevel: "OFF"` 명시 (모든 stage 공통)
- `ExpressLambdaFunctionLogGroup` 에 `RetentionInDays: 30` 명시
- **즉 template 차이는 없음 — 코드는 의도된 대로 작성됨**

실제 로그 그룹 현황:

| 채널 | dev | production | 분석 |
|---|---|---|---|
| Lambda 로그 (`/aws/lambda/...`) | 4.3 MB, 30일 retention, 어제 활동 | **223 MB, 30일 retention, 실시간 활동** | ✅ 정상 (production 트래픽 ≫ dev) |
| API GW execution log | 117 MiB, retention 없음, 7개월 전 | **0 바이트, retention 없음** | ⚠️ dev 만 비정상 |
| stage `loggingLevel` (현재) | OFF | OFF | 동일 (template 대로) |
| stage `accessLogSettings` | null | null | 동일 |

### 결론
- 실제 관찰 채널은 **Lambda 로그 그룹** — production 은 정상적으로 53배 더 많이 누적 중
- API Gateway execution log 는 Lambda 로그와 중복이라 둘 다 OFF 가 의도된 정상 상태
- dev 의 117 MiB 는 **과거(2024-08-27 ~ 2025-11-04 사이) 누군가 콘솔에서 dev stage logging 을 ON 으로 켜둔 채 방치한 결과**. 이후 OFF 로 되돌렸지만 retention 미설정이라 누적분이 영구 보관
- production 은 처음부터 한 번도 안 켜서 0 바이트

## 3) 의사결정

- `nswetbzg0b/dev` 삭제: 원본 API 없음, 2.4년 미사용
- `hrg3jdkzz4/dev` 삭제: 운영에 영향 없음 (Lambda 로그가 모니터링 담당), 새 로그 없음
- production execution log 그룹 (`dasrc5ygge/production`, 0 바이트): 그대로 둬도 비용 없음
- template 수정 없음: 코드는 정상이고 문제는 운영 중 콘솔 조작에서 발생

## 4) 실행

```bash
aws logs delete-log-group --log-group-name "API-Gateway-Execution-Logs_nswetbzg0b/dev"
aws logs delete-log-group --log-group-name "API-Gateway-Execution-Logs_hrg3jdkzz4/dev"
```

## 5) 결과

- 데이터 삭제: 164 MiB + 117 MiB = **281 MiB**
- 비용 절감: ~$0.008/월 (CloudWatch Logs storage $0.03/GB-mo 기준, 미미)
- 가치: 고아/잔재 리소스 제거, dev API logging 누적 방지

## 6) 재발 방지 메모

- 콘솔에서 dev stage logging 을 임시로 켰다면 작업 후 **반드시 OFF 로 되돌릴 것**
- 또는 template 에 API GW execution log group 을 명시적으로 정의하고 retention 부여 (예: 7일) — 단, 자동 생성 그룹과 import 충돌 가능성 있어 작업 시 주의

## 7) 후속

- **다른 고아 로그 그룹 일괄 점검**: `API-Gateway-Execution-Logs_*` 외에 `/aws/codebuild/*`, `/aws/apigateway/*` 등에도 원본 없는 그룹 존재 가능. 별도 sweep 작업 필요. → [[../aws-pending#cloudwatch-고아-log-group-sweep]]
- **retention 정책 일괄 적용**: 현재 거의 모든 로그 그룹이 retention 미설정 (무기한 누적). dev 환경은 7~30일, production 은 90일 등 정책 결정 후 일괄 적용 검토. → [[../aws-pending#cloudwatch-logs-retention-정책]]
