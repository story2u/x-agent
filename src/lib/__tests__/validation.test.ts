import { describe, expect, it } from "vitest";
import { parseGenerateRequest, parseJobTransitionRequest } from "@/lib/validation";

describe("parseGenerateRequest", () => {
  it("normalizes and bounds a valid request", () => {
    const request = parseGenerateRequest({
      topic: ` ${"a".repeat(1200)} `,
      audience: " engineers ",
      goal: " ship ",
      tone: "technical",
      constraints: " keep it factual "
    });

    expect(request.topic).toHaveLength(1000);
    expect(request.audience).toBe("engineers");
    expect(request.goal).toBe("ship");
    expect(request.tone).toBe("technical");
    expect(request.constraints).toBe("keep it factual");
  });

  it("rejects invalid tone", () => {
    expect(() => parseGenerateRequest({ topic: "valid topic", audience: "devs", goal: "share", tone: "loud" })).toThrow("tone");
  });
});

describe("parseJobTransitionRequest", () => {
  it("allows review and approved transitions", () => {
    expect(parseJobTransitionRequest({ status: "review" })).toBe("review");
    expect(parseJobTransitionRequest({ status: "approved" })).toBe("approved");
  });

  it("rejects direct published transition", () => {
    expect(() => parseJobTransitionRequest({ status: "published" })).toThrow("status");
  });
});
