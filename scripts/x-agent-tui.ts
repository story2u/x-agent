#!/usr/bin/env tsx

import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generateTwitterCreative } from "../src/lib/pi-agent";
import { listLocalSkills } from "../src/lib/skills/local-skills";
import type { GenerateRequest, GenerateResponse, Tone } from "../src/lib/types";

// Load a local .env (if present) so PI_* / OPENAI_CODEX_* credentials reach the
// runtime. process.loadEnvFile exists on Node >= 20.12 (package requires >= 22.19).
if (existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore a malformed .env; vars exported in the shell still apply
  }
}

const TONES: Tone[] = ["technical", "warm", "sharp", "playful", "executive"];
const OUTPUT_TYPES: NonNullable<GenerateRequest["outputType"]>[] = ["tweet", "thread", "longTweet", "both"];

const ansi = {
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m"
};

interface TuiState {
  skill: string;
  tone: Tone;
  outputType: NonNullable<GenerateRequest["outputType"]>;
  audience: string;
  goal: string;
  constraints: string;
  history: GenerateResponse[];
}

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  printHelp();
  process.exit(0);
}

const rl = createInterface({ input, output, terminal: true });
const EOF = "__X_AGENT_TUI_EOF__";
const state: TuiState = {
  skill: "auto",
  tone: "technical",
  outputType: "tweet",
  audience: process.env.X_AGENT_AUDIENCE || "AI engineers, independent builders, technical product owners",
  goal: process.env.X_AGENT_GOAL || "Create a publishable X/Twitter text artifact.",
  constraints: process.env.X_AGENT_CONSTRAINTS || "No unverifiable benchmarks. Do not overclaim.",
  history: []
};

try {
  printIntro();
  await loop();
} finally {
  rl.close();
}

async function loop() {
  while (true) {
    const line = (await ask(promptLabel())).trim();
    if (line === EOF) return;
    if (!line) continue;
    if (line.startsWith("/")) {
      const shouldQuit = await handleCommand(line);
      if (shouldQuit) return;
      continue;
    }
    await runAgent(line);
  }
}

async function ask(label: string) {
  try {
    return await rl.question(label);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_USE_AFTER_CLOSE") return EOF;
    throw error;
  }
}

async function runAgent(command: string) {
  const request: GenerateRequest = {
    topic: command,
    audience: state.audience,
    goal: state.goal,
    tone: state.tone,
    constraints: state.constraints,
    outputType: state.outputType,
    runMode: "draft",
    skillIds: state.skill === "auto" ? undefined : [state.skill]
  };

  console.log(`${ansi.dim}running pi agent...${ansi.reset}`);
  try {
    const result = await generateTwitterCreative(request);
    state.history.unshift(result);
    printResult(result);
  } catch (error) {
    console.log(`${ansi.red}error${ansi.reset} ${error instanceof Error ? error.message : String(error)}`);
    console.log(`${ansi.dim}Use /model to inspect credential hints, or /config to inspect the current request context.${ansi.reset}`);
  }
}

async function handleCommand(raw: string) {
  const [command, ...rest] = raw.slice(1).trim().split(/\s+/);
  const value = rest.join(" ").trim();

  switch (command) {
    case "q":
    case "quit":
    case "exit":
      return true;
    case "help":
    case "?":
      printHelp();
      return false;
    case "clear":
      if (process.stdout.isTTY) process.stdout.write("\x1b[2J\x1b[H");
      printIntro();
      return false;
    case "skills":
      await printSkills();
      return false;
    case "skill":
      await setSkill(value);
      return false;
    case "tone":
      setEnum("tone", value, TONES);
      return false;
    case "output":
      setEnum("outputType", value, OUTPUT_TYPES);
      return false;
    case "audience":
      setText("audience", value);
      return false;
    case "goal":
      setText("goal", value);
      return false;
    case "constraints":
      setText("constraints", value);
      return false;
    case "config":
      printConfig();
      return false;
    case "last":
      printLast();
      return false;
    case "history":
      printHistory();
      return false;
    case "model":
      printModel();
      return false;
    default:
      console.log(`${ansi.yellow}unknown command:${ansi.reset} /${command}`);
      console.log("Use /help to see commands.");
      return false;
  }
}

async function printSkills() {
  const skills = await listLocalSkills();
  if (!skills.length) {
    console.log("No local skills found. Add SKILL.md under skills/<slug>/SKILL.md.");
    return;
  }
  console.log(`${ansi.bold}local skills${ansi.reset}`);
  console.log("  auto - let x-agent select from local SKILL.md files");
  for (const skill of skills) {
    const marker = state.skill === skill.slug ? "*" : " ";
    const status = skill.validation.errors.length ? "invalid" : "valid";
    console.log(`${marker} ${skill.slug} v${skill.version} [${status}] - ${skill.description}`);
  }
}

async function setSkill(value: string) {
  if (!value || value === "auto") {
    state.skill = "auto";
    console.log("skill = auto");
    return;
  }
  const skills = await listLocalSkills();
  const selected = skills.find((skill) => skill.slug === value || skill.id === value || skill.name === value);
  if (!selected) {
    console.log(`${ansi.red}skill not found:${ansi.reset} ${value}`);
    console.log("Use /skills to list local skills.");
    return;
  }
  if (selected.validation.errors.length) {
    console.log(`${ansi.red}skill is invalid and cannot be selected:${ansi.reset} ${selected.slug}`);
    for (const err of selected.validation.errors) console.log(`  - ${err}`);
    return;
  }
  state.skill = selected.slug;
  console.log(`skill = ${selected.slug}`);
}

