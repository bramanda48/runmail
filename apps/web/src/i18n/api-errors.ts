import { i18n } from "./index";

const STATUS_KEYS: Record<number, string> = {
  400: "badRequest",
  401: "unauthorized",
  403: "forbidden",
  404: "notFound",
  409: "conflict",
  429: "rateLimited",
  500: "internal",
};

export function translateApiError(err: {
  code?: string;
  status?: number;
  message?: string;
}): string {
  const code = err.code?.trim();
  if (code) {
    const key = `errors.codes.${code}`;
    if (i18n.global.te(key)) return i18n.global.t(key);
  }

  if (typeof err.status === "number") {
    const statusKey = STATUS_KEYS[err.status];
    if (statusKey) {
      const key = `errors.status.${statusKey}`;
      if (i18n.global.te(key)) return i18n.global.t(key);
    }
  }

  if (err.message) return err.message;

  return i18n.global.t("errors.status.unknown");
}

export function translateFieldErrors(details: unknown): Record<string, string[]> {
  const translated: Record<string, string[]> = {};
  if (details === null || typeof details !== "object") return translated;

  for (const [field, value] of Object.entries(details as Record<string, unknown>)) {
    const messages = Array.isArray(value) ? value : [value];
    const strings = messages.filter((message): message is string => typeof message === "string");
    if (strings.length === 0) continue;

    translated[field] = strings.map((message) =>
      i18n.global.te(message) ? i18n.global.t(message) : message,
    );
  }

  return translated;
}
