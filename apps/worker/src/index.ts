import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Bindings } from "./lib/db";
import type { AppEnv } from "./lib/env";
import { validateEnv } from "./lib/env";
import { createExecutionLogger, createLogger } from "./lib/logger";
import { requestLogger } from "./middleware/logging";
import { authRoutes } from "./modules/auth";
import { domainRoutes } from "./modules/domains";
import { handleInboundEmail } from "./modules/email";
import { folderRoutes } from "./modules/folders";
import { inboxRoutes } from "./modules/inbox";
import { mailboxRoutes } from "./modules/mailboxes";
import { runRetentionCleanup } from "./modules/retention";
import { rulesetRoutes } from "./modules/rulesets";
import { syncRoutes } from "./modules/sync";
import { userRoutes } from "./modules/users";

const app = new Hono<AppEnv>();

app.use("*", requestLogger);

app.get("/api/v1/health", (c) => c.json({ data: { status: "ok" } }));

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/users", userRoutes);
app.route("/api/v1/domains", domainRoutes);
app.route("/api/v1/mailboxes", mailboxRoutes);
app.route("/api/v1/mailboxes", folderRoutes);
app.route("/api/v1/mailboxes", rulesetRoutes);
app.route("/api/v1/mailboxes", inboxRoutes);
app.route("/api/v1/mailboxes", syncRoutes);

app.onError((err, c) => {
  const logger = createLogger(c);

  if (err instanceof HTTPException) {
    logger.warn("HTTP exception", {
      status: err.status,
      message: err.message
    });
    return c.json({ error: { message: err.message } }, err.status);
  }

  logger.error("Unhandled error", err, {
    path: c.req.path
  });

  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred"
      }
    },
    500
  );
});

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export { app };

export default {
  fetch: (req: Request, env: Bindings, ctx: ExecutionContext) => {
    validateEnv(env);
    return app.fetch(req, env, ctx);
  },
  email: (message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext) => {
    validateEnv(env);
    return handleInboundEmail(message, env, ctx);
  },
  scheduled: (_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) => {
    validateEnv(env);
    const execution_id = crypto.randomUUID();
    const logger = createExecutionLogger(execution_id, { event: "retention_run" });
    ctx.waitUntil(
      runRetentionCleanup(env, { execution_id })
        .then((r) => logger.info("retention_run", { ...r }))
        .catch((err) => logger.error("retention_run_failed", err))
    );
  }
};
