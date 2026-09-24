import type { Context } from "hono";

export interface LogContext {
  request_id: string;
  method: string;
  url: string;
  [key: string]: unknown;
}

export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => void;
}

export interface ExecutionLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => void;
}

export function createExecutionLogger(
  execution_id: string,
  context: Record<string, unknown>
): ExecutionLogger {
  const base = { execution_id, ...context };
  return {
    info: (message: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ...base, level: "info", message, ...data })),
    error: (message: string, error?: unknown, data?: Record<string, unknown>) =>
      console.error(
        JSON.stringify({
          ...base,
          level: "error",
          message,
          error: error instanceof Error ? error.message : String(error),
          ...data
        })
      )
  };
}
export function getRequestId(c: Context): string {
  const existing = c.get("request_id") as string | undefined;
  if (typeof existing === "string" && existing.length > 0) return existing;
  const request_id = crypto.randomUUID();
  c.set("request_id", request_id);
  return request_id;
}

export function createLogger(c: Context): Logger {
  const request_id = getRequestId(c);

  const base: LogContext = {
    request_id,
    method: c.req.method,
    url: c.req.url
  };

  return {
    info: (message: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ...base, level: "info", message, ...data })),

    warn: (message: string, data?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ ...base, level: "warn", message, ...data })),

    error: (message: string, error?: unknown, data?: Record<string, unknown>) =>
      console.error(
        JSON.stringify({
          ...base,
          level: "error",
          message,
          error: error instanceof Error ? error.message : String(error),
          ...data
        })
      )
  };
}
