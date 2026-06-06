#!/usr/bin/env node

import { loginOpenAICodexDeviceCode } from "@earendil-works/pi-ai/oauth";

const credentials = await loginOpenAICodexDeviceCode({
  onDeviceCode(info) {
    console.error("");
    console.error("Open ChatGPT device authorization:");
    console.error(info.verificationUri);
    console.error("");
    console.error(`Enter code: ${info.userCode}`);
    console.error("");
    console.error("Waiting for authorization...");
  }
});

// .env values must be a single line — the dotenv parser truncates a multi-line
// value to "{". Emit compact JSON as a ready-to-paste env assignment.
const value = JSON.stringify({ "openai-codex": { type: "oauth", ...credentials } });

console.error("");
console.error("Authorized. Add this single line to your .env (do not reformat / wrap):");
console.error("");
console.log(`OPENAI_CODEX_OAUTH_CREDENTIALS=${value}`);
