// Provenance vocabulary for fortune底料.
//
// Every fortune factor declares WHERE it comes from and HOW confident we are, so
// creative seeds (hash rotations) are never presented as astrology/命理 facts.
// Shared across astro-day (western), eastern-day (future), and FortuneContext.

export type FortuneSourceLevel =
  | "deterministic-calendar" // exact from the civil calendar (weekday, sun-sign season)
  | "approximate-calendar" // a typical/approximate calendar date table (solar terms, zodiac year by 立春)
  | "traditional-symbolic" // a fixed traditional mapping (weekday planet, sign profile)
  | "approximate-astronomical" // computed but approximate (moon phase)
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

// Unified daily fortune底料: western (computed/symbolic), eastern (Slice 3, optional),
// seth (writing lens), creative (rotation seeds). Every leaf is a provenance-tagged
// FortuneFactor so the prompt and trace never blur facts and creative seeds.
export interface FortuneContext {
  dateISO: string;
  timeZone: string;
  western: {
    weekdayPlanet: FortuneFactor;
    moonPhase: FortuneFactor;
    sunSeason: FortuneFactor;
    signProfile?: FortuneFactor;
  };
  eastern?: {
    zodiacYear?: FortuneFactor;
    solarTerm?: FortuneFactor;
    fiveElementHint?: FortuneFactor;
    seasonalAdvice?: FortuneFactor;
  };
  seth: {
    meaningLens: FortuneFactor;
    agencyPrompt: FortuneFactor;
    probabilityFrame: FortuneFactor;
  };
  creative: {
    focusDomain: FortuneFactor;
    emotionalWeather: FortuneFactor;
    keywordCandidates: FortuneFactor<string[]>;
  };
}

// Structured, per-stage debugging record. Holds summaries and artifact-level
// intermediates only — never the model's private reasoning text.
export interface FortunePipelineTrace {
  stage: "context" | "understand" | "diverge" | "judge" | "draft" | "refine" | "expand" | "finalize";
  summary: string;
  inputKeys: string[];
  outputKeys: string[];
  selectedReferences?: string[];
  scores?: Record<string, number>;
  warnings?: string[];
}
