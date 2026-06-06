import type { OAuthCredentials } from "@earendil-works/pi-ai/oauth";
import { logInfo } from "@/lib/logger";
import { hideNodeVersionDuringPiOAuthImport } from "@/lib/pi-oauth-runtime";

export async function getPiApiKey(provider: string): Promise<string | undefined> {
  if (provider === "openai-codex") {
    return getOpenAICodexApiKey();
  }

  if (provider === "deepseek") {
    return process.env.DEEPSEEK_API_KEY;
  }

  return process.env.OPENAI_API_KEY;
}

async function getOpenAICodexApiKey() {
  if (process.env.OPENAI_CODEX_ACCESS_TOKEN) {
    return process.env.OPENAI_CODEX_ACCESS_TOKEN;
  }

  const rawCredentials = process.env.OPENAI_CODEX_OAUTH_CREDENTIALS;
  if (!rawCredentials) return undefined;

  const credentials = parseCodexCredentials(rawCredentials);
  const restore = hideNodeVersionDuringPiOAuthImport();
  try {
    const { getOAuthApiKey } = await import("@earendil-works/pi-ai/oauth");
    const result = await getOAuthApiKey("openai-codex", credentials);
    if (!result) return undefined;
    warnIfCredentialsRotated(credentials["openai-codex"], result.newCredentials);
    return result.apiKey;
  } finally {
    restore();
  }
}

// The local TUI sources Codex OAuth from env, so refreshed credentials cannot be
// persisted back (unlike the old D1-backed web app). Surface rotation so the user
// updates OPENAI_CODEX_OAUTH_CREDENTIALS instead of silently reusing a stale token.
function warnIfCredentialsRotated(previous: OAuthCredentials | undefined, next: OAuthCredentials | undefined) {
  if (!previous || !next) return;
  if (previous.refresh !== next.refresh || previous.access !== next.access) {
    logInfo("pi_codex_oauth_rotated", {
      hint: "Codex OAuth credentials were refreshed. Re-run `npm run chatgpt:oauth` and update OPENAI_CODEX_OAUTH_CREDENTIALS to avoid reusing a stale token next run."
    });
  }
}

function parseCodexCredentials(raw: string): Record<string, OAuthCredentials> {
  let parsed: OAuthCredentials | Record<string, OAuthCredentials>;
  try {
    parsed = JSON.parse(raw) as OAuthCredentials | Record<string, OAuthCredentials>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `OPENAI_CODEX_OAUTH_CREDENTIALS is not valid JSON (${detail}). It must be a single line — ` +
        "re-run `npm run chatgpt:oauth` and paste the one-line value into .env without reformatting or wrapping."
    );
  }
  if (parsed && typeof parsed === "object" && "openai-codex" in parsed) {
    return parsed as Record<string, OAuthCredentials>;
  }
  return { "openai-codex": parsed as OAuthCredentials };
}
