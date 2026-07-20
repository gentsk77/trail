/* Theme switch: the dark token block ships in tokens.css behind
   [data-theme="dark"]; main.tsx resolves the initial value (saved choice,
   else OS preference). This module owns changes and their persistence. */

const KEY = "trail-theme";

export type Theme = "light" | "dark";

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable; the choice lives for the page's lifetime */
  }
}
