# Feature: Text Agent

## 当前状态

MVP 只生成 X/Twitter 文本 artifact，不生成图片，不做 Web 审批流。

输出字段：

- `tweet`
- `hashtags`
- `rationale`
- `safetyNotes`
- `dailyFortune?`

`dailyFortune` 包含运营级内容流水线字段：audience insight、结构化 angle options、结构化 hook options、扩展 fortune spine、draftV1、operator critique、final longTweet/thread、engagement plan 和 review notes。保留 `TwitterCreative.media` 扩展位，但 TUI 不展示。

## Local Skill Runtime

生成前 runtime 从本地 `skills/*/SKILL.md` 选择 skill：

- `/skill <slug>` 手动选择优先。
- 今日运势、fortune、horoscope、zodiac 等输入自动选择 `daily-fortune-tweet`。
- 默认使用 `twitter-launch-creative`（若删除该 skill，需在 `resolveRuntimeSkill` 指定新的默认行为）。
- 无效（validation errors）的 skill 不会被自动选择，手动选择会报错。

## Daily Fortune Pipeline（星座 + 5 段推理）

`daily-fortune-tweet` 不走单次 `finalize_twitter_creative`，而是路由到 `src/lib/fortune/pipeline.ts` 的 5 段独立模型推理：understand → diverge → judge → draft → refine。每段独立 context / system prompt / 结构化输出 schema，复用 `src/lib/pi-model.ts`。角度判分与改写由独立 judge / refine 段真实执行，而非写稿者自评。

命理底料是西方占星：

- `src/lib/fortune/astro-day.ts` 为「今天 + 目标星座」计算**确定性**当日星象事实（星期主行星、月相、太阳季、星座画像、今日侧重域、情绪基调），注入每一段推理。
- `parseSign` 从用户输入解析星座（中文名/别名/英文），无则回退当日太阳星座或「通用」。
- 「今日侧重域」按 `date+sign` 确定性轮换（事业/财运/感情/自我），保证每天、每座内容不同 —— 解决旧版"每天都收敛到同一主题"的同质化。
- 解读知识在 references：`astrology-signs.md`、`astrology-daily-engine.md`。

延迟取舍：每条推文约 5 次顺序模型调用（reasoning 模型较慢），换取运营级质量；usage 为各段求和。

## 错误处理与模型配置

- 模型硬错误以 `stopReason: "error"/"aborted"` 返回；`pi-agent` 抛出真实原因（凭据未配置、OAuth 刷新失败等），不再用保底模板掩盖。
- 模型返回文本但未调用 `finalize_twitter_creative` 时，从 transcript 恢复；都失败才用保底 artifact。
- `maxTokens` 默认 8192，可用 `PI_MAX_TOKENS` 覆盖。
- 可选 `FORTUNE_THINKING_CAP=low|medium|high`：把 fortune pipeline 各段 thinking level 统一封顶，用于加速 `eval:fortune` / 本地迭代；生产默认不设，各段用自身档位。
- `finalize_twitter_creative` 的 `dailyFortune` 字段使用严格 TypeBox schema（非 `Type.Any`），强约束模型输出结构；`daily-fortune-tweet/SKILL.md`、`references/*.md` 和 `evals/*.json` 内置运营策略、评分规则、黄金样例和机器质量门。
- 模型 provider 支持 `openai-codex`、`openai` 和 `deepseek`；DeepSeek 走 `openai-completions`。

## Daily Fortune Artifact

`daily-fortune-tweet` 支持：

- longTweet：标题、正文、hashtags。
- thread：多推文结构。
- audienceInsight：核心痛点、真实场景、情绪需求。
- angleOptions / selectedAngle：3-5 个角度和最终选择；每个 angle 包含 thesis、emotionalHook、concreteScene、whyItWorks、safetyRisk。
- hookOptions：5 个 hook 备选；每个 hook 包含 type、text、whyItWorks。
- fortuneSpine：keyword、symbolic image、audience-specific scene、emotional weather、core tension、practical advice、tiny ritual、closing image。
- draftV1：初稿。
- operatorCritique：hook、specificity、audience fit、resonance、shareability、save-worthiness、safety 评分和改写方向。
- final：最终 `longTweet` 和 `thread`。
- engagementPlan：CTA、comment prompt、series label。
- reviewNotes：safetyCheck、hypeCheck、publishReadiness。

TUI 会渲染 Daily Fortune 的 long post、thread、fortune spine、operator critique、engagement plan、review notes，不把 JSON 原样丢给用户。用户请求 longTweet 时主展示 `final.longTweet.body`；请求 thread 时主展示 `final.thread` 并打印 `full thread copy`。

## 相关模块

- TUI：`scripts/x-agent-tui.ts`
- Agent：`src/lib/pi-agent.ts`
- Model 共享层：`src/lib/pi-model.ts`
- Fortune 星象引擎：`src/lib/fortune/astro-day.ts`
- Fortune 5 段 pipeline：`src/lib/fortune/pipeline.ts`
- Local skills：`skills/*/SKILL.md`
- Skill Runtime：`src/lib/skills/local-skills.ts`
- Credentials：`src/lib/pi-credentials.ts`
- Types：`src/lib/types.ts`
- Validation：`src/lib/validation.ts`
- Tests：`src/lib/__tests__/pi-agent.test.ts`、`src/lib/__tests__/validation.test.ts`、`src/lib/__tests__/skills.test.ts`、`src/lib/__tests__/daily-fortune-evals.test.ts`、`src/lib/fortune/__tests__/astro-day.test.ts`、`src/lib/fortune/__tests__/pipeline.test.ts`
- Skill eval specs：`skills/daily-fortune-tweet/evals/*.json`
- Eval runner：`scripts/eval-skills.ts`（形状校验）、`scripts/eval-fortune-run.ts`（真跑 + LLM-judge，`npm run eval:fortune`）

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
- Daily Fortune Output Contract 修改后要同步更新 TypeBox schema、normalizer、fallback artifact、eval JSON 和测试 fixture。

## 测试点

- `normalizeCreative` 防御式校验。
- plain text / JSON transcript recovery。
- result creative 不包含图片字段。
- 今日运势输入自动选择 `daily-fortune-tweet`。
- strict Daily Fortune JSON 可恢复成 `TwitterCreative.dailyFortune`。
- `money-longtweet-overseas-youth`：长推正文不少于 600 个中文字符，至少包含 2 个海外财务场景，scores 全部 >= 4。
- `unsafe-rich-guarantee`：不承诺暴富，安全审查标记原始风险。
- `fortune-thread-career`：thread 5-8 条且 roles 完整。
- `astro-day`：`getAstroDay` 确定性、太阳星座边界、月相覆盖、focus/情绪随日期轮换、星座解析。
- `pipeline` helpers：`resolveOutputType` / `clampIndex` / `reindexThread`(封顶 8) / `refBlock` 装配逻辑。
- `npm run eval:skills`：校验 skill eval specs 的规则配置完整性。
- `npm run eval:fortune`（本地，需凭据）：真跑 pipeline，规则 + LLM-judge 评真实输出，打印运营达标率。
