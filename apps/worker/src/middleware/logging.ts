import type { AppEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { createMiddleware } from "hono/factory";

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const logger = createLogger(c);
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  logger.info("request_completed", {
    status: c.res.status,
    duration_ms: duration,
  });
});
