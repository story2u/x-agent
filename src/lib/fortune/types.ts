// Provenance vocabulary for fortune底料.
//
// Every fortune factor declares WHERE it comes from and HOW confident we are, so
// creative seeds (hash rotations) are never presented as astrology/命理 facts.
// Shared across astro-day (western), eastern-day (future), and FortuneContext.

export type FortuneSourceLevel =
  | "deterministic-calendar" // exact from the civil calendar (weekday, sun-sign season)
  | "traditional-symbolic" // a fixed traditional mapping (weekday planet, sign profile)
  | "approximate-astronomical" // computed but approximate (moon phase, solar terms)
  | "symbolic-mapping" // a curated symbol → meaning mapping (five elements, tarot)
  | "creative-rotation"; // a deterministic creative seed, NOT a fact (hash rotation)

export type FortuneConfidence = "high" | "medium" | "creative";

export interface FortuneFactor<T = string> {
  key: string;
  label: string;
  value: T;
  sourceLevel: FortuneSourceLevel;
  confidence: FortuneConfidence;
  note?: string;
}
