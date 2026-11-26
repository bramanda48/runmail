import { API_ERROR_CODES, apiError } from "@runmail/shared";

export function badRequest(details: Record<string, unknown>) {
  return apiError(API_ERROR_CODES.VALIDATION_ERROR, "Validasi gagal", details);
}

export function notFound(message: string) {
  return apiError(API_ERROR_CODES.NOT_FOUND, message);
}
