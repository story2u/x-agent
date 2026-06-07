import { describe, expect, it } from "vitest";
import {
  formatAstroDayBlock,
  getAstroDay,
  moonPhaseForDate,
  parseSign,
  sunSignForDate,
  type MoonPhase
} from "@/lib/fortune/astro-day";

const ALL_MOON_PHASES: MoonPhase[] = ["新月", "蛾眉月", "上弦月", "盈凸月", "满月", "亏凸月", "下弦月", "残月"];

describe("parseSign", () => {
  it("parses Chinese names and aliases", () => {
    expect(parseSign("今日天秤座运势")).toBe("天秤座");
    expect(parseSign("天平座今天怎么样")).toBe("天秤座");
    expect(parseSign("白羊 vs 牡羊")).toBe("白羊座");
    expect(parseSign("帮我写 Pisces 的今日运势")).toBe("双鱼座");
  });

  it("returns undefined when no sign is present", () => {
    expect(parseSign("今天财运如何")).toBeUndefined();
    expect(parseSign(undefined)).toBeUndefined();
  });
});

describe("sunSignForDate", () => {
  it("maps dates to the correct tropical sun sign", () => {
    expect(sunSignForDate(new Date(2026, 5, 7))).toBe("双子座"); // Jun 7
    expect(sunSignForDate(new Date(2026, 0, 1))).toBe("摩羯座"); // Jan 1 (before Jan 20)
    expect(sunSignForDate(new Date(2026, 3, 15))).toBe("白羊座"); // Apr 15
    expect(sunSignForDate(new Date(2026, 11, 25))).toBe("摩羯座"); // Dec 25
    expect(sunSignForDate(new Date(2026, 8, 23))).toBe("天秤座"); // Sep 23 boundary
  });
});

describe("moonPhaseForDate", () => {
  it("returns a valid phase for any date", () => {
    for (let day = 1; day <= 29; day++) {
      const { phase } = moonPhaseForDate(new Date(2026, 5, day));
      expect(ALL_MOON_PHASES).toContain(phase);
    }
  });

  it("is deterministic", () => {
    const a = moonPhaseForDate(new Date(2026, 5, 7));
    const b = moonPhaseForDate(new Date(2026, 5, 7));
    expect(a.phase).toBe(b.phase);
  });

  it("advances through the cycle over a synodic month", () => {
    const phases = new Set<MoonPhase>();
    for (let day = 0; day < 30; day++) {
      phases.add(moonPhaseForDate(new Date(2026, 0, 1 + day)).phase);
    }
    // A full lunar cycle should surface several distinct phases.
    expect(phases.size).toBeGreaterThanOrEqual(6);
  });
});

describe("getAstroDay", () => {
  it("is fully deterministic for the same (date, sign)", () => {
    const a = getAstroDay(new Date(2026, 5, 7), "天秤座");
    const b = getAstroDay(new Date(2026, 5, 7), "天秤座");
    expect(a).toEqual(b);
  });

  it("attaches a real sign profile for a named sign", () => {
    const astro = getAstroDay(new Date(2026, 5, 7), "天秤座");
    expect(astro.sign).toBe("天秤座");
    expect(astro.signProfile?.element).toBe("风");
    expect(astro.signProfile?.rulingPlanet).toBe("金星");
    expect(astro.weekday).toBe("星期日"); // 2026-06-07 is a Sunday
    expect(astro.weekdayPlanet).toBe("太阳");
  });

  it("falls back to 通用 with no sign profile", () => {
    const astro = getAstroDay(new Date(2026, 5, 7));
    expect(astro.sign).toBe("通用");
    expect(astro.signProfile).toBeNull();
  });

  it("rotates focus across days (breaks homogeneity)", () => {
    const domains = new Set<string>();
    const weathers = new Set<string>();
    for (let day = 1; day <= 14; day++) {
      const astro = getAstroDay(new Date(2026, 5, day), "天秤座");
      domains.add(astro.focusDomain);
      weathers.add(astro.emotionalWeather);
    }
    expect(domains.size).toBeGreaterThanOrEqual(2);
    expect(weathers.size).toBeGreaterThanOrEqual(3);
  });

  it("differs across signs on the same day", () => {
    const libra = getAstroDay(new Date(2026, 5, 7), "天秤座");
    const aries = getAstroDay(new Date(2026, 5, 7), "白羊座");
    expect(libra.dailySeed).not.toBe(aries.dailySeed);
  });
});

describe("formatAstroDayBlock", () => {
  it("renders deterministic facts including the sign profile", () => {
    const block = formatAstroDayBlock(getAstroDay(new Date(2026, 5, 7), "天秤座"));
    expect(block).toContain("月相:");
    expect(block).toContain("天秤座");
    expect(block).toContain("守护星 金星");
    expect(block).toContain("今日侧重域");
  });
});
