// Lightweight, deterministic Eastern symbolic time layer for daily-fortune-tweet.
//
// MVP scope (Slice 3): Chinese zodiac year, solar term, seasonal five-element hint,
// and a seasonal action — all as symbolic底料, NOT a prediction system. Everything is
// honestly provenance-tagged (approximations are marked). No 干支日 / 八字 / 紫微 /
// 黄历宜忌 computation — those stay as reference-only for a later milestone.
//
// Pure and UTC-anchored (same convention as astro-day): same dateISO → same result.

import type { FortuneFactor } from "@/lib/fortune/types";

export interface EasternDayContext {
  zodiacYear?: FortuneFactor;
  solarTerm?: FortuneFactor;
  fiveElementHint?: FortuneFactor;
  seasonalAdvice?: FortuneFactor;
}

// (year - 4) % 12, calibrated so 2020 = 鼠.
const ZODIAC_ANIMALS = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"] as const;
// 立春 ≈ Feb 4 — the traditional 干支 year boundary. Popular 春节 usage differs by year,
// hence the approximate label on zodiacYear.
const LICHUN_MONTH = 2;
const LICHUN_DAY = 4;

// 24 solar terms with typical Gregorian dates (±1 day across years) + a modern,
// non-deterministic reading. Used as seasonal atmosphere, never as 吉凶.
const SOLAR_TERMS: Array<{ month: number; day: number; name: string; reading: string }> = [
  { month: 1, day: 6, name: "小寒", reading: "最冷前段，适合守住节奏、别硬撑" },
  { month: 1, day: 20, name: "大寒", reading: "岁末沉淀，适合收束、为新循环做准备" },
  { month: 2, day: 4, name: "立春", reading: "新的循环开始，适合先定一个小方向" },
  { month: 2, day: 19, name: "雨水", reading: "松动与滋润，适合让停滞的事重新流动" },
  { month: 3, day: 6, name: "惊蛰", reading: "蛰伏的事开始动，适合把想法说出口" },
  { month: 3, day: 21, name: "春分", reading: "昼夜平衡，适合校准节奏和优先级" },
  { month: 4, day: 5, name: "清明", reading: "清理与记得，适合整理与告别" },
  { month: 4, day: 20, name: "谷雨", reading: "播种后的等待，适合耐心打底" },
  { month: 5, day: 6, name: "立夏", reading: "能量上升，适合启动但留余地" },
  { month: 5, day: 21, name: "小满", reading: "将满未满，适合知足与收口" },
  { month: 6, day: 6, name: "芒种", reading: "该收的先收，别贪多" },
  { month: 6, day: 21, name: "夏至", reading: "到达顶点，适合看见而非硬冲" },
  { month: 7, day: 7, name: "小暑", reading: "渐热，适合给自己降温与留白" },
  { month: 7, day: 23, name: "大暑", reading: "最热时段，适合慢下来护住精力" },
  { month: 8, day: 8, name: "立秋", reading: "由盛转收，适合开始做减法" },
  { month: 8, day: 23, name: "处暑", reading: "暑气退场，适合收尾一件拖延的事" },
  { month: 9, day: 8, name: "白露", reading: "转凉，适合照看边界与身体" },
  { month: 9, day: 23, name: "秋分", reading: "再次平衡，适合复盘得失" },
  { month: 10, day: 8, name: "寒露", reading: "凉意加深，适合务实与取舍" },
  { month: 10, day: 24, name: "霜降", reading: "收敛，适合放下一个不再服务你的东西" },
  { month: 11, day: 8, name: "立冬", reading: "转入收藏，适合把重心收回内在" },
  { month: 11, day: 22, name: "小雪", reading: "安静积蓄，适合休整与储备" },
  { month: 12, day: 7, name: "大雪", reading: "深藏，适合专注少数重要的事" },
  { month: 12, day: 22, name: "冬至", reading: "转折点，适合安静重启" }
];

interface FiveElement {
  element: string;
  traits: string;
  action: string;
}

// Seasonal five-element (土 is the transitional element, not single-listed here — noted).
function fiveElementForMonth(month: number): FiveElement {
  if (month >= 2 && month <= 4) return { element: "木", traits: "生发、计划、启动", action: "开个小头、把一个想法写下来、约一次沟通" };
  if (month >= 5 && month <= 7) return { element: "火", traits: "表达、热度、情绪", action: "把话说清楚，别在情绪高点下决定或消费" };
  if (month >= 8 && month <= 10) return { element: "金", traits: "收口、规则、取舍", action: "取消、整理、设边界、复核细节" };
  return { element: "水", traits: "流动、信息、观察", action: "先观察、等一等、复盘消息再回应" };
}

function ordinal(month: number, day: number): number {
  return month * 100 + day;
}

/** Most recent solar term on/before the date (wrapping to 冬至 for early-January dates). */
function currentSolarTerm(month: number, day: number): { name: string; reading: string } {
  const target = ordinal(month, day);
  let best: { month: number; day: number; name: string; reading: string } | undefined;
  for (const term of SOLAR_TERMS) {
    const value = ordinal(term.month, term.day);
    if (value <= target && (!best || value > ordinal(best.month, best.day))) best = term;
  }
  // Before the first term of the year (大寒 1/20 onward) → wrap to the last term, 冬至.
  if (!best) return { name: "冬至", reading: "转折点，适合安静重启" };
  return { name: best.name, reading: best.reading };
}

/** Build the deterministic Eastern symbolic context for an explicit ISO date. */
export function getEasternDay(dateISO: string): EasternDayContext {
  const utc = new Date(`${dateISO}T12:00:00Z`);
  const year = utc.getUTCFullYear();
  const month = utc.getUTCMonth() + 1;
  const day = utc.getUTCDate();

  const beforeLichun = month < LICHUN_MONTH || (month === LICHUN_MONTH && day < LICHUN_DAY);
  const zodiacYearNumber = beforeLichun ? year - 1 : year;
  const animal = ZODIAC_ANIMALS[(((zodiacYearNumber - 4) % 12) + 12) % 12];

  const term = currentSolarTerm(month, day);
  const five = fiveElementForMonth(month);

  return {
    zodiacYear: {
      key: "zodiacYear",
      label: "生肖年",
      value: `${animal}年`,
      sourceLevel: "approximate-astronomical",
      confidence: "medium",
      note: "按立春≈2/4 近似；春节流派可能差一年"
    },
    solarTerm: {
      key: "solarTerm",
      label: "节气",
      value: `${term.name} — ${term.reading}`,
      sourceLevel: "approximate-astronomical",
      confidence: "medium",
      note: "近似日期表，±1 天"
    },
    fiveElementHint: {
      key: "fiveElementHint",
      label: "五行当令",
      value: `${five.element}（${five.traits}）：${five.action}`,
      sourceLevel: "symbolic-mapping",
      confidence: "medium",
      note: "按四季近似；土为过渡未单列"
    },
    seasonalAdvice: {
      key: "seasonalAdvice",
      label: "季节行动",
      value: `${term.name}前后，${five.element}当令：${five.action}`,
      sourceLevel: "symbolic-mapping",
      confidence: "creative"
    }
  };
}
