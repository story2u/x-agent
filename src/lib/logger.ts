export function logInfo(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ level: "info", event, at: new Date().toISOString(), ...details }));
}

export function logError(event: string, error: unknown, details: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", event, at: new Date().toISOString(), message, ...details }));
}
