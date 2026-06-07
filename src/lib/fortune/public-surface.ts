// Public-surface guards for daily-fortune output.
//
// Internal safety / review / Seth-framework language must never reach the reader-facing
// post; technical jargon is banned unless the audience is explicitly technical. Pure +
// unit-tested, and shared by the pipeline (public_rewrite gate) and the eval harness so
// the forbidden lists have a single source of truth.

export interface PublicSurfaceIssue {
  phrase: string;
  reason: string;
}

// Internal review/safety/Seth language that must NOT appear in a public post.
export const PUBLIC_FORBIDDEN_PHRASES = [
  "把这条当作",
  "仅供娱乐",
  "娱乐与反思",
  "不是预测",
  "这不是预言",
  "不构成投资建议",
  "不保证",
  "安全提醒",
  "风险提示",
  "审查",
  "pipeline",
  "Seth",
  "情绪不是命令",
  "概率线不是固定"
];

// Technical jargon — banned in public content unless the audience is explicitly technical.
export const TECHNICAL_JARGON = [
  "AI 工具",
  "AI工具",
  "SaaS",
  "云服务",
  "cron",
  "logs",
  "API",
  "cloud",
  "dashboard",
  "productivity app",
  "builder",
  "debug",
  "terminal",
  "hotfix",
  "pending queue",
  "drain queue",
  "server",
  "on-call"
];

/** Phrases (forbidden by default) that leaked into reader-facing text. */
export function validatePublicPostSurface(text: string, forbidden: string[] = PUBLIC_FORBIDDEN_PHRASES, audience?: string): PublicSurfaceIssue[] {
  const phraseIssues = forbidden
    .filter((phrase) => text.includes(phrase))
    .map((phrase) => ({ phrase, reason: "internal review/safety language leaked into public post" }));
  const jargonIssues = isTechnicalAudience(audience) ? [] : findTechnicalJargon(text).map((phrase) => ({ phrase, reason: "technical jargon leaked into non-technical public post" }));
  return [...phraseIssues, ...jargonIssues];
}

/** True only when the audience explicitly asks for a technical readership. */
export function isTechnicalAudience(audience: string | undefined): boolean {
  if (!audience) return false;
  if (["技术", "程序员", "工程师"].some((marker) => audience.includes(marker))) return true;
  // Word-boundary match so "retail"/"campaign" are not misread as technical.
  return /\b(ai|technical|developers?|engineers?)\b/.test(audience.toLowerCase());
}

/** Technical jargon present in the text (case-insensitive). */
export function findTechnicalJargon(text: string): string[] {
  const lower = text.toLowerCase();
  return TECHNICAL_JARGON.filter((term) => lower.includes(term.toLowerCase()));
}
