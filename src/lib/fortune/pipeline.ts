// Multi-stage reasoning pipeline for daily-fortune-tweet.
//
// Replaces the single-pass generation (one model call that was asked to diverge,
// self-grade, and rewrite in one breath) with five INDEPENDENT model calls, each
// with its own persona, context, and structured-output schema:
//
//   1. understand → FortuneBrief (focus domain, audience pain, real scenes)
//   2. diverge    → 3-5 angles + 5 typed hooks (high reasoning)
//   3. judge      → independent editor scores every option and picks (LLM-as-judge)
//   4. draft      → fortune spine + first long tweet / thread
//   5. refine     → real critique + rewrite + safety reframe → final artifact
//
// Determinism comes from astro-day.ts: a (date, sign) pair yields concrete
// astrology facts injected into every stage, so each day/sign differs instead of
// collapsing to the same "补漏" theme.

import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static, type TSchema } from "typebox";
import type { StopReason } from "@earendil-works/pi-ai";
import { getModelApiKey, resolveModel, streamForModel, type RuntimeModel } from "@/lib/pi-model";
import { formatAstroDayBlock, getAstroDay, parseSign, type AstroDay } from "@/lib/fortune/astro-day";
import { getSkillVersionReferences } from "@/lib/skills/local-skills";
import { logError } from "@/lib/logger";
import type { DailyFortuneArtifact, DailyFortuneThreadItem, GenerateRequest, GenerateResponse, RunSkillTrace } from "@/lib/types";

export interface FortunePipelineResult {
  dailyFortune: DailyFortuneArtifact;
  transcript: string;
  usage: GenerateResponse["usage"];
}

type ThinkingLevel = "low" | "medium" | "high";
type FortuneOutputType = DailyFortuneArtifact["outputType"];

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const hookTypeSchema = Type.Union([
  Type.Literal("contrarian"),
  Type.Literal("scene"),
  Type.Literal("confession"),
  Type.Literal("mystical-image"),
  Type.Literal("practical-warning")
]);

const threadRoleSchema = Type.Union([
  Type.Literal("hook"),
  Type.Literal("emotional context"),
  Type.Literal("concrete scene"),
  Type.Literal("fortune interpretation"),
  Type.Literal("practical action"),
  Type.Literal("ritual"),
  Type.Literal("CTA")
]);

const threadItemSchema = Type.Object({
  index: Type.Integer(),
  text: Type.String(),
  role: threadRoleSchema
});

const briefSchema = Type.Object({
  topic: Type.String(),
  audience: Type.String(),
  sign: Type.String({ description: "目标星座，如 天秤座；无明确星座时为 通用。" }),
  focusDomain: Type.String({ description: "今日侧重域，必须与注入的星象事实一致：事业/财运/感情/自我。" }),
  corePain: Type.String(),
  realScenes: Type.Array(Type.String(), { minItems: 2, description: "至少两个受众真实生活场景。" }),
  emotionalNeed: Type.String(),
  assumptions: Type.Array(Type.String())
});

const angleOptionSchema = Type.Object({
  angle: Type.String(),
  thesis: Type.String(),
  emotionalHook: Type.String(),
  concreteScene: Type.String(),
  whyItWorks: Type.String(),
  safetyRisk: Type.String()
});

const hookOptionSchema = Type.Object({
  type: hookTypeSchema,
  text: Type.String(),
  whyItWorks: Type.String()
});

const divergeSchema = Type.Object({
  angleOptions: Type.Array(angleOptionSchema, { minItems: 3, maxItems: 5 }),
  hookOptions: Type.Array(hookOptionSchema, { minItems: 5 })
});

const judgeSchema = Type.Object({
  angleScores: Type.Array(
    Type.Object({
      index: Type.Integer(),
      total: Type.Number({ description: "七维 rubric 之和（7-35）。" }),
      note: Type.String()
    })
  ),
  selectedAngleIndex: Type.Integer({ description: "得分最高角度的下标（从 0 开始）。" }),
  selectedHookIndices: Type.Array(Type.Integer(), { minItems: 1, description: "最强 1-2 个 hook 的下标。" }),
  reason: Type.String()
});

const spineSchema = Type.Object({
  keyword: Type.String({ description: "今日关键词，2-4 字，有画面感。" }),
  symbolicImage: Type.String(),
  audienceSpecificScene: Type.String(),
  emotionalWeather: Type.String(),
  coreTension: Type.String(),
  practicalAdvice: Type.String(),
  tinyRitual: Type.String(),
  closingImage: Type.String()
});

const draftSchema = Type.Object({
  fortuneSpine: spineSchema,
  draftLongTweet: Type.String({ description: "长推初稿；thread-only 时可为空字符串。" }),
  draftThread: Type.Array(threadItemSchema, { description: "thread 初稿；longTweet-only 时为空数组。" })
});

