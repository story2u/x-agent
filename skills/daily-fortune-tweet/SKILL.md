---
name: daily-fortune-tweet
description: Generate daily fortune-themed X/Twitter long posts and threads from user context. Use when the user asks for 今日运势, 运势推文, 星座, 生肖, fortune, horoscope, zodiac, daily luck, mystical copy, or reflective social content.
metadata:
  category: content
  domain: fortune
  system: astrology
  language: zh-CN
  version: "3.0"
allowed-tools: finalize_twitter_creative
---

# 今日运势运营级内容生产技能

## Goal

把“今日运势”从普通文案生成升级为运营级 X/Twitter 内容生产流水线。最终内容要像可发布的账号内容，而不是传统黄历摘要：有强开头、具体用户场景、反差、账号人格、互动设计、运营评分和必要的改写循环。

这个 skill 的目标不是做确定性预测，而是把“运势”包装成轻量的心理暗示、生活观察、情绪整理和行动提醒。

## Safety Positioning

今日运势内容必须遵守：

- 只能作为娱乐、灵感、反思、情绪陪伴或创意内容。
- 不得声称能够确定预测未来。
- 不得保证财运、感情、健康或事业结果。
- 不得提供具体投资、医疗、法律、赌博建议。
- 不得制造恐惧，例如“今天必有灾祸”“一定破财”“一定分手”。
- 可以使用“适合”“倾向”“提醒”“更像是”“今天的关键词是”等非确定性表达。
- 如涉及金钱，只能给出行为层面的温和提醒，例如“避免冲动消费”“先确认信息再下决定”“复核账单和订阅”。
- 如果用户要求“今天一定暴富”“稳赚”“必有贵人”，必须在安全审查中标记风险，并改写为娱乐/反思 framing。

## Astrology Grounding（星座与象征底料）

本技能以西方占星 + 东方象征为底料。运行时为「日期 + 时区 + 目标星座」生成可复现的 `FortuneContext`（实现见 `src/lib/fortune/context.ts`），底料分三类，每个因子都带来源等级与置信度（`sourceLevel` / `confidence`）：

1. Calendar / symbolic factors（西方）：星期主行星、月相、太阳季节背景、星座画像。
2. Eastern symbolic factors（东方）：生肖年、节气、五行当令、季节行动建议。
3. Creative seeds：今日侧重域、情绪基调、今日关键词候选。

目标星座：从用户输入解析（如「今日天秤座运势」→ 天秤座）；未指定时回退当日太阳星座或「通用」。

Creative seeds 由日期、星座和固定映射确定性生成，只用于内容多样性和创作主轴，**不是命理事实**，不得写成「星象证明今天一定会怎样」。今天写什么主轴由 `FortuneContext.creative.focusDomain` 提供方向，但它是创意种子（creative-rotation），不是预测结论。

解读规则见 references：`astrology-signs.md`（十二星座底料）、`astrology-daily-engine.md`（月相/星期/侧重域 → 当日基调）、`eastern-symbolic-calendar.md`（五行/节气/生肖 → 现代行动）。

象征只是情绪与行为的隐喻，不是命运开关（遵守 Safety Positioning）。

## Seth Consciousness Layer（意识解释内核）

象征系统（星座、月相、五行、节气、塔罗）只是镜子。本技能以 Seth 式意识框架作为**意义解释内核**（写作透镜，不是预测引擎），必须读取 `references/seth-consciousness-framework.md`，把象征翻译成：

- 注意力（今天适合放在哪里）
- 信念（哪个正在影响体验）
- 概率线 / 选择点（现在可以拨向哪边）
- 情绪信号（情绪在提示什么，不是命令）
- 当下力量点（改变从现在开始）
- 一个小行动（给下一条分支留一个更稳的入口）

要求：

- 最终文案必须体现上述至少一项（注意力 / 信念 / 概率线 / 当下力量点 / 选择点 / 小行动）。
- 把主动权还给读者，减少恐惧、增加能动性。
- 涉及财运时强调注意力回收 / 概率选择 / 行动提醒，而不是发财承诺。
- 禁止宿命化表达：命中注定、无法改变、一定会发生、必然失去、不照做就倒霉、在劫难逃。
- 不逐字引用赛斯原文，不归因具体话语（不写「赛斯说今天…」），对外口径仍是娱乐 / 非确定性。

## Public Post Boundary（正文边界）

Safety Positioning 和 Seth Consciousness Layer 都是**内部审查与解释逻辑**，不是 reader-facing 正文内容。最终 `final.longTweet.body` / `final.thread` 必须像自然发布的 X/Twitter 运势内容，不能像 AI 安全报告或心理学说明书（解读规则见 `references/public-post-boundary.md`、`references/playful-fortune-voice.md`）。

