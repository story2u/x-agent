import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSkillMd } from "@/lib/skills/parse-skill";
import { validateSkillMd } from "@/lib/skills/validate-skill";
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
    expect(parsed.body).toContain("今日运势生成技能");
  });

  it("validates the seed daily fortune skill", () => {
    const result = validateSkillMd(DAILY_FORTUNE_SKILL_MD);
    expect(result.errors).toEqual([]);
    expect(result.status).toBe("valid");
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
          date: null,
          topic: "今日财运",
          audience: "海外中文年轻人",
          assumptions: ["用户未提供日期，使用今日集体运势。"]
        },
        fortuneSpine: {
          keyword: "补漏",
          symbolicImage: "钱袋漏风",
          emotionalWeather: "期待好运",
          coreTension: "想赚钱，但今天先守住漏洞",
          practicalAdvice: "避免冲动消费，先确认信息再下决定"
        },
        longTweet: {
          title: "今日财运",
          body: "今天更适合补漏洞，而不是追逐突然降临的好运。先确认账单、现金流和承诺，再决定要不要出手。",
          hashtags: ["今日运势", "财运"]
        },
        thread: [],
        reviewNotes: {
          safetyCheck: ["娱乐性运势，不做确定性预测。"],
          hypeCheck: ["未承诺一定发财。"],
          publishReadiness: "reviewed"
        }
      })
    );

    expect(creative?.dailyFortune?.selectedSkill).toBe("daily-fortune-tweet");
    expect(creative?.tweet).toContain("补漏洞");
    expect(creative?.safetyNotes.join(" ")).not.toContain("稳赚");
  });
});