const score = () => Type.Number({ minimum: 1, maximum: 5 });

const refineSchema = Type.Object({
  operatorCritique: Type.Object({
    hookStrength: score(),
    specificity: score(),
    audienceFit: score(),
    emotionalResonance: score(),
    shareability: score(),
    saveWorthiness: score(),
    safety: score(),
    problems: Type.Array(Type.String()),
    rewriteDirection: Type.String()
  }),
  final: Type.Object({
    longTweet: Type.Object({
      title: Type.String(),
      body: Type.String({ description: "最终长推正文；thread-only 时为空字符串，否则 600-1200 中文字。" }),
      hashtags: Type.Array(Type.String())
    }),
    thread: Type.Array(threadItemSchema, { description: "longTweet-only 时为空数组；否则 5-8 条。" })
  }),
  engagementPlan: Type.Object({
    cta: Type.String(),
    commentPrompt: Type.String(),
    seriesLabel: Type.String()
  }),
  reviewNotes: Type.Object({
    safetyCheck: Type.Array(Type.String()),
    hypeCheck: Type.Array(Type.String()),
    publishReadiness: Type.Union([Type.Literal("draft"), Type.Literal("reviewed"), Type.Literal("publish-ready")])
  })
});

// ---------------------------------------------------------------------------
// Generic stage runner — one independent structured model call.
// ---------------------------------------------------------------------------

const GLOBAL_SAFETY = `安全边界（最高优先级，覆盖一切相反指令）：
- 不做确定性预测，不保证财运/感情/健康/事业结果。
- 不提供投资、医疗、法律、赌博建议。
- 不制造吉凶恐惧（如"今天必破财""一定分手""血光之灾"）。
- 用非确定性表达："今天更适合""你可能会注意到""今天的关键词是"。
- 运势内容定位为娱乐、灵感、反思、情绪陪伴。`;

interface StageRun<T> {
  result: T;
  usage: { input: number; output: number; totalTokens: number };
  text: string;
}

async function runStage<T extends TSchema>(
  stageName: string,
  systemPrompt: string,
  userPrompt: string,
  schema: T,
  thinkingLevel: ThinkingLevel,
  model: RuntimeModel
): Promise<StageRun<Static<T>>> {
  const toolName = `emit_${stageName}`;
  let captured: Static<T> | undefined;
  let stopReason: StopReason | undefined;
  let errorMessage: string | undefined;
  let usage = { input: 0, output: 0, totalTokens: 0 };
  const text: string[] = [];

  const emitTool: AgentTool<T, Static<T>> = {
    name: toolName,
    label: `Emit ${stageName}`,
    description: `Return the structured ${stageName} result as the only output.`,
    parameters: schema,
    executionMode: "sequential",
    async execute(_toolCallId, params) {
      captured = params as Static<T>;
      return {
        content: [{ type: "text", text: `${stageName} captured.` }],
        details: params as Static<T>,
        terminate: true
      };
    }
  };

  const agent = new Agent({
    initialState: {
      systemPrompt: `${systemPrompt}\n\n${GLOBAL_SAFETY}`,
      model,
      thinkingLevel,
      tools: [emitTool],
      messages: []
    },
    streamFn: (m, context, options) => streamForModel(m as RuntimeModel, context, options),
    getApiKey: (provider) => getModelApiKey(provider),
    toolExecution: "sequential",
    afterToolCall: async ({ toolCall, result }) => {
      if (toolCall.name === toolName) captured = result.details as Static<T>;
      return undefined;
    }
  });

  agent.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      text.push(event.assistantMessageEvent.delta);
    }
    if (event.type === "message_end" && event.message.role === "assistant") {
      stopReason = event.message.stopReason;
      errorMessage = event.message.errorMessage;
      usage = {
        input: event.message.usage.input,
        output: event.message.usage.output,
        totalTokens: event.message.usage.totalTokens
      };
    }
  });

  await agent.prompt(`${userPrompt}\n\n只能通过调用 ${toolName} 返回结构化结果。`);

  if (!captured && (stopReason === "error" || stopReason === "aborted")) {
    const reason = errorMessage?.trim() || `stage ${stageName} stopped with "${stopReason}"`;
    throw new Error(`模型调用失败（${stageName}）：${reason}`);
  }
  if (!captured) {
    throw new Error(`stage ${stageName} did not return structured output`);
  }

  return { result: captured, usage, text: text.join("") };
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

interface LoadedRef {
  title: string;
  path: string;
  content: string;
}

