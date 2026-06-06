import type { SkillFrontmatter } from "@/lib/types";

export interface ParsedSkillMd {
  frontmatter: SkillFrontmatter;
  body: string;
}

export function parseSkillMd(skillMd: string): ParsedSkillMd {
  const normalized = skillMd.replace(/\r\n/g, "\n").trim();
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: {}, body: normalized };
  }

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    return { frontmatter: {}, body: normalized };
  }

  const rawFrontmatter = normalized.slice(4, end).trim();
  const body = normalized.slice(end + 4).trim();
  return { frontmatter: parseFrontmatter(rawFrontmatter), body };
}

function parseFrontmatter(value: string): SkillFrontmatter {
  const output: SkillFrontmatter = {};
  const lines = value.split("\n");
  let section: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;

    if (indent > 0 && section === "metadata") {
      const entry = line.trim().match(/^([^:]+):\s*(.*)$/);
      if (!entry) continue;
      const metadata = isRecord(output.metadata) ? output.metadata : {};
      metadata[entry[1].trim()] = cleanScalar(entry[2]);
      output.metadata = metadata;
      continue;
    }

    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const raw = match[2] ?? "";
    section = key;

    if (key === "metadata" && !raw.trim()) {
      output.metadata = {};
    } else if (key === "allowed-tools") {
      output["allowed-tools"] = raw.split(/\s+/).map((item) => item.trim()).filter(Boolean);
    } else {
      output[key] = cleanScalar(raw);
    }
  }

  return output;
}

function cleanScalar(value: string) {
  const trimmed = value.trim();
  return trimmed.replace(/^["']|["']$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
