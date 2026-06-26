---
type: aws-runbook
category: waf
applies_to: [dev WebACL DEV_PACK_BY_GIMYO, prod WebACL PROD_PACK_TEMP]
last_verified: 2026-06-01
status: ready (스크립트 동작)
---

# WAF Bot Control 룰 on/off 토글

CloudFront scope (`us-east-1`) Web ACL 에 붙은 AWS managed rule group `AWS-AWSManagedRulesBotControlRuleSet` 만 떼었다 붙였다 하는 작업.

ps_aws 의 `src/scripts/wafBotControl.ts` 가 이 절차를 코드화. CLI 로 호출하면 자동 백업·복원까지 처리.

⚠️ **WAF Web ACL 자체를 끄는 것이 아니다** — managed rule group 1개만 제거 ([[../aws-inventory/protected-resources]] 의 "비활성 절대 금지" 범위 안에 있음).

---

## 1) 어떤 ACL 을 건드리나

코드에 하드코딩 (`src/scripts/wafBotControl.ts:30-33`):

```ts
const TARGETS = {
  dev:  { name: "DEV_PACK_BY_GIMYO", id: "d9603538-7bfe-4bc7-a2a7-92cb074e1a5c" },
  prod: { name: "PROD_PACK_TEMP",    id: "f6ab75c2-60a8-4b69-ae99-5e5b8d843a0a" },
};
```

| Target | Web ACL Name | Web ACL ID | Scope | Region |
|---|---|---|---|---|
| `dev` | DEV_PACK_BY_GIMYO | d9603538-...1a5c | CLOUDFRONT | us-east-1 |
| `prod` | PROD_PACK_TEMP | f6ab75c2-...43a0a | CLOUDFRONT | us-east-1 |

ACL 이름·ID 가 바뀌면 침묵 실패 → 스크립트 상수 함께 수정 필요.

## 2) 명령

```bash
# 양쪽 ACL 현재 상태
pnpm waf:bot status

# 한쪽만
pnpm waf:bot status --target dev

# Bot Control rule 제거 (dry-run, 변경 없음)
pnpm waf:bot disable --target dev

# 실제 제거 (--confirm 필수)
pnpm waf:bot disable --target dev --confirm

# 복원 (가장 최근 백업에서 자동)
pnpm waf:bot enable --target dev

# 특정 백업 파일 지정
pnpm waf:bot enable --target dev --from backups/waf-acl/dev-DEV_PACK_BY_GIMYO-2026-06-01T03-22-15.json
```

## 3) `--target all` 함정 ⚠️

`--target` 디폴트는 **`all`** (= dev + prod 동시).

```bash
pnpm waf:bot disable --confirm    # ← --target 안 적으면 prod 도 같이 disable
```

운영 ACL 을 손으로 부수기 쉽다. **항상 `--target dev` 를 명시.**

[[../gotchas#waf-bot-control-의-prod-사고-위험]] 참조.

## 4) 백업

`disable --confirm` 실행 직전 ACL 전체를 자동 저장:

```
backups/waf-acl/<target>-<aclName>-<timestamp>.json
```

예: `backups/waf-acl/dev-DEV_PACK_BY_GIMYO-2026-06-01T03-22-15.json`

`enable` 의 기본 복원 소스 = 가장 최근 파일. **이 폴더 손으로 지우지 말 것**. 지웠다면 `--from <path>` 로 명시 지정해야 복원 가능.

## 5) 내부 동작 (참고)

스크립트가 호출하는 AWS API (`@aws-sdk/client-wafv2`):

```
status:   GetWebACLCommand
disable:  GetWebACLCommand → (백업 파일 저장) → UpdateWebACLCommand (rule 제외)
enable:   GetWebACLCommand → (백업 파일 읽기) → UpdateWebACLCommand (rule 복원)
```

- `UpdateWebACL` 은 LockToken 기반 단발 교체 → 동시 수정 충돌은 자동 차단됨
- 콘솔에 변경 이력은 남지만 AWS 자체 롤백 기능은 없음 → 이 백업 파일이 유일한 복원 수단

## 6) 절대 금지 / 보존

- **WAF Web ACL 자체 삭제**: 절대 금지. [[../aws-inventory/protected-resources]]
- **Bot Control 외 다른 rule** (AWS-AWSManagedRulesAmazonIpReputationList 등): 이 스크립트가 직접 손대지 않음. 콘솔에서 추가/제거된 다른 rule 은 백업 파일 안에 포함되며 enable 시 그 시점 그대로 복원됨.
