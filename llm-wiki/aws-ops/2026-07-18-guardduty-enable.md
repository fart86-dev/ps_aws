---
type: aws-op
date: 2026-07-18
account: "306331009209"
region: ap-northeast-2
category: [guardduty, compliance]
impact: 비용 아님 — OPA 위치정보법 실태점검 2차 제출 대응 ("보안프로그램 운영" 증빙)
status: done
related: [[../aws-inventory/protected-resources#9-guardduty-ap-northeast-2]]
---

# 2026-07-18 · GuardDuty 활성화 (OPA 실태점검 대응)

## 배경

OPA 2026년도 실태점검 1차에서 "보안프로그램 운영" 미흡 판정. 점검자 코멘트: "AWS를 사용하는 경우 백신 설치가 불가능한 클라우드를 운영 중이라면, AWS GuardDuty 등 클라우드 보안 서비스를 활용한 화면을 제출해 주시기 바랍니다."

위치정보시스템(`iac_ddb_runn` — DynamoDB+AppSync)이 서버리스 구조라 전통적 서버 백신 설치가 불가능 → GuardDuty가 유일한 현실적 대응으로 판단.

## 사전 확인

```bash
aws guardduty list-detectors --region ap-northeast-2
# → {"DetectorIds": []}  (미활성 확인)
```

## 실행

```bash
aws guardduty create-detector --enable --region ap-northeast-2
# → Detector ID: 3ccfba97db6cdc94aabb011552564dc6
```

## 결과

```json
{
  "Status": "ENABLED",
  "FindingPublishingFrequency": "SIX_HOURS",
  "DataSources": {
    "CloudTrail": "ENABLED",
    "DNSLogs": "ENABLED",
    "FlowLogs": "ENABLED",
    "S3Logs": "ENABLED",
    "Kubernetes.AuditLogs": "ENABLED"
  }
}
```

기본 활성 기능: CloudTrail 분석, DNS 로그, VPC Flow 로그, S3 데이터 이벤트, EKS Audit 로그, Lambda 네트워크 로그, RDS 로그인 이벤트, EBS 멀웨어 보호. AI_PROTECTION/EKS·컨테이너 Runtime Monitoring은 기본 비활성(프리미엄 기능, 미사용 중인 EKS/컨테이너 워크로드 없어 불필요).

## 영향

- 순수 관찰형 서비스라 기존 AppSync/DynamoDB/Lambda 서비스에 코드 변경·다운타임 없음
- 30일 무료 평가 기간 이후 분석 볼륨(GB) 기준 과금 시작 — 실제 비용은 30일 뒤 Cost Explorer로 확인 필요
- [[../aws-inventory/protected-resources#9-guardduty-ap-northeast-2]]에 보호 자원으로 등록 — 향후 비용 절감 sweep에서 자동 종료 후보로 잡히지 않도록 함

## 다음 행동

- [ ] 콘솔에서 Detector 상태 화면 캡쳐 → OPA 2차 제출 문서 9번 항목에 첨부
- [ ] 30일 후 실제 과금액 확인
- [ ] 다른 리전(ap-northeast-2 외)에도 위치정보 관련 리소스가 있다면 GuardDuty 확장 필요 여부 검토(현재는 위치정보시스템이 ap-northeast-2 단일 리전이라 불필요로 판단)
