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

export function formatRelativeTime(value: DateInput): string {
  const target = toDate(value).getTime();
  const nowMs = Date.now();
  const diffMs = Math.max(0, nowMs - target);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  let unit: Intl.RelativeTimeFormatUnit;
  let amount: number;
  if (diffMs < hour) {
    unit = "minute";
    amount = -Math.max(1, Math.round(diffMs / minute));
  } else if (diffMs < day) {
    unit = "hour";
    amount = -Math.max(1, Math.round(diffMs / hour));
  } else if (diffMs < week) {
    unit = "day";
    amount = -Math.max(1, Math.round(diffMs / day));
  } else if (diffMs < month) {
    unit = "week";
    amount = -Math.max(1, Math.round(diffMs / week));
  } else if (diffMs < year) {
    unit = "month";
    amount = -Math.max(1, Math.round(diffMs / month));
  } else {
    unit = "year";
    amount = -Math.max(1, Math.round(diffMs / year));
  }
  return new Intl.RelativeTimeFormat(localeTag(), { numeric: "auto" }).format(amount, unit);
}
