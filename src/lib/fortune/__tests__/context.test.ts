import { describe, expect, it } from "vitest";
import { buildFortuneContext, formatFortuneContextForPrompt, resolveFortuneContext } from "@/lib/fortune/context";
import { getAstroDay } from "@/lib/fortune/astro-day";
import type { GenerateRequest } from "@/lib/types";

const req = (overrides: Partial<GenerateRequest> = {}): GenerateRequest => ({
  topic: "今日天秤座运势",
  audience: "海外中文年轻人",
  goal: "g",
  tone: "warm",
  date: "2026-06-07",
  timeZone: "Asia/Singapore",
  ...overrides
});

describe("resolveFortuneContext", () => {
  it("builds four provenance-tagged layers from the request", () => {
    const { context, astro } = resolveFortuneContext(req());
    expect(context.dateISO).toBe("2026-06-07");
    expect(context.timeZone).toBe("Asia/Singapore");
    expect(astro.sign).toBe("天秤座");
    expect(context.western.sunSeason.value).toBe(astro.sunSeason);
    expect(context.western.signProfile?.sourceLevel).toBe("traditional-symbolic");
    expect(context.western.moonPhase.sourceLevel).toBe("approximate-astronomical");
    expect(context.seth.meaningLens.sourceLevel).toBe("symbolic-mapping");
    expect(context.seth.agencyPrompt.confidence).toBe("creative");
    expect(context.creative.focusDomain.sourceLevel).toBe("creative-rotation");
    expect(context.creative.keywordCandidates.value.length).toBeGreaterThan(0);
    expect(context.eastern?.zodiacYear?.value).toContain("年");
    expect(context.eastern?.solarTerm).toBeTruthy();
    expect(context.eastern?.fiveElementHint).toBeTruthy();
  });

  it("is deterministic for the same request", () => {
    expect(resolveFortuneContext(req()).context).toEqual(resolveFortuneContext(req()).context);
  });

  it("every always-present factor carries sourceLevel + confidence", () => {
    const { context } = resolveFortuneContext(req());
    const factors = [
      context.western.weekdayPlanet,
      context.western.moonPhase,
      context.western.sunSeason,
      context.seth.meaningLens,
      context.seth.agencyPrompt,
      context.seth.probabilityFrame,
      context.creative.focusDomain,
      context.creative.emotionalWeather,
      context.creative.keywordCandidates
    ];
    for (const factor of factors) {
      expect(factor.sourceLevel).toBeTruthy();
      expect(factor.confidence).toBeTruthy();
    }
  });

  it("falls back to 通用 (no sign profile) when no sign is present", () => {
    const { context } = resolveFortuneContext(req({ topic: "今天财运如何", audience: "general" }));
    expect(context.western.signProfile).toBeUndefined();
  });
});

describe("buildFortuneContext", () => {
  it("maps an AstroDay deterministically", () => {
    const astro = getAstroDay("2026-06-07", "天秤座", "UTC");
    expect(buildFortuneContext(astro)).toEqual(buildFortuneContext(astro));
  });
});

describe("formatFortuneContextForPrompt", () => {
  it("renders the layers with provenance and non-fact markers", () => {
    const block = formatFortuneContextForPrompt(resolveFortuneContext(req()).context);
    expect(block).toContain("【西方象征 western】");
    expect(block).toContain("【Seth 意识透镜 seth（写作透镜·非预测）】");
    expect(block).toContain("【创意种子 creative（非命理事实）】");
    expect(block).toContain("[approximate-astronomical·medium]");
    expect(block).toContain("【东方象征 eastern】"); // populated in Slice 3
  });
});
