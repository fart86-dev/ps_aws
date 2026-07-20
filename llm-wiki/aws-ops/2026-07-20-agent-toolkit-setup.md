---
type: aws-op
date: 2026-07-20
account: "306331009209"
region: us-east-1
category: [tooling, mcp, agent-toolkit]
impact: 비용 아님 — 로컬 개발 도구 설정 (AI 코딩 에이전트용 AWS MCP 서버 + 스킬 등록)
status: done
---

# 2026-07-20 · AWS Agent Toolkit 설정 (Claude Code ↔ AWS MCP)

## 배경

사용자가 `https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup.md` 를 제시하며 실제 AWS 제공 도구인지 확인 요청.

확인 결과 `aws/agent-toolkit-for-aws` 는 GitHub `aws` 조직(공식) 소유, 설명 "Official, AWS-supported MCP servers, skills, and plugins to help AI agents build on AWS" — 진짜 AWS 공식 저장소.

## 사전 상태

- AWS CLI `2.22.27` (2025-01 설치, `com.amazon.aws.cli2` pkg) — 이미 `kimps` 로 로그인, 계정 `306331009209`, region `ap-northeast-2`
- `aws configure agent-toolkit` 서브커맨드 없음 → 구버전이라 기능 미지원 확인

## 실행

1. **AWS CLI 업그레이드**: macOS 는 `install.sh`(Linux 전용) 대신 공식 `.pkg` 사용
   ```bash
   curl -fsSL "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o AWSCLIV2.pkg
   sudo installer -pkg AWSCLIV2.pkg -target /   # 사용자가 직접 실행 (sudo 대화형 비번 필요)
   ```
   → `2.22.27` → `2.36.2`

2. **Agent Toolkit 설치**:
   ```bash
   aws configure agent-toolkit --yes --region us-east-1
   ```
   결과 — 로컬에 설치된 4개 AI 도구 감지 및 설정:
   - Claude Code → `~/.claude/skills` + `~/.claude.json` 에 MCP 서버 `aws-mcp` 추가
   - Codex → `~/.agents/skills/` + codex 설정
   - Cursor → `~/.cursor/skills` + `~/.cursor/mcp.json`
   - Gemini CLI → `~/.agents/skills/` + `~/.gemini/settings.json`

   기본 스킬 15개 설치(amazon-bedrock, aws-cdk, aws-serverless, aws-observability 등). `list-available-skills` 로 훨씬 더 많은 카탈로그 확인 가능 (Aurora, 결제, 컨테이너 등 세분화).

3. **검증**: 새 `claude` 프로세스에서
   ```bash
   claude mcp list
   # aws-mcp: uvx mcp-proxy-for-aws@latest https://aws-mcp.us-east-1.api.aws/mcp ... - ✔ Connected
   ```

4. **규칙 파일**: 저장소의 `rules/aws-agent-rules.md` 를 이 리포 `CLAUDE.md` 에 덮어쓰지 않고 [[../aws-agent-toolkit-rules]] 로 별도 보관 (기존 protected-resources/절대규칙 보존 목적).

## 영향 범위 — 프로젝트 밖까지 번짐 주의

`aws configure agent-toolkit` 은 **이 프로젝트(`ps_aws`) 범위가 아니라 이 macOS 사용자 계정 전역**을 건드린다:
- `~/.claude.json` (Claude Code 전역 MCP 설정 — 이 리포 소속 아님)
- `~/.cursor/mcp.json`, `~/.gemini/settings.json`, codex 설정
- `~/.claude/skills`, `~/.agents/skills/`, `~/.cursor/skills` 에 스킬 파일 설치

즉 이 리포와 무관한 다른 프로젝트에서 Claude Code/Cursor/Gemini CLI 를 열어도 `aws-mcp` 와 새 스킬들이 이미 잡혀 있다.

## 다음 행동

- [ ] 새 터미널/세션에서 실제 AWS 스킬(`aws-cdk`, `aws-serverless` 등)이 트리거되는지 실사용 확인
- [ ] `llm-wiki/aws-agent-toolkit-rules.md` 를 이 리포 `CLAUDE.md` 에서 참조할지 여부는 사용자 결정 대기
