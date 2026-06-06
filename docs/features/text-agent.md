# Feature: Text Agent

## 当前状态

MVP 只生成 X/Twitter 文本 artifact，不生成图片，不做 Web 审批流。

输出字段：

- `tweet`
- `hashtags`
- `rationale`
- `safetyNotes`
- `dailyFortune?`

保留 `TwitterCreative.media` 扩展位，但 TUI 不展示。

## Local Skill Runtime

生成前 runtime 从本地 `skills/*/SKILL.md` 选择 skill：

- `/skill <slug>` 手动选择优先。
- 今日运势、fortune、horoscope、zodiac 等输入自动选择 `daily-fortune-tweet`。
- 默认使用 `twitter-launch-creative`（若删除该 skill，需在 `resolveRuntimeSkill` 指定新的默认行为）。
- 无效（validation errors）的 skill 不会被自动选择，手动选择会报错。

## 错误处理与模型配置

- 模型硬错误以 `stopReason: "error"/"aborted"` 返回；`pi-agent` 抛出真实原因（凭据未配置、OAuth 刷新失败等），不再用保底模板掩盖。
- 模型返回文本但未调用 `finalize_twitter_creative` 时，从 transcript 恢复；都失败才用保底 artifact。
- `maxTokens` 默认 8192，可用 `PI_MAX_TOKENS` 覆盖。
- `finalize_twitter_creative` 的 `dailyFortune` 字段使用严格 TypeBox schema（非 `Type.Any`），强约束模型输出结构；`daily-fortune-tweet/SKILL.md` 内置 few-shot 范例以拉高生成质量。

## Daily Fortune Artifact

`daily-fortune-tweet` 支持：

- longTweet：标题、正文、hashtags。
- thread：多推文结构。
- fortuneSpine：keyword、symbolic image、emotional weather、core tension、practical advice。
- reviewNotes：safetyCheck、hypeCheck、publishReadiness。

TUI 会渲染 Daily Fortune 的 long post、thread、fortune spine、review notes，不把 JSON 原样丢给用户。

## 相关模块

- TUI：`scripts/x-agent-tui.ts`
- Agent：`src/lib/pi-agent.ts`
- Local skills：`skills/*/SKILL.md`
- Skill Runtime：`src/lib/skills/local-skills.ts`
- Credentials：`src/lib/pi-credentials.ts`
- Types：`src/lib/types.ts`
- Validation：`src/lib/validation.ts`
- Tests：`src/lib/__tests__/pi-agent.test.ts`、`src/lib/__tests__/validation.test.ts`、`src/lib/__tests__/skills.test.ts`

## 操作面规则

- 主操作面是 CLI/TUI 的单输入框。
- 普通输入直接生成真实推文 artifact，不生成提示词。
- 配置项通过 slash commands 调整。
- TUI 选择 skill 时必须把 skill slug 写入 `skillIds`。

## 开发注意

- 不要把 `includeImage`、`imagePrompt`、`altText`、`imageStyle` 放回 TUI。
- 修改 prompt/tool schema 后必须更新测试。
- 修改输出结构后必须同步更新 `docs/数据流程.md`。
- Fortune 内容必须定位为娱乐、灵感、反思，不得做确定性预测、投资建议、医疗建议、法律建议或保证性承诺。

## 测试点

- `normalizeCreative` 防御式校验。
- plain text / JSON transcript recovery。
- result creative 不包含图片字段。
- 今日运势输入自动选择 `daily-fortune-tweet`。
- strict Daily Fortune JSON 可恢复成 `TwitterCreative.dailyFortune`。
