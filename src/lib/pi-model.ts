// Shared model resolution + streaming + credential plumbing.
//
// Extracted from pi-agent.ts so both the single-pass path (pi-agent.ts) and the
// multi-stage fortune pipeline (fortune/pipeline.ts) can reuse it without a
// circular import. Provider selection and credential precedence are documented
// in docs/数据流程.md.

import type { Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { getPiApiKey } from "@/lib/pi-credentials";
import { hideNodeVersionDuringPiOAuthImport } from "@/lib/pi-oauth-runtime";

export type RuntimeModel = Model<"openai-responses"> | Model<"openai-codex-responses"> | Model<"openai-completions">;

// Reasoning models spend output budget on hidden reasoning, and fortune artifacts
// are large, so a low cap truncates structured output. Default high; allow tuning
// via PI_MAX_TOKENS.
export function readMaxTokens(fallback = 8192) {
  const raw = Number(process.env.PI_MAX_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function resolveModel(): RuntimeModel {
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
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 400000,
      maxTokens: readMaxTokens()
    };
  }

  if (process.env.PI_PROVIDER === "deepseek") {
    const modelId = process.env.PI_MODEL ?? "deepseek-v4-pro";
    return {
      id: modelId,
      name: modelId,
      api: "openai-completions",
      provider: "deepseek",
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      reasoning: process.env.DEEPSEEK_REASONING === "false" ? false : true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1048576,
      maxTokens: readMaxTokens(32768)
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
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 400000,
    maxTokens: readMaxTokens(4096)
  };
}

export async function getModelApiKey(provider: string) {
  const key = await getPiApiKey(provider);
  if (!key) {
    throw new Error(`${provider} credentials are not configured.`);
  }
  return key;
}

export async function streamForModel(model: RuntimeModel, context: Context, options: SimpleStreamOptions | undefined) {
  const streamOptions = options ?? {};
  if (model.api === "openai-codex-responses") {
    const { streamSimpleOpenAICodexResponses } = await importCodexResponses();
    return streamSimpleOpenAICodexResponses(model as Model<"openai-codex-responses">, context, streamOptions);
  }
  if (model.api === "openai-completions") {
    const { streamSimpleOpenAICompletions } = await importOpenAICompletions();
    return streamSimpleOpenAICompletions(model as Model<"openai-completions">, context, streamOptions);
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

async function importOpenAICompletions() {
  const restore = hideNodeVersionDuringProviderImport();
  try {
    return await import("@earendil-works/pi-ai/openai-completions");
  } finally {
    restore();
  }
}

function hideNodeVersionDuringProviderImport() {
  return hideNodeVersionDuringPiOAuthImport();
}
