import type { AppEnv } from "@/lib/env";
import { publicJwk } from "@/modules/auth/keypair";
import { API_ERROR_CODES } from "@runmail/shared";
import { Hono } from "hono";

export const wellKnownRoutes = new Hono<AppEnv>();

wellKnownRoutes.get("/jwks.json", async (c) => {
  try {
    const jwk = await publicJwk(c);
    return c.json({ keys: [jwk] }, 200, { "Cache-Control": "public, max-age=86400" });
  } catch {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.INTERNAL_ERROR,
          message: "Kunci keamanan tidak tersedia",
        },
      },
      500,
    );
  }
});
