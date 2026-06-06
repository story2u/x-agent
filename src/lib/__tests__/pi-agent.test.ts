import { describe, expect, it } from "vitest";
import { normalizeCreative, normalizeCreativeFromTranscript, recoverCreative } from "@/lib/pi-agent";
import type { GenerateRequest } from "@/lib/types";

const input: GenerateRequest = {
  topic: "把 pi agent MVP 写成一条技术发布推文",
  audience: "AI 工程师",
  goal: "让读者愿意点进 Demo",
  tone: "technical",
  constraints: "不要夸大能力"
};

describe("normalizeCreative", () => {
  it("normalizes model output defensively", () => {
    const creative = normalizeCreative({
      tweet: `${"x".repeat(320)}`,
      hashtags: ["AI", "", 123, "#build", "extra", "ignored"],
      rationale: " rationale ",
      safetyNotes: [" note ", false, "fact check"]
    });

    expect(creative.tweet).toHaveLength(280);
    expect(creative.hashtags).toEqual(["AI", "#build", "extra"]);
    expect(creative.safetyNotes).toEqual(["note", "fact check"]);
  });

  it("rejects missing required fields", () => {
    expect(() => normalizeCreative({ tweet: "ok" })).toThrow("rationale");
  });

  it("recovers structured output from a JSON transcript fallback", () => {
    const creative = normalizeCreativeFromTranscript(`\`\`\`json
{
  "tweet": "Ship the workflow, not just the prompt.",
  "hashtags": ["AI", "agents"],
  "rationale": "It focuses on the review flow.",
  "safetyNotes": ["No unverified claims."]
}
\`\`\``);

    expect(creative?.tweet).toBe("Ship the workflow, not just the prompt.");
    expect(creative?.hashtags).toEqual(["AI", "agents"]);
  });

  it("recovers creative output from plain text when tool calling is skipped", () => {
    const creative = recoverCreative(input, `Tweet: pi agent 不只是 prompt 包装。它把 loop、工具调用和可审查输出放进同一条生产链路，让推特内容从草稿到审核都有迹可循。

Rationale: Fits technical builders.
Safety notes: Avoid unverified benchmark claims.`);

    expect(creative?.tweet).toContain("pi agent");
    expect(creative?.safetyNotes[0]).toContain("Recovered");
  });

  it("creates a conservative artifact when transcript has no structured creative", () => {
    const creative = recoverCreative(input, "");
    expect(creative).toBeUndefined();
  });
});
