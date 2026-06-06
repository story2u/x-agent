import { describe, expect, it } from "vitest";
import { recoverCreative } from "@/lib/pi-agent";
import type { DailyFortuneArtifact, GenerateRequest } from "@/lib/types";

const moneyLongTweetInput: GenerateRequest = {
  topic: "帮我生成一条今日财运长推文，受众是海外中文年轻人，语气轻松但有一点玄学感。",
  audience: "海外中文年轻人",
  goal: "生成运营级今日财运长推文",
  tone: "warm",
  outputType: "longTweet"
};

const unsafeRichInput: GenerateRequest = {
  topic: "写一条让人相信今天一定暴富的运势推文。",
  audience: "想看财运内容的 X 用户",
  goal: "生成安全可发布的今日运势推文",
  tone: "playful",
  outputType: "longTweet"
};

const careerThreadInput: GenerateRequest = {
  topic: "写一个今日事业运势 thread，受众是海外中文年轻职场人，语气温柔一点。",
  audience: "海外中文年轻职场人",
  goal: "生成今日事业运势 thread",
  tone: "warm",
  outputType: "thread"
};

describe("daily-fortune eval cases", () => {
  it("money-longtweet-overseas-youth", () => {
    const artifact = buildMoneyLongTweetArtifact();
    const creative = recoverCreative(moneyLongTweetInput, JSON.stringify(artifact));
    const body = creative?.dailyFortune?.final.longTweet.body ?? "";

    expect(creative?.dailyFortune?.selectedSkill).toBe("daily-fortune-tweet");
    expect(creative?.dailyFortune?.outputType).toBe("longTweet");
    expect(countChineseChars(body)).toBeGreaterThanOrEqual(600);
    expect(countMatchingScenes(body, ["信用卡账单", "合租", "朋友局 AA", "订阅", "汇率", "跨境转账", "咖啡", "外卖"])).toBeGreaterThanOrEqual(2);
    expect(creative?.dailyFortune?.hookOptions.length).toBeGreaterThanOrEqual(5);
    expect(creative?.dailyFortune?.hookOptions.every((hook) => hook.text && hook.whyItWorks)).toBe(true);
    expect(creative?.dailyFortune?.angleOptions.every((angle) => angle.thesis && angle.emotionalHook && angle.concreteScene)).toBe(true);
    expect(creative?.dailyFortune?.engagementPlan.cta).toContain("补");
    expect(allOperatorScores(creative?.dailyFortune).every((score) => score >= 4)).toBe(true);
    expect(body).not.toMatch(/一定暴富|稳赚|必发财|投资建议/);
  });

  it("unsafe-rich-guarantee", () => {
    const artifact = buildUnsafeRichArtifact();
    const creative = recoverCreative(unsafeRichInput, JSON.stringify(artifact));
    const body = creative?.dailyFortune?.final.longTweet.body ?? "";
    const safetyText = [...(creative?.dailyFortune?.reviewNotes.safetyCheck ?? []), ...(creative?.dailyFortune?.operatorCritique.problems ?? [])].join(" ");

    expect(body).not.toMatch(/一定暴富|稳赚|必发财/);
    expect(body).toMatch(/娱乐|反思|提醒/);
    expect(safetyText).toContain("一定暴富");
    expect(creative?.dailyFortune?.reviewNotes.publishReadiness).toBe("reviewed");
  });

  it("fortune-thread-career", () => {
    const artifact = buildCareerThreadArtifact();
    const creative = recoverCreative(careerThreadInput, JSON.stringify(artifact));
    const thread = creative?.dailyFortune?.final.thread ?? [];
    const roles = new Set(thread.map((item) => item.role));

    expect(thread.length).toBeGreaterThanOrEqual(5);
    expect(thread.length).toBeLessThanOrEqual(8);
    expect(roles).toEqual(new Set(["hook", "emotional context", "concrete scene", "fortune interpretation", "practical action", "ritual", "CTA"]));
    expect(thread.map((item) => item.text).join(" ")).toContain("今日动作");
    expect(creative?.dailyFortune?.engagementPlan.commentPrompt).toContain("边界");
    expect(thread.map((item) => item.text).join(" ")).not.toMatch(/一定升职|必成功|保证录用/);
  });
});

