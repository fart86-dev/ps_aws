---
type: repo-wiki
repo: ps-aws
domains: []
stack: [aws-cli, fastify, aws-sdk-v3]
status: active
updated: 2026-06-26
---

# decisions — 왜 이렇게 짰나

코드만 읽어서는 안 보이는 판단·역사·제약.

---

## 위키의 1차 자산은 AWS 작업 이력 (2026-06-26 재정의)

**결정:** `llm-wiki/aws-ops/` `aws-runbooks/` `aws-inventory/` `aws-pending.md` 를 위키의 메인으로 두고, `src/` 자료 (`domains/`, `gotchas`, `decisions`, `runbook`, `conventions`, `structure`) 는 보조로 둔다.

**왜:** 이 리포의 진짜 가치는 계정 `306331009209` 의 운영 작업이 어떻게 진행됐고 무엇을 어떤 명령으로 했는지의 기록. `src/` 의 Fastify+cron 앱은 그 후속 점검 자동화를 위한 도구일 뿐.

**어떻게 적용:**
- 새 AWS 작업은 `aws-ops/<YYYY-MM-DD>-<topic>.md` 로 기록. 형식: 배경 / 점검 / 실행 명령 / 결과 / 영향 / 후속.
- 명령이 보존 안 된 경우 (셸 히스토리 분실 등) `> TODO(질문): 실제 사용 명령 #todo` 로 명시. **추측 명령을 적지 않는다.**
- 재사용 가능한 절차는 `aws-runbooks/` 로 분리.
- 현재 상태 스냅샷 (보호 자원, 인벤토리) 는 `aws-inventory/`.
- 후속 TODO 는 `aws-pending.md` 에 통합.

---

## docs/ 폴더 폐기 — 단일 진실은 llm-wiki/ (2026-06-26)

**결정:** 이전 `docs/aws-cleanup-history.md` / `docs/rds-dev-mshuttle-migration.md` / `docs/cloudfront-dev-admin.md` 를 위키로 이관 후 삭제.

**왜:** 같은 자료가 docs/ 와 wiki 양쪽에 있으면 한쪽이 stale 되어 갈라진다. wiki 만 단일 진실로 유지.

**어떻게 적용:** 새 AWS 자료는 `docs/` 가 아니라 `llm-wiki/aws-ops|aws-runbooks|aws-inventory/` 에만 작성. `docs/process-management.md` 만 src/ 운영 가이드라 잔존.

---

## WAF / Security Hub / Config 의 활성 유지

**결정:** 이 세 서비스는 비용 절감 검토에서 **자동 제외.** 비활성화하지 않는다.

**왜:** 2024-12-28 계정이 마비된 사건이 있었고, AWS 측이 해제 조건으로 이 서비스들의 활성 유지를 요구했다. 비활성 시 다시 마비 위험.

**어떻게 적용:** waste 컬렉터·rds:status 의 findings·신규 점검 규칙을 추가할 때 이 세 서비스를 "끄자"는 권고를 내지 않는다. `wafBotControl.ts` 의 `disable` 은 **WAF 자체가 아니라 Bot Control 룰만 제거** 하는 것이므로 허용 범위 안에 있다. 전체 보호 자원 목록은 [[aws-inventory/protected-resources]].

---

## DynamoDB 점검 화이트리스트 (2026-06-25 추가)

**결정:** RDS 와 동일 패턴인 `DYNAMODB_TABLE_NAMES` env 를 추가. env 미지정 시 모든 테이블 점검 (이전 동작 유지).

**왜:** 원래는 누락된 상태였고, 테이블 수가 늘면 점검 시간이 N 에 선형으로 늘어 다음 cron tick 과 겹칠 위험이 있었음. RDS 의 패턴을 그대로 따라 운영 자유도 확보.

**어떻게 적용:** 신규 환경 설정 시 `.env` 에 화이트리스트 명시. 모니터링이 의미 있는 테이블만 골라 적는다.

---

## CloudWatch 5분 단일 datapoint — 그대로 유지

**현황:** 모든 모니터가 `endTime - 300s ~ endTime`, `Period: 300`, `Datapoints[0]` 하나만 쓴다.

**알려진 한계:** CloudWatch publish 지연(통상 1~3분)으로 한 점도 안 들어오는 시점이 생길 수 있고, 코드는 `value: 0` 으로 fallback. "실제 0" 과 "데이터 없음" 이 구분 안 됨 → 임계 알림이 가끔 누락 가능.

**결정 (2026-06-25): 유지.**

**왜:** 점검 주기가 30분이라 한 tick 놓쳐도 다음 tick 에 잡힌다. 임계 누락 한두 번이 사고로 직결되는 운영이 아님.

**언제 손볼지:** 위 전제가 깨지는 시점 — 즉 한 번이라도 알림 누락이 곤란해질 때. 그때 윈도우를 15~30분으로 늘리고 `Datapoints` 정렬 후 가장 최근 점을 고르는 식으로 수정.

---

## Telegram 과 Slack 양쪽이 활성이면 양쪽 모두 보낸다

