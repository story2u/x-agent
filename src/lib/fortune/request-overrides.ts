import type { GenerateRequest, Tone } from "@/lib/types";

export const FORTUNE_DEFAULT_AUDIENCE = "海外年轻中文用户";
export const FORTUNE_DEFAULT_TONE: Tone = "playful";
export const FORTUNE_DEFAULT_OUTPUT_TYPE: NonNullable<GenerateRequest["outputType"]> = "longTweet";

const fortuneTriggers = [/今日运势/, /每日运势/, /运势/, /星座/, /生肖/, /幸运/, /财运/, /fortune/i, /horoscope/i, /zodiac/i, /daily luck/i, /玄学/];
const overseasYouthAudiences = [/海外中文年轻人/, /海外年轻中文用户/];
const playfulToneMarkers = [/轻松/, /玄学/, /玩梗/, /有梗/, /解压/, /松弛/, /好玩/];

export function isFortuneRequest(command: string): boolean {
  return fortuneTriggers.some((trigger) => trigger.test(command));
}

export function deriveFortuneRequestOverrides(command: string): Partial<GenerateRequest> {
  const overrides: Partial<GenerateRequest> = {};
  const fortuneRequest = isFortuneRequest(command);

  if (fortuneRequest) {
    overrides.audience = FORTUNE_DEFAULT_AUDIENCE;
    overrides.tone = FORTUNE_DEFAULT_TONE;
    overrides.outputType = FORTUNE_DEFAULT_OUTPUT_TYPE;
  }

  const audience = extractAudience(command) ?? extractKnownAudience(command);
  if (audience) overrides.audience = audience;

  const tone = extractTone(command);
  if (tone) overrides.tone = tone;

  const outputType = extractOutputType(command);
  if (outputType) overrides.outputType = outputType;

  return overrides;
}

function extractAudience(command: string): string | undefined {
  const patterns = [
    /受众\s*(?:是|为|=|：|:)?\s*([^，。；;,.、\n]+)/,
    /面向\s*([^，。；;,.、\n]+)/,
    /给\s*([^，。；;,.、\n]+?)\s*看/
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(command);
    const value = cleanupAudience(match?.[1]);
    if (value) return value;
  }
  return undefined;
}

function extractKnownAudience(command: string): string | undefined {
  return overseasYouthAudiences.map((pattern) => pattern.exec(command)?.[0]).find((value): value is string => Boolean(value));
}

function cleanupAudience(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/^(是|为)/, "")
    .split(/(?:语气|风格|输出|要求|目标)/)[0]
    .trim();
  return cleaned || undefined;
}

function extractTone(command: string): Tone | undefined {
  if (playfulToneMarkers.some((marker) => marker.test(command))) return "playful";
  if (/温柔|暖|柔和/.test(command)) return "warm";
  if (/犀利|尖锐|直接/.test(command)) return "sharp";
  if (/高管|管理层|executive/i.test(command)) return "executive";
  if (/技术|technical/i.test(command)) return "technical";
  return undefined;
}

function extractOutputType(command: string): GenerateRequest["outputType"] | undefined {
  if (/thread|串推/i.test(command)) return "thread";
  if (/长推文|长推|long post|longTweet/i.test(command)) return "longTweet";
  return undefined;
}
