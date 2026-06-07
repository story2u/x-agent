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
import { Type, type Static } from "typebox";
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
const cliArgs = process.argv.slice(2);
// Dry-run/mock: exercise the eval harness offline (no model, no credentials).
const mockMode = cliArgs.includes("--mock") || process.env.EVAL_FORTUNE_MODE === "mock";
const specFilter = cliArgs.find((arg) => !arg.startsWith("--"));
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

type JudgeResult = Static<typeof judgeSchema>;

/** Deterministic passing judge stub for mock/dry-run mode (no model call). */
function mockJudge(): JudgeResult {
  return {
    hookStrength: 5,
    specificity: 5,
    audienceFit: 5,
    emotionalResonance: 5,
    shareability: 5,
    saveWorthiness: 5,
    safety: 5,
    verdict: true,
    notes: "[mock] judge skipped (dry-run, no model)"
  };
}

/**
 * Deterministic fixture that passes every checkRules branch for the given spec.
 * Used by mock/dry-run mode so CI / credential-less environments can exercise the
 * full eval harness offline. NOT part of the generation pipeline.
 */
function mockFortune(spec: FortuneEvalSpec): DailyFortuneArtifact {
  const outputType = (spec.expect.outputType === "thread" || spec.expect.outputType === "both" ? spec.expect.outputType : "longTweet") as DailyFortuneArtifact["outputType"];
  const sign = spec.expect.expectSign ?? "今日";
  const scenes = ["信用卡账单和订阅扣费", "朋友局 AA 和跨境转账手续费", "跨时区会议和拖着没回的消息"];
  const sentences = [
    `今日${sign}运势更像是一个提醒，而不是预言。`,
    "今天的重点不是控制未来，而是把注意力收回到当下。",
    "你正站在一个选择点上：一个小动作，就能把概率线轻轻拨向更稳的方向。",
    `具体一点：${scenes[0]}、${scenes[1]}，都是今天最容易被忽略的小事。`,
    `还有${scenes[2]}，先看见它，再决定怎么回应。`,
    "这不是要你焦虑，而是把主动权重新放回你手里。",
    "今天的小仪式：选一件最容易被忽略的小事，在今天结束前把它收口。",
    "它不会立刻改变什么，但会让你更稳地接住接下来的事。"
  ];
  let body = sentences.join("");
  while (countChineseChars(body) < 620) body += sentences[2] + sentences[6];

  const thread: DailyFortuneArtifact["final"]["thread"] = [
    { index: 1, text: `今日${sign}运势：关键词是「收回注意力」。今天不是预言，是一个选择点。`, role: "hook" },
    { index: 2, text: `如果你最近在${scenes[2]}里反复消耗，累不是因为你不努力。`, role: "emotional context" },
    { index: 3, text: `具体看：${scenes[0]}、${scenes[1]}，都值得今天看一眼。`, role: "concrete scene" },
    { index: 4, text: "把象征落到当下：你正站在一个选择点上，不是命运的旁观者。", role: "fortune interpretation" },
    { index: 5, text: "今日小动作：挑一件最容易忽略的小事，今天结束前收口。", role: "practical action" },
    { index: 6, text: "小仪式：睡前把一件没说清的事，用三行写下来。", role: "ritual" },
    { index: 7, text: "你今天最想先收回注意力的是哪件事？留一个词。", role: "CTA" }
  ];

  return {
    selectedSkill: "daily-fortune-tweet",
    outputType,
    inputSummary: { topic: spec.input, audience: spec.request.audience, tone: spec.request.tone, assumptions: ["[mock] dry-run fixture"] },
    audienceInsight: { corePain: "想变好但被日常小事悄悄消耗", realScenes: scenes, emotionalNeed: "需要一种恢复掌控感的温和提醒" },
    angleOptions: [
      { angle: "把注意力收回来", thesis: "今天的好运感来自收回注意力", emotionalHook: "你不是不努力，是一直在替别人想", concreteScene: scenes[0], whyItWorks: "具体且安全", safetyRisk: "无" },
      { angle: "选择点而非命运", thesis: "今天是一个选择点", emotionalHook: "你可以拨动概率线", concreteScene: scenes[1], whyItWorks: "agency framing", safetyRisk: "无" },
      { angle: "小动作收口", thesis: "一个小动作改变下一步", emotionalHook: "别小看一件小事", concreteScene: scenes[2], whyItWorks: "落到行动", safetyRisk: "无" }
    ],
    selectedAngle: { angle: "把注意力收回来", reason: "[mock]" },
    hookOptions: [
      { type: "contrarian", text: "今天不是预言，是一个选择点。", whyItWorks: "反转预期" },
      { type: "scene", text: `打开${scenes[0]}前那几秒，就是今天的入口。`, whyItWorks: "场景代入" },
      { type: "confession", text: "我更愿意把好运理解成收回注意力的能力。", whyItWorks: "建立人格" },
      { type: "mystical-image", text: "今天像雾散到一半：方向能看见，但别硬冲。", whyItWorks: "意象" },
      { type: "practical-warning", text: "今天先别在情绪高点下决定，给自己一个选择点。", whyItWorks: "落到行动" }
    ],
    fortuneSpine: { keyword: "收回注意力", symbolicImage: "雾散到一半", audienceSpecificScene: scenes[2], emotionalWeather: "想被理解又怕麻烦别人", coreTension: "想快，但今天适合先收回", practicalAdvice: "挑一件小事今天收口", tinyRitual: "睡前三行写下一件没说清的事", closingImage: "把注意力轻轻放回自己身上" },
    draftV1: { longTweet: body, thread: outputType === "longTweet" ? [] : thread },
    operatorCritique: { hookStrength: 5, specificity: 5, audienceFit: 5, emotionalResonance: 5, shareability: 5, saveWorthiness: 5, safety: 5, problems: [], rewriteDirection: "[mock]" },
    final: {
      longTweet: { title: `今日${sign}运势｜收回注意力`, body: outputType === "thread" ? "" : body, hashtags: ["今日运势", sign, "选择点"] },
      thread: outputType === "longTweet" ? [] : thread
    },
    engagementPlan: { cta: "选一件今天要收回注意力的小事", commentPrompt: "你今天最想先收回注意力的是哪件事？", seriesLabel: "今日运势·选择点系列" },
    reviewNotes: { safetyCheck: ["[mock] 定位为娱乐与反思，非预测"], hypeCheck: ["[mock] 无保证性表达"], publishReadiness: "publish-ready" }
  };
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
  if (mockMode) console.log("(mock/dry-run mode — no model calls)");

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
    if (mockMode) {
      fortune = mockFortune(spec);
    } else {
      try {
        const result = await generateTwitterCreative(request);
        fortune = result.creative.dailyFortune;
        if (result.usage) console.log(`tokens: ${result.usage.totalTokens}`);
      } catch (error) {
        console.error(`  RUN FAILED: ${error instanceof Error ? error.message : String(error)}`);
        hardFailure = true;
        continue;
      }
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
      const scores: JudgeResult = mockMode ? mockJudge() : await judge(spec, fortune);
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
