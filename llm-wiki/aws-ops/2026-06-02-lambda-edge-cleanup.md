---
type: aws-op
date: 2026-06-02
account: "306331009209"
region: us-east-1
category: [lambda, lambda-edge, iam, cloudwatch-logs]
impact: 미미 (호출 0건, 정리 가치 중심)
status: done
---

# 2026-06-02 · us-east-1 Lambda@Edge 잔재 7개 정리

us-east-1 (북부 버지니아) 에 남아 있던 deprecated Lambda 함수 7개 sweep. 모두 과거 Next.js 배포의 Lambda@Edge 잔재 + Apex 테스트 함수 1개.

---

## 1) 배경

CloudFront Lambda@Edge 함수는 반드시 **us-east-1** 에 생성됨. 다른 리전에 자동 replica 가 깔리지만 origin 함수의 진실 위치는 us-east-1.

ap-northeast-2 sweep 중 us-east-1 도 마저 확인 → 7개 발견. 모두 nodejs6.10/14.x/16.x runtime → 이미 deprecated.

| 함수 | Runtime | 최종 수정 | 용도 |
|---|---|---|---|
| `cgws53q-mlglxu9` | nodejs14.x | 2022-08-23 | Image Lambda@Edge (Next.js) |
| `cgws53q-bzysx3o` | nodejs16.x | 2022-08-23 | Default Lambda@Edge (Next.js) |
| `cgws53q-3kxqwa` | nodejs16.x | 2022-08-23 | API Lambda@Edge (Next.js) |
| `7zurgve-t0widd` | nodejs14.x | 2022-08-24 | Image Lambda@Edge (Next.js) |
| `msrpay` | nodejs16.x | 2022-08-24 | Default Lambda@Edge (Next.js) |
| `f4y8xal-k7b7g8` | nodejs14.x | 2022-08-24 | Image Lambda@Edge (Next.js) |
| `test_hello` | **nodejs6.10** | **2018-07-08** | Apex 테스트 함수 |

## 2) 점검 (삭제 안전성 검증)

Lambda@Edge 는 함수를 어디서 호출 중인지 직접 알기 어려워서 다중 검증.

| 검증 항목 | 결과 |
|---|---|
| CloudFront distribution 연결 (101개 전수 검색) | 어디에도 없음 |
| 다른 리전 Lambda@Edge replica (15개 리전 sweep) | 없음 (이미 정리됨) |
| Resource policy (외부 호출 권한) | 7개 모두 없음 |
| Event source mappings (SQS/DDB/Kinesis 등) | 7개 모두 0 |
| Function URL | 7개 모두 None |
| 30일 호출 (us-east-1 / ap-northeast-2 / us-west-2 / eu-west-1) | 7개 모두 0건 |
| IAM Role LastUsed | 7개 모두 `None` (기록 없음) |
| InstanceProfile 부착 | 7개 모두 없음 |

### S3 의존성 확인

| 위치 | 버킷 | 상태 |
|---|---|---|
| Lambda 코드 저장소 | `prod-04-2014-tasks` (AWS 시스템) | AWS 관리, 무관 |
| IAM 권한 참조 (3개 함수) | `nextjs-msrpay` | **이미 삭제됨** (dead reference) |
| IAM 권한 참조 (3개 함수) | `slsv` (ap-northeast-2) | 존재, 6.3GB / 2,424 객체 |

### slsv 버킷 내 ussr 프로젝트 분석

| 항목 | 결과 |
|---|---|
| `ussr` Lambda 함수 (모든 리전) | 없음 |
| 활성 CloudFormation 스택 | 없음 |
| 최근 Serverless 배포 | **2024-02-20** (1년 4개월 전) |
| 결론 | **폐기된 프로젝트** |

slsv 버킷에는 `my-app/` (118KB, 2025-09-25) CDK asset 도 별도 active → 버킷 자체는 유지.

## 3) 실행 명령

> TODO(질문): 아래 일괄 sweep 에 실제로 쓴 명령 (특히 7개 함수를 어떻게 묶어 호출했는지) 보존 안 됨. #todo

표준 호출 형태:

```bash
REGION=us-east-1
FN=cgws53q-mlglxu9

# Lambda 함수 삭제 (모든 버전 + alias 같이 사라짐)
aws lambda delete-function --region $REGION --function-name $FN

# 함수에 묶인 IAM Role 확인
aws iam get-role --role-name <함수-execution-role>
aws iam list-attached-role-policies --role-name <함수-execution-role>
aws iam list-role-policies --role-name <함수-execution-role>

# Inline policy 삭제
aws iam delete-role-policy --role-name <role> --policy-name <inline-policy>

# Managed policy detach (있으면)
aws iam detach-role-policy --role-name <role> --policy-arn <arn>

# Role 삭제
aws iam delete-role --role-name <role>

# Managed policy 자체 삭제 (test_lambda_logs)
aws iam delete-policy --policy-arn arn:aws:iam::306331009209:policy/test_lambda_logs

# CloudWatch Log Group 삭제
aws logs delete-log-group --region $REGION \
  --log-group-name "/aws/lambda/test_hello"
```

## 4) 결과

| 리소스 | 개수 | 결과 |
|---|---|---|
| Lambda 함수 | 7개 | ✅ 전부 삭제 |
| IAM Role | 7개 | ✅ 전부 삭제 |
| Inline IAM Policy | 6개 (`*-policy`) | ✅ 전부 삭제 |
| Managed IAM Policy (`test_lambda_logs`) | 1개 | ✅ 삭제 |
| CloudWatch Log Group (`/aws/lambda/test_hello`) | 1개 | ✅ 삭제 |

## 5) 영향

- 직접 절감: 미미 (호출 0건 → 과금 거의 없음)
- 의미: deprecated runtime (nodejs6.10/14.x/16.x EOL) 잔재 제거, IAM 잡동사니 정리

## 6) 후속

- **slsv 버킷의 `serverless/ussr/` prefix (6.3GB)**: ussr 프로젝트 폐기 확인됨. 정리 시 ~-$0.15/월. 버킷 자체는 my-app CDK 용으로 유지 필요. → [[../aws-pending#slsv-serverless-ussr-prefix-정리]]
