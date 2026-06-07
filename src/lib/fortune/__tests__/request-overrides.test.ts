import { describe, expect, it } from "vitest";
import { deriveFortuneRequestOverrides, isFortuneRequest } from "@/lib/fortune/request-overrides";

describe("deriveFortuneRequestOverrides", () => {
  it("derives explicit fortune audience, playful tone, and longTweet output", () => {
    const overrides = deriveFortuneRequestOverrides("生成一条今日财运长推文，受众是海外中文年轻人，语气轻松但有一点玄学感。");

    expect(overrides).toMatchObject({
      audience: "海外中文年轻人",
      tone: "playful",
      outputType: "longTweet"
    });
  });

  it("uses fortune defaults when context is omitted", () => {
    const overrides = deriveFortuneRequestOverrides("写一条今日运势");

    expect(overrides).toMatchObject({
      audience: "海外年轻中文用户",
      tone: "playful",
      outputType: "longTweet"
    });
  });

  it("extracts alternate audience and thread requests", () => {
    const overrides = deriveFortuneRequestOverrides("写一个今日事业运势 thread，面向海外中文年轻职场人，风格温柔一点。");

    expect(overrides).toMatchObject({
      audience: "海外中文年轻职场人",
      tone: "warm",
      outputType: "thread"
    });
  });

  it("detects fortune requests by keyword", () => {
    expect(isFortuneRequest("今日财运长推文")).toBe(true);
    expect(isFortuneRequest("product launch tweet")).toBe(false);
  });
});
