"use client";

// ✅ DEFAULT THEME = LIGHT (white).
// Dark mode sirf tab lagta hai jab user ne toggle karke cookie `user-theme=dark`
// set ki ho. Class <html> par lagti hai (`:root.user-dark` overrides) taake
// root layout ka inline script pehle se hi paint se pehle apply kar de —
// is liye dark mode bhi bina flash ke chalta hai.
const DEFAULT_THEME = "light";

export function getThemeFromCookie() {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const cookies = document.cookie.split("; ");
  const themeCookie = cookies.find((cookie) => cookie.startsWith("user-theme="));
  if (!themeCookie) return DEFAULT_THEME;
  const value = themeCookie.split("=")[1];
  return value === "dark" ? "dark" : DEFAULT_THEME;
}

export function setUserTheme(theme) {
  if (typeof document === "undefined") return;
  const next = theme === "dark" ? "dark" : DEFAULT_THEME;
  document.cookie = `user-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.classList.toggle("user-dark", next === "dark");
}

export function initThemeFromCookie() {
  if (typeof document === "undefined") return;
  const savedTheme = getThemeFromCookie();
  document.documentElement.classList.toggle("user-dark", savedTheme === "dark");
}
