/* ==========================================================
   STORE THEME → CSS (server + client dono par chalta hai)
   ----------------------------------------------------------
   Store editor ka published theme (backend /theme/public) sirf
   `--user-*` CSS variables override karta hai — components wahi
   hain, koi rewrite nahi (src/app/user.css ke tokens).

   • Accent colors light + dark dono modes me lagte hain.
   • Surface colors (background / card / text / border) SIRF light
     mode me — dark mode (`:root.user-dark`) ke built-in values safe
     rehte hain, taake seller ke light colors dark UI na todein.
   • null / missing value → kuch override nahi (built-in default).
   • Fonts sirf LTR par (Urdu/Arabic ke RTL fonts root layout se).

   Sab values backend validator se guzar chuki hain (hex, whitelist),
   phir bhi yahan dobara check — CSS injection ka koi raasta nahi.
   ========================================================== */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Backend config/themeSchema.js ke FONTS ke saath sync rakho
export const THEME_FONTS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Nunito",
  "DM Sans",
  "Playfair Display",
  "Merriweather",
  "Cairo",
  "Tajawal",
  "Noto Naskh Arabic",
];

const ACCENT_VARS = {
  accent: "--user-accent",
  accentHover: "--user-accent-hover",
  accentText: "--user-accent-text",
};

const SURFACE_VARS = {
  background: "--user-bg",
  card: "--user-bg-card",
  text: "--user-text",
  border: "--user-border",
};

const RADIUS = {
  none: ["0px", "0px", "0px", "0px"],
  small: ["4px", "6px", "8px", "12px"],
  large: ["12px", "16px", "22px", "32px"],
};

const color = (v) => (typeof v === "string" && HEX.test(v) ? v : null);
const font = (v) => (THEME_FONTS.includes(v) ? v : null);

/** true → store ne apna accent set kiya (home ka purana orange override skip) */
export function hasCustomAccent(theme) {
  return Boolean(color(theme?.settings?.colors?.accent));
}

export function buildThemeCss(theme) {
  const colors = theme?.settings?.colors || {};
  const typography = theme?.settings?.typography || {};
  const radius = RADIUS[theme?.settings?.layout?.radius];
  const rules = [];

  const accentDecls = [];
  for (const [key, cssVar] of Object.entries(ACCENT_VARS)) {
    const v = color(colors[key]);
    if (v) accentDecls.push(`${cssVar}:${v}`);
  }
  const accent = color(colors.accent);
  if (accent) {
    if (!color(colors.accentHover)) {
      accentDecls.push(`--user-accent-hover:color-mix(in srgb, ${accent} 85%, #000)`);
    }
    accentDecls.push(`--user-accent-soft:color-mix(in srgb, ${accent} 14%, transparent)`);
  }
  if (radius) {
    ["sm", "md", "lg", "xl"].forEach((size, i) => accentDecls.push(`--user-radius-${size}:${radius[i]}`));
  }
  if (accentDecls.length) rules.push(`#user-theme{${accentDecls.join(";")}}`);

  const surfaceDecls = [];
  for (const [key, cssVar] of Object.entries(SURFACE_VARS)) {
    const v = color(colors[key]);
    if (v) surfaceDecls.push(`${cssVar}:${v}`);
  }
  if (surfaceDecls.length) rules.push(`:root:not(.user-dark) #user-theme{${surfaceDecls.join(";")}}`);

  const body = font(typography.bodyFont);
  const heading = font(typography.headingFont);
  if (body) rules.push(`#user-theme[dir="ltr"]{font-family:"${body}",system-ui,sans-serif}`);
  if (heading) {
    rules.push(`#user-theme[dir="ltr"] :is(h1,h2,h3,h4){font-family:"${heading}",system-ui,sans-serif}`);
  }

  return rules.join("\n");
}

/** Google Fonts stylesheet URL (sirf whitelist) — koi font na ho to null */
export function themeFontsHref(theme) {
  const typography = theme?.settings?.typography || {};
  const families = [...new Set([font(typography.bodyFont), font(typography.headingFont)].filter(Boolean))];
  if (!families.length) return null;
  const query = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
