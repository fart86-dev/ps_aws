# ps-aws

AWS 계정 `306331009209` 의 **운영 작업 이력 + 재사용 절차 + 보호 자원 목록**.

`src/` 의 Fastify+cron 앱은 그 위에서 정기 점검·알림을 자동화하는 **보조 도구**일 뿐, 주된 자산이 아니다.

상세 위키: `llm-wiki/`

## 작업 시작 방법

대부분의 작업은 **AWS 자료**에서 시작한다.

1. `llm-wiki/index.md` 로 전체 맵 보기
2. AWS 작업 (대부분의 경우):
   - 진행 중·후속 TODO → `llm-wiki/aws-pending.md`
   - 절대 건드리지 마라 → `llm-wiki/aws-inventory/protected-resources.md`
   - 과거 작업 이력 → `llm-wiki/aws-ops/<날짜>-<주제>.md`
   - 재사용 절차 → `llm-wiki/aws-runbooks/<주제>.md`
   - 현재 상태 스냅샷 → `llm-wiki/aws-inventory/<주제>.md`
3. `src/` 코드 수정 시에만:
   - 수정 전 반드시 `llm-wiki/gotchas.md` + `llm-wiki/decisions.md` 확인
   - 빌드·실행은 `llm-wiki/runbook.md`, 관례는 `llm-wiki/conventions.md`
   - 영역별 상세는 `llm-wiki/domains/<영역>.md`

## AWS 작업 시 절대 규칙

- **AWS Security Hub / AWS Config / WAF Web ACL 비활성화 금지** (2024-12-28 계정 마비 후 AWS 요구). 자세한 보호 자원 8종은 `llm-wiki/aws-inventory/protected-resources.md`.
- 운영 자원 (`production-mshuttle`, `admin-fe-response-*`, `msdeveloper/db/` 등) 손대기 전 사용자 명시 확인 필수.
- destructive AWS 명령은 항상 dry-run → `--confirm` 게이트 (스크립트 추가 시도 같은 패턴).
