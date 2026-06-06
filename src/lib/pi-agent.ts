import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { Context, Model, SimpleStreamOptions, StopReason } from "@earendil-works/pi-ai";
import { getPiApiKey } from "@/lib/pi-credentials";
import { logError } from "@/lib/logger";
import { hideNodeVersionDuringPiOAuthImport } from "@/lib/pi-oauth-runtime";
import {
  compileSkillPrompt,
  getSkillVersionSkillMd,
  resolveRuntimeSkill
} from "@/lib/skills/local-skills";
import type { DailyFortuneArtifact, GenerationReference, GenerateRequest, GenerateResponse, RunSkillTrace, TwitterCreative } from "@/lib/types";

const SYSTEM_PROMPT = `You are a Twitter/X creative agent.

Your job:
- Generate publishable X/Twitter text that respects the user's audience, goal, tone, and constraints.
- When a skill is provided, follow its workflow and Output Contract exactly.

Rules:
- The "tweet" field is a standalone post and must stay under 280 characters.
- For long-form output (longTweet/thread), put the full content in the structured artifact (e.g. dailyFortune.longTweet.body and dailyFortune.thread); do not compress everything to fit 280 characters.
- Avoid fake metrics, fake quotes, unverified claims, and engagement bait.
- If a claim needs evidence, phrase it cautiously.
- Prefer concrete, publishable language.
- Always finish by calling finalize_twitter_creative.
- If tool calling is unavailable, return strict JSON only, with keys: tweet, hashtags, rationale, safetyNotes (plus dailyFortune when a fortune skill is selected).
- Do not generate image prompts or image assets in this MVP.`;

const dailyFortuneSchema = Type.Object(
  {
    selectedSkill: Type.Literal("daily-fortune-tweet"),
    outputType: Type.Union([Type.Literal("longTweet"), Type.Literal("thread"), Type.Literal("both")]),
    inputSummary: Type.Object({
      date: Type.Union([Type.String(), Type.Null()]),
      topic: Type.String(),
      audience: Type.Union([Type.String(), Type.Null()]),
      assumptions: Type.Array(Type.String())
    }),
    fortuneSpine: Type.Object({
      keyword: Type.String({ description: "今日关键词，2-4 字，有画面感（如 收口 / 补漏 / 雾散）。" }),
      symbolicImage: Type.String({ description: "一个象征意象（如 钱袋漏风 / 桌面重新整理 / 旧消息浮出水面）。" }),
      emotionalWeather: Type.String(),
      coreTension: Type.String(),
      practicalAdvice: Type.String({ description: "具体、可执行、非确定性的温和提醒。" })
    }),
    longTweet: Type.Object({
      title: Type.String(),
      body: Type.String({ description: "长推正文；thread-only 时可为空字符串。" }),
      hashtags: Type.Array(Type.String())
    }),
    thread: Type.Array(
      Type.Object({
        index: Type.Integer(),
        text: Type.String(),
        role: Type.Union([
          Type.Literal("hook"),
          Type.Literal("context"),
          Type.Literal("money"),
          Type.Literal("career"),
          Type.Literal("relationship"),
          Type.Literal("risk"),
          Type.Literal("ritual"),
          Type.Literal("cta")
        ])
      }),
      { description: "longTweet-only 时为空数组。" }
    ),
    reviewNotes: Type.Object({
      safetyCheck: Type.Array(Type.String()),
      hypeCheck: Type.Array(Type.String()),
      publishReadiness: Type.Union([Type.Literal("draft"), Type.Literal("reviewed"), Type.Literal("publish-ready")])
    })
  },
  { description: "Daily Fortune artifact. Required only when the selected skill is daily-fortune-tweet; omit otherwise." }
);

const finalizeSchema = Type.Object({
  tweet: Type.String({ description: "The final Twitter/X post, under 280 characters." }),
  hashtags: Type.Array(Type.String(), {
    description: "Zero to three relevant hashtags without filler."
  }),
  rationale: Type.String({ description: "Short explanation of why this creative fits the brief." }),
  safetyNotes: Type.Array(Type.String(), {
    description: "Warnings, assumptions, or fact-check notes for the operator."
  }),
  dailyFortune: Type.Optional(dailyFortuneSchema)
});

