# Feature: CLI / TUI Client

## 当前状态

MVP 的主操作入口是本地终端 client：

```bash
npm run tui
```

TUI 只有一个输入框。普通文本会直接调用 agent 生成 X/Twitter 文本 artifact；其他能力通过 `/` slash commands 调用。默认 public mode 保持结果面干净，只打印 effective context、可发布正文和 hashtags；`/debug on` 后才实时打印 pipeline 阶段进度，并在 provider/agent 产生可见 `text_delta` 时按流输出模型文本。Daily Fortune 请求会先经过 `deriveFortuneRequestOverrides()` 归一化：默认使用海外年轻中文用户、`playful`、`longTweet`，并从自然语言命令里抽取显式受众/语气/输出类型覆盖旧 TUI state。

## 能力范围

- 生成：普通输入直接调用 `generateTwitterCreative()`，并通过 `onProgress` 订阅 `pipeline_start` / `stage_start` / `text_delta` / `tool_call` / `pipeline_end` 等事件；public mode 只显示最终可发布内容，debug mode 才打印这些进度事件。Daily Fortune 会显示 effective `skill/output/tone/audience`。
- Skill：`/skills` 列出本地 Markdown skills，`/skill auto|<slug>` 切换选择。
- Context：`/tone`、`/output`、`/audience`、`/goal`、`/constraints`、`/date`、`/timezone` 调整生成上下文。
- Model：`/model` 展示 provider 和本地凭据状态。
- Display：默认 `public` 只展示可发布正文和 hashtags；`/debug on` 打开内部 artifact 详情，`/debug off` 恢复 public，`/details` 用 debug 视图查看最近一次结果。
- Session：`/last`、`/history`、`/trace`、`/context` 查看当前进程内结果，以及最近一次 fortune run 的 stage trace 与四层 FortuneContext。
- Input history：方向键历史跨 TUI 会话持久化，默认写入仓库根目录 `.x-agent-tui-history`（gitignored）。

TUI 不访问任何网络后端、不登录、不落地存储。

## 相关模块

- TUI：`scripts/x-agent-tui.ts`
- Scripts：`package.json` 的 `tui`、`cli`
- Local skills：`skills/*/SKILL.md`
- Skill loader：`src/lib/skills/local-skills.ts`
- Fortune request normalizer：`src/lib/fortune/request-overrides.ts`
- Agent：`src/lib/pi-agent.ts`
- Types：`src/lib/types.ts` 的 `GenerateProgressEvent` / `GenerateProgressOptions`
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
/debug on
/debug off
/details
/date <YYYY-MM-DD>
/timezone <IANA tz>
/config
/model
/model <openai-codex|openai|deepseek> [model]
/last
/history
/trace
/context
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
- Daily Fortune public 渲染时只展示 `final.longTweet.body` / `final.thread` 和 hashtags；内部 scenes/hooks/spine/critique/engagement/rationale/notes/skill/tokens 只在 debug 视图展示。
- `/model <provider> [model]` 只修改当前 TUI 进程内的 `process.env.PI_PROVIDER` / `process.env.PI_MODEL`，不回写 `.env`。
- TUI input history 只保存用户输入行和 slash commands，不保存模型输出 artifact；可用 `X_AGENT_TUI_HISTORY_FILE` 改路径，`X_AGENT_TUI_HISTORY_LIMIT` 改最大条数（默认 200）。
- 进度输出只写当前终端，不进入 `.x-agent-tui-history`，也不改变最终 `GenerateResponse` 的结构化 artifact 渲染。

## 测试点

- `npm run tui -- --help` 能输出帮助。
- `printf '/skills\n' | npm run tui` 能列出本地 skills 并正常退出。
- `/skill daily-fortune-tweet` 后生成请求包含该 skill slug。
- 今日运势输入能自动选择 `daily-fortune-tweet`。
- `/model` 能显示 DeepSeek key/base URL 状态。
- `/model deepseek` 能把当前 TUI session 切到 `deepseek-v4-pro`。
- `/debug on` 后普通生成不再只显示等待状态，而是展示 skill selection、pipeline provider/model、stage progress、tool capture 和 token usage。若模型产生可见文本 delta，debug mode 会即时输出。
- Fortune 自然语言请求 `受众是海外中文年轻人，语气轻松但有一点玄学感` 会以 `daily-fortune-tweet/longTweet/playful` 有效上下文运行，不沿用默认 `technical`。
- public mode 默认不展示 rationale、notes、skill trace、tokens、operator critique 等内部信息；`/details` 可查看。
