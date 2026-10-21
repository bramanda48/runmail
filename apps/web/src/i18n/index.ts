import { createI18n } from "vue-i18n";
import en from "./locales/en";
import id from "./locales/id";
import "./types";

export const SUPPORTED_LOCALES = ["en", "id"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = "runmail_locale";

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  id: "id-ID",
};

function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the locale
    // still applies for the current session.
  }
}

function detectLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) return stored;

  const preferred = typeof navigator === "undefined" ? undefined : navigator.languages?.[0];
  const detected: Locale = preferred?.toLowerCase().startsWith("id") ? "id" : "en";
  persistLocale(detected);
  return detected;
}

let currentLocale: Locale = detectLocale();

export function getLocale(): Locale {
  return currentLocale;
}

export function localeTag(locale: Locale = currentLocale): string {
  return LOCALE_TAGS[locale];
}

function syncDocumentLang(locale: Locale): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = LOCALE_TAGS[locale];
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: currentLocale,
  fallbackLocale: "en",
  messages: { en, id },
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
});

export function setLocale(locale: Locale): void {
  if (!isSupportedLocale(locale) || locale === currentLocale) return;

  currentLocale = locale;
  i18n.global.locale.value = locale;
  syncDocumentLang(locale);
  persistLocale(locale);
}

syncDocumentLang(currentLocale);
