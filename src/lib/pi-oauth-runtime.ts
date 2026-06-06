// Some pi-ai provider/oauth modules branch on `process.versions.node` at import time
// and pull in Node-only code paths. We transiently mask it so those imports resolve
// the runtime-agnostic path. The mask is reference-counted: only the first concurrent
// caller saves and clears the real value, and only the last restore puts it back — so
// overlapping imports can never leave `process.versions.node` permanently undefined.

let maskDepth = 0;
let savedNodeVersion: string | undefined;

export function hideNodeVersionDuringPiOAuthImport() {
  const processLike = (globalThis as { process?: { versions?: Record<string, string | undefined> } }).process;
  const versions = processLike?.versions;
  if (!versions || !("node" in versions)) return () => undefined;

  try {
    if (maskDepth === 0) {
      savedNodeVersion = versions.node;
      Object.defineProperty(versions, "node", { configurable: true, value: undefined });
    }
    maskDepth += 1;
  } catch {
    return () => undefined;
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    maskDepth -= 1;
    if (maskDepth === 0) {
      Object.defineProperty(versions, "node", { configurable: true, value: savedNodeVersion });
      savedNodeVersion = undefined;
    }
  };
}
