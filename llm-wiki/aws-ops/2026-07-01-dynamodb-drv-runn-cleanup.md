---
type: aws-op
date: 2026-07-01
account: "306331009209"
region: ap-northeast-2
category: [dynamodb, cleanup, provisioned]
impact: -$25/월
status: done
---

# 2026-07-01 · DynamoDB `drv_runn_*_production` 5개 삭제 (이전 세대 잔재)

DynamoDB 18개 테이블 전수 조사 → 전부 PROVISIONED 모드 확인. 그 중 2024-10 생성된 `drv_runn_*_production` 5개가 새 세대 `production_dr_runn_*` (2025-12 생성) 로 완전히 대체됐고 무활동. Phase 1 정리 실행.

---

## 1) 배경

- 계정 DynamoDB 총 18개 테이블, 전부 PROVISIONED (BillingModeSummary None = 프로비저닝 기본 모드)
- 총 프로비저닝 비용 추정 ~$93/월
- 그 중 `drv_runn_*_production` 계열 5개가 이전 세대. Key schema 를 후속 `production_dr_runn_*` 와 비교하니 동일 (date + status_id 등)
- 최근 7일 read/write 0. drv_runn_status_production 데이터 마지막 시점은 2025-09-29 (약 9개월 무활동)
- ps_aws 리포 코드에는 참조 없음. 소유는 driver 앱 계열 별도 리포

## 2) 대상

| 테이블 | Items | RCU/WCU | 월 비용 | PITR | Deletion Protection |
|---|---|---|---|---|---|
| drv_runn_production | 0 | 10/20 | $11.40 | ENABLED | ON |
| drv_runn_hist_production | 0 | 3/15 | $8.10 | ENABLED | ON |
| drv_runn_status_production | 1585 | 3/3 | $1.86 | DISABLED | OFF |
| drv_runn_status_hst_production | 0 | 3/3 | $1.86 | DISABLED | OFF |
| drv_st_log_production | 0 | 1/3 | $1.66 | ON | ON |
| **합계** | | | **$24.88** | | |

## 3) 실행

### 3-1) 백업 (데이터 있는 1개)

drv_runn_status_production 은 1585 items 있고 PITR 미활성 → scan JSON 백업 필수.

```bash
aws dynamodb scan --table-name drv_runn_status_production --output json \
  > ~/aws-backups/2026-07-01-drv_runn_status_production.json
# 1.4 MB, 1585 items 확인
```

**백업 위치:** `~/aws-backups/2026-07-01-drv_runn_status_production.json`
**복원 방법:** batch-write-item 으로 재적재 가능 (필요 시).

### 3-2) 삭제

```bash
# 3개는 Deletion Protection ON → 해제 후 삭제
for t in drv_runn_production drv_runn_hist_production drv_st_log_production; do
  aws dynamodb update-table --table-name $t --no-deletion-protection-enabled
  aws dynamodb delete-table --table-name $t
done

# 2개는 바로 삭제 가능
aws dynamodb delete-table --table-name drv_runn_status_production
aws dynamodb delete-table --table-name drv_runn_status_hst_production
```

## 4) 결과

- 5/5 테이블 DELETING → 삭제 완료 확인 (`aws dynamodb list-tables` grep drv_ 결과 0)
- **월 절감: -$25/월** (확정, 다음 청구서 반영)
- 백업 (drv_runn_status_production) 은 로컬 보관. 세션 tmp 는 휘발성이라 `~/aws-backups/` 로 이관

## 5) 회수/롤백

- **불가**: 삭제된 empty 4개는 데이터 자체가 없어서 회수 개념 없음
- drv_runn_status_production 만 백업 JSON 으로 복원 가능. 절차:
  ```bash
  # 원본과 동일한 key schema 로 테이블 재생성 후
  # jq 로 25개씩 chunking 하여 batch-write-item 반복
  ```

## 6) 후속

- Phase 2: `production_dr_runn_analysis_alert*` 3개 (비활성) — 담당자 확인 후 → **-$5.6/월**
- Phase 3: `dev_dr_runn_*` 6개 (dev 환경 자체 미사용) — dev 존치 결정 후 → **-$21/월**
- Phase 4: 활성 4개 On-demand 전환 검토 (별개 이슈) — 추정 **-$20~30/월**
- Phase 1+2+3 완료 시 총 -$52/월 (DynamoDB $93 → $41)

관련: [[../aws-pending]] 에 Phase 2/3 항목 등록.

## 7) 참고

- Deletion Protection 이 걸려있어도 20개월 무활동 empty 는 형식적. update-table 로 즉시 해제 가능
- PITR 은 삭제와 함께 소멸. 필요하면 삭제 전 export-to-s3 로 스냅샷 확보 (이번 경우 PITR 있던 것들이 empty 라 스킵)
- 삭제 후 소유 리포/앱에서 참조 코드 있으면 즉시 에러 → 사전 검색으로 ps_aws 는 clean 확인. driver 앱 리포 쪽은 미확인 (drv_ 사용 코드는 대체된 production_dr_ 로 이미 전환됐을 것으로 판단, 무활동 9개월+ 이 근거)
