#!/usr/bin/env tsx
//
// Real, model-in-the-loop quality gate for daily-fortune-tweet.
//
// Unlike scripts/eval-skills.ts (which only validates the SHAPE of eval specs),
// this harness actually RUNS the 5-stage pipeline on each eval input, then grades
// the real output with (1) deterministic rules and (2) an independent LLM-judge
// scoring the operator rubric. It prints a 运营达标率 (operator pass rate).
//
// Requires model credentials (.env). Run locally:  npm run eval:fortune [specId]

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Type } from "typebox";
import { generateTwitterCreative } from "../src/lib/pi-agent";
import { resolveModel } from "../src/lib/pi-model";
import { runStage } from "../src/lib/fortune/pipeline";
import type { DailyFortuneArtifact, GenerateRequest, Tone } from "../src/lib/types";

if (existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore malformed .env; shell-exported vars still apply
  }
}

interface FortuneEvalSpec {
  id: string;
  skill: string;
  input: string;
  request: { audience: string; goal: string; tone: string; outputType: string };
  expect: {
    outputType: string;
    minChineseChars?: number;
    minRealScenes?: number;
    requiredHookTypes?: string[];
    forbiddenPhrases: string[];
    minOperatorScore?: number;
    publishReadiness?: string[];
    expectSign?: string;
  };
}

const SCENE_KEYWORDS = [
  "账单", "订阅", "AA", "汇率", "跨境", "手续费", "咖啡", "外卖", "打车", "合租", "房租", "押金",
  "时差", "时区", "邮件", "会议", "签证", "面试", "加班", "消息", "聚会", "孤独", "想家", "存款"
];

const skillsRoot = process.env.X_AGENT_SKILLS_DIR ? path.resolve(process.env.X_AGENT_SKILLS_DIR) : path.join(process.cwd(), "skills");
const specFilter = process.argv[2];
const minPassRate = Number(process.env.EVAL_FORTUNE_MIN_PASS_RATE) || 0.6;

const judgeSchema = Type.Object({
  hookStrength: Type.Number({ minimum: 1, maximum: 5 }),
  specificity: Type.Number({ minimum: 1, maximum: 5 }),
  audienceFit: Type.Number({ minimum: 1, maximum: 5 }),
  emotionalResonance: Type.Number({ minimum: 1, maximum: 5 }),
  shareability: Type.Number({ minimum: 1, maximum: 5 }),
  saveWorthiness: Type.Number({ minimum: 1, maximum: 5 }),
  safety: Type.Number({ minimum: 1, maximum: 5 }),
  verdict: Type.Boolean({ description: "是否达到可发布的运营级质量（各维≥4 且安全）。" }),
  notes: Type.String()
});

interface RuleResult {
  name: string;
  ok: boolean;
  detail: string;
}

function countChineseChars(value: string) {
  return (value.match(/[一-鿿]/g) ?? []).length;
}

function contentFor(fortune: DailyFortuneArtifact): string {
  const long = fortune.final.longTweet.body;
  const thread = fortune.final.thread.map((item) => item.text).join("\n");
  return [long, thread].filter(Boolean).join("\n");
}

function checkRules(spec: FortuneEvalSpec, fortune: DailyFortuneArtifact): RuleResult[] {
  const rules: RuleResult[] = [];
  const content = contentFor(fortune);

  if (spec.expect.minChineseChars && spec.expect.outputType !== "thread") {
    const chars = countChineseChars(fortune.final.longTweet.body);
    rules.push({ name: "minChineseChars", ok: chars >= spec.expect.minChineseChars, detail: `${chars}/${spec.expect.minChineseChars}` });
  }

  const sceneHits = SCENE_KEYWORDS.filter((kw) => content.includes(kw));
  const minScenes = spec.expect.minRealScenes ?? 2;
  rules.push({ name: "realScenes", ok: sceneHits.length >= minScenes || fortune.audienceInsight.realScenes.length >= minScenes, detail: `body hits=${sceneHits.length}, insight=${fortune.audienceInsight.realScenes.length} (need ${minScenes})` });

  const hits = spec.expect.forbiddenPhrases.filter((phrase) => content.includes(phrase));
  rules.push({ name: "forbiddenPhrases", ok: hits.length === 0, detail: hits.length ? `FOUND: ${hits.join(", ")}` : "none" });

  if (spec.expect.requiredHookTypes) {
    const got = new Set(fortune.hookOptions.map((hook) => hook.type));
    const missing = spec.expect.requiredHookTypes.filter((type) => !got.has(type as never));
    rules.push({ name: "hookTypes", ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : "all 5" });
  }

  if (spec.expect.publishReadiness) {
    rules.push({ name: "publishReadiness", ok: spec.expect.publishReadiness.includes(fortune.reviewNotes.publishReadiness), detail: fortune.reviewNotes.publishReadiness });
  }

  if (spec.expect.expectSign) {
    rules.push({ name: "signMention", ok: content.includes(spec.expect.expectSign), detail: spec.expect.expectSign });
  }

  if (spec.expect.outputType === "thread" || spec.expect.outputType === "both") {
    const n = fortune.final.thread.length;
    rules.push({ name: "threadLength", ok: n >= 5 && n <= 8, detail: `${n} items` });
  }

  // Seth agency framing must be present; fatalistic language must be absent.
  const agencyMarkers = ["注意力", "选择点", "概率", "当下", "信念", "小动作", "小行动", "主动权", "收回"];
  const agencyHits = agencyMarkers.filter((marker) => content.includes(marker));
  rules.push({ name: "agencyFraming", ok: agencyHits.length >= 1, detail: agencyHits.length ? agencyHits.slice(0, 3).join("/") : "none" });

  const fatalism = ["命中注定", "无法改变", "必然失去", "不照做", "在劫难逃", "一定会发生"];
  const fatalHits = fatalism.filter((phrase) => content.includes(phrase));
  rules.push({ name: "noFatalism", ok: fatalHits.length === 0, detail: fatalHits.length ? `FOUND: ${fatalHits.join(", ")}` : "none" });

  return rules;
}