const finalizeTwitterCreativeTool: AgentTool<typeof finalizeSchema, TwitterCreative> = {
  name: "finalize_twitter_creative",
  label: "Finalize Twitter Creative",
  description: "Return the final Twitter/X post copy, hashtags, rationale, and review notes.",
  parameters: finalizeSchema,
  executionMode: "sequential",
  async execute(_toolCallId, params) {
    const creative = normalizeCreative(params);
    return {
      content: [{ type: "text", text: "Twitter creative finalized." }],
      details: creative,
      terminate: true
    };
  }
};

export function normalizeCreative(value: unknown): TwitterCreative {
  if (!isRecord(value)) {
    throw new Error("finalize_twitter_creative received invalid payload.");
  }

  const tweet = readRequiredString(value, "tweet").trim().slice(0, 280);
  return {
    tweet,
    hashtags: readStringArray(value.hashtags).map((tag) => tag.trim()).filter(Boolean).slice(0, 3),
    rationale: readRequiredString(value, "rationale").trim(),
    safetyNotes: readStringArray(value.safetyNotes).map((note) => note.trim()).filter(Boolean),
    dailyFortune: normalizeDailyFortune(value.dailyFortune)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRequiredString(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (typeof field !== "string") {
    throw new Error(`finalize_twitter_creative.${key} must be a string.`);
  }
  return field;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

// Reasoning models spend output budget on hidden reasoning, and the daily-fortune
// artifact (spine + long tweet + up to 7 thread items + review notes) is large, so a
// low cap truncates the finalize call. Default high; allow tuning via PI_MAX_TOKENS.
function readMaxTokens(fallback = 8192) {
  const raw = Number(process.env.PI_MAX_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function resolveModel(): Model<"openai-responses"> | Model<"openai-codex-responses"> {
  if (process.env.PI_PROVIDER === "openai-codex") {
    const modelId = process.env.PI_MODEL ?? "gpt-5.5";
    return {
      id: modelId,
      name: modelId,
      api: "openai-codex-responses",
      provider: "openai-codex",
      baseUrl: process.env.OPENAI_CODEX_BASE_URL ?? "https://chatgpt.com/backend-api",
      reasoning: true,
      input: ["text"],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      },
      contextWindow: 400000,
      maxTokens: readMaxTokens()
    };
  }

  const modelId = process.env.PI_MODEL ?? "gpt-5.5";
  return {
    id: modelId,
    name: modelId,
    api: "openai-responses",
    provider: "openai",
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    reasoning: true,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0
    },
    contextWindow: 400000,
    maxTokens: 4096
  };
}

async function getModelApiKey(provider: string) {
  const key = await getPiApiKey(provider);
  if (!key) {
    throw new Error(`${provider} credentials are not configured.`);
  }
  return key;
}

async function streamForModel(
  model: Model<"openai-responses"> | Model<"openai-codex-responses">,
  context: Context,
  options: SimpleStreamOptions | undefined
) {
  const streamOptions = options ?? {};
  if (model.api === "openai-codex-responses") {
    const { streamSimpleOpenAICodexResponses } = await importCodexResponses();
    return streamSimpleOpenAICodexResponses(model as Model<"openai-codex-responses">, context, streamOptions);
  }
  const { streamSimpleOpenAIResponses } = await importOpenAIResponses();
  return streamSimpleOpenAIResponses(model as Model<"openai-responses">, context, streamOptions);
}

async function importCodexResponses() {
  const restore = hideNodeVersionDuringProviderImport();
  try {
    return await import("@earendil-works/pi-ai/openai-codex-responses");
  } finally {
    restore();
  }
}

async function importOpenAIResponses() {
  const restore = hideNodeVersionDuringProviderImport();
  try {
    return await import("@earendil-works/pi-ai/openai-responses");
  } finally {
    restore();
  }
}

function hideNodeVersionDuringProviderImport() {
  return hideNodeVersionDuringPiOAuthImport();
}

function buildPrompt(input: GenerateRequest, contextBlock: string) {
  return `Create a Twitter/X text creative.

Topic:
${input.topic}

Audience:
${input.audience}

Goal:
${input.goal}

Tone:
${input.tone}

Output type:
${input.outputType || "tweet"}

Run mode:
${input.runMode || "draft"}

Constraints:
${input.constraints || "None"}

Workspace context:
${contextBlock || "No additional workspace context selected."}

Return only by calling finalize_twitter_creative.`;
}

export async function generateTwitterCreative(input: GenerateRequest): Promise<GenerateResponse> {
  const id = crypto.randomUUID();
  const transcript: string[] = [];
  let creative: TwitterCreative | undefined;
  let usage: GenerateResponse["usage"];
  let stopReason: StopReason | undefined;
  let modelErrorMessage: string | undefined;
  const skillTrace = await resolveRuntimeSkill(input);
  const skillMd = skillTrace ? await getSkillVersionSkillMd(skillTrace.skillVersionId) : undefined;
  const references = buildReferences(skillTrace);

  const agent = new Agent({
    initialState: {
      systemPrompt: SYSTEM_PROMPT,
      model: resolveModel(),
      thinkingLevel: "medium",
      tools: [finalizeTwitterCreativeTool],
      messages: []
    },
    streamFn: (model, context, options) => streamForModel(model as Model<"openai-responses"> | Model<"openai-codex-responses">, context, options),
    getApiKey: (provider) => getModelApiKey(provider),
    toolExecution: "sequential",
    afterToolCall: async ({ toolCall, result }) => {
      if (toolCall.name === "finalize_twitter_creative") {
        creative = result.details as TwitterCreative;
      }
      return undefined;
    }
  });

  agent.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      transcript.push(event.assistantMessageEvent.delta);
    }
    if (event.type === "message_end" && event.message.role === "assistant") {
      const messageText = readAssistantMessageText(event.message);
      if (messageText && !transcript.join("").includes(messageText)) {
        transcript.push(messageText);
      }
      stopReason = event.message.stopReason;
      modelErrorMessage = event.message.errorMessage;
      usage = {
        input: event.message.usage.input,
        output: event.message.usage.output,
        totalTokens: event.message.usage.totalTokens
      };
    }
  });

  try {
    await agent.prompt(buildSkillAwarePrompt(input, skillTrace, skillMd));
  } catch (error) {
    logError("pi_agent_prompt_failed", error, { id, transcript: transcript.join("").slice(0, 800) });
    throw error;
  }

  // A hard model error (auth failure, transport error, aborted run) surfaces as an
  // assistant message with stopReason "error"/"aborted" — NOT a thrown exception.
  // Don't mask it behind a canned fallback; report the real reason so the user can
  // fix credentials/config instead of seeing a fake artifact with 0 tokens.
  if (!creative && (stopReason === "error" || stopReason === "aborted")) {
    const reason = modelErrorMessage?.trim() || `model stopped with reason "${stopReason}"`;
    logError("pi_agent_model_error", new Error(reason), { id, stopReason });
    throw new Error(`模型调用失败：${reason}`);
  }

  if (!creative) {
    creative = recoverCreative(input, transcript.join(""));
  }

  if (!creative) {
    logError("pi_agent_no_finalize", new Error("no finalize tool call"), {
      id,
      transcriptLength: transcript.join("").length,
      transcript: transcript.join("").slice(0, 800)
    });
    creative = createFallbackCreative(input, transcript.join(""), skillTrace);
  }

  return {
    id,
    creative,
    transcript: transcript.join(""),
    references,
    skillTrace,
    usage
  };
}