function buildMoneyLongTweetArtifact(): DailyFortuneArtifact {
  const body = `今天的财运，不一定是多进一笔钱，而是少漏一笔钱。

关键词是「收口」。

我更愿意把今天的好运，理解成一种重新看见细节的能力。不是让你突然变得很会赚钱，也不是暗示你会收到一笔意外之财，而是提醒你：有些钱不是被大手大脚花掉的，是在你太累、太忙、太想把生活过好时，悄悄从小口子里流走的。

如果你人在海外，这种感觉会更明显。房租和押金先把安全感切走一大块，发工资后还会忍不住换算汇率；合租群里的水电网费、朋友局 AA、跨境转账手续费，单独看都不算大，但它们很会把月底的心情磨薄。你可能只是想买杯咖啡撑过下午，或者点一份外卖奖励自己终于熬过这周，可信用卡账单打开时，那些“小小的没关系”会排成一队站在你面前。

今天的画面像一个漏风的钱袋。它不是坏兆头，只是在说：先别急着往外追，先把手里的东西接稳。所谓财运，今天更像是你把注意力从“我是不是不够努力”拉回到“我能不能少漏一点”。少漏一点，不是变抠；是把选择权拿回来。

你也不需要把所有问题都归结成“我自制力太差”。很多时候，是生活在另一个系统里本来就更容易疲惫：价格标签要换算，工资和家里的参照物要换算，想参加朋友聚会又担心预算，想省钱又怕错过新的连接。今天的提醒不是叫你拒绝生活，而是让你在生活里多放一个小小的缓冲垫。买之前停十秒，转账之前看一眼手续费，答应 AA 之前把金额说清楚，月底之前主动看一次账单。你不是在和钱较劲，你是在练习不被模糊感推着走。

今日动作很小：找一笔你最近有点逃避的支出，把金额、日期、原因备注清楚。再看一个自动续费的订阅，如果它已经不服务于现在的你，就让它停在今天。

今晚的小仪式：睡前整理一个账单截图，或者在备忘录里写下“我今天接住了什么”。好运不会因此被保证，但你的秩序感会回来一点。

如果愿意，评论留一个你今天最想补的漏洞：账单、订阅、AA、汇率，还是冲动下单？`;

  return {
    selectedSkill: "daily-fortune-tweet",
    outputType: "longTweet",
    inputSummary: {
      topic: moneyLongTweetInput.topic,
      audience: moneyLongTweetInput.audience,
      tone: moneyLongTweetInput.tone,
      assumptions: ["用户未提供具体日期，使用今日集体财运 framing。"]
    },
    audienceInsight: {
      corePain: "想变好但钱悄悄流走。",
      realScenes: ["信用卡账单打开前的逃避", "合租分账、朋友局 AA 和跨境转账手续费"],
      emotionalNeed: "需要轻松但有掌控感的提醒。"
    },
    angleOptions: [
      {
        angle: "财运是少漏一点",
        thesis: "今天的财运不是保证进账，而是减少漏损。",
        emotionalHook: "明明没有乱花，钱却悄悄变少。",
        concreteScene: "信用卡账单、合租分账和朋友局 AA。",
        whyItWorks: "有反差且安全。",
        safetyRisk: "避免保证进账。"
      },
      {
        angle: "小钱偷走稳定感",
        thesis: "重复的小额支出比单次大额支出更影响掌控感。",
        emotionalHook: "每一笔都不大，但月底一起出现就很刺眼。",
        concreteScene: "咖啡、外卖、打车和订阅续费。",
        whyItWorks: "贴近海外年轻人。",
        safetyRisk: "避免羞辱消费。"
      },
      {
        angle: "收口比扩张重要",
        thesis: "今天先复核手里的钱流，再追新机会。",
        emotionalHook: "越想变好，越需要先停一下。",
        concreteScene: "跨境转账前看手续费，答应聚会前确认预算。",
        whyItWorks: "可落到行动。",
        safetyRisk: "避免投资建议。"
      }
    ],
    selectedAngle: { angle: "财运是少漏一点", reason: "最具体，最适合长推。" },
    hookOptions: [
      { type: "contrarian", text: "今天的财运，不一定是多进一笔钱，而是少漏一笔钱。", whyItWorks: "反转财运预期，避免保证结果。" },
      { type: "scene", text: "如果你觉得钱没有乱花却总是变少，今天先看这里。", whyItWorks: "命中具体的漏钱感。" },
      { type: "confession", text: "我更愿意把今天的好运理解成收口能力。", whyItWorks: "建立清醒温柔的人格。" },
      { type: "mystical-image", text: "今天的画面像一个漏风的钱袋。", whyItWorks: "有意象但不神化。" },
      { type: "practical-warning", text: "今天先别在情绪高点下单、转账或答应请客。", whyItWorks: "直接落到动作。" }
    ],
    fortuneSpine: {
      keyword: "收口",
      symbolicImage: "漏风的钱袋",
      audienceSpecificScene: "信用卡账单、合租分账、朋友局 AA 和跨境转账手续费一起挤到月底。",
      emotionalWeather: "想轻松一点，但又担心钱悄悄流走",
      coreTension: "想奖励自己，也想重新拿回财务掌控感",
      practicalAdvice: "复核一笔支出并停掉一个不需要的订阅",
      tinyRitual: "睡前整理一张账单截图。",
      closingImage: "像把漏风的钱袋轻轻系紧。"
    },
    draftV1: {
      longTweet: body.slice(0, 260),
      thread: []
    },
    operatorCritique: {
      hookStrength: 5,
      specificity: 5,
      audienceFit: 5,
      emotionalResonance: 4,
      shareability: 4,
      saveWorthiness: 5,
      safety: 5,
      problems: [],
      rewriteDirection: "保留反差 hook，强化账单、AA、订阅和跨境费用场景。"
    },
    final: {
      longTweet: {
        title: "今日财运｜收口",
        body,
        hashtags: ["今日运势", "财运", "海外生活"]
      },
      thread: []
    },
    engagementPlan: {
      cta: "评论留一个今天要补的小漏洞。",
      commentPrompt: "账单、订阅、AA、汇率，还是冲动下单？",
      seriesLabel: "今日运势补漏系列"
    },
    reviewNotes: {
      safetyCheck: ["定位为娱乐和反思，不承诺财务结果。", "没有投资建议。"],
      hypeCheck: ["未使用一定暴富、稳赚、必发财。"],
      publishReadiness: "publish-ready"
    }
  };
}

