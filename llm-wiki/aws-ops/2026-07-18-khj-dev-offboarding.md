---
type: aws-op
date: 2026-07-18
account: "306331009209"
region: ap-northeast-2
category: [iam, security, compliance]
impact: 비용 아님 — 퇴사자 계정 정리 + OPA 실태점검 "관리자 계정 소명"(5번) 대응
status: done
related: [[../aws-pending#dynamodb-위치정보-저장-암호화-opa-실태점검-대응]]
---

# 2026-07-18 · IAM 사용자 `khj.dev` 오프보딩 (퇴사자 계정 삭제)

## 배경

OPA 실태점검 5번 항목("관리자 계정 소명") 대응 중, 위치정보시스템(DynamoDB)에 접근 가능한 IAM 계정을 전수 조사한 결과 4개 확인: `kimps`, `fart86`, `jejen205`, `khj.dev`. 이 중 `khj.dev`는 사용자 확인 결과 **퇴사자**.

## 조사 (삭제 전 안전성 확인)

1. **코드 하드코딩 여부 검색** — `khj.dev`의 액세스 키 ID(`AKIAUOUWAIC44EYGVAOF`, `AKIAUOUWAIC4S7ON6AXX`)를 `~/ps`, `~/sl`, `~/iac` 전체에서 검색 → 코드에 하드코딩된 곳 없음. (참고: 이 검색 과정에서 별개로 `kimps`/`fart86`/`email` 계정의 키가 `cron_serv`/`driver-runn-cron`에 광범위하게 하드코딩된 사실을 발견 — 별도 이슈, [[../aws-pending]]에 후속 등록 필요)
2. **CloudTrail 활동 조회** — 마지막 활동 2026-06-17(`AssumeRole`) 이후 약 한 달간 활동 없음. 2026-06-14 활동은 `/crewrun/dev/auth/iot-jwt-secret`(mshuttle과 무관한 다른 프로젝트의 dev 시크릿) 생성→확인→삭제 패턴 — 퇴사 전 정리 작업으로 판단, 의심 정황 없음.
3. **결론**: 코드 의존성 없음 + 최근 활동 없음 → 삭제해도 운영 영향 없다고 판단.

## 실행

```bash
# 1) 그룹에서 제거
for g in infra event app_data_store security; do
  aws iam remove-user-from-group --user-name khj.dev --group-name "$g"
done

# 2) 액세스 키 삭제
aws iam delete-access-key --user-name khj.dev --access-key-id AKIAUOUWAIC44EYGVAOF
aws iam delete-access-key --user-name khj.dev --access-key-id AKIAUOUWAIC4S7ON6AXX

# 3) SSH 공개키 삭제 (4개, 전부 이미 Inactive 상태였음)
for sk in APKAUOUWAIC43H3AISWU APKAUOUWAIC4QZYO2AHI APKAUOUWAIC42M5DXCTA APKAUOUWAIC46PPQ5WOP; do
  aws iam delete-ssh-public-key --user-name khj.dev --ssh-public-key-id "$sk"
done

# 4) 첫 delete-user 시도 실패 (DeleteConflict: 정책 미해제) → 정책 정리
for p in cdk-deploy-policy temp_2024_12_28 AWSXrayReadOnlyAccess AmazonRoute53FullAccess AmazonEventBridgeFullAccess; do
  aws iam detach-user-policy --user-name khj.dev --policy-arn <arn>
done
for ip in s3 Scaling_Mshuttle ValidatePolicy xray-summarize-readonly; do
  aws iam delete-user-policy --user-name khj.dev --policy-name "$ip"
done

# 5) 사용자 삭제
aws iam delete-user --user-name khj.dev
```

## 결과

```bash
aws iam get-user --user-name khj.dev
# → NoSuchEntity: The user with name khj.dev cannot be found.
```

완전 삭제 확인됨.

## 특이사항

- `get-user` 응답의 User Tags에서 이미 삭제된 과거 액세스 키 ID 5개가 `khj_home`/`company`/`khj2` 같은 라벨로 태그되어 있던 흔적 발견 — 개인이 여러 기기(집/회사)에서 쓰던 키를 라벨링해 관리한 것으로 추정. 삭제 자체에는 영향 없었음.
- **놓치기 쉬운 포인트**: `delete-user`는 그룹/액세스키/SSH키/MFA/로그인프로필뿐 아니라 **직접 붙은 관리형+인라인 정책까지 전부 detach/delete해야** 성공한다. 그룹 소속 여부만 확인하고 넘어가면 이번처럼 중간에 `DeleteConflict`로 막힘.

## 다음 행동

- [x] `jejen205` — 재직 중인 직원(퇴사자 아님)으로 확인됨. 계정 삭제는 부적절하다고 정정하고, **직접 붙어있던 `AdministratorAccess`만 detach**(2026-07-18) — 업무용 그룹 권한(infra/event/app_data_store/code/security/noti/analytics/dev)은 그대로 유지.
- [x] **`app_data_store` 그룹 재구성 (2026-07-18)** — 아래 13) 참조. `jejen205`의 DynamoDB 접근도 완전 차단 완료.
- [ ] `kimps`/`fart86`/`email` 하드코딩 키 이슈는 별도 트랙 — [[../aws-pending#cron_servdriver-runn-cron-하드코딩-aws-액세스-키--소유자-특정-완료]]에 등록됨

## 13) `app_data_store` 그룹 재구성 — Textract/SecretsManager 분리 (2026-07-18)

`app_data_store`(DynamoDB Full Access 포함)에 `AmazonTextractFullAccess`, `SecretsManagerReadWrite`가 같이 묶여있어서, `jejen205`를 그룹에서 빼면 DynamoDB뿐 아니라 실제로 쓰고 있던 Textract/SecretsManager까지 같이 끊기는 문제가 있었음(`kimps`도 이 두 권한을 씀). **관심사 분리**로 해결.

**실행:**
```bash
aws iam create-group --group-name doc_secrets
aws iam attach-group-policy --group-name doc_secrets --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess
aws iam attach-group-policy --group-name doc_secrets --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
aws iam add-user-to-group --group-name doc_secrets --user-name kimps
aws iam add-user-to-group --group-name doc_secrets --user-name jejen205
aws iam detach-group-policy --group-name app_data_store --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess
aws iam detach-group-policy --group-name app_data_store --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
aws iam remove-user-from-group --user-name jejen205 --group-name app_data_store
```

**결과:**
- `app_data_store` = DynamoDB+AppSync 전용, 멤버는 `kimps`만 → **위치정보시스템 DynamoDB 접근 가능 계정이 `kimps` 하나로 좁혀짐**
- `doc_secrets`(신규) = Textract+SecretsManager 전용, 멤버 `kimps`+`jejen205` → 두 사람의 기존 업무는 유지
- `jejen205`는 DynamoDB 접근 완전 차단(AdministratorAccess 제거 + app_data_store 탈퇴), 나머지 업무 그룹(infra/event/code/security/noti/analytics/dev) 유지
