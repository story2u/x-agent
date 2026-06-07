// Deterministic daily astrology engine for the daily-fortune-tweet skill.
//
// Why this exists: the previous runtime passed only topic/audience/tone to the
// model, so every "今日运势" had no real per-day variable and collapsed to the
// same theme. This module turns a (date, sign) pair into concrete, deterministic
// facts — weekday energy, moon phase, solar season, sign profile, and a rotated
// daily focus — that get injected into the generation prompt. Same (date, sign)
// always yields the same AstroDay; different days differ. No network, no
// randomness, so it is fully unit-testable.

export type ZodiacSign =
  | "白羊座"
  | "金牛座"
  | "双子座"
  | "巨蟹座"
  | "狮子座"
  | "处女座"
  | "天秤座"
  | "天蝎座"
  | "射手座"
  | "摩羯座"
  | "水瓶座"
  | "双鱼座";

export type Element = "火" | "土" | "风" | "水";
export type Modality = "基本" | "固定" | "变动";
export type MoonPhase = "新月" | "蛾眉月" | "上弦月" | "盈凸月" | "满月" | "亏凸月" | "下弦月" | "残月";
export type FocusDomain = "事业" | "财运" | "感情" | "自我";

export interface SignProfile {
  sign: ZodiacSign;
  english: string;
  element: Element;
  modality: Modality;
  rulingPlanet: string;
  keywords: string[];
  coreDrive: string;
  shadow: string;
}

export interface AstroDay {
  dateISO: string;
  weekday: string;
  weekdayPlanet: string;
  weekdayEnergy: string;
  moonPhase: MoonPhase;
  moonPhaseMeaning: string;
  sunSeason: ZodiacSign;
  sign: ZodiacSign | "通用";
  signProfile: SignProfile | null;
  focusDomain: FocusDomain;
  emotionalWeather: string;
  dailySeed: number;
}

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] as const;

// Traditional planetary rulers of the weekday — gives each day a real,
// repeating-but-varied tonal anchor the model can interpret.
const WEEKDAY_PLANETS: Array<{ planet: string; energy: string }> = [
  { planet: "太阳", energy: "自我与休整，把注意力收回到自己身上" }, // Sunday
  { planet: "月亮", energy: "情绪与节奏，照顾内在状态" }, // Monday
  { planet: "火星", energy: "行动与推进，但别硬冲" }, // Tuesday
  { planet: "水星", energy: "沟通与信息，把话说清楚" }, // Wednesday
  { planet: "木星", energy: "扩展与机会，保持开放但有边界" }, // Thursday
  { planet: "金星", energy: "关系与价值，关照喜欢的人和事" }, // Friday
  { planet: "土星", energy: "边界与收尾，把责任落到实处" } // Saturday
];

const SIGN_PROFILES: Record<ZodiacSign, SignProfile> = {
  白羊座: { sign: "白羊座", english: "Aries", element: "火", modality: "基本", rulingPlanet: "火星", keywords: ["开拓", "冲劲", "直接"], coreDrive: "想率先行动、证明自己", shadow: "急躁、容易因冲动透支" },
  金牛座: { sign: "金牛座", english: "Taurus", element: "土", modality: "固定", rulingPlanet: "金星", keywords: ["稳定", "积累", "感官"], coreDrive: "想要安全感和可掌控的节奏", shadow: "固执、回避变化" },
  双子座: { sign: "双子座", english: "Gemini", element: "风", modality: "变动", rulingPlanet: "水星", keywords: ["好奇", "沟通", "灵活"], coreDrive: "想收集信息、保持选择权", shadow: "分心、承诺难落地" },
  巨蟹座: { sign: "巨蟹座", english: "Cancer", element: "水", modality: "基本", rulingPlanet: "月亮", keywords: ["照顾", "归属", "记忆"], coreDrive: "想建立情感上的家与安全感", shadow: "情绪化、过度自我保护" },
  狮子座: { sign: "狮子座", english: "Leo", element: "火", modality: "固定", rulingPlanet: "太阳", keywords: ["表达", "热情", "被看见"], coreDrive: "想发光、想被真诚地认可", shadow: "好面子、怕被忽视" },
  处女座: { sign: "处女座", english: "Virgo", element: "土", modality: "变动", rulingPlanet: "水星", keywords: ["梳理", "务实", "改进"], coreDrive: "想把事情做对、把混乱理清", shadow: "苛责自己、陷在细节里" },
  天秤座: { sign: "天秤座", english: "Libra", element: "风", modality: "基本", rulingPlanet: "金星", keywords: ["平衡", "关系", "审美"], coreDrive: "想要公平、和谐与连接", shadow: "犹豫、为迁就而委屈自己" },
  天蝎座: { sign: "天蝎座", english: "Scorpio", element: "水", modality: "固定", rulingPlanet: "冥王星", keywords: ["深度", "专注", "转化"], coreDrive: "想要真实、深入与掌控", shadow: "多疑、不愿放手" },
  射手座: { sign: "射手座", english: "Sagittarius", element: "火", modality: "变动", rulingPlanet: "木星", keywords: ["远方", "意义", "自由"], coreDrive: "想探索更大的世界和意义", shadow: "好高骛远、承诺过头" },
  摩羯座: { sign: "摩羯座", english: "Capricorn", element: "土", modality: "基本", rulingPlanet: "土星", keywords: ["目标", "责任", "长期"], coreDrive: "想要成就和可被信赖的位置", shadow: "压抑、把价值绑在产出上" },
  水瓶座: { sign: "水瓶座", english: "Aquarius", element: "风", modality: "固定", rulingPlanet: "天王星", keywords: ["独立", "理念", "疏离"], coreDrive: "想保持独立、按自己的方式生活", shadow: "抽离、回避亲密" },
  双鱼座: { sign: "双鱼座", english: "Pisces", element: "水", modality: "变动", rulingPlanet: "海王星", keywords: ["共情", "想象", "流动"], coreDrive: "想要连接、慈悲与意义感", shadow: "边界模糊、容易逃避" }
};

