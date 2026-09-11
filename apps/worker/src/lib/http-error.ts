import { API_ERROR_CODES } from "@runmail/shared";

export function badRequest(details: Record<string, unknown>) {
  return {
    error: {
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: "Validasi gagal",
      details
    }
  };
}

export function notFound(message: string) {
  return {
    error: {
      code: API_ERROR_CODES.NOT_FOUND,
      message
    }
  };
}
