import { ref } from "vue";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "runmail_theme";
const DARK_MEDIA = "(prefers-color-scheme: dark)";

const currentTheme = ref<Theme>("system");
const currentResolved = ref<ResolvedTheme>("light");

let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); theme still applies for the session.
  }
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return window.matchMedia(DARK_MEDIA).matches ? "dark" : "light";
  return theme;
}

function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function detachMediaListener(): void {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener("change", mediaListener);
  }
  mediaQuery = null;
  mediaListener = null;
}

function attachMediaListener(): void {
  if (typeof window === "undefined") return;
  mediaQuery = window.matchMedia(DARK_MEDIA);
  mediaListener = (e: MediaQueryListEvent) => {
    if (currentTheme.value !== "system") return;
    const resolved: ResolvedTheme = e.matches ? "dark" : "light";
    currentResolved.value = resolved;
    applyTheme(resolved);
  };
  mediaQuery.addEventListener("change", mediaListener);
}

export function setTheme(theme: Theme): void {
  if (!isTheme(theme) || theme === currentTheme.value) return;
  currentTheme.value = theme;
  const resolved = resolveTheme(theme);
  currentResolved.value = resolved;
  applyTheme(resolved);
  persistTheme(theme);
  if (theme === "system") {
    attachMediaListener();
  } else {
    detachMediaListener();
  }
}

export function initTheme(): void {
  const stored = readStoredTheme();
  const theme = stored ?? "system";
  currentTheme.value = theme;
  const resolved = resolveTheme(theme);
  currentResolved.value = resolved;
  applyTheme(resolved);
  if (theme === "system") attachMediaListener();
}

export { currentResolved, currentTheme };
