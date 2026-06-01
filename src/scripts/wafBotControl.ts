/**
 * WAF Bot Control rule on/off 토글 스크립트
 *
 * 사용:
 *   pnpm waf:bot status                                 # 양쪽 ACL 상태
 *   pnpm waf:bot status --target dev
 *   pnpm waf:bot disable --target dev --confirm        # Bot Control 제거
 *   pnpm waf:bot enable  --target dev                   # 자동 최근 백업에서 복원
 *   pnpm waf:bot enable  --target dev --from <path>     # 명시 백업 사용
 *
 *   --confirm 없으면 destructive 작업은 dry-run.
 *   백업은 backups/waf-acl/ 에 timestamp별로 저장.
 */

import {
  WAFV2Client,
  GetWebACLCommand,
  UpdateWebACLCommand,
  type Rule,
  type WebACL,
} from "@aws-sdk/client-wafv2";
import fs from "node:fs";
import path from "node:path";

// CloudFront scope는 us-east-1
const REGION = "us-east-1" as const;
const SCOPE = "CLOUDFRONT" as const;
const BOT_RULE_NAME = "AWS-AWSManagedRulesBotControlRuleSet";

const TARGETS = {
  dev: { name: "DEV_PACK_BY_GIMYO", id: "d9603538-7bfe-4bc7-a2a7-92cb074e1a5c" },
  prod: { name: "PROD_PACK_TEMP", id: "f6ab75c2-60a8-4b69-ae99-5e5b8d843a0a" },
} as const;
type TargetKey = keyof typeof TARGETS;

const BACKUP_DIR = path.resolve(process.cwd(), "backups/waf-acl");

const client = new WAFV2Client({ region: REGION });

// ──────────────── CLI 파싱 ────────────────
type Action = "status" | "disable" | "enable";
interface Args {
  action: Action;
  targets: TargetKey[];
  dryRun: boolean;
  confirm: boolean;
  from?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  if (argv.length === 0) usage("action 필수");
  const action = argv[0] as Action;
  if (!["status", "disable", "enable"].includes(action)) usage(`unknown action: ${action}`);

  const flags: Record<string, string | true> = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }

  const targetArg = (flags.target as string) ?? "all";
  let targets: TargetKey[];
  if (targetArg === "all") targets = ["dev", "prod"];
  else if (targetArg in TARGETS) targets = [targetArg as TargetKey];
  else usage(`unknown target: ${targetArg}`);

  return {
    action,
    targets: targets!,
    dryRun: !!flags["dry-run"],
    confirm: !!flags.confirm,
    from: flags.from as string | undefined,
  };
}

function usage(msg?: string): never {
  if (msg) console.error(`ERROR: ${msg}\n`);
  console.error(`사용: tsx src/scripts/wafBotControl.ts <action> [options]

action:
  status                현재 상태 표시
  disable               Bot Control rule 제거 (백업 저장)
  enable                Bot Control rule 복원 (백업에서)

options:
  --target dev|prod|all       대상 ACL (기본 all)
  --confirm                   destructive 작업 실제 실행 (없으면 dry-run)
  --dry-run                   변경 안 함 (명시적)
  --from <path>               enable 시 사용할 백업 파일 경로 (없으면 가장 최근)
`);
  process.exit(1);
}

// ──────────────── 헬퍼 ────────────────
async function getAcl(target: TargetKey): Promise<{ acl: WebACL; lockToken: string }> {
  const t = TARGETS[target];
  const res = await client.send(
    new GetWebACLCommand({ Name: t.name, Id: t.id, Scope: SCOPE })
  );
  if (!res.WebACL || !res.LockToken) {
    throw new Error(`GetWebACL 결과 누락: ${target}`);
  }
  return { acl: res.WebACL, lockToken: res.LockToken };
}

function findBotRule(rules: Rule[]): Rule | undefined {
  return rules.find((r) => r.Name === BOT_RULE_NAME);
}

function backupFilePath(target: TargetKey, stamp: string) {
  return path.join(BACKUP_DIR, `${target}-${TARGETS[target].name}-${stamp}.json`);
}

function saveBackup(target: TargetKey, acl: WebACL): string {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = backupFilePath(target, stamp);
  fs.writeFileSync(file, JSON.stringify(acl, null, 2), "utf8");
  return file;
}

function latestBackup(target: TargetKey): string | null {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const prefix = `${target}-${TARGETS[target].name}-`;
  const candidates = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort();
  if (candidates.length === 0) return null;
  return path.join(BACKUP_DIR, candidates[candidates.length - 1]);
}

function loadBackup(filePath: string): WebACL {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as WebACL;
  if (!data.Rules) throw new Error(`백업 파일에 Rules 누락: ${filePath}`);
  return data;
}

