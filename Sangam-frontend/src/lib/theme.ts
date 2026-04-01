import { useEffect, useState } from "react";

const STORAGE_KEY = "sangam-theme";
export type ThemePreference = "light" | "dark" | "system";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveThemePreference(preference: ThemePreference): Theme {
  return preference === "system" ? getSystemTheme() : preference;
}

export function applyThemePreference(preference: ThemePreference) {
  const resolved = resolveThemePreference(preference);
  applyTheme(resolved);
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }
  return resolved;
}

export function getStoredThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function initializeTheme() {
  return applyThemePreference(getStoredThemePreference());
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference());
  const [theme, setTheme] = useState<Theme>(() => resolveThemePreference(preference));

  useEffect(() => {
    setTheme(applyThemePreference(preference));
  }, [preference]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystem = () => {
      if (preference === "system") {
        setTheme(applyThemePreference("system"));
      }
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncWithSystem);
      return () => media.removeEventListener("change", syncWithSystem);
    }

    media.addListener(syncWithSystem);
    return () => media.removeListener(syncWithSystem);
  }, [preference]);

  const toggle = () => {
    setPreference((current) => (resolveThemePreference(current) === "dark" ? "light" : "dark"));
  };

  return {
    theme,
    preference,
    toggle,
    setThemePreference: setPreference,
  } as const;
}