async function judge(spec: FortuneEvalSpec, fortune: DailyFortuneArtifact) {
  const content = contentFor(fortune);
  const { result } = await runStage(
    "eval_judge",
    "你是 X/Twitter 资深运营主编，独立、挑剔。对下面这条已成稿的运势内容按 operator rubric 七维打分（各 1-5），并给出 verdict：是否达到可发布的运营级质量（要求各维≥4 且安全、非确定性）。只评分，不改写。",
    `受众：${spec.request.audience}\n输出类型：${spec.expect.outputType}\n\n成稿内容：\n${content}\n\n关键词：${fortune.fortuneSpine.keyword}；角度：${fortune.selectedAngle.angle}`,
    judgeSchema,
    "low",
    resolveModel()
  );
  return result;
}

function readSpecs(): FortuneEvalSpec[] {
  const evalsDir = path.join(skillsRoot, "daily-fortune-tweet", "evals");
  if (!existsSync(evalsDir)) return [];
  return readdirSync(evalsDir)
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => JSON.parse(readFileSync(path.join(evalsDir, file), "utf8")) as FortuneEvalSpec)
    .filter((spec) => spec.skill === "daily-fortune-tweet")
    .filter((spec) => !specFilter || spec.id === specFilter);
}

async function main() {
  const specs = readSpecs();
  if (!specs.length) {
    console.error(specFilter ? `No fortune eval spec found: ${specFilter}` : "No daily-fortune eval specs found.");
    process.exit(1);
  }

  let passed = 0;
  let hardFailure = false;

  for (const spec of specs) {
    console.log(`\n=== ${spec.id} ===`);
    const request: GenerateRequest = {
      topic: spec.input,
      audience: spec.request.audience,
      goal: spec.request.goal,
      tone: spec.request.tone as Tone,
      outputType: spec.request.outputType as GenerateRequest["outputType"],
      runMode: "reviewed",
      skillIds: ["daily-fortune-tweet"]
    };

    let fortune: DailyFortuneArtifact | undefined;
    try {
      const result = await generateTwitterCreative(request);
      fortune = result.creative.dailyFortune;
      if (result.usage) console.log(`tokens: ${result.usage.totalTokens}`);
    } catch (error) {
      console.error(`  RUN FAILED: ${error instanceof Error ? error.message : String(error)}`);
      hardFailure = true;
      continue;
    }

    if (!fortune) {
      console.error("  NO dailyFortune artifact produced.");
      hardFailure = true;
      continue;
    }

    const rules = checkRules(spec, fortune);
    for (const rule of rules) console.log(`  [${rule.ok ? "PASS" : "FAIL"}] ${rule.name}: ${rule.detail}`);
    const rulesOk = rules.every((rule) => rule.ok);
    if (rules.some((rule) => rule.name === "forbiddenPhrases" && !rule.ok)) hardFailure = true;

    let judgeOk = false;
    try {
      const scores = await judge(spec, fortune);
      const dims = ["hookStrength", "specificity", "audienceFit", "emotionalResonance", "shareability", "saveWorthiness", "safety"] as const;
      const line = dims.map((dim) => `${dim}=${scores[dim]}`).join(" ");
      const minScore = spec.expect.minOperatorScore ?? 4;
      const allMeet = dims.every((dim) => scores[dim] >= minScore);
      judgeOk = scores.verdict && allMeet;
      console.log(`  judge: ${line}`);
      console.log(`  judge verdict: ${scores.verdict} | all>=${minScore}: ${allMeet} | ${scores.notes}`);
    } catch (error) {
      console.error(`  JUDGE FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }

    const ok = rulesOk && judgeOk;
    if (ok) passed += 1;
    console.log(`  => ${ok ? "达标" : "未达标"}`);
  }

  const rate = passed / specs.length;
  console.log(`\n运营达标率: ${passed}/${specs.length} = ${(rate * 100).toFixed(0)}%  (门槛 ${(minPassRate * 100).toFixed(0)}%)`);

  if (hardFailure || rate < minPassRate) {
    console.error(hardFailure ? "硬性失败（安全/结构/运行错误）。" : "达标率低于门槛。");
    process.exit(1);
  }
  console.log("fortune eval ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
