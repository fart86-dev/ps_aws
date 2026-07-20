---
type: aws-op
date: 2026-07-19
account: "306331009209"
region: ap-northeast-2
category: [dynamodb, appsync, security, compliance]
impact: 비용 아님 — OPA 실태점검 "접근사실 자동기록"(8번) 대응 범위 재확정
status: done
related: [[../aws-ops/2026-07-17-dynamodb-location-encryption-audit]]
---

# 2026-07-19 · 위치정보 데이터 쓰기(수정) 경로 전수 조사

## 배경

OPA 실태점검 8번 항목("접근사실 자동기록 — 조회/입력/수정 등 행위이력") 소명을 준비하다가 나온 질문: "위치정보는 사실상 조회만 되는 거 아닌가? 실제로 조작(수정)하는 경로가 있나?" 실제로 답을 확인하지 않고 "3개 경로 모두 CRUD 로깅 필요"로 전제하고 있었어서, 코드베이스 전수 조사로 검증.

## 조사 대상

- `~/psapp/admin/be/admin-runn-restapi`
- `~/psapp/admin/be/admin-rt-restapi`
- `~/psapp/admin/fe/admin_drvcontr`
- `~/iac/iac_ddb_runn` (AppSync 스키마·리졸버)

## 결과

**`production_dr_runn_hist`(GPS 원본 이력)**: 완전 append-only. `iac_ddb_runn`의 `runnHist/insert.ts` 리졸버가 `PutItem` + 조건 `attributeExists:false`(신규 키만 허용)로 구현되어 있어 **기존 레코드 수정·삭제가 시스템 설계상 불가능**. `updateRunnHist`/`deleteRunnHist` 자체가 GraphQL 스키마에 정의돼 있지 않음.

**3개 admin 경로 전부 읽기 전용**:
- `admin-runn-restapi`, `admin-rt-restapi`: 컨트롤러가 Athena `SELECT`/MySQL 조회만 수행. DynamoDB SDK import 자체가 없음.
- `admin_drvcontr`: `RunnHistRepository.ts`는 GraphQL Query/Subscription만 사용.

**유일한 쓰기 동작**: `admin_drvcontr`의 "강제종료" 버튼 → `RunnRepo.ts`의 `updateRunn` mutation 호출 → `production_dr_runn`의 `endedAt`/`endedBy`만 변경. 위경도는 건드리지 않음.

**⚠️ 발견 — 잠재적 미사용 쓰기 경로**: `iac_ddb_runn/src/graphql/schema.graphql`의 `updateRunn` mutation 입력 타입(`RunnUpdateInput`)에 `latitude`/`longitude`/`accuracy` 필드가 포함되어 있음. 리졸버(`resolvers/runn/update.ts`)도 조건이 `ended_at:{eq:""}`(진행중 건만)일 뿐 위경도 갱신 자체는 막지 않음 — **API 레벨에서는 위치정보 수정이 기술적으로 가능**하나, 현재 어떤 프론트/백엔드 코드도 이 필드를 채워서 호출하지 않음(미사용). 인증은 API 전체 단일 `API_KEY`(`appsync-api.ts` 66-73행)라 필드별 권한 분리도 없음.

## 의미

OPA 8번 항목의 실질 대응 범위가 애초 가정("3개 경로 각각 다른 CRUD 로깅 체계 필요")보다 훨씬 좁음 — **조회(접근) 로그 + 강제종료 1건의 수정 로그**만 있으면 실사용 행위는 대부분 커버됨. AppSync 경로의 담당자별 인증 전환(공유 API_KEY 문제)은 여전히 핵심 과제로 남음.

## 다음 행동

- [ ] `RunnUpdateInput`에서 미사용 `latitude`/`longitude`/`accuracy` 필드 제거 검토(원천 차단, 낮은 비용) — [[../aws-pending#appsync-runnupdateinput의-미사용-위경도-필드-제거-검토]]
- [ ] AppSync 담당자별 인증 전환은 OPA 8번 항목 본 작업과 함께 진행
