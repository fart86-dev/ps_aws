---
type: aws-op
date: 2026-07-19
account: "306331009209"
region: us-east-1
category: [iam, cloudtrail, security, compliance]
impact: 비용 아님 — OPA 실태점검 "관리자 계정 소명"(5번) 대응, 부여·말소 정확 시각 확보
status: done
related: [[../aws-ops/2026-07-18-khj-dev-offboarding]]
---

# 2026-07-19 · IAM 부여·말소 이력 CloudTrail 원본 로그 조사

## 배경

OPA 실태점검 5번 항목 소명에 `jejen205`/`khj.dev`의 위치정보시스템(DynamoDB) 접근권한 **부여일·말소일**이 필요했음. 말소는 [[../aws-ops/2026-07-18-khj-dev-offboarding]]에서 직접 수행해서 알지만, **부여일**은 몰랐음.

## 조사 방법

1. `aws cloudtrail lookup-events`(Event history API)는 **최근 90일만 조회**, AWS 하드 리밋 — 트레일 S3 보존기간과 무관.
2. IAM은 글로벌 서비스라 `lookup-events`를 **`--region us-east-1`로 명시해야** 결과가 나옴(디폴트 리전 `ap-northeast-2`로 조회하면 0건 — 계정 리전이 서울이라도 마찬가지).
3. 90일 이전 이력은 트레일(`management-event-tracker`, 멀티리전, S3 저장, 2024-07~ 보존)의 원본 로그를 직접 다운로드해서 조사해야 함. `aws s3 sync`로 `us-east-1/2026/` 하위만 받아도 2026년 한 해 분량이 gzip 파일 약 8.5만 개(대부분 5분 주기 하트비트라 내용은 비어있음).
4. `zgrep -l "jejen205\|khj.dev"`로 후보 파일 추림 → Python으로 gzip 열어서 `eventSource == iam.amazonaws.com` && `requestParameters.userName in (대상)` 필터링.
5. **주의**: 단순 문자열 grep으로 "이 계정이 언급된 이벤트"를 찾으면 오탐 다수 — `jejen205`가 실제 개발 업무로 CloudFront/Lambda API를 부르면 `userIdentity.arn`에 이름이 찍혀서 잡힘(관련없는 `UpdateDistribution`/`CreateInvalidation` 등). **반드시 `requestParameters.userName`(작업 대상)으로 필터링**해야 함, `userIdentity`(수행자)와 혼동하지 말 것.

## 결과

| 계정 | 이벤트 | 일시(UTC) | 일시(KST) | 수행자 |
|---|---|---|---|---|
| jejen205 | AddUserToGroup(security/event/infra) | 2026-06-17T02:30:17Z | 06-17 11:30 | **root** |
| jejen205 | AttachUserPolicy(AdministratorAccess) | 2026-06-17T02:32:34Z | 06-17 11:32 | **root** |
| jejen205 | DetachUserPolicy(AdministratorAccess) | 2026-07-18T13:19:46Z | 07-18 22:19 | kimps |
| jejen205 | RemoveUserFromGroup(app_data_store) | 2026-07-18T13:23:39Z | 07-18 22:23 | kimps |
| khj.dev | RemoveUserFromGroup(dev/analytics/code/log), DetachUserPolicy(AWSCodeBuildAdminAccess) 등 1차 정리 | 2026-05-26T07:01~07:03Z | 05-26 16:01~16:03 | **root** |
| khj.dev | 나머지 그룹(infra/event/**app_data_store**/security) 제외 + 계정 완전삭제 | 2026-07-18T13:11~13:12Z | 07-18 22:11~22:12 | kimps |

**핵심 발견 1**: `jejen205`/`khj.dev` 모두 `app_data_store`(DynamoDB 접근 그룹) 자체의 **최초 편입 이벤트는 2026년 로그에 없음** → 2026년 이전부터 소속돼 있었던 것으로 판단. 정확한 최초 부여일은 트레일 보존기간(2024-07~) 안에서도 확인 안 되면 그 이전 — 역사적으로 추적 불가능한 영역.

**핵심 발견 2 (중요, 별도 트랙)**: `jejen205`의 AdministratorAccess 신규 부여(06-17)와 `khj.dev` 1차 정리(05-26) 둘 다 **루트(root) 계정으로 수행됨**. GuardDuty의 "루트 자격증명 사용" 낮음등급 경고 2건(`ConsoleLogin`, `DescribeRegions`)과 시점이 겹침 — 사실상 같은 사건. 루트 MFA는 활성화, 액세스키는 미발급(`AccountAccessKeysPresent: 0`) 상태라 키 유출류 심각 리스크는 아니지만, **일상적 IAM 변경을 루트로 수행하는 관행 자체가 AWS 베스트프랙티스 위반**. OPA 제출본에는 기재하지 않기로 결정(2026-07-19, 사용자 판단)했으나 별도로 다뤄야 함 — [[../aws-pending#루트-계정-일상-iam-작업-사용-관행-점검-필요]] 참조.

## 다음 행동

- [ ] 왜/누가 06-17, 05-26에 루트로 로그인해서 IAM을 바꿨는지 확인 (콘솔 로그인 이력, 담당자 인터뷰)
- [ ] 재발 방지: 루트 계정에 대한 별도 알림(예: 루트 로그인 시 즉시 Slack/Telegram 알림) 설정 검토
