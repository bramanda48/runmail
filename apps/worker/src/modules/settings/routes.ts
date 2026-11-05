import type { AppEnv } from "@/lib/env";
import { notFound } from "@/lib/http-error";
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
  return c.json({ data: projected }, 200);
});

settingsRoutes.get("/:key", async (c) => {
  const key = c.req.param("key");
  if (!(PUBLIC_SETTING_KEYS as readonly string[]).includes(key)) {
    return c.json(notFound("Pengaturan tidak ditemukan"), 404);
  }
  const value = await getPublicSettingValue(c, key as (typeof PUBLIC_SETTING_KEYS)[number]);
  return c.json({ data: { key, value } }, 200);
});
