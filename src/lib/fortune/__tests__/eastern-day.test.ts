import { describe, expect, it } from "vitest";
import { getEasternDay } from "@/lib/fortune/eastern-day";

describe("getEasternDay", () => {
  it("is deterministic for the same date", () => {
    expect(getEasternDay("2026-06-07")).toEqual(getEasternDay("2026-06-07"));
  });

  it("computes the zodiac year with a 立春 boundary (approximate)", () => {
    expect(getEasternDay("2026-06-07").zodiacYear?.value).toBe("马年"); // 2026 → 马
    expect(getEasternDay("2026-01-15").zodiacYear?.value).toBe("蛇年"); // before 立春 → 2025 → 蛇
    expect(getEasternDay("2020-06-01").zodiacYear?.value).toBe("鼠年"); // calibration: 2020 = 鼠
  });

  it("marks zodiac year and solar term as approximate with a note", () => {
    const eastern = getEasternDay("2026-06-07");
    expect(eastern.zodiacYear?.sourceLevel).toBe("approximate-calendar");
    expect(eastern.zodiacYear?.confidence).toBe("medium");
    expect(eastern.zodiacYear?.note).toBeTruthy();
    expect(eastern.solarTerm?.sourceLevel).toBe("approximate-calendar");
    expect(eastern.solarTerm?.note).toBeTruthy();
  });

  it("picks the most recent solar term (wrapping early January to 冬至)", () => {
    expect(getEasternDay("2026-06-07").solarTerm?.value).toContain("芒种"); // Jun 6
    expect(getEasternDay("2026-03-25").solarTerm?.value).toContain("春分"); // Mar 21
    expect(getEasternDay("2026-01-03").solarTerm?.value).toContain("冬至"); // before 小寒 → wrap
  });

  it("maps season to a five element (symbolic)", () => {
    expect(getEasternDay("2026-03-15").fiveElementHint?.value).toContain("木"); // spring
    expect(getEasternDay("2026-06-15").fiveElementHint?.value).toContain("火"); // summer
    expect(getEasternDay("2026-09-15").fiveElementHint?.value).toContain("金"); // autumn
    expect(getEasternDay("2026-12-15").fiveElementHint?.value).toContain("水"); // winter
    expect(getEasternDay("2026-06-15").fiveElementHint?.sourceLevel).toBe("symbolic-mapping");
  });

  it("produces a seasonal action factor", () => {
    expect(getEasternDay("2026-06-07").seasonalAdvice?.value).toBeTruthy();
    expect(getEasternDay("2026-06-07").seasonalAdvice?.sourceLevel).toBe("symbolic-mapping");
  });
});
