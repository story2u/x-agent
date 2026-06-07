# Feature: CLI / TUI Client

## 当前状态

MVP 的主操作入口是本地终端 client：

```bash
npm run tui
```

TUI 只有一个输入框。普通文本会直接调用 agent 生成 X/Twitter 文本 artifact；其他能力通过 `/` slash commands 调用。

## 能力范围

- 生成：普通输入直接调用 `generateTwitterCreative()`。
- Skill：`/skills` 列出本地 Markdown skills，`/skill auto|<slug>` 切换选择。
- Context：`/tone`、`/output`、`/audience`、`/goal`、`/constraints`、`/date`、`/timezone` 调整生成上下文。
- Model：`/model` 展示 provider 和本地凭据状态。
- Session：`/last`、`/history` 查看当前进程内结果。
- Input history：方向键历史跨 TUI 会话持久化，默认写入仓库根目录 `.x-agent-tui-history`（gitignored）。

TUI 不访问任何网络后端、不登录、不落地存储。

## 相关模块

- TUI：`scripts/x-agent-tui.ts`
- Scripts：`package.json` 的 `tui`、`cli`
- Local skills：`skills/*/SKILL.md`
- Skill loader：`src/lib/skills/local-skills.ts`
- Agent：`src/lib/pi-agent.ts`
- Credentials：`src/lib/pi-credentials.ts`

## Slash Commands

```text
/skills
/skill auto
/skill <slug>
/tone <technical|warm|sharp|playful|executive>
/output <tweet|thread|longTweet|both>
/audience <text>
/goal <text>
/constraints <text>
/date <YYYY-MM-DD>
/timezone <IANA tz>
/config
/model
/model <openai-codex|openai|deepseek> [model]
/last
/history
/clear
/quit
```

## 运行方式

```bash
npm run tui
```

环境变量（TUI 启动时自动加载仓库根目录 `.env`）：

- `PI_PROVIDER`
- `PI_MODEL`
- `PI_MAX_TOKENS`
- `OPENAI_CODEX_ACCESS_TOKEN`
- `OPENAI_CODEX_OAUTH_CREDENTIALS`（单行 JSON）
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_REASONING`
- `X_AGENT_SKILLS_DIR`
- `X_AGENT_AUDIENCE`
- `X_AGENT_GOAL`
- `X_AGENT_CONSTRAINTS`
- `X_AGENT_TUI_HISTORY_FILE`
- `X_AGENT_TUI_HISTORY_LIMIT`

## 开发注意

- TUI 是本地 client，不应重新引入 Web 后端、登录或数据库依赖。
- Skill source of truth 是 `skills/<slug>/SKILL.md`，不得把 skill 编辑和选择迁回 D1。
- Slash commands 改动必须同步更新本文件和 README。
- TUI 不暴露图片生成入口。
- Daily Fortune 渲染时，longTweet 主展示 `final.longTweet.body`，thread 主展示 `final.thread`，顶层 `tweet` 只作为摘要。
- `/model <provider> [model]` 只修改当前 TUI 进程内的 `process.env.PI_PROVIDER` / `process.env.PI_MODEL`，不回写 `.env`。
- TUI input history 只保存用户输入行和 slash commands，不保存模型输出 artifact；可用 `X_AGENT_TUI_HISTORY_FILE` 改路径，`X_AGENT_TUI_HISTORY_LIMIT` 改最大条数（默认 200）。

## 测试点

- `npm run tui -- --help` 能输出帮助。
- `printf '/skills\n' | npm run tui` 能列出本地 skills 并正常退出。
- `/skill daily-fortune-tweet` 后生成请求包含该 skill slug。
- 今日运势输入能自动选择 `daily-fortune-tweet`。
- `/model` 能显示 DeepSeek key/base URL 状态。
- `/model deepseek` 能把当前 TUI session 切到 `deepseek-v4-pro`。
