// requiredFields path resolver for the daily-fortune eval harness.
//
// Pure + unit-testable so the eval quality gates provably CATCH missing fields,
// not just pass on a happy-path fixture. Supports paths "a", "a.b.c", and "a[].b"
// (array `a` must be non-empty AND every element's `b` must be non-empty).

export function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function fieldPresent(root: unknown, path: string): boolean {
  let current: unknown[] = [root];
  for (const segment of path.split(".")) {
    const isEach = segment.endsWith("[]");
    const key = isEach ? segment.slice(0, -2) : segment;
    const next: unknown[] = [];
    for (const node of current) {
      if (node === null || node === undefined || typeof node !== "object") return false;
      const value = (node as Record<string, unknown>)[key];
      if (isEach) {
        if (!Array.isArray(value) || value.length === 0) return false;
        next.push(...value);
      } else {
        next.push(value);
      }
    }
    current = next;
  }
  return current.length > 0 && current.every(isNonEmpty);
}