export function recoverCreative(input: GenerateRequest, transcriptText: string): TwitterCreative | undefined {
  return normalizeDailyFortuneFromTranscript(transcriptText) ?? normalizeCreativeFromTranscript(transcriptText) ?? normalizeCreativeFromPlainText(input, transcriptText);
}

function normalizeCreativeFromPlainText(input: GenerateRequest, value: string): TwitterCreative | undefined {
  const text = value.trim();
  if (!text) return undefined;

  const tweet =
    readLabeledValue(text, ["tweet", "post", "copy", "推文", "文案"]) ??
    text
      .split(/\n+/)
      .map((line) => line.trim().replace(/^[-*\d.、\s]+/, ""))
      .find((line) => line.length >= 8 && line.length <= 280);

  if (!tweet) return undefined;

  return normalizeCreative({
    tweet,
    hashtags: extractHashtags(text),
    rationale:
      readLabeledValue(text, ["rationale", "reason", "理由"]) ??
      "Recovered from a plain-text model response because the model did not call finalize_twitter_creative.",
    safetyNotes: [
      "Recovered from model text output; review before publishing.",
      ...(input.constraints ? [`User constraints: ${input.constraints}`] : [])
    ]
  });
}

function createFallbackCreative(input: GenerateRequest, transcriptText: string, skillTrace?: RunSkillTrace): TwitterCreative {
  if (skillTrace?.skillSlug === "daily-fortune-tweet") {
    return createDailyFortuneFallbackCreative(input);
  }
  const topic = input.topic.replace(/\s+/g, " ").trim();
  const goal = input.goal.replace(/\s+/g, " ").trim();
  const tweet = `${topic}${goal ? `\n\n${goal}` : ""}`.slice(0, 280);
  return {
    tweet,
    hashtags: extractHashtags(`${topic} ${input.audience}`),
    rationale: transcriptText.trim()
      ? "The model returned text without a valid finalize tool call, so the response was converted into a reviewable creative artifact."
      : "The model did not return a valid finalize tool call, so a conservative artifact was generated from the brief.",
    safetyNotes: ["Review manually before publishing.", ...(input.constraints ? [`User constraints: ${input.constraints}`] : [])]
  };
}

