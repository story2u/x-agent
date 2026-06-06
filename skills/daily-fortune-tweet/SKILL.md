---
name: daily-fortune-tweet
description: Generate daily fortune-themed X/Twitter long posts and threads from user context. Use when the user asks for 今日运势, 运势推文, 星座, 生肖, fortune, horoscope, zodiac, daily luck, mystical copy, or reflective social content.
metadata:
  category: content
  domain: fortune
  language: zh-CN
  version: "1.0"
allowed-tools: finalize_twitter_creative
---

# 今日运势生成技能

## Goal

根据用户输入生成适合 X/Twitter 发布的“今日运势”文本内容。内容要有仪式感、画面感、情绪张力和可读性，不能只是简单罗列“财运好、桃花旺、注意休息”。

这个 skill 的目标不是做确定性预测，而是把“运势”包装成一种轻量的心理暗示、生活观察、情绪整理和行动提醒。

## Safety Positioning

今日运势内容必须遵守：

- 只能作为娱乐、灵感、反思、情绪陪伴或创意内容。
- 不得声称能够确定预测未来。
- 不得保证财运、感情、健康或事业结果。
- 不得提供具体投资、医疗、法律、赌博建议。
- 不得制造恐惧，例如“今天必有灾祸”“一定破财”“一定分手”。
- 可以使用“适合”“倾向”“提醒”“更像是”“今天的关键词是”等非确定性表达。
- 如涉及金钱，只能给出行为层面的温和提醒，例如“避免冲动消费”“先确认信息再下决定”。

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

## Depth Workflow

Do not immediately write the final post. First construct the fortune spine:

1. Identify the fortune theme: 财运 / 事业 / 感情 / 人际 / 学习 / 自我整理 / 综合运势.
2. Identify the emotional weather: 焦躁 / 犹豫 / 想突破 / 害怕损失 / 期待好运 / 需要稳定感.
3. Choose one symbolic image: 雾散 / 门半开 / 水面起风 / 钱袋漏风 / 新芽破土 / 灯亮在远处 / 桌面重新整理 / 旧消息浮出水面.
4. Build the core tension.
5. Define practical advice.
6. Draft the long tweet or thread.
7. Run the Safety and Quality Checklist.

## Writing Style

- 使用中文，除非用户明确要求英文。
- 有画面感，有一点神秘感，但不要装神弄鬼。
- 短句为主，适合手机阅读。
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
    "date": "string | null",
    "topic": "string",
    "audience": "string | null",
    "assumptions": ["string"]
  },
  "fortuneSpine": {
    "keyword": "string",
    "symbolicImage": "string",
    "emotionalWeather": "string",
    "coreTension": "string",
    "practicalAdvice": "string"
  },
  "longTweet": {
    "title": "string",
    "body": "string",
    "hashtags": ["string"]
  },
  "thread": [
    {
      "index": 1,
      "text": "string",
      "role": "hook | context | money | career | relationship | risk | ritual | cta"
    }
  ],
  "reviewNotes": {
    "safetyCheck": ["string"],
    "hypeCheck": ["string"],
    "publishReadiness": "draft | reviewed | publish-ready"
  }
}
```

If the user only asks for longTweet, still return an empty thread array.
If the user only asks for thread, still return longTweet with an empty body.
If both are requested, return both.

## Examples（目标质量范例）

以下是达到运营发布标准的范例。注意它们的共性：有钩子、有画面、非确定性表达、最后落到一个具体动作。新生成内容应达到或超过这个质量，但不要照抄措辞或意象。

### 范例 A · longTweet（财运）

今日财运 · 关键词「收口」

钱的事，今天别急着往外冲，更适合往回收一收。

不是让你抠，而是先把漏的地方补上：一笔没对上的账、一个忘了取消的订阅、一句没谈清的价钱。这些小口子平时不疼，攒到月底就是一道坎。

好运很少从天上掉下来，更多是你把已经到手的东西先稳稳接住。

今日动作：翻一笔你最近"懒得看"的账单，把它弄明白。今天不一定进账，但你会少漏一点——这就是今天的好运。

标签：#今日运势 #财运 #好运提醒

### 范例 B · thread（综合，节选 4 条）

1（hook）今日综合运势，关键词是「先慢半拍」。今天不是冲刺日，是对焦日——把模糊的地方看清楚，比多做一件事更值。
2（context）画面感像「雾正在散」：方向还没完全清楚，但轮廓已经能看见。别在雾里做最终决定。
3（risk）注意：情绪高点容易冲动承诺，今天说出口的"我可以"，明天可能要还。给自己留一个复核窗口。
4（cta）你最近卡在哪件事上？留言告诉我方向（财运 / 事业 / 感情），下一条帮你拆一个。

## Review Checklist

- Is the content framed as entertainment or reflection rather than deterministic prediction?
- Is there a clear daily keyword?
- Is there a symbolic image?
- Is the advice specific and actionable?
- Are money, health, love, and career claims non-deterministic?
- Are forbidden absolute claims removed?
- Is the long tweet publishable?
- Does the thread have clear progression?
- Are hashtags relevant and not spammy?
