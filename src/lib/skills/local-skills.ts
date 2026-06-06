import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseSkillMd } from "@/lib/skills/parse-skill";
import { validateSkillMd } from "@/lib/skills/validate-skill";
import type { GenerateRequest, RunSkillTrace, SkillReferenceBinding, SkillValidationResult } from "@/lib/types";

export interface LocalSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: number;
  skillMd: string;
  filePath: string;
  allowedTools: string[];
  references: SkillReferenceBinding[];
  validation: SkillValidationResult;
}

const fortuneTriggers = [/今日运势/, /每日运势/, /运势/, /星座/, /生肖/, /幸运/, /财运/, /fortune/i, /horoscope/i, /zodiac/i, /daily luck/i];

export async function listLocalSkills(): Promise<LocalSkill[]> {
  const root = getSkillsRoot();
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }

  const skills = await Promise.all(entries.map((entry) => readLocalSkill(path.join(root, entry, "SKILL.md"))));
  return skills
    .filter((skill): skill is LocalSkill => Boolean(skill))
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

export async function getLocalSkill(idOrSlug: string): Promise<LocalSkill | undefined> {
  const skills = await listLocalSkills();
  return skills.find((skill) => skill.id === idOrSlug || skill.slug === idOrSlug || skill.name === idOrSlug);
}

export async function resolveRuntimeSkill(input: GenerateRequest): Promise<RunSkillTrace | undefined> {
  const skills = await listLocalSkills();
  const manualId = input.skillIds?.[0];

  // Manual selection fails closed: an unknown or invalid id must surface an error
  // rather than silently running a different (auto/default) skill.
  if (manualId) {
    const manual = skills.find((skill) => skill.id === manualId || skill.slug === manualId);
    if (!manual) {
      throw new Error(`Skill not found: ${manualId}. Run /skills to list local skills.`);
    }
    assertSkillRunnable(manual);
    return buildSkillTrace(manual, "manual");
  }

  // Auto/default selection only considers skills that pass validation, so an invalid
  // SKILL.md is never silently injected into the model prompt.
  const runnable = skills.filter((skill) => skill.validation.errors.length === 0);
  const combined = `${input.topic}\n${input.audience}\n${input.goal}\n${input.constraints ?? ""}`;
  const fortune = runnable.find((skill) => skill.slug === "daily-fortune-tweet");
  const autoFortune = Boolean(fortune) && fortuneTriggers.some((trigger) => trigger.test(combined));
  const selected = (autoFortune ? fortune : undefined) ?? runnable.find((skill) => skill.slug === "twitter-launch-creative") ?? runnable[0];
  if (!selected) return undefined;

  const mode: RunSkillTrace["selectionMode"] = autoFortune && selected.slug === "daily-fortune-tweet" ? "auto" : "default";
  return buildSkillTrace(selected, mode);
}

function assertSkillRunnable(skill: LocalSkill) {
  if (skill.validation.errors.length) {
    throw new Error(`Skill "${skill.slug}" is invalid and cannot be run: ${skill.validation.errors.join("; ")}`);
  }
}

function buildSkillTrace(selected: LocalSkill, mode: RunSkillTrace["selectionMode"]): RunSkillTrace {
  return {
    skillId: selected.id,
    skillSlug: selected.slug,
    skillName: selected.name,
    skillVersionId: `local:${selected.slug}`,
    version: selected.version,
    selectionMode: mode,
    selectionReason:
      mode === "manual"
        ? "User selected a local SKILL.md."
        : mode === "auto"
          ? "User asked for 今日运势 / fortune content."
          : "Default local X/Twitter creative skill.",
    loadedReferences: [
      { title: "Local SKILL.md", path: relativeToProject(selected.filePath), loadPolicy: "always" },
      ...selected.references.map((reference) => ({
        title: reference.title,
        path: reference.path,
        loadPolicy: reference.loadPolicy
      }))
    ],
    allowedTools: selected.allowedTools.map((toolName) => ({ toolName, permission: "allowed", enabled: true })),
    outputContractValid: selected.validation.errors.length === 0,
    validation: selected.validation
  };
}

export async function getSkillVersionSkillMd(versionId: string) {
  const slug = versionId.startsWith("local:") ? versionId.slice("local:".length) : versionId;
  return (await getLocalSkill(slug))?.skillMd;
}