function createDailyFortuneFallbackCreative(input: GenerateRequest): TwitterCreative {
  const outputType = input.outputType === "thread" || input.outputType === "both" ? input.outputType : "longTweet";
  const theme = detectFortuneTheme(input.topic);
  const keyword = theme === "财运" ? "补漏" : theme === "事业" ? "稳住节奏" : theme === "人际" ? "把话说清楚" : "整理信号";
  const symbolicImage = theme === "财运" ? "钱袋漏风" : theme === "事业" ? "桌面重新整理" : theme === "人际" ? "旧消息浮出水面" : "雾散";
  const practicalAdvice =
    theme === "财运"
      ? "先确认账单、现金流和承诺，避免在情绪高点冲动消费。"
      : theme === "事业"
        ? "先把一件拖延的小事收尾，再决定要不要开启新的承诺。"
        : theme === "人际"
          ? "重要的话慢半拍再说，把边界和期待讲清楚。"
          : "今天先观察信号，少做一个冲动决定，多确认一次信息。";
  const title = `今日${theme}运势｜${keyword}`;
  const body = [
    `${title}`,
    "",
    `今天的关键词是：${keyword}。`,
    "",
    `这不是确定性预测，更像是一张提醒卡：好运不一定来自突然降临的机会，更多时候来自你先把小漏洞补上。`,
    "",
    `综合来看，今天的能量像“${symbolicImage}”。你可能会想快一点看到结果，但更适合先慢下来，把信息、账单、日程或对话重新确认一遍。`,
    "",
    `${theme}提醒：${practicalAdvice}`,
    "",
    `今日行动：选一件最容易被忽略的小事，在今天结束前处理掉。它不会立刻改变命运，但会让你更稳地接住接下来的机会。`
  ].join("\n");
  const thread = [
    { index: 1, role: "hook" as const, text: `今日${theme}运势：今天的关键词是「${keyword}」。这不是预测未来，而是提醒你把注意力放回真正能改变节奏的地方。` },
    { index: 2, role: "context" as const, text: `今天的画面感像「${symbolicImage}」：有些信号已经出现，但还没到立刻下结论的时候。` },
    { index: 3, role: theme === "财运" ? ("money" as const) : ("career" as const), text: `${theme}方面，别急着追一个看起来很亮的机会。先确认细节、成本和承诺，守住漏洞比冒进更重要。` },
    { index: 4, role: "relationship" as const, text: `人际上，今天适合把话说清楚。少一点猜测，多一点确认，误会就会少很多。` },
    { index: 5, role: "risk" as const, text: `风险提醒：不要在情绪高点承诺、消费或做最终决定。给自己留一个复核窗口。` },
    { index: 6, role: "ritual" as const, text: `今日小仪式：整理一个账单、一个待办，或一段迟迟没说清楚的话。好运感会从秩序感里长出来。` },
    { index: 7, role: "cta" as const, text: `把你的星座/生肖或今天最关心的主题留在评论里，下一条可以继续拆「财运 / 事业 / 感情」其中一个方向。` }
  ];
  const dailyFortune: DailyFortuneArtifact = {
    selectedSkill: "daily-fortune-tweet",
    outputType,
    inputSummary: {
      date: null,
      topic: input.topic,
      audience: input.audience || null,
      assumptions: ["用户未提供完整出生信息，使用今日集体运势 framing。"]
    },
    fortuneSpine: {
      keyword,
      symbolicImage,
      emotionalWeather: "期待好运，但需要稳定感",
      coreTension: "想快点看到结果，但今天更适合先补漏洞",
      practicalAdvice
    },
    longTweet: {
      title,
      body: outputType === "thread" ? "" : body,
      hashtags: ["今日运势", theme, "好运提醒"]
    },
    thread: outputType === "longTweet" ? [] : thread,
    reviewNotes: {
      safetyCheck: ["内容定位为娱乐、灵感和反思，不做确定性预测。", "没有提供投资、医疗、法律或赌博建议。"],
      hypeCheck: ["未使用“稳赚”“一定发财”“马上脱单”等保证性表达。"],
      publishReadiness: "reviewed"
    }
  };
  return creativeFromDailyFortune(dailyFortune);
}

