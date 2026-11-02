import type { AppEnv } from "@/lib/env";
import { errorCodeForStatus } from "@/lib/error";
import { createLogger } from "@/lib/logger";
import { requestLogger } from "@/middleware/logging";
import { authRoutes } from "@/modules/auth";
import { cloudflareRoutes } from "@/modules/cloudflare";
import { domainRoutes } from "@/modules/domains";
import { folderRoutes } from "@/modules/folders";
import { mailboxRoutes } from "@/modules/mailboxes";
import { messageRoutes } from "@/modules/messages";
import { rulesetRoutes } from "@/modules/rulesets";
import { settingsRoutes } from "@/modules/settings";
import { syncRoutes } from "@/modules/sync";
import { teamRoutes } from "@/modules/teams";
import { userRoutes } from "@/modules/users";
import { API_ERROR_CODES } from "@runmail/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

const app = new Hono<AppEnv>();

app.use("*", requestLogger);
app.get("/api/v1/health", (c) => c.json({ data: { status: "ok" } }));

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/users", userRoutes);
app.route("/api/v1/domains", domainRoutes);
app.route("/api/v1/teams", teamRoutes);
app.route("/api/v1/mailboxes", mailboxRoutes);
app.route("/api/v1/mailboxes", folderRoutes);
app.route("/api/v1/mailboxes", rulesetRoutes);
app.route("/api/v1/mailboxes", messageRoutes);
app.route("/api/v1/mailboxes", syncRoutes);
app.route("/api/v1/integrations", cloudflareRoutes);
app.route("/api/v1/settings", settingsRoutes);

app.onError((err, c) => {
  const logger = createLogger(c);

  if (err instanceof HTTPException) {
    logger.warn("HTTP exception", {
      status: err.status,
      message: err.message,
    });
    return c.json(
      { error: { code: errorCodeForStatus(err.status), message: err.message } },
      err.status,
    );
  }

  logger.error("Unhandled error", err, {
    path: c.req.path,
  });

  return c.json(
    {
      error: {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: "An unexpected error occurred",
      },
    },
    500,
  );
});

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export { app };
