import { describe, expect, it } from "vitest";
import {
  astroFactors,
  formatAstroDayBlock,
  getAstroDay,
  moonPhaseForDate,
  parseDateFromText,
  parseSign,
  resolveCalendarDate,
  sunSignForDate,
  type MoonPhase
} from "@/lib/fortune/astro-day";

const ALL_MOON_PHASES: MoonPhase[] = ["新月", "蛾眉月", "上弦月", "盈凸月", "满月", "亏凸月", "下弦月", "残月"];
const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);

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

describe("parseDateFromText", () => {
  it("extracts an ISO-ish date from free text", () => {
    expect(parseDateFromText("帮我写 2026-06-07 天秤座运势")).toBe("2026-06-07");
    expect(parseDateFromText("2026/6/7 的运势")).toBe("2026-06-07");
  });

  it("returns undefined for no/invalid date", () => {
    expect(parseDateFromText("今天的运势")).toBeUndefined();
    expect(parseDateFromText("2026-13-40")).toBeUndefined();
    expect(parseDateFromText(undefined)).toBeUndefined();
  });
});

describe("sunSignForDate (UTC-anchored)", () => {
  it("maps dates to the correct tropical sun sign", () => {
    expect(sunSignForDate(utc("2026-06-07"))).toBe("双子座");
    expect(sunSignForDate(utc("2026-01-01"))).toBe("摩羯座");
    expect(sunSignForDate(utc("2026-04-15"))).toBe("白羊座");
    expect(sunSignForDate(utc("2026-12-25"))).toBe("摩羯座");
    expect(sunSignForDate(utc("2026-09-23"))).toBe("天秤座");
  });
});

describe("moonPhaseForDate", () => {
  it("returns a valid, deterministic phase", () => {
    for (let day = 1; day <= 28; day++) {
      const iso = `2026-06-${String(day).padStart(2, "0")}`;
      expect(ALL_MOON_PHASES).toContain(moonPhaseForDate(utc(iso)).phase);
    }
    expect(moonPhaseForDate(utc("2026-06-07")).phase).toBe(moonPhaseForDate(utc("2026-06-07")).phase);
  });
});

describe("resolveCalendarDate", () => {
  it("uses an explicit ISO date verbatim", () => {
    expect(resolveCalendarDate({ date: "2026-06-07", timeZone: "Asia/Singapore" })).toEqual({ dateISO: "2026-06-07", timeZone: "Asia/Singapore" });
  });

  it("falls back to today (YYYY-MM-DD) without an explicit date, and does not throw on any timezone", () => {
    const r = resolveCalendarDate({ timeZone: "Asia/Tokyo" });
    expect(r.dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.timeZone).toBe("Asia/Tokyo");
    expect(() => resolveCalendarDate({ timeZone: "Not/AZone" })).not.toThrow();
  });
});

describe("getAstroDay", () => {
  it("is fully deterministic for the same (dateISO, sign)", () => {
    expect(getAstroDay("2026-06-07", "天秤座", "UTC")).toEqual(getAstroDay("2026-06-07", "天秤座", "UTC"));
  });

  it("attaches sign profile, weekday, and timezone", () => {
    const astro = getAstroDay("2026-06-07", "天秤座", "Asia/Singapore");
    expect(astro.sign).toBe("天秤座");
    expect(astro.signProfile?.element).toBe("风");
    expect(astro.signProfile?.rulingPlanet).toBe("金星");
    expect(astro.weekday).toBe("星期日"); // 2026-06-07 is a Sunday
    expect(astro.weekdayPlanet).toBe("太阳");
    expect(astro.timeZone).toBe("Asia/Singapore");
  });

  it("falls back to 通用 with no sign profile", () => {
    const astro = getAstroDay("2026-06-07");
    expect(astro.sign).toBe("通用");
    expect(astro.signProfile).toBeNull();
  });

  it("rotates creative seeds across days and differs across signs", () => {
    const domains = new Set<string>();
    const weathers = new Set<string>();
    for (let day = 1; day <= 14; day++) {
      const astro = getAstroDay(`2026-06-${String(day).padStart(2, "0")}`, "天秤座");
      domains.add(astro.creativeFocusDomain);
      weathers.add(astro.creativeEmotionalWeather);
    }
    expect(domains.size).toBeGreaterThanOrEqual(2);
    expect(weathers.size).toBeGreaterThanOrEqual(3);
    expect(getAstroDay("2026-06-07", "天秤座").dailySeed).not.toBe(getAstroDay("2026-06-07", "白羊座").dailySeed);
  });
});

describe("astroFactors (provenance)", () => {
  it("labels each factor with the correct source level and confidence", () => {
    const factors = astroFactors(getAstroDay("2026-06-07", "天秤座"));
    const by = (key: string) => factors.find((factor) => factor.key === key);
    expect(by("weekdayPlanet")).toMatchObject({ sourceLevel: "traditional-symbolic", confidence: "high" });
    expect(by("moonPhase")).toMatchObject({ sourceLevel: "approximate-astronomical", confidence: "medium" });
    expect(by("sunSeason")).toMatchObject({ sourceLevel: "deterministic-calendar", confidence: "high" });
    expect(by("creativeFocusDomain")).toMatchObject({ sourceLevel: "creative-rotation", confidence: "creative" });
    expect(by("creativeEmotionalWeather")).toMatchObject({ sourceLevel: "creative-rotation", confidence: "creative" });
    expect(by("signProfile")).toMatchObject({ sourceLevel: "traditional-symbolic", confidence: "medium" });
  });

  it("omits the sign profile factor when no sign is given", () => {
    expect(astroFactors(getAstroDay("2026-06-07")).find((factor) => factor.key === "signProfile")).toBeUndefined();
  });
});

describe("formatAstroDayBlock", () => {
  it("annotates provenance and marks creative seeds as non-facts", () => {
    const block = formatAstroDayBlock(getAstroDay("2026-06-07", "天秤座", "Asia/Singapore"));
    expect(block).toContain("时区 Asia/Singapore");
    expect(block).toContain("[deterministic-calendar·high]");
    expect(block).toContain("[creative-rotation·creative]");
    expect(block).toContain("非命理事实");
    expect(block).toContain("守护星 金星");
  });
});