// (startMonth, startDay) inclusive → sign. Standard tropical zodiac date ranges.
const SUN_SIGN_RANGES: Array<{ from: [number, number]; sign: ZodiacSign }> = [
  { from: [1, 20], sign: "水瓶座" },
  { from: [2, 19], sign: "双鱼座" },
  { from: [3, 21], sign: "白羊座" },
  { from: [4, 20], sign: "金牛座" },
  { from: [5, 21], sign: "双子座" },
  { from: [6, 22], sign: "巨蟹座" },
  { from: [7, 23], sign: "狮子座" },
  { from: [8, 23], sign: "处女座" },
  { from: [9, 23], sign: "天秤座" },
  { from: [10, 24], sign: "天蝎座" },
  { from: [11, 23], sign: "射手座" },
  { from: [12, 22], sign: "摩羯座" }
];

const FOCUS_DOMAINS: FocusDomain[] = ["事业", "财运", "感情", "自我"];

const EMOTIONAL_WEATHERS = [
  "想往前冲，但需要先稳一下",
  "外表平静，心里有点没说出口的事",
  "疲惫但不想停，怕一停就乱",
  "对一件事既期待又不太敢确认",
  "想被理解，又怕麻烦别人",
  "状态在回升，适合慢慢收拾心情",
  "信息有点多，需要先安静下来",
  "想要确定的答案，但今天答案还在路上"
];

// Aliases people actually type, mapped to the canonical sign.
const SIGN_ALIASES: Array<{ patterns: string[]; sign: ZodiacSign }> = [
  { patterns: ["白羊", "牡羊", "aries"], sign: "白羊座" },
  { patterns: ["金牛", "taurus"], sign: "金牛座" },
  { patterns: ["双子", "雙子", "gemini"], sign: "双子座" },
  { patterns: ["巨蟹", "cancer"], sign: "巨蟹座" },
  { patterns: ["狮子", "獅子", "leo"], sign: "狮子座" },
  { patterns: ["处女", "處女", "virgo"], sign: "处女座" },
  { patterns: ["天秤", "天平", "libra"], sign: "天秤座" },
  { patterns: ["天蝎", "天蠍", "scorpio"], sign: "天蝎座" },
  { patterns: ["射手", "人马", "人馬", "sagittarius"], sign: "射手座" },
  { patterns: ["摩羯", "魔羯", "山羊", "capricorn"], sign: "摩羯座" },
  { patterns: ["水瓶", "宝瓶", "寶瓶", "aquarius"], sign: "水瓶座" },
  { patterns: ["双鱼", "雙魚", "pisces"], sign: "双鱼座" }
];

/** Parse a zodiac sign out of free text (Chinese names, common aliases, English). */
export function parseSign(text: string | undefined): ZodiacSign | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  for (const { patterns, sign } of SIGN_ALIASES) {
    if (patterns.some((pattern) => lower.includes(pattern))) return sign;
  }
  return undefined;
}

/** Solar (sun) sign for a given date — the seasonal backdrop everyone shares. */
export function sunSignForDate(date: Date): ZodiacSign {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  // Walk ranges; a date before the first cutoff (Jan 1–19) belongs to 摩羯座.
  let current: ZodiacSign = "摩羯座";
  for (const { from, sign } of SUN_SIGN_RANGES) {
    const [fromMonth, fromDay] = from;
    if (month > fromMonth || (month === fromMonth && day >= fromDay)) {
      current = sign;
    }
  }
  return current;
}

