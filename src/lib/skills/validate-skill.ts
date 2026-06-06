import type { SkillValidationResult } from "@/lib/types";
import { parseSkillMd } from "@/lib/skills/parse-skill";

const allowedFrontmatter = new Set(["name", "description", "metadata", "allowed-tools"]);

export function validateSkillMd(skillMd: string): SkillValidationResult {
  const parsed = parseSkillMd(skillMd);
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = typeof parsed.frontmatter.name === "string" ? parsed.frontmatter.name : "";
  const description = typeof parsed.frontmatter.description === "string" ? parsed.frontmatter.description : "";
  const body = parsed.body.trim();

  if (!name) {
    errors.push("frontmatter.name is required.");
  } else {
    if (name.length > 64) errors.push("frontmatter.name must be 64 characters or fewer.");
    if (!/^[a-z0-9-]+$/.test(name)) errors.push("frontmatter.name may only contain lowercase letters, numbers, and hyphens.");
    if (name.startsWith("-") || name.endsWith("-")) errors.push("frontmatter.name cannot start or end with a hyphen.");
    if (name.includes("--")) errors.push("frontmatter.name cannot contain consecutive hyphens.");
  }

  if (!description) {
    errors.push("frontmatter.description is required.");
  } else {
    if (description.length > 1024) errors.push("frontmatter.description must be 1024 characters or fewer.");
    if (!/Use when|When to Use|使用场景|触发/i.test(description)) {
      warnings.push("description should include a trigger such as 'Use when'.");
    }
  }

  if (!body) errors.push("SKILL.md body is required.");
  if (!/(Workflow|Steps|Process|工作流|流程)/i.test(body)) errors.push("SKILL.md body must include a workflow/process section.");
  if (!/Output Contract|输出契约|输出结构/i.test(body)) errors.push("SKILL.md body must include Output Contract.");
  if (!/Review Checklist|Quality Gate|Safety Rules|Safety Positioning|安全|检查/i.test(body)) {
    errors.push("SKILL.md body must include a review checklist, quality gate, or safety rules.");
  }

  for (const key of Object.keys(parsed.frontmatter)) {
    if (!allowedFrontmatter.has(key)) warnings.push(`Unknown frontmatter field '${key}' will be preserved but is not interpreted.`);
  }

  return { status: errors.length ? "error" : warnings.length ? "warning" : "valid", errors, warnings };
}

export function validateOutputContractJson(value: string) {
  if (!value.trim()) return { ok: true, parsed: null as Record<string, unknown> | null, error: "" };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, parsed: null, error: "Output contract must be a JSON object." };
    }
    return { ok: true, parsed, error: "" };
  } catch (error) {
    return { ok: false, parsed: null, error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}