- `final.longTweet.body` / `final.thread` **禁止**出现：把这条当作、仅供娱乐、娱乐与反思、不是预测、这不是预言、不构成投资建议、不保证、安全提醒、风险提示、审查、Seth、pipeline、情绪不是命令、概率线不是固定。
- 出现这些话必须**重写**，不得直接发布。安全审查结论只写进 `reviewNotes`，不写进正文。
- 有风险的表达直接改写成安全但自然的运势说法，不向读者解释安全政策（不要写「这不是预言/仅供娱乐/不构成建议」）。
- 默认受众是**海外年轻中文用户**（娱乐 / 新奇 / 玩梗 / 解压 / 轻玄学），不是技术人。
- 除非用户明确指定技术人 / 程序员 / 工程师 / developer / engineer，否则正文**禁止**技术黑话：cron、logs、API、cloud、dashboard、terminal、hotfix、pending queue、drain queue、server、on-call。

## When To Use

Use this skill when the user asks for:

- 今日运势
- 每日运势
- 星座运势
- 生肖运势
- 财运推文
- 情感运势推文
- 事业运势推文
- 神秘学风格内容
- 占卜感社交内容
- Fortune-themed X/Twitter copy
- Horoscope-style thread
- Daily luck long tweet

## Workflow

运行时把这套流程编排为 **5 段独立的模型推理**（understand → diverge → judge → draft → refine），而不是一次成稿；角度判分与改写由独立的「运营主编」段真实执行（实现见 `src/lib/fortune/pipeline.ts`）。下面的步骤描述每段应产出的内容与质量标准。

Do not immediately write the final post. Produce the artifact through this sequence:

1. Read all loaded references before writing.
2. Build the Audience Insight Layer.
3. Mine 3-5 angle options.
4. Run Hook Lab with 5 hook options.
5. Choose the strongest angle and explain why.
6. Build the fortune spine.
7. Draft `draftV1`.
8. Score `draftV1` as an X/Twitter operator editor.
9. If any score is below 4, rewrite once before producing `final`.
10. Add engagement design and review notes.
11. Call `finalize_twitter_creative` with the full `dailyFortune` artifact.

## Audience Insight Layer

Before writing, identify the target user's hidden pain and emotional need.

For “海外中文年轻人”, include at least two concrete scenes unless the user explicitly asks for generic content. Consider:

- 房租、押金、合租分账
- 汇率换算
- 跨境转账手续费
- 订阅自动扣费
- 外卖、咖啡、打车小额支出
- 信用卡账单
- 朋友局 AA
- FOMO 消费
- 奖励自己式下单
- 想变好但钱悄悄流走的焦虑

Final content must include at least 2 real scenes from the audience's life. Do not leave these only in analysis.

## Angle Mining

Generate 3-5 angle options before final writing.

Each option must include:

- `angle`
- `thesis`
- `emotionalHook`
- `concreteScene`
- `whyItWorks`
- `safetyRisk`

Good angle patterns:

- “好运不是突然进账，而是少漏一点。”
- “今天不是扩张日，是收口日。”
- “财运不是玄学承诺，是你重新拿回选择权。”
- “小钱不小，它在偷走稳定感。”

Choose one angle with the strongest mix of specificity, emotional pull, and safety.

## Hook Lab

Generate 5 hook options before final writing:

- contrarian hook
- scene hook
- confession hook
- mystical image hook
- practical warning hook

Each hook option must be an object with:

- `type`: `contrarian | scene | confession | mystical-image | practical-warning`
- `text`
- `whyItWorks`

Avoid generic openings:

- 今日运势关键词：
- 今天你的财运是：
- 今日财运不错

These are only acceptable if followed by a strong contrast in the same opening sentence.

## Fortune Spine

Build a concise spine:

- keyword: 2-4 Chinese characters, memorable and visual.
- symbolicImage: one image such as 钱袋漏风 / 雾正在散 / 门半开 / 桌面重新整理.
- audienceSpecificScene: one concrete scene tied to the audience.
- emotionalWeather: the user's mood state.
- coreTension: the conflict between desire and reality.
- practicalAdvice: specific, behavioral, non-deterministic.
- tinyRitual: a small symbolic action, not superstition and not a promise.
- closingImage: a soft final image.

## Long Tweet Standard

When the user requests `longTweet`, the final body must be 600-1200 Chinese characters.

It must include:

- scroll-stopping hook
- 今日关键词
- symbolic image
- audience-specific scenes
- core tension
- practical action
- soft mystical closing
- engagement CTA

For `longTweet`, `final.longTweet.body` is the primary artifact. The top-level `tweet` field is only a short summary and must not replace the long post.

## Thread Standard

When the user requests `thread`, output 5-8 tweets.

Each thread item must have one of these roles:

- hook
- emotional context
- concrete scene
- fortune interpretation
- practical action
- ritual
- CTA

