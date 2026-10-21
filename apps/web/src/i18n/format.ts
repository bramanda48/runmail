import { localeTag } from "./index";

export type DateInput = Date | number | string;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tag = localeTag();
  const key = `${tag}|${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(tag, options);
  formatterCache.set(key, formatter);
  return formatter;
}

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatTime(value: DateInput): string {
  return getFormatter({ hour: "2-digit", minute: "2-digit" }).format(toDate(value));
}

export function formatShortDate(value: DateInput): string {
  return getFormatter({ day: "2-digit", month: "short" }).format(toDate(value));
}

export function formatNumericDate(value: DateInput): string {
  return getFormatter({ day: "2-digit", month: "2-digit", year: "numeric" }).format(toDate(value));
}

export function formatDateTime(value: DateInput): string {
  return getFormatter({
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(value));
}

export function formatFullDate(value: DateInput): string {
  return getFormatter({
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate(value));
}
