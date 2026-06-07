import { describe, expect, it } from "vitest";
import { fieldPresent, isNonEmpty } from "@/lib/fortune/field-present";

const artifact = {
  audienceInsight: { corePain: "x", realScenes: ["a", "b"] },
  angleOptions: [
    { thesis: "t1", safetyRisk: "r1" },
    { thesis: "t2", safetyRisk: "r2" }
  ],
  hookOptions: [{ type: "contrarian", whyItWorks: "w" }],
  fortuneSpine: { tinyRitual: "r", closingImage: "c", empty: "" },
  operatorCritique: { problems: ["p"] },
  final: { longTweet: { body: "body" }, thread: [{ role: "hook" }] }
};

describe("isNonEmpty", () => {
  it("treats null/undefined/blank/empty as missing", () => {
    expect(isNonEmpty(undefined)).toBe(false);
    expect(isNonEmpty(null)).toBe(false);
    expect(isNonEmpty("  ")).toBe(false);
    expect(isNonEmpty([])).toBe(false);
    expect(isNonEmpty({})).toBe(false);
  });

  it("treats populated values as present", () => {
    expect(isNonEmpty("x")).toBe(true);
    expect(isNonEmpty([1])).toBe(true);
    expect(isNonEmpty({ a: 1 })).toBe(true);
    expect(isNonEmpty(0)).toBe(true);
  });
});

describe("fieldPresent", () => {
  it("resolves plain / nested / array-each paths that exist and are populated", () => {
    expect(fieldPresent(artifact, "audienceInsight")).toBe(true);
    expect(fieldPresent(artifact, "fortuneSpine.tinyRitual")).toBe(true);
    expect(fieldPresent(artifact, "final.longTweet.body")).toBe(true);
    expect(fieldPresent(artifact, "final.thread")).toBe(true);
    expect(fieldPresent(artifact, "operatorCritique.problems")).toBe(true);
    expect(fieldPresent(artifact, "angleOptions[].thesis")).toBe(true);
    expect(fieldPresent(artifact, "angleOptions[].safetyRisk")).toBe(true);
    expect(fieldPresent(artifact, "hookOptions[].type")).toBe(true);
  });

  it("CATCHES missing / empty / partial fields (the point of the gate)", () => {
    expect(fieldPresent(artifact, "missingField")).toBe(false);
    expect(fieldPresent(artifact, "fortuneSpine.notThere")).toBe(false);
    expect(fieldPresent(artifact, "fortuneSpine.empty")).toBe(false); // blank string
    expect(fieldPresent(artifact, "final.longTweet.missing")).toBe(false);
    expect(fieldPresent({ angleOptions: [] }, "angleOptions[].thesis")).toBe(false); // empty array
    expect(fieldPresent({ angleOptions: [{ thesis: "t" }, { thesis: "" }] }, "angleOptions[].thesis")).toBe(false); // one element blank
    expect(fieldPresent({ angleOptions: [{ other: "x" }] }, "angleOptions[].thesis")).toBe(false); // element missing the field
  });
});
