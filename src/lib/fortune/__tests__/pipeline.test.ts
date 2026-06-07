import { describe, expect, it } from "vitest";
import { clampIndex, countChineseChars, MIN_LONG_TWEET_CHARS, needsLongTweetExpansion, normalizeLongTweetOpening, refBlock, reindexThread, resolveOutputType } from "@/lib/fortune/pipeline";
import type { DailyFortuneThreadItem, GenerateRequest } from "@/lib/types";

function req(outputType?: GenerateRequest["outputType"]): GenerateRequest {
  return { topic: "今日天秤座运势", audience: "海外中文年轻人", goal: "g", tone: "warm", outputType };
}

describe("resolveOutputType", () => {
  it("maps request output types to fortune output types", () => {
    expect(resolveOutputType(req("thread"))).toBe("thread");
    expect(resolveOutputType(req("both"))).toBe("both");
    expect(resolveOutputType(req("longTweet"))).toBe("longTweet");
    expect(resolveOutputType(req("tweet"))).toBe("longTweet");
    expect(resolveOutputType(req("review"))).toBe("longTweet");
    expect(resolveOutputType(req(undefined))).toBe("longTweet");
  });
});

describe("clampIndex", () => {
  it("keeps in-range values and floors floats", () => {
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(2.9, 5)).toBe(2);
  });

  it("clamps out-of-range and invalid values", () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(99, 5)).toBe(4);
    expect(clampIndex(Number.NaN, 5)).toBe(0);
  });
});

describe("reindexThread", () => {
  const make = (n: number): DailyFortuneThreadItem[] =>
    Array.from({ length: n }, (_, i) => ({ index: 99, text: `t${i}`, role: "concrete scene" as const }));

  it("reindexes from 1 and preserves content", () => {
    const out = reindexThread(make(3));
    expect(out.map((item) => item.index)).toEqual([1, 2, 3]);
    expect(out[0].text).toBe("t0");
    expect(out[2].role).toBe("concrete scene");
  });

  it("caps the thread at 8 items", () => {
    expect(reindexThread(make(12))).toHaveLength(8);
    expect(reindexThread(make(12)).at(-1)?.index).toBe(8);
  });
});

describe("refBlock", () => {
  const refs = [
    { title: "Astrology Signs", path: "skills/daily-fortune-tweet/references/astrology-signs.md", content: "  signs body  " },
    { title: "Hook Patterns", path: "skills/daily-fortune-tweet/references/hook-patterns.md", content: "hooks body" }
  ];

  it("selects refs by basename, trims, and labels with title", () => {
    const block = refBlock(refs, ["astrology-signs.md"]);
    expect(block).toContain("## Astrology Signs");
    expect(block).toContain("signs body");
    expect(block).not.toContain("hooks body");
  });

  it("joins multiple refs and skips missing ones", () => {
    const block = refBlock(refs, ["astrology-signs.md", "does-not-exist.md", "hook-patterns.md"]);
    expect(block).toContain("signs body");
    expect(block).toContain("hooks body");
    expect(block.split("---")).toHaveLength(2);
  });

  it("returns empty string when nothing matches", () => {
    expect(refBlock(refs, ["nope.md"])).toBe("");
  });
});

describe("countChineseChars", () => {
  it("counts only CJK characters", () => {
    expect(countChineseChars("abc 123 你好，世界")).toBe(4);
    expect(countChineseChars("")).toBe(0);
  });
});

describe("needsLongTweetExpansion", () => {
  const short = "字".repeat(MIN_LONG_TWEET_CHARS - 1);
  const atFloor = "字".repeat(MIN_LONG_TWEET_CHARS);

  it("flags short longTweet/both bodies", () => {
    expect(needsLongTweetExpansion("longTweet", short)).toBe(true);
    expect(needsLongTweetExpansion("both", short)).toBe(true);
  });

  it("passes bodies at or above the floor", () => {
    expect(needsLongTweetExpansion("longTweet", atFloor)).toBe(false);
  });

  it("never expands thread output (no long body expected)", () => {
    expect(needsLongTweetExpansion("thread", short)).toBe(false);
  });
});

describe("normalizeLongTweetOpening", () => {
  it("removes template keyword opening when a hook follows", () => {
    const body = `今日财运关键词：收口

今天不求暴富，先求别被小钱偷家。

关键词可以放后面再解释。`;

    expect(normalizeLongTweetOpening(body, "收口").startsWith("今天不求暴富")).toBe(true);
  });

  it("removes keyword openings even when the emitted keyword differs from the spine keyword", () => {
    const body = `今日财运关键词：补漏

别急着问今天会不会突然进账，先看看钱包有没有被自动续费偷家。

关键词后面再解释。`;

    expect(normalizeLongTweetOpening(body, "收口").startsWith("别急着问")).toBe(true);
  });

  it("keeps non-template openings unchanged", () => {
    const body = "今天不求暴富，先求别被小钱偷家。\n\n关键词是收口。";
    expect(normalizeLongTweetOpening(body, "收口")).toBe(body);
  });
});
