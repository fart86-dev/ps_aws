---
type: aws-runbook
category: cloudfront
applies_to: [dev-admin-* distributions, 향후 staging/production admin]
last_verified: 2026-06-16
status: ready
---

# CloudFront Distribution 에 Function 일괄 연결

특정 prefix 의 CloudFront Distribution 들에 viewer-request / viewer-response 단계 CloudFront Function 을 일괄로 추가하는 절차.

기존에 다른 Function 이 이미 붙어 있으면 **반드시 보존** (대표적으로 `admin-fe-response-*` 은 절대 변경 금지).

대표 작업 이력: [[../aws-ops/2026-06-16-cloudfront-admin-function-attach]] (dev-admin-* 11개에 `admin-fe-request-dev` 연결).

---

## 전제

- CloudFront 는 글로벌 서비스 — 모든 명령은 `us-east-1` 기준 (CLI 는 --region 안 적어도 동작하지만 명시 권장).
- Function 은 미리 LIVE 단계로 publish 되어 있어야 함. ARN 형식: `arn:aws:cloudfront::306331009209:function/<name>`.
- 운영 distribution 에 적용할 때는 **백업 → 1개로 테스트 → 일괄 적용** 순.

## 1) 사전 조회

### 등록된 Function 목록
```bash
aws cloudfront list-functions \
  --query "FunctionList.Items[?contains(Name, 'admin-fe')].{Name:Name,Stage:FunctionMetadata.Stage,LastModified:FunctionMetadata.LastModifiedTime}" \
  --output table
```

### 대상 Distribution ID 수집
```bash
# Comment prefix 로 필터링
DIST_IDS=($(aws cloudfront list-distributions \
  --query "DistributionList.Items[?starts_with(Comment, 'dev-admin')].Id" \
  --output text))
```

### 현재 Function 연결 상태 표
```bash
for ID in "${DIST_IDS[@]}"; do
  COMMENT=$(aws cloudfront get-distribution --id $ID \
    --query "Distribution.DistributionConfig.Comment" --output text)
  ASSOCS=$(aws cloudfront get-distribution --id $ID \
    --query "Distribution.DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items[].FunctionARN" \
    --output text 2>/dev/null)
  REQ="-"; RES="-"
  echo "$ASSOCS" | grep -q "admin-fe-request-dev" && REQ="OK"
  echo "$ASSOCS" | grep -q "admin-fe-response-dev" && RES="OK"
  printf "%-18s %-25s %-4s %-4s\n" "$ID" "$COMMENT" "$REQ" "$RES"
done
```

## 2) 백업

job tmp 디렉토리 (`$CLAUDE_JOB_DIR/tmp/cf-backup/` 등 휘발성 위치) 에 distribution 단위로 전체 config + ETag 보존:

```bash
mkdir -p cf-backup
for ID in "${DIST_IDS[@]}"; do
  aws cloudfront get-distribution-config --id $ID > cf-backup/${ID}.json
done
```

`cf-backup/${ID}.json` 구조:
```json
{
  "DistributionConfig": { ... },
  "ETag": "E1A2B3C4..."
}
```

## 3) Function 추가 (단일 distribution)

```bash
ID=E33WR5QDEHNJRP
FUNC_ARN=arn:aws:cloudfront::306331009209:function/admin-fe-request-dev
EVENT_TYPE=viewer-request   # or viewer-response

# 현재 config + ETag
aws cloudfront get-distribution-config --id $ID > /tmp/cf-${ID}.json
ETAG=$(jq -r '.ETag' /tmp/cf-${ID}.json)

# FunctionAssociations 에 추가 (기존 항목 보존)
jq --arg arn "$FUNC_ARN" --arg ev "$EVENT_TYPE" '
  .DistributionConfig.DefaultCacheBehavior.FunctionAssociations = (
    .DistributionConfig.DefaultCacheBehavior.FunctionAssociations // {Quantity:0, Items:[]}
  )
  | .DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items += [{EventType: $ev, FunctionARN: $arn}]
  | .DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Quantity =
      (.DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items | length)
  | .DistributionConfig
' /tmp/cf-${ID}.json > /tmp/cf-${ID}-new.json

# 업데이트
aws cloudfront update-distribution \
  --id $ID --if-match $ETAG \
  --distribution-config file:///tmp/cf-${ID}-new.json
```

응답이 `Status: InProgress` 면 정상 (배포 전파 대기, 3~10분).

## 4) 일괄 적용 (위 단계를 루프로)

```bash
FUNC_ARN=arn:aws:cloudfront::306331009209:function/admin-fe-request-dev
EVENT_TYPE=viewer-request

for ID in "${DIST_IDS[@]}"; do
  echo "=== $ID ==="
  ETAG=$(jq -r '.ETag' cf-backup/${ID}.json)

  jq --arg arn "$FUNC_ARN" --arg ev "$EVENT_TYPE" '
    .DistributionConfig.DefaultCacheBehavior.FunctionAssociations = (
      .DistributionConfig.DefaultCacheBehavior.FunctionAssociations // {Quantity:0, Items:[]}
    )
    | .DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items += [{EventType: $ev, FunctionARN: $arn}]
    | .DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Quantity =
        (.DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items | length)
    | .DistributionConfig
  ' cf-backup/${ID}.json > /tmp/cf-${ID}-new.json

  aws cloudfront update-distribution \
    --id $ID --if-match $ETAG \
    --distribution-config file:///tmp/cf-${ID}-new.json \
    --query 'Distribution.Status' --output text
done
```

> **이미 같은 ARN 이 같은 EventType 으로 붙어 있으면 중복 추가됨** — 위 jq 는 dedup 안 함. 사전 점검 표에서 이미 연결된 것은 루프에서 제외할 것.

## 5) 롤백

```bash
CURR_ETAG=$(aws cloudfront get-distribution-config --id $ID --query ETag --output text)
jq '.DistributionConfig' cf-backup/${ID}.json > /tmp/rollback-${ID}.json
aws cloudfront update-distribution \
  --id $ID --if-match $CURR_ETAG \
  --distribution-config file:///tmp/rollback-${ID}.json
```

## 6) 절대 금지 / 보존

- **`admin-fe-response-production` association 보존**: 운영 admin FE 응답 가공. 절대 끊지 말 것. [[../aws-inventory/protected-resources]]
- 마찬가지로 staging/production 의 `admin-fe-request-*`, `admin-fe-response-*` 모두 변경 시 사용자 확인 필수.
- 본 runbook 의 jq pipeline 은 **append 만** 한다. 기존 association 을 덮어쓰지 않음.

## 7) 운영 영향 메모

- CloudFront 변경은 모든 edge 에 전파되기까지 3~10분 (지역에 따라 더 걸리기도 함).
- viewer-request Function 추가는 **모든 요청마다 실행**됨. Function 의 throughput / latency 영향 미리 검토. 일반적으로 ms 미만이지만 무한 루프 / regex 폭주 등으로 측정 가능한 영향이 생길 수 있음.
- 비용은 Function 실행 횟수 × 단가 — distribution 트래픽에 비례.

## 8) 현황 갱신

작업 후 [[../aws-inventory/cloudfront-dev-admin]] 의 표를 위 1) 의 조회 명령으로 다시 떠서 갱신.
