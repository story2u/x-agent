import type { CreativeJobStatus, GenerateRequest, Tone } from "@/lib/types";

const tones = new Set<Tone>(["sharp", "warm", "technical", "playful", "executive"]);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function parseGenerateRequest(input: unknown): GenerateRequest {
  if (!input || typeof input !== "object") {
    throw new Error("请求体必须是 JSON object。");
  }

  const record = input as Record<string, unknown>;
  const topic = cleanText(record.topic);
  const audience = cleanText(record.audience);
  const goal = cleanText(record.goal);
  const constraints = cleanText(record.constraints);
  const requestedTone = cleanText(record.tone, "sharp") as Tone;

  if (topic.length < 4) throw new Error("topic 至少需要 4 个字符。");
  if (audience.length < 2) throw new Error("audience 至少需要 2 个字符。");
  if (goal.length < 2) throw new Error("goal 至少需要 2 个字符。");
  if (!tones.has(requestedTone)) throw new Error("tone 不在允许范围内。");

  return {
    topic: topic.slice(0, 1000),
    audience: audience.slice(0, 300),
    goal: goal.slice(0, 300),
    tone: requestedTone,
    constraints: constraints.slice(0, 500),
    outputType: readOutputType(record.outputType),
    runMode: readRunMode(record.runMode),
    skillIds: readStringList(record.skillIds),
    referenceIds: readStringList(record.referenceIds),
    knowledgeSourceIds: readStringList(record.knowledgeSourceIds),
    toolIds: readStringList(record.toolIds)
  };
}

function readOutputType(value: unknown): GenerateRequest["outputType"] {
  if (value === "tweet" || value === "thread" || value === "review" || value === "longTweet" || value === "both") return value;
  return undefined;
}

function readRunMode(value: unknown): GenerateRequest["runMode"] {
  if (value === "draft" || value === "reviewed" || value === "publish-ready") return value;
  return undefined;
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

export function parseJobTransitionRequest(input: unknown): CreativeJobStatus {
  if (!input || typeof input !== "object") {
    throw new Error("请求体必须是 JSON object。");
  }

  const status = cleanText((input as Record<string, unknown>).status);
  if (status === "review" || status === "approved") return status;
  throw new Error("status 只允许 review 或 approved。");
}
