import { describe, expect, it } from "vitest";
import { createDailyFortuneFallbackCreative } from "@/lib/pi-agent";
import type { GenerateRequest } from "@/lib/types";

const input: GenerateRequest = {
  topic: "今日财运如何",
  audience: "海外中文年轻人",
  goal: "生成今日运势",
  tone: "warm",
  outputType: "longTweet"
};

describe("daily fortune fallback artifact", () => {
  const creative = createDailyFortuneFallbackCreative(input);

  it("downgrades publishReadiness to draft (not operator-verified)", () => {
    expect(creative.dailyFortune?.reviewNotes.publishReadiness).toBe("draft");
  });

  it("zeroes every operatorCritique score", () => {
    const critique = creative.dailyFortune?.operatorCritique;
    expect(critique?.hookStrength).toBe(0);
    expect(critique?.specificity).toBe(0);
    expect(critique?.audienceFit).toBe(0);
    expect(critique?.emotionalResonance).toBe(0);
    expect(critique?.shareability).toBe(0);
    expect(critique?.saveWorthiness).toBe(0);
    expect(critique?.safety).toBe(0);
  });

  it("is explicitly marked as a fallback in rationale, safetyNotes, and reviewNotes", () => {
    expect(creative.rationale).toContain("Fallback artifact");
    expect(creative.safetyNotes.some((note) => note.includes("Fallback artifact"))).toBe(true);
    expect(creative.dailyFortune?.reviewNotes.safetyCheck.join(" ")).toContain("Fallback artifact");
  });
});
