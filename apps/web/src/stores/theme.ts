import { defineStore } from "pinia";
import type { Ref } from "vue";
import { ref } from "vue";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "runmail_theme";
const DARK_MEDIA = "(prefers-color-scheme: dark)";

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

function attachMediaListener(theme: Ref<Theme>, resolved: Ref<ResolvedTheme>): void {
  if (typeof window === "undefined") return;
  detachMediaListener();
  mediaQuery = window.matchMedia(DARK_MEDIA);
  mediaListener = (e: MediaQueryListEvent) => {
    if (theme.value !== "system") return;
    const nextResolved: ResolvedTheme = e.matches ? "dark" : "light";
    resolved.value = nextResolved;
    applyTheme(nextResolved);
  };
  mediaQuery.addEventListener("change", mediaListener);
}

/**
 * Theme store: the user's choice (`light` | `dark` | `system`), the resolved
 * concrete theme, and the side effects that keep the DOM, localStorage, and
 * the OS colour-scheme listener in sync.
 */
export const useThemeStore = defineStore("theme", () => {
  const theme = ref<Theme>("system");
  const resolved = ref<ResolvedTheme>("light");

  function setTheme(next: Theme): void {
    if (!isTheme(next) || next === theme.value) return;
    theme.value = next;
    const nextResolved = resolveTheme(next);
    resolved.value = nextResolved;
    applyTheme(nextResolved);
    persistTheme(next);
    if (next === "system") {
      attachMediaListener(theme, resolved);
    } else {
      detachMediaListener();
    }
  }

  function init(): void {
    const stored = readStoredTheme();
    const next = stored ?? "system";
    theme.value = next;
    const nextResolved = resolveTheme(next);
    resolved.value = nextResolved;
    applyTheme(nextResolved);
    if (next === "system") attachMediaListener(theme, resolved);
  }

  return { theme, resolved, setTheme, init };
});