export async function getSkillVersionReferences(versionId: string) {
  const slug = versionId.startsWith("local:") ? versionId.slice("local:".length) : versionId;
  const skill = await getLocalSkill(slug);
  return skill?.references.map((reference) => ({
    title: reference.title,
    path: reference.path,
    loadPolicy: reference.loadPolicy,
    content: reference.content
  })) ?? [];
}

export function compileSkillPrompt(
  input: GenerateRequest,
  skill: RunSkillTrace | undefined,
  fullSkillMd: string | undefined,
  referencesBlock: string,
  toolsBlock: string,
  outputContractBlock: string,
  contextBlock: string
) {
  if (!skill || !fullSkillMd) return contextBlock;
  return `SYSTEM:
You are x-agent local TUI runtime. You must follow the selected local SKILL.md.

GLOBAL SAFETY:
- Do not make deterministic claims.
- Do not provide medical, legal, financial, investment, or gambling advice.
- For fortune content, frame it as entertainment, reflection, creative inspiration, or mood-setting.

SELECTED LOCAL SKILL:
${fullSkillMd}

REFERENCES:
${referencesBlock || "No extra references loaded."}

RUN CONTEXT:
- user command: ${input.topic}
- audience: ${input.audience}
- goal: ${input.goal}
- tone: ${input.tone}
- output type: ${input.outputType ?? "tweet"}
- run mode: ${input.runMode ?? "draft"}
- constraints: ${input.constraints || "None"}

ALLOWED TOOLS:
${toolsBlock || "finalize_twitter_creative"}

OUTPUT CONTRACT:
${outputContractBlock || "tweet, hashtags, rationale, safetyNotes"}

${contextBlock}`;
}

function getSkillsRoot() {
  return process.env.X_AGENT_SKILLS_DIR ? path.resolve(process.env.X_AGENT_SKILLS_DIR) : path.join(process.cwd(), "skills");
}

async function readLocalSkill(filePath: string): Promise<LocalSkill | undefined> {
  try {
    const skillMd = await readFile(filePath, "utf8");
    const parsed = parseSkillMd(skillMd);
    const slug = slugify(String(parsed.frontmatter.name || path.basename(path.dirname(filePath))));
    const skillVersionId = `local:${slug}`;
    return {
      id: slug,
      slug,
      name: String(parsed.frontmatter.name || slug),
      description: String(parsed.frontmatter.description || "Local x-agent skill."),
      version: readVersion(parsed.frontmatter.metadata),
      skillMd,
      filePath,
      allowedTools: readAllowedTools(parsed.frontmatter["allowed-tools"]),
      references: await readLocalReferences(path.join(path.dirname(filePath), "references"), skillVersionId),
      validation: validateSkillMd(skillMd)
    };
  } catch {
    return undefined;
  }
}

async function readLocalReferences(referencesDir: string, skillVersionId: string): Promise<SkillReferenceBinding[]> {
  let entries: string[];
  try {
    entries = await readdir(referencesDir);
  } catch {
    return [];
  }

  const references = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".md"))
      .sort((left, right) => left.localeCompare(right))
      .map(async (entry) => {
        const filePath = path.join(referencesDir, entry);
        const content = await readFile(filePath, "utf8");
        const title = titleFromReference(entry, content);
        const relativePath = relativeToProject(filePath);
        return {
          id: `${skillVersionId}:${entry}`,
          skillVersionId,
          title,
          path: relativePath,
          type: referenceType(entry),
          content,
          loadPolicy: "always" as const,
          createdAt: new Date(0).toISOString()
        };
      })
  );

  return references;
}

function titleFromReference(fileName: string, content: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fileName.replace(/\.md$/i, "").replace(/-/g, " ");
}

function referenceType(fileName: string): SkillReferenceBinding["type"] {
  if (/policy|safety/i.test(fileName)) return "policy";
  if (/example|golden/i.test(fileName)) return "example";
  return "markdown";
}

function readAllowedTools(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value === "string") return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
  return ["finalize_twitter_creative"];
}

function readVersion(value: unknown) {
  if (!value || typeof value !== "object") return 1;
  const version = (value as Record<string, unknown>).version;
  const parsed = Number.parseInt(String(version ?? "1").split(".")[0].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "") || "local-skill";
}

function relativeToProject(filePath: string) {
  return path.relative(process.cwd(), filePath);
}