function detectFortuneTheme(text: string) {
  if (/财|钱|消费|收入|现金|投资/i.test(text)) return "财运";
  if (/事业|工作|职业|项目|老板|同事/i.test(text)) return "事业";
  if (/人际|朋友|关系|沟通|感情|恋爱/i.test(text)) return "人际";
  return "综合";
}

function readLabeledValue(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`(?:^|\\n)\\s*["']?${escaped}["']?\\s*[:：]\\s*(.+?)(?=\\n\\s*["']?[\\w\\s\\u4e00-\\u9fff]+["']?\\s*[:：]|$)`, "is"));
    const value = match?.[1]?.trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  return undefined;
}

function extractHashtags(text: string) {
  const explicit = Array.from(new Set((text.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map((tag) => tag.trim()))).slice(0, 3);
  if (explicit.length) return explicit;

  const fallback: string[] = [];
  if (/agent|智能体|代理/i.test(text)) fallback.push("AIagents");
  if (/pi\b|framework|框架/i.test(text)) fallback.push("pi");
  if (/twitter|x\/twitter|推特|发布/i.test(text)) fallback.push("buildinpublic");
  return fallback.slice(0, 3);
}

function readAssistantMessageText(message: unknown) {
  if (!isRecord(message)) return "";
  const direct = message.content ?? message.text ?? message.output;
  return readUnknownText(direct);
}

function readUnknownText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(readUnknownText).filter(Boolean).join("");
  }
  if (!isRecord(value)) return "";
  const text = value.text ?? value.content ?? value.value ?? value.output_text;
  return readUnknownText(text);
}

function buildSkillAwarePrompt(
  input: GenerateRequest,
  skillTrace: RunSkillTrace | undefined,
  skillMd: string | undefined
) {
  const contextBlock = "Local TUI client mode. No database workspace context is loaded.";
  if (!skillTrace || !skillMd) return buildPrompt(input, contextBlock);
  const referencesBlock = skillTrace.loadedReferences.map((reference) => `- ${reference.title} (${reference.path}, ${reference.loadPolicy})`).join("\n");
  const toolsBlock = skillTrace.allowedTools.map((tool) => `- ${tool.toolName}: ${tool.permission}${tool.enabled ? "" : " (disabled)"}`).join("\n");
  const outputContractBlock =
    skillTrace.skillSlug === "daily-fortune-tweet"
      ? `Return JSON compatible with the SKILL.md Output Contract. Then call finalize_twitter_creative with:
- tweet: the longTweet body or the first thread tweet, under 280 chars.
- hashtags: longTweet.hashtags.
- rationale: summarize fortuneSpine and skill selection.
- safetyNotes: reviewNotes.safetyCheck + reviewNotes.hypeCheck.
- dailyFortune: the full Daily Fortune JSON artifact.`
      : "tweet, hashtags, rationale, safetyNotes";

  return `Create a Twitter/X text creative.

${compileSkillPrompt(input, skillTrace, skillMd, referencesBlock, toolsBlock, outputContractBlock, contextBlock)}

USER REQUEST:
${input.topic}

Return only by calling finalize_twitter_creative.`;
}

function buildReferences(skillTrace?: RunSkillTrace): GenerationReference[] {
  return [
    ...(skillTrace ? [{ id: skillTrace.skillId, type: "skill" as const, label: `${skillTrace.skillName} v${skillTrace.version}` }] : [])
  ];
}

export function normalizeCreativeFromTranscript(value: string): TwitterCreative | undefined {
  const json = extractJsonObject(value);
  if (!json) return undefined;

  try {
    return normalizeCreative(JSON.parse(json));
  } catch {
    return undefined;
  }
}

