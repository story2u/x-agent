# x-agent

x-agent 是一个本地 CLI/TUI 形式的 X/Twitter 文本创意 agent。TUI 只有一个输入框：直接输入自然语言会生成真实推文 artifact，输入 `/` 可以调用 skills、上下文、模型和历史等命令。

项目使用 `@earendil-works/pi-agent-core` / `@earendil-works/pi-ai`，默认通过 `openai-codex` provider 调用 ChatGPT Plus/Pro 模型，也可通过 `PI_PROVIDER=deepseek` 使用 DeepSeek API。

MVP 阶段只做文本：tweet、hashtags、rationale、safety notes，以及可选 `dailyFortune`。不做图片生成、Web 登录、Review Gate 或后台审批流。

## Quick Start

```bash
npm install
npm run tui
```

普通输入会直接生成：

```text
x-agent auto/tweet/technical › 帮我生成一条今日财运长推文，受众是海外中文年轻人
```

Slash commands：

```text
/skills
/skill auto
/skill daily-fortune-tweet
/tone warm
/output both
/audience 海外中文年轻人
/goal 生成适合 X 发布的长推文
/constraints 不要确定性预测，不要投资建议
/model
/model deepseek
/last
/history
/quit
```

## Model Credentials

默认 provider：

```bash
PI_PROVIDER=openai-codex
PI_MODEL=gpt-5.5
```

生成 ChatGPT Plus/Pro OAuth credentials：

```bash
npm run chatgpt:oauth
```

将脚本输出放入本地环境变量：

```bash
export OPENAI_CODEX_OAUTH_CREDENTIALS='{"openai-codex":{"type":"oauth",...}}'
```

可选 fallback：

```bash
export OPENAI_CODEX_ACCESS_TOKEN=...
export OPENAI_API_KEY=...
```

可选 DeepSeek API：

```bash
export PI_PROVIDER=deepseek
export PI_MODEL=deepseek-v4-pro
export DEEPSEEK_API_KEY=...
```

DeepSeek 使用 OpenAI-compatible Chat Completions，默认 base URL 为 `https://api.deepseek.com`，可用 `DEEPSEEK_BASE_URL` 覆盖。
TUI 内也可以用 `/model deepseek` 临时切换到 DeepSeek；该切换只影响当前 TUI 进程，不会回写 `.env`。

## Local Skills

Skills 的 source of truth 是本地 Markdown：

```text
skills/
  twitter-launch-creative/
    SKILL.md
  daily-fortune-tweet/
    SKILL.md
    references/
      *.md
    evals/
      *.json
```

新增 skill 时创建：

```text
skills/<slug>/SKILL.md
```

每个 `SKILL.md` 应包含：

- frontmatter `name`
- frontmatter `description`
- optional `metadata.version`
- optional `allowed-tools`
- Workflow / Process section
- Output Contract section
- Review Checklist / Safety Rules section

## Current Capability

- Single-input TUI client：`scripts/x-agent-tui.ts`
- Slash command context control
- Persistent TUI input history：default `.x-agent-tui-history`
- Local Markdown skill loading：`src/lib/skills/local-skills.ts`
- Text agent runtime：`src/lib/pi-agent.ts`
- Default `twitter-launch-creative` skill
- Default `daily-fortune-tweet` skill: astrology-grounded 5-stage reasoning pipeline (understand → diverge → judge → draft → refine) over a deterministic daily astrology engine
- Fortune pipeline & astrology engine: `src/lib/fortune/pipeline.ts`, `src/lib/fortune/astro-day.ts`; shared model layer `src/lib/pi-model.ts`
- Daily Fortune eval specs (`skills/daily-fortune-tweet/evals/*.json`) + real model-in-loop eval (`npm run eval:fortune`)
- ChatGPT Plus/Pro OAuth credential refresh through pi-ai
- DeepSeek API provider through OpenAI-compatible Chat Completions
- Web root page only shows CLI launch instructions

## Docs Harness

本项目采用文档驱动的 harness 开发方式。开发前先读文档定位功能和模块，开发后必须把变更回写到 docs。

AI / Codex 开发入口：

- `AGENTS.md`：AI 开发规范和必读顺序。
- `docs/README.md`：文档导航入口。
- `docs/开发规范.md`：编码边界、质量门、文档回写要求。
- `docs/架构文档.md`：系统架构和模块边界。
- `docs/开发流程.md`：需求到提交部署的流程。
- `docs/功能导航.md`：按功能定位代码、数据和测试。
- `docs/业务流程.md`：TUI、agent 和本地 skill 流程。
- `docs/数据流程.md`：TUI 请求、模型调用和本地 skill 数据流。
- `docs/features/`：功能域专项文档。

开发新功能或修复缺陷时，先从 `docs/功能导航.md` 找到对应 feature 文档；没有文档的功能，先补文档再实现。

## Validation

```bash
npm run tui -- --help
printf '/skills\n' | npm run tui
npm run typecheck
npm run build
npm run lint
npm test
npm run eval:skills
npm run eval:skill -- daily-fortune-tweet
npm run eval:fortune:mock     # 离线 harness 自检（无需凭据，CI 跑这条）
npm run eval:fortune -- --mock                 # 等价写法
EVAL_FORTUNE_MODE=mock npm run eval:fortune    # 等价写法（环境变量）
npm run eval:fortune          # 真跑 fortune pipeline + 规则 + LLM-judge（需模型凭据）
```

> mock 模式不评估真实生成质量，只验证 eval harness、规则检查、fixture artifact 和 CI 可运行性；真实运营质量仍以非 mock 的 `npm run eval:fortune` 为准。eval spec 已固定 `date` / `timeZone`（默认 2026-06-07 / Asia/Singapore），保证可复现。

## Legacy Code

Next.js API、D1、Durable Object、Web component 和 auth/RBAC 等旧 Web/backend 代码已在本次重构中移除，仓库现在聚焦本地 TUI。如需恢复 Web/backend 模式，请先更新 docs harness 再实现。
