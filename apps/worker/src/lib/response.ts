import {
  API_ERROR_CODES,
  apiError,
  apiSuccess,
  type ApiErrorCode,
  type ApiMeta,
} from "@runmail/shared";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function ok<T>(c: Context, data: T, meta?: ApiMeta, status: 200 | 201 = 200) {
  return c.json(apiSuccess(data, meta), status);
}

export function fail(
  c: Context,
  code: ApiErrorCode,
  message: string,
  status: ContentfulStatusCode,
  details?: Record<string, unknown>,
) {
  return c.json(apiError(code, message, details), status);
}

export function badRequest(c: Context, details: Record<string, unknown>) {
  return fail(c, API_ERROR_CODES.VALIDATION_ERROR, "Validasi gagal", 400, details);
}

export function notFound(c: Context, message: string) {
  return fail(c, API_ERROR_CODES.NOT_FOUND, message, 404);
}

const HTTP_STATUS_ERROR_CODES: Partial<Record<number, ApiErrorCode>> = {
  400: API_ERROR_CODES.VALIDATION_ERROR,
  401: API_ERROR_CODES.UNAUTHORIZED,
  403: API_ERROR_CODES.FORBIDDEN,
  404: API_ERROR_CODES.NOT_FOUND,
  429: API_ERROR_CODES.RATE_LIMITED,
};

export function errorCodeForStatus(status: number): ApiErrorCode {
  if (status >= 500) return API_ERROR_CODES.INTERNAL_ERROR;
  return HTTP_STATUS_ERROR_CODES[status] ?? API_ERROR_CODES.VALIDATION_ERROR;
}
