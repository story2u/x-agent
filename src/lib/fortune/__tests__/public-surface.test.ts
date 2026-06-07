import { describe, expect, it } from "vitest";
import { findTechnicalJargon, isTechnicalAudience, validatePublicPostSurface } from "@/lib/fortune/public-surface";

describe("validatePublicPostSurface", () => {
  it("flags leaked internal safety / Seth / review language", () => {
    expect(validatePublicPostSurface("把这条当作娱乐与反思的提示就好").length).toBeGreaterThan(0);
    expect(validatePublicPostSurface("这不是预言，更像是一个提醒").length).toBeGreaterThan(0);
    expect(validatePublicPostSurface("概率线不是固定的").length).toBeGreaterThan(0);
    expect(validatePublicPostSurface("情绪不是命令，它只是信号").length).toBeGreaterThan(0);
    expect(validatePublicPostSurface("这不构成投资建议").length).toBeGreaterThan(0);
  });

  it("passes natural fortune content", () => {
    expect(validatePublicPostSurface("今日钱包防漏日。购物车先冷静 24 小时，月底的你会轻一点。")).toEqual([]);
  });
});

describe("technical jargon guard", () => {
  it("treats overseas-youth audiences as non-technical and finds jargon", () => {
    expect(isTechnicalAudience("海外中文年轻人")).toBe(false);
    expect(findTechnicalJargon("今天清空你的 pending queue，重启 cron")).toEqual(expect.arrayContaining(["pending queue", "cron"]));
  });

  it("recognizes explicitly technical audiences", () => {
    expect(isTechnicalAudience("AI engineers and developers")).toBe(true);
    expect(isTechnicalAudience("程序员")).toBe(true);
    expect(isTechnicalAudience("工程师/技术从业者")).toBe(true);
  });

  it("does not misclassify non-technical English audiences", () => {
    expect(isTechnicalAudience("retail shoppers")).toBe(false);
    expect(isTechnicalAudience("overseas students")).toBe(false);
  });

  it("returns no jargon for clean fortune content", () => {
    expect(findTechnicalJargon("今日钱包防漏日，外卖咖啡打车先缓一缓")).toEqual([]);
  });
});
