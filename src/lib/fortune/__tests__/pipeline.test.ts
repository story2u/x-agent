import { describe, expect, it } from "vitest";
import { clampIndex, refBlock, reindexThread, resolveOutputType } from "@/lib/fortune/pipeline";
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
