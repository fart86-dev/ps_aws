---
type: repo-wiki
repo: ps-aws-infra-monitor
domains: []
area: waf-bot-control
stack: [aws-sdk-v3, wafv2]
status: active
updated: 2026-06-25
---

# waf-bot-control — WAF Bot Control 룰 on/off 스크립트

#domain/waf-bot-control

## 이 리포에서의 처리

이 영역은 **CloudFront scope 의 두 WebACL(dev: `DEV_PACK_BY_GIMYO`, prod: `PROD_PACK_TEMP`)에서 Bot Control 관리형 룰(`AWS-AWSManagedRulesBotControlRuleSet`)을 임시로 빼고 복원하는** 도구다. WAF 자체를 끄는 도구가 아니다.

WAF / Security Hub / Config 비활성은 정책상 금지 — [[../decisions]] 참조.

## 파일 매핑

| 파일 | 역할 |
|---|---|
| `src/scripts/wafBotControl.ts` | 전체 스크립트 (307 lines) — status/disable/enable |
| `backups/waf-acl/` | `disable` 시 자동 백업, `enable` 의 기본 복원 소스 |

## 명령

```bash
yarn waf:bot status                                # 양쪽 ACL 상태
yarn waf:bot status --target dev
yarn waf:bot disable --target dev --confirm        # Bot Control 제거 + 자동 백업
yarn waf:bot enable  --target dev                  # 가장 최근 백업에서 복원
yarn waf:bot enable  --target dev --from <path>    # 명시 백업 사용
```

- `--confirm` 없으면 destructive 동작은 dry-run.
- `--target` 디폴트는 **`all` (= dev + prod 동시)** — 사고 위험. [[../gotchas]] "WAF Bot Control 의 prod 사고 위험" 참조.

## 하드코딩 값

```ts
const REGION = "us-east-1";              // CloudFront scope 전용
const SCOPE = "CLOUDFRONT";
const BOT_RULE_NAME = "AWS-AWSManagedRulesBotControlRuleSet";
const TARGETS = {
  dev: { name: "DEV_PACK_BY_GIMYO", id: "d9603538-7bfe-4bc7-a2a7-92cb074e1a5c" },
  prod: { name: "PROD_PACK_TEMP", id: "f6ab75c2-60a8-4b69-ae99-5e5b8d843a0a" },
};
```

ACL 이름·ID 가 바뀌면 침묵 실패. 새 ACL 을 관리 대상에 추가하려면 `TARGETS` 직접 수정.

## 백업·복원 패턴

`disable` 단계:
1. `GetWebACL` 로 현재 ACL 통째로 조회 (LockToken 포함)
2. `backups/waf-acl/<target>-<aclName>-<ISO timestamp>.json` 으로 직렬화 저장
3. Bot Control rule 만 제거한 새 Rules 배열로 `UpdateWebACL`

`enable` 단계:
1. `--from` 없으면 `backups/waf-acl/` 에서 `<target>-<aclName>-` 접두 파일 중 가장 최근 정렬 선택
2. 백업에서 Bot Control rule 추출
3. 현재 ACL Rules + 추출 rule → Priority 순 정렬 → `UpdateWebACL`

**백업 폴더를 손으로 지우지 말 것.** rollback 수단이 사라진다.

## UpdateWebACL 시 보존하는 필드

```ts
DefaultAction, Description, Rules, VisibilityConfig, LockToken,
CustomResponseBodies, CaptchaConfig, ChallengeConfig, TokenDomains, AssociationConfig
```

AWS SDK v3 의 `WebACL` 타입에 새 필드가 추가되면 `Update` 호출이 그 필드를 빠뜨려 덮어쓸 위험. SDK 업데이트 시 점검 필요.

## 비용 효과

`disable` 시 ACL 당 약 -$10/월 절감 표시. 출처는 `actionStatus` 안에 리터럴.

> TODO(질문): Bot Control 을 어떤 조건에서 disable 하나요? 평상시 on/off 정책이 있는지, 트래픽 패턴 확인을 위한 일시 비활성인지? #todo
