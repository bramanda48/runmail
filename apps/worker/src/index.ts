import { Hono } from "hono";
import type { Bindings } from "./lib/db";
import type { AppEnv } from "./lib/env";
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

app.get("/api/v1/health", (c) => c.json({ data: { status: "ok" } }));

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/users", userRoutes);
app.route("/api/v1/domains", domainRoutes);
app.route("/api/v1/mailboxes", mailboxRoutes);
app.route("/api/v1/mailboxes", folderRoutes);
app.route("/api/v1/mailboxes", rulesetRoutes);
app.route("/api/v1/mailboxes", inboxRoutes);
app.route("/api/v1/mailboxes", syncRoutes);

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  email: handleInboundEmail,
  scheduled: (_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) => {
    ctx.waitUntil(
      runRetentionCleanup(env)
        .then((r) => console.log(JSON.stringify({ event: "retention_run", ...r })))
        .catch((err) =>
          console.error(
            JSON.stringify({
              event: "retention_run_failed",
              error: String(err)
            })
          )
        )
    );
  }
};
