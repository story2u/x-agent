// Unified daily fortune context — consolidates the scattered prompt底料 into one
// provenance-tagged object (western / eastern / seth / creative). The eastern slot
// is intentionally empty until Slice 3. Built on Slice 1's astro-day engine so the
// western/creative factors keep their source-level + confidence labels.

import type { GenerateRequest } from "@/lib/types";
import type { FortuneContext, FortuneFactor } from "@/lib/fortune/types";
import { astroFactors, getAstroDay, parseDateFromText, parseSign, resolveCalendarDate, type AstroDay } from "@/lib/fortune/astro-day";

// Static Seth writing lens — a meaning layer, explicitly NOT a prediction engine.
const SETH_FACTORS: FortuneContext["seth"] = {
  meaningLens: {
    key: "meaningLens",
    label: "意义透镜",
    value: "把象征翻译成注意力/信念/选择点/小行动，解释为什么值得注意，而不是预测结果",
    sourceLevel: "symbolic-mapping",
    confidence: "creative",
    note: "Seth 写作透镜，非预测引擎"
  },
  agencyPrompt: {
    key: "agencyPrompt",
    label: "能动性提示",
    value: "把主动权还给读者：你正站在一个选择点上，今天的小动作会影响下一条分支",
    sourceLevel: "symbolic-mapping",
    confidence: "creative"
  },
  probabilityFrame: {
    key: "probabilityFrame",
    label: "概率框架",
    value: "未来是概率性的、可被注意力与选择影响；当下是力量点；情绪是信号不是命令",
    sourceLevel: "symbolic-mapping",
    confidence: "creative"
  }
};

/** Map a deterministic AstroDay into the western + creative layers of a FortuneContext. */
export function buildFortuneContext(astro: AstroDay): FortuneContext {
  const byKey = new Map(astroFactors(astro).map((factor) => [factor.key, factor]));
  const need = (key: string): FortuneFactor => {
    const factor = byKey.get(key);
    if (!factor) throw new Error(`missing astro factor: ${key}`);
    return factor;
  };

  const keywordSeed = astro.signProfile ? [astro.creativeFocusDomain, ...astro.signProfile.keywords] : [astro.creativeFocusDomain, astro.sunSeason];
  const keywordCandidates: FortuneFactor<string[]> = {
    key: "keywordCandidates",
    label: "关键词候选",
    value: Array.from(new Set(keywordSeed)).slice(0, 5),
    sourceLevel: "creative-rotation",
    confidence: "creative",
    note: "由侧重域 + 星座关键词派生的创意候选，非命理事实"
  };

  return {
    dateISO: astro.dateISO,
    timeZone: astro.timeZone,
    western: {
      weekdayPlanet: need("weekdayPlanet"),
      moonPhase: need("moonPhase"),
      sunSeason: need("sunSeason"),
      signProfile: byKey.get("signProfile")
    },
    eastern: undefined,
    seth: { ...SETH_FACTORS },
    creative: {
      focusDomain: need("creativeFocusDomain"),
      emotionalWeather: need("creativeEmotionalWeather"),
      keywordCandidates
    }
  };
}

/** Resolve the full FortuneContext from a request (date/timezone/sign all reproducible). */
export function resolveFortuneContext(input: GenerateRequest): { context: FortuneContext; astro: AstroDay } {
  const sign = parseSign(input.topic) ?? parseSign(input.audience);
  const { dateISO, timeZone } = resolveCalendarDate({ date: input.date ?? parseDateFromText(input.topic), timeZone: input.timeZone });
  const astro = getAstroDay(dateISO, sign, timeZone);
  return { context: buildFortuneContext(astro), astro };
}

function formatFactor(factor: FortuneFactor<string | string[]> | undefined): string | null {
  if (!factor) return null;
  const value = Array.isArray(factor.value) ? factor.value.join("、") : factor.value;
  return `${factor.label}: ${value} [${factor.sourceLevel}·${factor.confidence}]${factor.note ? `（${factor.note}）` : ""}`;
}

function section(title: string, factors: Array<FortuneFactor<string | string[]> | undefined>): string[] {
  const lines = factors.map(formatFactor).filter((line): line is string => Boolean(line));
  return lines.length ? [title, ...lines.map((line) => `- ${line}`)] : [];
}

/** Serialize a FortuneContext into a prompt block where every factor shows provenance. */
export function formatFortuneContextForPrompt(context: FortuneContext): string {
  const lines: string[] = [`日期: ${context.dateISO}（时区 ${context.timeZone}）`];
  lines.push(...section("【西方象征 western】", [context.western.weekdayPlanet, context.western.moonPhase, context.western.sunSeason, context.western.signProfile]));
  if (context.eastern) {
    lines.push(...section("【东方象征 eastern】", [context.eastern.zodiacYear, context.eastern.solarTerm, context.eastern.fiveElementHint, context.eastern.seasonalAdvice]));
  }
  lines.push(...section("【Seth 意识透镜 seth（写作透镜·非预测）】", [context.seth.meaningLens, context.seth.agencyPrompt, context.seth.probabilityFrame]));
  lines.push(...section("【创意种子 creative（非命理事实）】", [context.creative.focusDomain, context.creative.emotionalWeather, context.creative.keywordCandidates]));
  return lines.join("\n");
}
