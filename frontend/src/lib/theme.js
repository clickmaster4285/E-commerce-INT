"use client";

export function getThemeFromCookie() {
  if (typeof document === "undefined") return "dark";
  const cookies = document.cookie.split("; ");
  const themeCookie = cookies.find((cookie) => cookie.startsWith("user-theme="));
  if (!themeCookie) return "dark";
  return themeCookie.split("=")[1];
}

export function setUserTheme(theme) {
  if (typeof document === "undefined") return;
  document.cookie = `user-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  const element = document.getElementById("user-theme");
  if (element) element.classList.toggle("light", theme === "light");
}

export function initThemeFromCookie() {
  if (typeof document === "undefined") return;
  const savedTheme = getThemeFromCookie();
  const element = document.getElementById("user-theme");
  if (element) element.classList.toggle("light", savedTheme === "light");
}