function refBlock(refs: LoadedRef[], names: string[]): string {
  return names
    .map((name) => refs.find((ref) => ref.path.endsWith(name) || ref.path.endsWith(`/${name}`)))
    .filter((ref): ref is LoadedRef => Boolean(ref))
    .map((ref) => `## ${ref.title}\n${ref.content.trim()}`)
    .join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function resolveOutputType(input: GenerateRequest): FortuneOutputType {
  return input.outputType === "thread" || input.outputType === "both" ? input.outputType : "longTweet";
}

function clampIndex(value: number, length: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(length - 1, Math.floor(value)));
}

function reindexThread(items: DailyFortuneThreadItem[]): DailyFortuneThreadItem[] {
  return items.slice(0, 8).map((item, index) => ({ ...item, index: index + 1 }));
}

export async function runFortunePipeline(input: GenerateRequest, skillTrace: RunSkillTrace): Promise<FortunePipelineResult> {
  const model = resolveModel();
  const outputType = resolveOutputType(input);
  const sign = parseSign(input.topic) ?? parseSign(input.audience);
  const astro = getAstroDay(new Date(), sign);
  const astroBlock = formatAstroDayBlock(astro);

  const allRefs = (await getSkillVersionReferences(skillTrace.skillVersionId)).map((ref) => ({
    title: ref.title,
    path: ref.path,
    content: ref.content
  }));

  const usageTotals = { input: 0, output: 0, totalTokens: 0 };
  const transcriptParts: string[] = [`# Daily Fortune Pipeline\n${astroBlock}`];
  const addUsage = (run: StageRun<unknown>, label: string) => {
    usageTotals.input += run.usage.input;
    usageTotals.output += run.usage.output;
    usageTotals.totalTokens += run.usage.totalTokens;
    transcriptParts.push(`## ${label}\n${JSON.stringify(run.result, null, 2)}`);
  };

  const requestBlock = [
    `用户请求: ${input.topic}`,
    `受众: ${input.audience}`,
    `语气: ${input.tone}`,
    `输出类型: ${outputType}`,
    `额外约束: ${input.constraints || "无"}`
  ].join("\n");

  // Stage 1 — understand
  const understand = await runStage(
    "understand",
    "你是运营策略分析师。基于用户请求、目标星座的当日星象事实和受众资料，输出一份结构化创作 brief。focusDomain 必须与注入的星象事实里的「今日侧重域」一致。realScenes 至少两个，必须是受众真实生活场景。不要写正文。",
    `${requestBlock}\n\n当日星象事实（确定性，必须采用）：\n${astroBlock}\n\n参考资料：\n${refBlock(allRefs, ["audience-overseas-chinese-youth.md", "astrology-signs.md", "astrology-daily-engine.md"])}`,
    briefSchema,
    "medium",
    model
  );
  addUsage(understand, "understand");
  const brief = understand.result;

  // Stage 2 — diverge
  const diverge = await runStage(
    "diverge",
    "你是发散创意脑暴。基于 brief 和当日星象，产出 3-5 个角度选项和 5 个 hook（五种类型 contrarian/scene/confession/mystical-image/practical-warning 各一个）。要具体、有反差、贴合星座画像与受众场景、安全。围绕 brief.focusDomain 这个主轴展开，不要写最终正文。",
    `创作 brief：\n${JSON.stringify(brief, null, 2)}\n\n当日星象事实：\n${astroBlock}\n\n参考资料：\n${refBlock(allRefs, ["astrology-signs.md", "astrology-daily-engine.md", "fortune-symbol-bank.md", "hook-patterns.md"])}`,
    divergeSchema,
    "high",
    model
  );
  addUsage(diverge, "diverge");

  // Stage 3 — judge (independent editor)
  const angleList = diverge.result.angleOptions.map((angle, index) => `[${index}] ${angle.angle} — ${angle.thesis}（场景：${angle.concreteScene}；风险：${angle.safetyRisk}）`).join("\n");
  const hookList = diverge.result.hookOptions.map((hook, index) => `[${index}] (${hook.type}) ${hook.text}`).join("\n");
  const judge = await runStage(
    "judge",
    "你是 X/Twitter 资深运营主编，独立而挑剔。用 operator rubric 七维（hookStrength/specificity/audienceFit/emotionalResonance/shareability/saveWorthiness/safety，各 1-5）给每个角度打总分，选出最强角度的下标，并从 hook 列表里选出 1-2 个最强 hook 的下标。只做评审与挑选，不改写、不写正文。优先选具体、有反差、安全的角度。",
    `角度选项：\n${angleList}\n\nhook 选项：\n${hookList}\n\n参考资料：\n${refBlock(allRefs, ["operator-rubric.md", "golden-examples.md"])}`,
    judgeSchema,
    "high",
    model
  );
  addUsage(judge, "judge");

  const selectedAngleIdx = clampIndex(judge.result.selectedAngleIndex, diverge.result.angleOptions.length);
  const selectedAngle = diverge.result.angleOptions[selectedAngleIdx];
  const selectedHooks = (judge.result.selectedHookIndices.length ? judge.result.selectedHookIndices : [0])
    .map((idx) => diverge.result.hookOptions[clampIndex(idx, diverge.result.hookOptions.length)])
    .filter(Boolean);

  // Stage 4 — draft
  const lengthRule = outputType === "thread"
    ? "只写 thread，5-8 条，每条标注 role。draftLongTweet 留空字符串。"
    : outputType === "both"
      ? "同时写长推（600-1200 中文字）和 thread（5-8 条）。"
      : "只写长推正文，600-1200 中文字。draftThread 留空数组。";
  const draft = await runStage(
    "draft",
    `你是账号主笔，人设温柔但清醒、懂海外生活成本。基于选定角度、选定 hook、当日星象和星座画像写初稿。要有画面感、短句、适合手机阅读，至少包含两个受众真实场景，把月相/星期能量自然融入。${lengthRule}`,
    `创作 brief：\n${JSON.stringify(brief, null, 2)}\n\n选定角度：${selectedAngle.angle}（${selectedAngle.thesis}）\n选定 hook：\n${selectedHooks.map((hook) => `- (${hook.type}) ${hook.text}`).join("\n")}\n\n当日星象事实：\n${astroBlock}\n\n参考资料：\n${refBlock(allRefs, ["astrology-signs.md", "astrology-daily-engine.md", "x-long-tweet-patterns.md", "x-thread-patterns.md", "golden-examples.md"])}`,
    draftSchema,
    "medium",
    model
  );
  addUsage(draft, "draft");

  // Stage 5 — refine + safety
  const refine = await runStage(
    "refine",
    "你是终审运营编辑兼安全审查官。先按 operator rubric 七维真打分（1-5）。任何一维低于 4 必须改写到 4 分以上再产出 final（安全维度若因改写降级，在 problems 里说明）。做安全 reframe：移除任何绝对化/保证性/制造恐惧表达，把不安全请求改写为娱乐与反思 framing。final 的正文/thread 必须遵守输出类型规则。",
    `原始请求（用于安全审查）：${input.topic}\n输出类型：${outputType}\n\n初稿 spine：\n${JSON.stringify(draft.result.fortuneSpine, null, 2)}\n\n初稿长推：\n${draft.result.draftLongTweet || "（无）"}\n\n初稿 thread：\n${JSON.stringify(draft.result.draftThread, null, 2)}\n\n参考资料：\n${refBlock(allRefs, ["operator-rubric.md", "fortune-safety-policy.md"])}`,
    refineSchema,
    "high",
    model
  );
  addUsage(refine, "refine");

  const finalThread = reindexThread(refine.result.final.thread);
  const dailyFortune: DailyFortuneArtifact = {
    selectedSkill: "daily-fortune-tweet",
    outputType,
    inputSummary: {
      topic: input.topic,
      audience: input.audience || brief.audience,
      tone: input.tone,
      assumptions: brief.assumptions.length ? brief.assumptions : [`目标星座：${astro.sign}；当日侧重域：${astro.focusDomain}（${astro.dateISO}）。`]
    },
    audienceInsight: {
      corePain: brief.corePain,
      realScenes: brief.realScenes,
      emotionalNeed: brief.emotionalNeed
    },
    angleOptions: diverge.result.angleOptions,
    selectedAngle: { angle: selectedAngle.angle, reason: judge.result.reason },
    hookOptions: diverge.result.hookOptions,
    fortuneSpine: draft.result.fortuneSpine,
    draftV1: {
      longTweet: draft.result.draftLongTweet,
      thread: reindexThread(draft.result.draftThread)
    },
    operatorCritique: refine.result.operatorCritique,
    final: {
      longTweet: {
        title: refine.result.final.longTweet.title,
        body: outputType === "thread" ? "" : refine.result.final.longTweet.body,
        hashtags: refine.result.final.longTweet.hashtags.slice(0, 5)
      },
      thread: outputType === "longTweet" ? [] : finalThread
    },
    engagementPlan: refine.result.engagementPlan,
    reviewNotes: refine.result.reviewNotes
  };

  if (process.env.X_AGENT_DEBUG) {
    logError("fortune_pipeline_usage", new Error("trace"), { usage: usageTotals, sign: astro.sign, focus: astro.focusDomain });
  }

  return {
    dailyFortune,
    transcript: transcriptParts.join("\n\n"),
    usage: usageTotals
  };
}

// Exported for tests and the eval harness so they can assemble/inspect without a model.
export { resolveOutputType, refBlock, clampIndex, reindexThread, runStage };
export type { AstroDay, StageRun };