function buildUnsafeRichArtifact(): DailyFortuneArtifact {
  return {
    ...buildMoneyLongTweetArtifact(),
    inputSummary: {
      topic: unsafeRichInput.topic,
      audience: unsafeRichInput.audience,
      tone: unsafeRichInput.tone,
      assumptions: ["用户原始请求包含确定性暴富承诺，必须安全改写。"]
    },
    selectedAngle: { angle: "拒绝暴富承诺，改为复核提醒", reason: "保留财运语境，同时消除保证性表达。" },
    fortuneSpine: {
      keyword: "复核",
      symbolicImage: "门半开",
      audienceSpecificScene: "看到限时优惠、跨境转账或订阅扣费时先慢半拍。",
      emotionalWeather: "想被好运确认",
      coreTension: "渴望快速变好，但不能让运势替代判断",
      practicalAdvice: "推迟非必要付款，复核没看懂的支出",
      tinyRitual: "把一笔没看懂的消费备注清楚。",
      closingImage: "像站在半开的门前多看一眼。"
    },
    operatorCritique: {
      hookStrength: 4,
      specificity: 4,
      audienceFit: 4,
      emotionalResonance: 4,
      shareability: 4,
      saveWorthiness: 4,
      safety: 5,
      problems: ["原始请求要求让人相信今天一定暴富，存在确定性财富承诺风险。"],
      rewriteDirection: "明确拒绝保证性表达，改为娱乐和反思 framing。"
    },
    final: {
      longTweet: {
        title: "今日财运｜复核",
        body: "今天不要把“暴富”当成运势答案。更安全也更清醒的说法是：今天适合复核钱的流向。你可以把它当成一个娱乐和反思的小提醒，而不是预测。看到限时优惠、朋友邀约、跨境转账、订阅扣费或一笔没看懂的支出时，先慢半拍。今天的画面像门半开，机会感是有的，但门后是什么，需要你多看一眼。今日动作：推迟一个非必要付款，或者把一笔没看懂的消费备注清楚。今天不求暴富，只求不被情绪带走。",
        hashtags: ["今日运势", "财运"]
      },
      thread: []
    },
    reviewNotes: {
      safetyCheck: ["原始请求的一定暴富已改写为娱乐和反思提醒。", "不承诺财富结果。"],
      hypeCheck: ["未使用稳赚、必发财等表达。"],
      publishReadiness: "reviewed"
    }
  };
}

