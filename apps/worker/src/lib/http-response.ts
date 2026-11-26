import type { AppEnv } from "@/lib/env";
import { apiError, apiSuccess, type ApiErrorCode, type ApiMeta } from "@runmail/shared";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function ok<T>(c: Context<AppEnv>, data: T, meta?: ApiMeta, status: 200 | 201 = 200) {
  return c.json(apiSuccess(data, meta), status);
}

export function fail(
  c: Context<AppEnv>,
  code: ApiErrorCode,
  message: string,
  status: ContentfulStatusCode,
  details?: Record<string, unknown>,
) {
  return c.json(apiError(code, message, details), status);
}
