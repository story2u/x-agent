# Feature: Text Agent

## 当前状态

MVP 只生成 X/Twitter 文本 artifact，不生成图片，不做 Web 审批流。
`generateTwitterCreative(input, options?)` 仍返回最终 `GenerateResponse`，同时支持可选 `GenerateProgressOptions.onProgress` 回调，用于实时暴露 pipeline 阶段进度、模型可见 `text_delta`、结构化 tool capture 和错误事件。TUI 使用该回调展示实时进度；不订阅时旧调用方式保持不变。

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

- `src/lib/fortune/astro-day.ts` 为「日期 + 时区 + 目标星座」计算**可复现**当日星象底料（星期主行星、月相、太阳季、星座画像）+ 创意种子（creativeFocusDomain / creativeEmotionalWeather），注入每一段推理。`resolveCalendarDate` 解析显式 `date`/`timeZone`（缺省用 `X_AGENT_TIMEZONE` / 系统），同 `(date, sign)` 永远同结果。
- `parseSign` 从用户输入解析星座（中文名/别名/英文），无则回退当日太阳星座或「通用」。`parseDateFromText` 从 topic 抽取 `YYYY-MM-DD`。
- 「今日侧重域」(creativeFocusDomain) 按 `date+sign` 哈希轮换，是**创意种子、非命理事实**；每个变量经 `astroFactors()` 标注 `sourceLevel`+`confidence`（类型 `src/lib/fortune/types.ts`），`formatAstroDayBlock` 在 prompt 里显示来源，避免把创意种子当命理事实。
- 解读知识在 references：`astrology-signs.md`、`astrology-daily-engine.md`；**Seth 意识内核** `seth-consciousness-framework.md` 注入 diverge/draft/refine，把象征翻译成注意力/信念/概率线/选择点/当下力量点/小行动，refine 检查 agency framing 并去宿命化。对外口径不变（娱乐/非确定性），不逐字引用赛斯。
- **正文边界（public surface）**：Safety / Seth 是内部逻辑，不得泄漏到正文。`references/public-post-boundary.md` + `playful-fortune-voice.md` 注入 draft/refine；assemble 后 `src/lib/fortune/public-surface.ts` 检查 final，若混入「这不是预言/仅供娱乐/概率线不是固定」等内部术语，触发 `public_rewrite` 段重写为面向海外年轻中文用户的自然运势内容，仍泄漏则 `publishReadiness=draft`。默认非技术受众，禁止 cron/API/terminal 等黑话（除非明确技术受众）。
- **FortuneContext**：western / eastern（生肖年/节气/五行，`src/lib/fortune/eastern-day.ts`）/ seth / creative 四层底料统一为 `FortuneContext`（`src/lib/fortune/context.ts`，`resolveFortuneContext` + `formatFortuneContextForPrompt`），注入各段；TUI `/context` 看四层 + provenance，`/trace` 看逐段 stage trace（selectedReferences / scores / warnings）。

延迟取舍：每条推文约 5 次顺序模型调用（reasoning 模型较慢），换取运营级质量；usage 为各段求和。
Daily Fortune pipeline 会在 context、reference loading、understand、diverge、judge、draft、refine、finalize 以及可选 expand/public_rewrite 阶段发出进度事件；每个模型 stage 仍独立调用模型，并把可见 `text_delta` 透传给订阅方。

## 错误处理与模型配置

- 模型硬错误以 `stopReason: "error"/"aborted"` 返回；`pi-agent` 抛出真实原因（凭据未配置、OAuth 刷新失败等），不再用保底模板掩盖。
- progress callback 异常不会中断生成；runtime 会记录 `generate_progress_callback_failed` 或 `fortune_progress_callback_failed`。
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
- Progress event types：`src/lib/types.ts` 的 `GenerateProgressEvent` / `GenerateProgressOptions`
- Fortune 星象引擎：`src/lib/fortune/astro-day.ts`
- Fortune 5 段 pipeline：`src/lib/fortune/pipeline.ts`
- Fortune provenance 类型：`src/lib/fortune/types.ts`（FortuneSourceLevel / Confidence / FortuneFactor / FortuneContext / FortunePipelineTrace）
- FortuneContext + 序列化：`src/lib/fortune/context.ts`（resolveFortuneContext / formatFortuneContextForPrompt）
- Seth 意识 reference：`skills/daily-fortune-tweet/references/seth-consciousness-framework.md`
- 正文边界 guard：`src/lib/fortune/public-surface.ts`；references `public-post-boundary.md`、`playful-fortune-voice.md`
- Local skills：`skills/*/SKILL.md`
- Skill Runtime：`src/lib/skills/local-skills.ts`
- Credentials：`src/lib/pi-credentials.ts`
- Types：`src/lib/types.ts`
- Validation：`src/lib/validation.ts`
- Tests：`src/lib/__tests__/pi-agent.test.ts`、`src/lib/__tests__/validation.test.ts`、`src/lib/__tests__/skills.test.ts`、`src/lib/__tests__/daily-fortune-evals.test.ts`、`src/lib/fortune/__tests__/astro-day.test.ts`、`src/lib/fortune/__tests__/pipeline.test.ts`
- Skill eval specs：`skills/daily-fortune-tweet/evals/*.json`
- Eval runner：`scripts/eval-skills.ts`（形状校验 `eval:skills`）、`scripts/eval-fortune-run.ts`（`eval:fortune:mock` 离线自检 / `eval:fortune` 真跑 + LLM-judge）

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
- `generateTwitterCreative(input, { onProgress })` 能在单次路径和 Daily Fortune pipeline 中发出阶段事件，并保持无 callback 调用兼容。
- `field-present`：requiredFields 路径解析(a / a.b / a[].b)正负用例。
- `public-surface`：泄漏短语检测(正负)、技术受众识别、技术黑话扫描。
- `npm run eval:skills`：校验 skill eval specs 的规则配置完整性。
- `npm run eval:fortune:mock`：离线 harness 自检（确定性 fixture，无凭据，CI 守门）。
- `npm run eval:fortune`（本地，需凭据）：真跑 pipeline，规则 + LLM-judge 评真实输出，打印运营达标率。
