import type { AppEnv } from "@/lib/env";
import { notFound, ok } from "@/lib/response";
import { jwtAuth } from "@/middleware/auth";
import {
  getPublicSettings,
  getPublicSettingValue,
  PUBLIC_SETTING_KEYS,
} from "@/modules/settings/service";
import { Hono } from "hono";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.get("/", jwtAuth, async (c) => {
  // ensureSettings inside getPublicSettings auto-provisions on clean install.
  const projected = await getPublicSettings(c);
  return ok(c, projected);
});

settingsRoutes.get("/:key", async (c) => {
  const key = c.req.param("key");
  if (!(PUBLIC_SETTING_KEYS as readonly string[]).includes(key)) {
    return notFound(c, "Setting not found");
  }
  const value = await getPublicSettingValue(c, key as (typeof PUBLIC_SETTING_KEYS)[number]);
  return ok(c, { key, value });
});