const SYNODIC_MONTH = 29.530588853;
// Reference new moon: 2000-01-06 18:14 UTC.
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

const MOON_PHASES: Array<{ phase: MoonPhase; meaning: string }> = [
  { phase: "新月", meaning: "适合起念、定一个小目标，先别急着看结果" },
  { phase: "蛾眉月", meaning: "刚起步，给新计划一点耐心和保护" },
  { phase: "上弦月", meaning: "会遇到阻力，适合做一个具体的决定推进" },
  { phase: "盈凸月", meaning: "接近成形，调整细节比推倒重来更有用" },
  { phase: "满月", meaning: "情绪和结果都被放大，适合看见、释放，不适合冲动定论" },
  { phase: "亏凸月", meaning: "适合复盘和分享，把已有的东西消化掉" },
  { phase: "下弦月", meaning: "适合做减法，放下一个不再服务你的东西" },
  { phase: "残月", meaning: "适合收尾、休息，为下一轮腾出空间" }
];

/** Moon phase for a date, derived from the synodic cycle (deterministic). */
export function moonPhaseForDate(date: Date): { phase: MoonPhase; meaning: string } {
  const ageDays = (((date.getTime() - NEW_MOON_EPOCH_MS) / 86_400_000) % SYNODIC_MONTH + SYNODIC_MONTH) % SYNODIC_MONTH;
  // 8 equal-ish bins across the cycle.
  const index = Math.floor((ageDays / SYNODIC_MONTH) * 8) % 8;
  return MOON_PHASES[index];
}

/** Stable non-negative string hash (djb2) — used to rotate focus deterministically. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Build the deterministic daily astrology context.
 * @param date the day to read (local time).
 * @param sign target sign; omit/undefined → "通用" (uses the day's sun season for color).
 */
export function getAstroDay(date: Date, sign?: ZodiacSign | "通用"): AstroDay {
  const dateISO = toISODate(date);
  const weekdayIndex = date.getDay();
  const { planet, energy } = WEEKDAY_PLANETS[weekdayIndex];
  const { phase, meaning } = moonPhaseForDate(date);
  const sunSeason = sunSignForDate(date);
  const resolvedSign: ZodiacSign | "通用" = sign && sign !== "通用" ? sign : "通用";
  const signProfile = resolvedSign === "通用" ? null : SIGN_PROFILES[resolvedSign];

  // Rotate the day's emphasis deterministically by (date, sign) so the same sign
  // gets a different focus on different days, and different signs differ on the
  // same day — this is what breaks the old "every fortune = 补漏" homogeneity.
  const dailySeed = hashString(`${dateISO}|${resolvedSign}`);
  const focusDomain = FOCUS_DOMAINS[dailySeed % FOCUS_DOMAINS.length];
  const emotionalWeather = EMOTIONAL_WEATHERS[dailySeed % EMOTIONAL_WEATHERS.length];

  return {
    dateISO,
    weekday: WEEKDAYS[weekdayIndex],
    weekdayPlanet: planet,
    weekdayEnergy: energy,
    moonPhase: phase,
    moonPhaseMeaning: meaning,
    sunSeason,
    sign: resolvedSign,
    signProfile,
    focusDomain,
    emotionalWeather,
    dailySeed
  };
}

/** Render an AstroDay as a compact prompt block of deterministic facts. */
export function formatAstroDayBlock(astro: AstroDay): string {
  const lines = [
    `日期: ${astro.dateISO}（${astro.weekday}）`,
    `当日主行星(星期): ${astro.weekdayPlanet} — ${astro.weekdayEnergy}`,
    `月相: ${astro.moonPhase} — ${astro.moonPhaseMeaning}`,
    `太阳季节背景: ${astro.sunSeason}`,
    `目标星座: ${astro.sign}`,
    `今日侧重域(确定性轮换): ${astro.focusDomain}`,
    `情绪基调(确定性): ${astro.emotionalWeather}`
  ];
  if (astro.signProfile) {
    const profile = astro.signProfile;
    lines.push(
      `星座画像: ${profile.sign}（${profile.english}）｜元素 ${profile.element}｜模式 ${profile.modality}｜守护星 ${profile.rulingPlanet}`,
      `星座关键词: ${profile.keywords.join("、")}`,
      `核心驱动: ${profile.coreDrive}`,
      `阴影/张力: ${profile.shadow}`
    );
  }
  return lines.join("\n");
}

export { SIGN_PROFILES };