// ──────────────── 액션 ────────────────
async function actionStatus(targets: TargetKey[]) {
  for (const target of targets) {
    const t = TARGETS[target];
    const { acl } = await getAcl(target);
    const bot = findBotRule(acl.Rules ?? []);
    const ruleNames = (acl.Rules ?? []).map((r) => r.Name).join(", ");
    console.log(`[${target}] ${t.name}`);
    console.log(`  Capacity        : ${acl.Capacity}`);
    console.log(`  Bot Control     : ${bot ? "✓ 활성" : "✗ 비활성"}`);
    if (bot) {
      const cfg =
        bot.Statement?.ManagedRuleGroupStatement?.ManagedRuleGroupConfigs?.[0] as
          | { AWSManagedRulesBotControlRuleSet?: { InspectionLevel?: string } }
          | undefined;
      const level = cfg?.AWSManagedRulesBotControlRuleSet?.InspectionLevel ?? "?";
      console.log(`  InspectionLevel : ${level}`);
      console.log(`  비용 영향       : -$10/월 (제거 시 절감)`);
    }
    console.log(`  Rules           : ${ruleNames}`);
    console.log();
  }
}

async function actionDisable(targets: TargetKey[], confirm: boolean, dryRun: boolean) {
  for (const target of targets) {
    const t = TARGETS[target];
    const { acl, lockToken } = await getAcl(target);
    const rules = acl.Rules ?? [];
    const botIdx = rules.findIndex((r) => r.Name === BOT_RULE_NAME);

    if (botIdx < 0) {
      console.log(`[${target}] Bot Control 이미 비활성. skip.`);
      continue;
    }

    const newRules = rules.filter((_, i) => i !== botIdx);
    console.log(`[${target}] ${t.name}`);
    console.log(`  변경 전 rule 수 : ${rules.length}`);
    console.log(`  변경 후 rule 수 : ${newRules.length}`);
    console.log(`  제거 대상       : ${BOT_RULE_NAME}`);

    if (!confirm || dryRun) {
      console.log(`  → DRY-RUN (실제 실행하려면 --confirm 추가)`);
      console.log();
      continue;
    }

    // 백업 저장
    const backupFile = saveBackup(target, acl);
    console.log(`  백업 저장       : ${backupFile}`);

    // update
    await client.send(
      new UpdateWebACLCommand({
        Name: t.name,
        Id: t.id,
        Scope: SCOPE,
        DefaultAction: acl.DefaultAction!,
        Description: acl.Description || undefined,
        Rules: newRules,
        VisibilityConfig: acl.VisibilityConfig!,
        LockToken: lockToken,
        CustomResponseBodies: acl.CustomResponseBodies,
        CaptchaConfig: acl.CaptchaConfig,
        ChallengeConfig: acl.ChallengeConfig,
        TokenDomains: acl.TokenDomains,
        AssociationConfig: acl.AssociationConfig,
      })
    );
    console.log(`  ✓ disable 완료`);
    console.log();
  }
}

async function actionEnable(
  targets: TargetKey[],
  fromPath: string | undefined,
  confirm: boolean,
  dryRun: boolean
) {
  for (const target of targets) {
    const t = TARGETS[target];
    const backupPath = fromPath ?? latestBackup(target);
    if (!backupPath) {
      console.error(`[${target}] 백업 파일 없음. --from <path> 로 명시하거나 먼저 disable 실행`);
      continue;
    }
    const backup = loadBackup(backupPath);
    const botFromBackup = findBotRule(backup.Rules ?? []);
    if (!botFromBackup) {
      console.error(`[${target}] 백업 파일에 Bot Control rule 없음: ${backupPath}`);
      continue;
    }

    const { acl, lockToken } = await getAcl(target);
    if (findBotRule(acl.Rules ?? [])) {
      console.log(`[${target}] Bot Control 이미 활성. skip.`);
      continue;
    }

    const newRules = [...(acl.Rules ?? []), botFromBackup].sort(
      (a, b) => (a.Priority ?? 0) - (b.Priority ?? 0)
    );

    console.log(`[${target}] ${t.name}`);
    console.log(`  백업 사용       : ${backupPath}`);
    console.log(`  변경 전 rule 수 : ${acl.Rules?.length ?? 0}`);
    console.log(`  변경 후 rule 수 : ${newRules.length}`);
    console.log(`  추가 rule       : ${BOT_RULE_NAME} (Priority ${botFromBackup.Priority})`);

    if (!confirm || dryRun) {
      console.log(`  → DRY-RUN (실제 실행하려면 --confirm 추가)`);
      console.log();
      continue;
    }

    await client.send(
      new UpdateWebACLCommand({
        Name: t.name,
        Id: t.id,
        Scope: SCOPE,
        DefaultAction: acl.DefaultAction!,
        Description: acl.Description || undefined,
        Rules: newRules,
        VisibilityConfig: acl.VisibilityConfig!,
        LockToken: lockToken,
        CustomResponseBodies: acl.CustomResponseBodies,
        CaptchaConfig: acl.CaptchaConfig,
        ChallengeConfig: acl.ChallengeConfig,
        TokenDomains: acl.TokenDomains,
        AssociationConfig: acl.AssociationConfig,
      })
    );
    console.log(`  ✓ enable 완료`);
    console.log();
  }
}

// ──────────────── 진입점 ────────────────
async function main() {
  const args = parseArgs();
  switch (args.action) {
    case "status":
      await actionStatus(args.targets);
      break;
    case "disable":
      await actionDisable(args.targets, args.confirm, args.dryRun);
      break;
    case "enable":
      await actionEnable(args.targets, args.from, args.confirm, args.dryRun);
      break;
  }
}

main().catch((err) => {
  console.error("실행 실패:", err);
  process.exit(1);
});