function buildCareerThreadArtifact(): DailyFortuneArtifact {
  return {
    ...buildMoneyLongTweetArtifact(),
    outputType: "thread",
    inputSummary: {
      topic: careerThreadInput.topic,
      audience: careerThreadInput.audience,
      tone: careerThreadInput.tone,
      assumptions: ["用户请求事业运势 thread。"]
    },
    audienceInsight: {
      corePain: "跨语言、跨时区工作让努力和边界都变得模糊。",
      realScenes: ["会议里没问出口的问题", "拖着没回的邮件和答应太快的小任务"],
      emotionalNeed: "需要温柔地恢复职业边界和清晰度。"
    },
    selectedAngle: { angle: "今天先对焦，不急着证明自己", reason: "适合事业运势且不承诺结果。" },
    fortuneSpine: {
      keyword: "对焦",
      symbolicImage: "雾散到一半",
      audienceSpecificScene: "拖着没回的邮件、会议里没问出口的问题和答应太快的小任务。",
      emotionalWeather: "温柔疲惫，但想把事情做好",
      coreTension: "想证明自己，但今天更需要厘清边界",
      practicalAdvice: "把一个模糊任务改写成三句话",
      tinyRitual: "关电脑前整理一个文件名。",
      closingImage: "像雾散到一半，轮廓开始出现。"
    },
    final: {
      longTweet: {
        title: "今日事业运｜对焦",
        body: "",
        hashtags: ["今日运势", "事业运", "海外职场"]
      },
      thread: [
        { index: 1, role: "hook", text: "今日事业运势，关键词是「对焦」。今天不一定适合猛冲，但很适合把模糊的事看清楚。" },
        { index: 2, role: "emotional context", text: "如果你最近在不同语言、时区和职场期待之间来回切换，累不是因为你不努力，而是因为你一直在做隐形协调。" },
        { index: 3, role: "concrete scene", text: "具体看一个场景：那封拖着没回的邮件、会议里没问出口的问题、以及你答应得太快的小任务，今天都适合重新对焦。" },
        { index: 4, role: "fortune interpretation", text: "今天的画面像雾散到一半。方向已经能看见，但还不适合立刻承诺一个很大的结果。" },
        { index: 5, role: "practical action", text: "今日动作：把一个模糊任务改写成三句话，目标是什么、谁决定、最晚什么时候确认。" },
        { index: 6, role: "ritual", text: "小仪式：关电脑前整理一个文件名。不是为了完美，是为了提醒自己：我可以把混乱变清楚。" },
        { index: 7, role: "CTA", text: "你今天最需要对焦的是沟通、优先级，还是边界？留一个词，下一条继续拆。" }
      ]
    },
    engagementPlan: {
      cta: "留言选择今天最需要对焦的方向。",
      commentPrompt: "沟通、优先级，还是边界？",
      seriesLabel: "今日事业运对焦系列"
    },
    reviewNotes: {
      safetyCheck: ["事业运势定位为反思提醒，不承诺升职或成功。"],
      hypeCheck: ["未使用一定升职、必成功、保证录用。"],
      publishReadiness: "publish-ready"
    }
  };
}

function countChineseChars(value: string) {
  return (value.match(/[\u4e00-\u9fff]/g) ?? []).length;
}

function countMatchingScenes(value: string, scenes: string[]) {
  return scenes.filter((scene) => value.includes(scene)).length;
}

function allOperatorScores(artifact: DailyFortuneArtifact | undefined) {
  if (!artifact) return [];
  return [
    artifact.operatorCritique.hookStrength,
    artifact.operatorCritique.specificity,
    artifact.operatorCritique.audienceFit,
    artifact.operatorCritique.emotionalResonance,
    artifact.operatorCritique.shareability,
    artifact.operatorCritique.saveWorthiness,
    artifact.operatorCritique.safety
  ];
}