function setEnum<K extends "tone" | "outputType">(key: K, value: string, allowed: readonly TuiState[K][]) {
  if (!allowed.includes(value as TuiState[K])) {
    console.log(`${key} must be one of: ${allowed.join(", ")}`);
    return;
  }
  state[key] = value as TuiState[K];
  console.log(`${key} = ${value}`);
}

function setText(key: "audience" | "goal" | "constraints", value: string) {
  if (!value) {
    console.log(`${key} = ${state[key]}`);
    return;
  }
  state[key] = value;
  console.log(`${key} updated`);
}

function printIntro() {
  console.log(`${ansi.bold}x-agent${ansi.reset} ${ansi.dim}local TUI client${ansi.reset}`);
  console.log("Type a request to generate a real X/Twitter text artifact.");
  console.log("Type /help for slash commands.");
  console.log("");
}

function printHelp() {
  console.log(`x-agent TUI

Plain input:
  Generate a text artifact directly.

Slash commands:
  /skills                       list local Markdown skills
  /skill auto                   auto-select local skill
  /skill <slug>                 select local skill
  /tone <technical|warm|sharp|playful|executive>
  /output <tweet|thread|longTweet|both>
  /audience <text>
  /goal <text>
  /constraints <text>
  /config                       show request context
  /model                        show model credential hints
  /last                         show last artifact
  /history                      list generated artifacts in this session
  /clear                        clear screen
  /quit                         exit

Environment:
  PI_PROVIDER=openai-codex
  PI_MODEL=gpt-5.5
  OPENAI_CODEX_ACCESS_TOKEN or OPENAI_CODEX_OAUTH_CREDENTIALS
  X_AGENT_SKILLS_DIR            override local skills directory
`);
}

function printConfig() {
  console.log(`${ansi.bold}config${ansi.reset}`);
  console.log(`skill       ${state.skill}`);
  console.log(`tone        ${state.tone}`);
  console.log(`output      ${state.outputType}`);
  console.log(`audience    ${state.audience}`);
  console.log(`goal        ${state.goal}`);
  console.log(`constraints ${state.constraints}`);
}

function printModel() {
  console.log(`${ansi.bold}model${ansi.reset}`);
  console.log(`provider    ${process.env.PI_PROVIDER || "openai"}`);
  console.log(`model       ${process.env.PI_MODEL || "gpt-5.5"}`);
  console.log(`codex token ${process.env.OPENAI_CODEX_ACCESS_TOKEN ? "present" : "missing"}`);
  console.log(`codex oauth ${process.env.OPENAI_CODEX_OAUTH_CREDENTIALS ? "present" : "missing"}`);
  console.log(`openai key  ${process.env.OPENAI_API_KEY ? "present" : "missing"}`);
}

function printResult(result: GenerateResponse) {
  const { creative, skillTrace, usage } = result;
  console.log("");
  console.log(`${ansi.green}${ansi.bold}artifact${ansi.reset}`);
  console.log(`${ansi.bold}tweet${ansi.reset}`);
  console.log(creative.tweet);
  if (creative.hashtags.length) console.log(`\n${ansi.bold}hashtags${ansi.reset}\n${creative.hashtags.join(" ")}`);
  console.log(`\n${ansi.bold}rationale${ansi.reset}\n${creative.rationale}`);
  if (creative.safetyNotes.length) {
    console.log(`\n${ansi.bold}notes${ansi.reset}`);
    for (const note of creative.safetyNotes) console.log(`- ${note}`);
  }
  if (creative.dailyFortune) printDailyFortune(creative.dailyFortune);
  if (skillTrace) {
    console.log(`\n${ansi.dim}skill ${skillTrace.skillSlug} (${skillTrace.selectionMode}) - ${skillTrace.selectionReason}${ansi.reset}`);
  }
  if (usage) {
    console.log(`${ansi.dim}tokens ${usage.totalTokens} total${ansi.reset}`);
  }
  console.log("");
}

function printDailyFortune(fortune: NonNullable<GenerateResponse["creative"]["dailyFortune"]>) {
  console.log(`\n${ansi.bold}daily fortune${ansi.reset}`);
  console.log(`keyword: ${fortune.fortuneSpine.keyword}`);
  console.log(`image: ${fortune.fortuneSpine.symbolicImage}`);
  if (fortune.longTweet.body) {
    console.log(`\n${ansi.bold}long post${ansi.reset}`);
    console.log(fortune.longTweet.body);
  }
  if (fortune.thread.length) {
    console.log(`\n${ansi.bold}thread${ansi.reset}`);
    for (const item of fortune.thread) console.log(`${item.index}. ${item.text}`);
  }
}

function printLast() {
  const last = state.history[0];
  if (!last) {
    console.log("No artifact yet.");
    return;
  }
  printResult(last);
}

function printHistory() {
  if (!state.history.length) {
    console.log("No artifacts generated in this session.");
    return;
  }
  state.history.forEach((item, index) => {
    const skill = item.skillTrace?.skillSlug || "none";
    console.log(`${index + 1}. [${skill}] ${item.creative.tweet.replace(/\s+/g, " ").slice(0, 100)}`);
  });
}

function promptLabel() {
  const skill = state.skill === "auto" ? "auto" : state.skill;
  return `${ansi.bold}x-agent${ansi.reset} ${ansi.dim}${skill}/${state.outputType}/${state.tone}${ansi.reset} › `;
}
