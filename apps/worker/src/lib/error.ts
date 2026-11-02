import { API_ERROR_CODES, type ApiErrorCode } from "@runmail/shared";

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