For `thread`, `final.thread` is the primary artifact. Each item should be independently readable and suitable for copying into X/Twitter as a thread.

## Operator Review

After `draftV1`, score it as an X/Twitter operator editor:

- hookStrength
- specificity
- audienceFit
- emotionalResonance
- shareability
- saveWorthiness
- safety

Each score is 1-5. If any score is below 4, rewrite once. The final artifact should have all scores at least 4 unless safety requires a publishability downgrade; explain any exception in `operatorCritique.problems`.

## Engagement Design

Final content must include one natural interaction design:

- comment prompt
- save-worthy checklist
- choose-one question
- tiny ritual
- series label
- follow-up invitation

Avoid spammy CTA such as “转发立刻发财” or “关注马上转运”.

## Writing Style

- 使用中文，除非用户明确要求英文。
- 有画面感，有一点神秘感，但不要装神弄鬼。
- 短句为主，适合手机阅读。
- 账号人格：温柔但清醒，懂生活成本，懂年轻人的自我拉扯。
- 不要像传统黄历复制文案。
- 不要使用绝对化表达。

Preferred phrases:

- “今天更适合……”
- “你要留意的是……”
- “好运不是突然降临，而是……”
- “今天的关键词是……”
- “别急着做最终决定。”
- “先把一个小漏洞补上。”

Avoid:

- “一定发财”
- “必有贵人”
- “灾祸临头”
- “稳赚”
- “马上脱单”
- “百分百”

## Output Contract

Return valid JSON in `dailyFortune`, then call `finalize_twitter_creative`.

```json
{
  "selectedSkill": "daily-fortune-tweet",
  "outputType": "longTweet | thread | both",
  "inputSummary": {
    "topic": "string",
    "audience": "string",
    "tone": "string",
    "assumptions": ["string"]
  },
  "audienceInsight": {
    "corePain": "string",
    "realScenes": ["string"],
    "emotionalNeed": "string"
  },
  "angleOptions": [
    {
      "angle": "string",
      "thesis": "string",
      "emotionalHook": "string",
      "concreteScene": "string",
      "whyItWorks": "string",
      "safetyRisk": "string"
    }
  ],
  "selectedAngle": {
    "angle": "string",
    "reason": "string"
  },
  "hookOptions": [
    {
      "type": "contrarian | scene | confession | mystical-image | practical-warning",
      "text": "string",
      "whyItWorks": "string"
    }
  ],
  "fortuneSpine": {
    "keyword": "string",
    "symbolicImage": "string",
    "audienceSpecificScene": "string",
    "emotionalWeather": "string",
    "coreTension": "string",
    "practicalAdvice": "string",
    "tinyRitual": "string",
    "closingImage": "string"
  },
  "draftV1": {
    "longTweet": "string",
    "thread": [
      {
        "index": 1,
        "text": "string",
        "role": "string"
      }
    ]
  },
  "operatorCritique": {
    "hookStrength": 1,
    "specificity": 1,
    "audienceFit": 1,
    "emotionalResonance": 1,
    "shareability": 1,
    "saveWorthiness": 1,
    "safety": 1,
    "problems": ["string"],
    "rewriteDirection": "string"
  },
  "final": {
    "longTweet": {
      "title": "string",
      "body": "string",
      "hashtags": ["string"]
    },
    "thread": [
      {
        "index": 1,
        "text": "string",
        "role": "string"
      }
    ]
  },
  "engagementPlan": {
    "cta": "string",
    "commentPrompt": "string",
    "seriesLabel": "string"
  },
  "reviewNotes": {
    "safetyCheck": ["string"],
    "hypeCheck": ["string"],
    "publishReadiness": "draft | reviewed | publish-ready"
  }
}
```

If the user only asks for longTweet, return `final.thread: []`.
If the user only asks for thread, return `final.longTweet.body: ""`.
If both are requested, return both.

## Review Checklist

- Is the content framed as entertainment or reflection rather than deterministic prediction?
- Does it include Audience Insight Layer in the artifact?
- Are there 3-5 angle options?
- Are there 5 hook options?
- Is there a clear selected angle?
- Is there a clear daily keyword?
- Is there a symbolic image?
- Does final content include at least 2 concrete audience scenes when relevant?
- Is the advice specific and actionable?
- Are money, health, love, and career claims non-deterministic?
- Are forbidden absolute claims removed?
- Does the content show Seth-style agency (注意力 / 信念 / 选择点 / 当下力量点 / 小行动 中至少一项) and avoid fatalism (命中注定 / 无法改变 / 一定会发生 / 必然失去 / 不照做就倒霉)?
- Is `operatorCritique` present with all scores 4 or above after rewrite?
- Is `engagementPlan` present and non-spammy?
- For longTweet, is `final.longTweet.body` the primary full content?
- For thread, does `final.thread` have 5-8 items with clear roles?