function normalizeDailyFortuneFromTranscript(value: string): TwitterCreative | undefined {
  const json = extractJsonObject(value);
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as unknown;
    const dailyFortune = normalizeDailyFortune(parsed);
    if (!dailyFortune) return undefined;
    return creativeFromDailyFortune(dailyFortune);
  } catch {
    return undefined;
  }
}

function normalizeDailyFortune(value: unknown): DailyFortuneArtifact | undefined {
  if (!isRecord(value)) return undefined;
  if (value.selectedSkill !== "daily-fortune-tweet") return undefined;
  const outputType = readOutputType(value.outputType);
  const inputSummary = isRecord(value.inputSummary) ? value.inputSummary : {};
  const fortuneSpine = isRecord(value.fortuneSpine) ? value.fortuneSpine : {};
  const longTweet = isRecord(value.longTweet) ? value.longTweet : {};
  const reviewNotes = isRecord(value.reviewNotes) ? value.reviewNotes : {};
  return {
    selectedSkill: "daily-fortune-tweet",
    outputType,
    inputSummary: {
      date: typeof inputSummary.date === "string" ? inputSummary.date : null,
      topic: typeof inputSummary.topic === "string" ? inputSummary.topic : "",
      audience: typeof inputSummary.audience === "string" ? inputSummary.audience : null,
      assumptions: readStringArray(inputSummary.assumptions)
    },
    fortuneSpine: {
      keyword: readOptionalString(fortuneSpine.keyword, "今日整理"),
      symbolicImage: readOptionalString(fortuneSpine.symbolicImage, "桌面重新整理"),
      emotionalWeather: readOptionalString(fortuneSpine.emotionalWeather, "需要稳定感"),
      coreTension: readOptionalString(fortuneSpine.coreTension, "想快，但今天适合慢一点"),
      practicalAdvice: readOptionalString(fortuneSpine.practicalAdvice, "先把一个小漏洞补上")
    },
    longTweet: {
      title: readOptionalString(longTweet.title, "今日运势"),
      body: readOptionalString(longTweet.body, ""),
      hashtags: readStringArray(longTweet.hashtags).slice(0, 5)
    },
    thread: readThread(value.thread),
    reviewNotes: {
      safetyCheck: readStringArray(reviewNotes.safetyCheck),
      hypeCheck: readStringArray(reviewNotes.hypeCheck),
      publishReadiness: readPublishReadiness(reviewNotes.publishReadiness)
    }
  };
}

function creativeFromDailyFortune(dailyFortune: DailyFortuneArtifact): TwitterCreative {
  const tweetSource = dailyFortune.longTweet.body || dailyFortune.thread[0]?.text || `${dailyFortune.longTweet.title}\n\n${dailyFortune.fortuneSpine.practicalAdvice}`;
  return {
    tweet: tweetSource.trim().slice(0, 280),
    hashtags: dailyFortune.longTweet.hashtags.slice(0, 3),
    rationale: `Selected daily-fortune-tweet. Keyword: ${dailyFortune.fortuneSpine.keyword}. Advice: ${dailyFortune.fortuneSpine.practicalAdvice}.`,
    safetyNotes: [
      ...dailyFortune.reviewNotes.safetyCheck,
      ...dailyFortune.reviewNotes.hypeCheck,
      "Fortune content is framed as entertainment/reflection, not deterministic prediction."
    ].filter(Boolean),
    dailyFortune
  };
}

function readOptionalString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readOutputType(value: unknown): DailyFortuneArtifact["outputType"] {
  return value === "thread" || value === "both" ? value : "longTweet";
}

function readPublishReadiness(value: unknown): DailyFortuneArtifact["reviewNotes"]["publishReadiness"] {
  return value === "reviewed" || value === "publish-ready" ? value : "draft";
}

function readThread(value: unknown): DailyFortuneArtifact["thread"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const role = readThreadRole(item.role);
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) return null;
      return {
        index: typeof item.index === "number" ? item.index : index + 1,
        text,
        role
      };
    })
    .filter((item): item is DailyFortuneArtifact["thread"][number] => Boolean(item));
}

function readThreadRole(value: unknown): DailyFortuneArtifact["thread"][number]["role"] {
  const allowed = new Set(["hook", "context", "money", "career", "relationship", "risk", "ritual", "cta"]);
  return typeof value === "string" && allowed.has(value) ? (value as DailyFortuneArtifact["thread"][number]["role"]) : "context";
}

function extractJsonObject(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced?.startsWith("{")) return fenced;

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end <= start) return "";
  return value.slice(start, end + 1);
}