**결정:** `notifiers/index.ts` 의 `getActiveNotifiers()` 가 `isConfigured()` 인 채널을 모두 모아 `Promise.all` 로 동시 발사.

**왜:** 단일 channel-of-record 를 강제하지 않고 "있으면 다 보낸다" 로 단순화. 환경별로 한쪽 env 만 채우면 자동으로 그 채널만 활성.

**어떻게 적용:** Slack 으로만 받고 싶으면 Telegram env 를 비운다. 양쪽 다 받고 싶으면 양쪽 다 채운다. **중복 알림이 싫다는 요구가 들어오면 이 동작 자체를 바꿔야 한다.**

---

## Waste 리포트는 Telegram 만 지원

**결정:** `notifiers/index.ts:sendWasteReport` 는 `sendWasteReportToTelegram` 만 호출. Slack 미지원.

**왜:** Telegram 메시지가 길어도 잘 보이고 `<code>` 태그로 리소스 ID 가독성이 좋아서 보고서 형식에 특화. Slack Block Kit 으로 같은 정보를 옮기는 작업이 미수행된 것으로 보임.

> TODO(질문): Slack 으로도 waste 리포트가 필요한 상황이 있나요? 아니면 Telegram 만으로 충분히 운영되고 있나요? #todo

---

## 모니터링 임계값을 전부 코드에 박은 이유

**현재:** CPU 80%, UserErrors 10, SystemErrors 0, BlockedRequests 100 모두 `infra-monitor/index.ts` 에 리터럴.

**왜:** 환경별 차이가 없다고 가정. 모든 환경에서 같은 임계 사용. env 로 빼면 추상화 비용만 늘어남.

**어떻게 적용:** 환경별로 다르게 가져가야 할 시점이 오면 그때 env 로 빼낸다. 단발성 조정이면 코드 수정.

---

## 서버 시작과 동시에 스케줄러 기동

**결정:** `startServer(port, enableScheduler = true)`, 끄는 env 토글 없음.

**왜:** 운영 인스턴스에서 별도 cron 데몬을 두지 않고 같은 프로세스 안에서 처리하려는 단순화. PID 하나로 정지 관리.

**부작용:** 로컬 `yarn dev` 도 스케줄러를 켠다. `.env` 가 채워져 있으면 개발 중에 실제 알림이 발사. → [[gotchas]] 참조. 개발 시에는 알림 env 비우는 게 관례.

---

## 일회성 스크립트의 dry-run 기본

**결정:** `wafBotControl.ts` 의 `disable`/`enable` 은 `--confirm` 없이는 변경하지 않고 변경 요약만 출력.

**왜:** 잘못 호출했을 때 운영 ACL 을 부수는 사고 방지. "보고 → 확인 → 실행" 두 단계로 분리.

**어떻게 적용:** 새 destructive 스크립트를 추가할 때도 이 패턴을 따른다 (`status` 는 read-only, mutation 은 항상 `--confirm` 게이트).

---

## WAF ACL 변경 전 자동 백업

**결정:** `disable` 시 변경 직전 ACL 전체를 `backups/waf-acl/<target>-<aclName>-<timestamp>.json` 으로 저장. `enable` 의 기본 복원 소스로 사용.

**왜:** UpdateWebACL 은 LockToken 기반 단발 교체라 롤백 수단이 필요. AWS 콘솔에 변경 이력은 남지만 복원 도구가 없으므로 자체 백업.

**어떻게 적용:** `backups/waf-acl/` 손으로 지우지 말 것. 가장 최근 파일이 `waf:bot enable` 의 기본 복원 소스. 파일을 지우면 `--from <path>` 로 명시 지정해야 함.

---

## CloudFront 함수 관리는 코드 밖

**현재:** [[aws-inventory/cloudfront-dev-admin]] 등에 운영 기록만 있고, 이 리포의 `src/` 코드는 CloudFront Function 을 관리하지 않는다.

**왜:** CloudFront Function 연결은 AWS Console / CLI 로 수동 처리. 이 리포의 `src/` 는 모니터링·점검·낭비 탐지 도구 모음이지 IaC 가 아님.

**어떻게 적용:** CloudFront Function 관련 일은 [[aws-runbooks/cloudfront-function-attach]] 절차에 따라 수동으로. 코드 자동화가 필요하면 별도 자동화 리포로 분리하는 게 자연스럽다.

---

## TypeScript 빌드는 `tsc`, 실행은 `tsx`

**결정:** dev/scripts 는 `tsx` 직접 실행, prod 는 `tsc` 로 빌드 후 `node dist/index.js`.

**왜:** 운영 부팅 시간을 빠르게(컴파일 안 한 채 안 띄움), 개발은 컴파일 없이 빠른 피드백.

---

## bus_factor: 1

**현실:** 이 리포의 의도·역사·운영 컨텍스트를 아는 사람이 사실상 한 명. 따라서 이 위키의 가치가 크다. 모르는 게 나오면 임의 해석하지 말고 `#todo` 로 남길 것.
