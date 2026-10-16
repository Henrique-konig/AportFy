// =========================================================
// AportFy — ui/theme.js
// Tema claro / escuro / do sistema. A preferência fica no navegador; um
// script no <head> do index.html aplica o tema antes da página aparecer.
// =========================================================

const THEME_KEY = "aportfy_theme";
const THEMES = ["dark", "light", "system"];

const themeEl = {
  toggle: document.getElementById("theme-toggle"),
  options: document.querySelectorAll("[data-theme-option]"),
  meta: document.querySelector('meta[name="theme-color"]'),
};

const prefersLight = () => window.matchMedia?.("(prefers-color-scheme: light)").matches === true;

export function getThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : "dark";
  } catch {
    return "dark";
  }
}

/** Tema efetivo ("dark" | "light") para uma preferência. */
export function resolveTheme(preference = getThemePreference()) {
  return preference === "system" ? (prefersLight() ? "light" : "dark") : preference;
}

export function applyTheme(preference = getThemePreference()) {
  const theme = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle("theme-light", theme === "light");
  root.classList.toggle("dark", theme !== "light");
  themeEl.meta?.setAttribute("content", theme === "light" ? "#f1f5f9" : "#020617");

  if (themeEl.toggle) {
    const next = theme === "light" ? "escuro" : "claro";
    themeEl.toggle.setAttribute("aria-label", `Ativar tema ${next}`);
    themeEl.toggle.setAttribute("title", `Ativar tema ${next}`);
    const icon = themeEl.toggle.querySelector("i");
    if (icon) icon.className = `ph-bold ${theme === "light" ? "ph-moon" : "ph-sun"} text-xl`;
  }
  themeEl.options.forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.themeOption === preference)));
}

export function setThemePreference(preference) {
  if (!THEMES.includes(preference)) return;
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    /* sem storage: o tema vale só nesta visita */
  }
  applyTheme(preference);
}

export function bindTheme() {
  themeEl.toggle?.addEventListener("click", () => setThemePreference(resolveTheme() === "light" ? "dark" : "light"));
  themeEl.options.forEach((btn) => btn.addEventListener("click", () => setThemePreference(btn.dataset.themeOption)));
  window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", () => {
    if (getThemePreference() === "system") applyTheme("system");
  });
  applyTheme();
}
