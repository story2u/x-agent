# Feature: Model Credentials

## 当前状态

模型调用默认使用 pi-ai `openai-codex` provider，通过本地 ChatGPT Plus/Pro OAuth credentials 调用模型。也支持 `PI_PROVIDER=deepseek`，通过 DeepSeek OpenAI-compatible Chat Completions 调用 `deepseek-v4-pro`（可用 `PI_MODEL` 覆盖）。

## 相关模块

- TUI：`scripts/x-agent-tui.ts` 的 `/model`
- Runtime credentials：`src/lib/pi-credentials.ts`
- Runtime model/stream：`src/lib/pi-agent.ts`
- OAuth script：`scripts/chatgpt-oauth-login.mjs`
- 凭据解析：`parseCodexCredentials`（`src/lib/pi-credentials.ts`）

## 凭据流程

1. `npm run chatgpt:oauth`
2. 用户按 device code 登录 ChatGPT。
3. 脚本输出**单行** `OPENAI_CODEX_OAUTH_CREDENTIALS=...`（compact JSON，可直接粘贴）。
4. 把该单行写入仓库根 `.env`（多行 JSON 会被 dotenv 截断成 `{`，导致 JSON 解析失败）。
5. TUI 启动加载 `.env`；生成时 `@earendil-works/pi-ai/oauth` 自动刷新 access token。
6. 刷新得到新凭据时，`pi-credentials` 通过 logger 提示更新 `.env`（env 路径无法回写）。

可选 provider / fallback：

- `OPENAI_CODEX_ACCESS_TOKEN`
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`（配合 `PI_PROVIDER=deepseek`）

DeepSeek `.env` 示例：

```bash
PI_PROVIDER=deepseek
PI_MODEL=deepseek-v4-pro
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

DeepSeek 使用 pi-ai `openai-completions` 通道，默认开启 reasoning；可用 `DEEPSEEK_REASONING=false` 关闭。TUI 中可用 `/model deepseek [model]` 临时切换 provider；该命令只影响当前进程，不会写回 `.env`。

## 开发注意

- 不要在 TUI 中打印 token（`/model` 只显示 present/missing）。
- 凭据只来自 `.env` / 环境变量，不依赖任何数据库或 Web 设置。
- `.env` 已 gitignore，本地 credentials 不应提交到 git。
- `OPENAI_CODEX_OAUTH_CREDENTIALS` 解析失败会抛出明确错误（必须单行）。
- DeepSeek API key 只通过 `DEEPSEEK_API_KEY` 读取；`/model` 只显示 present/missing，`/model deepseek` 只切换 session provider/model。
