import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSkillMd } from "@/lib/skills/parse-skill";
import { validateSkillMd } from "@/lib/skills/validate-skill";
import { getSkillVersionReferences, resolveRuntimeSkill } from "@/lib/skills/local-skills";
import { recoverCreative } from "@/lib/pi-agent";

// Skill content is the on-disk source of truth (skills/<slug>/SKILL.md), not an in-code constant.
const DAILY_FORTUNE_SKILL_MD = readFileSync(
  fileURLToPath(new URL("../../../skills/daily-fortune-tweet/SKILL.md", import.meta.url)),
  "utf8"
);

describe("skill parser and validator", () => {
  it("parses daily fortune SKILL.md frontmatter", () => {
    const parsed = parseSkillMd(DAILY_FORTUNE_SKILL_MD);
    expect(parsed.frontmatter.name).toBe("daily-fortune-tweet");
    expect(parsed.frontmatter.description).toContain("Use when");
    expect(parsed.frontmatter["allowed-tools"]).toContain("finalize_twitter_creative");
    expect(parsed.body).toContain("今日运势运营级内容生产技能");
    expect(parsed.body).toContain("Audience Insight Layer");
    expect(parsed.body).toContain("Operator Review");
  });

  it("validates the seed daily fortune skill", () => {
    const result = validateSkillMd(DAILY_FORTUNE_SKILL_MD);
    expect(result.errors).toEqual([]);
    expect(result.status).toBe("valid");
  });

  it("loads daily fortune references into runtime trace", async () => {
    const trace = await resolveRuntimeSkill({
      topic: "帮我生成一条今日财运长推文，受众是海外中文年轻人",
      audience: "海外中文年轻人",
      goal: "生成长推文",
      tone: "warm",
      outputType: "longTweet"
    });
    const references = trace ? await getSkillVersionReferences(trace.skillVersionId) : [];

    expect(trace?.skillSlug).toBe("daily-fortune-tweet");
    expect(trace?.loadedReferences.map((reference) => reference.path)).toContain("skills/daily-fortune-tweet/references/golden-examples.md");
    expect(references.map((reference) => reference.path)).toContain("skills/daily-fortune-tweet/references/operator-rubric.md");
    expect(references.find((reference) => reference.path.endsWith("audience-overseas-chinese-youth.md"))?.content).toContain("信用卡账单");
  });

  it("rejects invalid skill names and missing sections", () => {
    const result = validateSkillMd(`---
name: Bad--Name
description: Tiny prompt
---

# Bad
`);
    expect(result.status).toBe("error");
    expect(result.errors.join(" ")).toContain("lowercase");
    expect(result.errors.join(" ")).toContain("Output Contract");
  });
});

describe("daily fortune output recovery", () => {
  it("converts strict Daily Fortune JSON into a TwitterCreative artifact", () => {
    const creative = recoverCreative(
      {
        topic: "今日运势",
        audience: "海外中文年轻人",
        goal: "生成长推文",
        tone: "warm",
        outputType: "longTweet"
      },
      JSON.stringify({
        selectedSkill: "daily-fortune-tweet",
        outputType: "longTweet",
        inputSummary: {
          topic: "今日财运",
          audience: "海外中文年轻人",
          tone: "warm",
          assumptions: ["用户未提供日期，使用今日集体运势。"]
        },
        audienceInsight: {
          corePain: "想存住钱，但小额支出和跨境费用让钱悄悄流走。",
          realScenes: ["信用卡账单拖到月底才看", "合租分账和朋友局 AA 还没算清"],
          emotionalNeed: "需要温和提醒重新拿回掌控感。"
        },
        angleOptions: [
          { angle: "好运是少漏一点", whyItWorks: "具体可执行。", safetyRisk: "避免承诺发财。" },
          { angle: "先收口再扩张", whyItWorks: "有反差。", safetyRisk: "避免投资建议。" },
          { angle: "小钱决定稳定感", whyItWorks: "贴近海外生活。", safetyRisk: "避免制造焦虑。" }
        ],
        selectedAngle: {
          angle: "好运是少漏一点",
          reason: "最贴近财运和用户痛点。"
        },
        hookOptions: [
          "今天的财运，不一定是多进一笔钱，而是少漏一笔钱。",
          "打开信用卡账单前那几秒，就是今天的财运入口。",
          "我更愿意把今天的好运理解成收口能力。",
          "今天的画面像一个漏风的钱袋。",
          "今天先别在情绪高点下单。"
        ],
        fortuneSpine: {
          keyword: "补漏",
          symbolicImage: "钱袋漏风",
          emotionalWeather: "期待好运",
          coreTension: "想赚钱，但今天先守住漏洞",
          practicalAdvice: "避免冲动消费，先确认信息再下决定"
        },
        draftV1: {
          longTweet: "今天更适合补漏洞。",
          thread: []
        },
        operatorCritique: {
          hookStrength: 4,
          specificity: 4,
          audienceFit: 4,
          emotionalResonance: 4,
          shareability: 4,
          saveWorthiness: 4,
          safety: 5,
          problems: [],
          rewriteDirection: "强化海外生活场景。"
        },
        final: {
          longTweet: {
            title: "今日财运",
            body: "今天更适合补漏洞，而不是追逐突然降临的好运。先确认信用卡账单、合租分账和朋友局 AA，再决定要不要出手。",
            hashtags: ["今日运势", "财运"]
          },
          thread: []
        },
        engagementPlan: {
          cta: "选择一个今天要补的小漏洞。",
          commentPrompt: "你今天最想补账单、订阅还是 AA？",
          seriesLabel: "今日运势补漏系列"
        },
        reviewNotes: {
          safetyCheck: ["娱乐性运势，不做确定性预测。"],
          hypeCheck: ["未承诺一定发财。"],
          publishReadiness: "reviewed"
        }
      })
    );

    expect(creative?.dailyFortune?.selectedSkill).toBe("daily-fortune-tweet");
    expect(creative?.tweet).toContain("补漏洞");
    expect(creative?.dailyFortune?.final.longTweet.body).toContain("信用卡账单");
    expect(creative?.dailyFortune?.operatorCritique.safety).toBe(5);
    expect(creative?.safetyNotes.join(" ")).not.toContain("稳赚");
  });
});
