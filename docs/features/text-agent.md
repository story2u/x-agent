# Feature: Text Agent

## 当前状态

MVP 只生成 X/Twitter 文本 artifact，不生成图片，不做 Web 审批流。

输出字段：

- `tweet`
- `hashtags`
- `rationale`
- `safetyNotes`
- `dailyFortune?`

`dailyFortune` 包含运营级内容流水线字段：audience insight、angle options、hook options、draftV1、operator critique、final longTweet/thread、engagement plan 和 review notes。保留 `TwitterCreative.media` 扩展位，但 TUI 不展示。

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
- `finalize_twitter_creative` 的 `dailyFortune` 字段使用严格 TypeBox schema（非 `Type.Any`），强约束模型输出结构；`daily-fortune-tweet/SKILL.md` 和 `references/*.md` 内置运营策略、评分规则和黄金样例以拉高生成质量。
- 模型 provider 支持 `openai-codex`、`openai` 和 `deepseek`；DeepSeek 走 `openai-completions`。

## Daily Fortune Artifact

`daily-fortune-tweet` 支持：

- longTweet：标题、正文、hashtags。
- thread：多推文结构。
- audienceInsight：核心痛点、真实场景、情绪需求。
- angleOptions / selectedAngle：3-5 个角度和最终选择。
- hookOptions：5 个 hook 备选。
- fortuneSpine：keyword、symbolic image、emotional weather、core tension、practical advice。
- draftV1：初稿。
- operatorCritique：hook、specificity、audience fit、resonance、shareability、save-worthiness、safety 评分和改写方向。
- final：最终 `longTweet` 和 `thread`。
- engagementPlan：CTA、comment prompt、series label。
- reviewNotes：safetyCheck、hypeCheck、publishReadiness。

TUI 会渲染 Daily Fortune 的 long post、thread、fortune spine、operator critique、engagement plan、review notes，不把 JSON 原样丢给用户。用户请求 longTweet 时主展示 `final.longTweet.body`；请求 thread 时主展示 `final.thread` 并打印 `full thread copy`。

## 相关模块

- TUI：`scripts/x-agent-tui.ts`
- Agent：`src/lib/pi-agent.ts`
- Local skills：`skills/*/SKILL.md`
- Skill Runtime：`src/lib/skills/local-skills.ts`
- Credentials：`src/lib/pi-credentials.ts`
- Types：`src/lib/types.ts`
- Validation：`src/lib/validation.ts`
- Tests：`src/lib/__tests__/pi-agent.test.ts`、`src/lib/__tests__/validation.test.ts`、`src/lib/__tests__/skills.test.ts`、`src/lib/__tests__/daily-fortune-evals.test.ts`

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
- Daily Fortune references 修改后要确认 `resolveRuntimeSkill` trace 能列出并加载 reference 内容。

## 测试点

- `normalizeCreative` 防御式校验。
- plain text / JSON transcript recovery。
- result creative 不包含图片字段。
- 今日运势输入自动选择 `daily-fortune-tweet`。
- strict Daily Fortune JSON 可恢复成 `TwitterCreative.dailyFortune`。
- `money-longtweet-overseas-youth`：长推正文不少于 600 个中文字符，至少包含 2 个海外财务场景，scores 全部 >= 4。
- `unsafe-rich-guarantee`：不承诺暴富，安全审查标记原始风险。
- `fortune-thread-career`：thread 5-8 条且 roles 完整。
