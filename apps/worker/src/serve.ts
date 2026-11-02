import { handleInboundEmail } from "@/handler/inbound";
import { validateEnv } from "@/lib/env";
import { createExecutionLogger } from "@/lib/logger";
import { app } from "@/main";
import { runRetentionCleanup } from "@/modules/retention";

export default {
  fetch: (req: Request, env: CloudflareBindings, ctx: ExecutionContext) => {
    validateEnv(env);
    return app.fetch(req, env, ctx);
  },
  email: (message: ForwardableEmailMessage, env: CloudflareBindings, ctx: ExecutionContext) => {
    validateEnv(env);
    return handleInboundEmail(message, env, ctx);
  },
  scheduled: (_controller: ScheduledController, env: CloudflareBindings, ctx: ExecutionContext) => {
    validateEnv(env);
    const execution_id = crypto.randomUUID();
    const logger = createExecutionLogger(execution_id, { event: "retention_run" });
    ctx.waitUntil(
      runRetentionCleanup(env, { execution_id })
        .then((r) => logger.info("retention_run", { ...r }))
        .catch((err) => logger.error("retention_run_failed", err)),
    );
  },
};
