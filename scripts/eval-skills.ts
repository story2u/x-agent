#!/usr/bin/env tsx

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

interface SkillEvalSpec {
  id: string;
  skill: string;
  input: string;
  request: {
    audience: string;
    goal: string;
    tone: string;
    outputType: string;
  };
  expect: {
    selectedSkill: string;
    outputType: string;
    minChineseChars?: number;
    minAngleOptions?: number;
    minHookOptions?: number;
    minRealScenes?: number;
    requiredFields: string[];
    requiredHookTypes?: string[];
    requiredThreadRoles?: string[];
    forbiddenPhrases: string[];
    minOperatorScore?: number;
    publishReadiness?: string[];
  };
}

const skillsRoot = process.env.X_AGENT_SKILLS_DIR ? path.resolve(process.env.X_AGENT_SKILLS_DIR) : path.join(process.cwd(), "skills");
const requestedSkill = process.argv[2];
const specs = readEvalSpecs(requestedSkill);

if (!specs.length) {
  throw new Error(requestedSkill ? `No eval specs found for skill: ${requestedSkill}` : "No skill eval specs found.");
}

const failures: string[] = [];
for (const spec of specs) {
  failures.push(...validateEvalSpec(spec));
}

if (failures.length) {
  for (const failure of failures) console.error(`eval failed: ${failure}`);
  process.exit(1);
}

console.log(`skill eval specs ok (${specs.length})`);

function readEvalSpecs(skillFilter?: string) {
  const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !skillFilter || name === skillFilter);

  const allSpecs: SkillEvalSpec[] = [];
  for (const skillDir of skillDirs) {
    const evalsDir = path.join(skillsRoot, skillDir, "evals");
    if (!existsSync(evalsDir)) continue;
    const files = readdirSync(evalsDir).filter((file) => file.endsWith(".json")).sort((left, right) => left.localeCompare(right));
    for (const file of files) {
      const spec = JSON.parse(readFileSync(path.join(evalsDir, file), "utf8")) as SkillEvalSpec;
      allSpecs.push(spec);
    }
  }
  return allSpecs;
}

function validateEvalSpec(spec: SkillEvalSpec) {
  const errors: string[] = [];
  const label = spec.id || "<missing id>";
  if (!spec.id) errors.push(`${label}: id is required.`);
  if (!spec.skill) errors.push(`${label}: skill is required.`);
  if (!spec.input || spec.input.length < 8) errors.push(`${label}: input is too short.`);
  if (!spec.request?.audience) errors.push(`${label}: request.audience is required.`);
  if (!spec.request?.goal) errors.push(`${label}: request.goal is required.`);
  if (!["sharp", "warm", "technical", "playful", "executive"].includes(spec.request?.tone)) errors.push(`${label}: request.tone is invalid.`);
  if (!["longTweet", "thread", "both"].includes(spec.request?.outputType)) errors.push(`${label}: request.outputType must be longTweet/thread/both.`);
  if (spec.expect?.selectedSkill !== spec.skill) errors.push(`${label}: expect.selectedSkill must match skill.`);
  if (spec.expect?.outputType !== spec.request?.outputType) errors.push(`${label}: expect.outputType must match request.outputType.`);
  if (!Array.isArray(spec.expect?.requiredFields) || spec.expect.requiredFields.length < 5) errors.push(`${label}: expect.requiredFields must include core artifact fields.`);
  if (!Array.isArray(spec.expect?.forbiddenPhrases) || spec.expect.forbiddenPhrases.length < 3) errors.push(`${label}: expect.forbiddenPhrases must include safety phrases.`);
  if ((spec.expect.minAngleOptions ?? 0) < 3) errors.push(`${label}: expect.minAngleOptions must be at least 3.`);
  if ((spec.expect.minHookOptions ?? 0) < 5) errors.push(`${label}: expect.minHookOptions must be at least 5.`);
  if ((spec.expect.minOperatorScore ?? 0) < 4) errors.push(`${label}: expect.minOperatorScore must be at least 4.`);
  if (spec.request.outputType === "longTweet" && (spec.expect.minChineseChars ?? 0) < 600) {
    errors.push(`${label}: longTweet eval must require at least 600 Chinese chars.`);
  }
  if (spec.request.outputType === "thread" && (!spec.expect.requiredThreadRoles || spec.expect.requiredThreadRoles.length < 5)) {
    errors.push(`${label}: thread eval must require thread roles.`);
  }
  return errors;
}
