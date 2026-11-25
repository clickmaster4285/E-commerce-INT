/* ==========================================================
   STORE THEME → CSS (server + client dono par chalta hai)
   ----------------------------------------------------------
   Store editor ka published theme (backend /theme/public) sirf
   `--user-*` CSS variables + chand style hooks override karta hai —
   components wahi hain, koi rewrite nahi (src/app/user.css ke tokens).

   • Accent colors light + dark dono modes me lagte hain.
   • Surface colors (background / card / text / border) SIRF light
     mode me — dark mode ke apne colors `darkColors` group se.
   • Buttons: primary = accent background wale <button>/<a>.
   • Product cards: ProductCard ke `product-card-*` hook classes.
   • Animations: HomeClient ka `[data-theme-section]` wrapper.
   • null / missing / "default" value → kuch override nahi.
   • Fonts sirf LTR par (Urdu/Arabic ke RTL fonts root layout se).

   Theme ke rules unlayered hain → Tailwind utilities (@layer) se
   jeet-te hain bina !important ke.
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

// Google Fonts css2 poori request 400 kar deta hai agar koi weight font me na ho
// → har font ke sirf mojood weights (static fonts: Lato, Merriweather, Tajawal ...)
const ALL_WEIGHTS = "400;500;600;700;800;900";
const FONT_WEIGHTS = {
  "Open Sans": "400;500;600;700;800",
  Lato: "400;700;900",
  Merriweather: "400;700;900",
  Tajawal: "400;500;700;800;900",
  "Noto Naskh Arabic": "400;500;600;700",
};

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

const HEADING_WEIGHTS = new Set(["500", "600", "700", "800", "900"]);
const HEADING_ZOOM = { small: 0.9, large: 1.12, xlarge: 1.25 };
const HEADING_SPACING = { tight: "-0.02em", wide: "0.06em" };
const TEXT_SIZE = { small: "93.75%", large: "106.25%" };
const IMAGE_RATIO = { square: "1/1", portrait: "3/4", landscape: "4/3" };
const REVEAL_FROM = {
  fade: "opacity:0",
  slide: "opacity:0;transform:translateY(32px)",
  zoom: "opacity:0;transform:scale(.96)",
};

const color = (v) => (typeof v === "string" && HEX.test(v) ? v : null);
const font = (v) => (THEME_FONTS.includes(v) ? v : null);
const group = (theme, name) => {
  const g = theme?.settings?.[name];
  return g && typeof g === "object" ? g : {};
};

// Badge text color: background ke hisaab se kala ya safed (contrast)
export function readableOn(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#111111" : "#ffffff";
}

/** true → store ne apna accent set kiya (home / filtering ka purana orange override skip) */
export function hasCustomAccent(theme) {
  return Boolean(color(group(theme, "colors").accent) || color(group(theme, "darkColors").accent));
}

/** Sections scroll par animate hon? (HomeClient wrapper isi se lagta hai) */
export function revealEnabled(theme) {
  return Boolean(REVEAL_FROM[group(theme, "animations").reveal]);
}

const accentDerived = (accent, hoverSet) => [
  ...(hoverSet ? [] : [`--user-accent-hover:color-mix(in srgb, ${accent} 85%, #000)`]),
  `--user-accent-soft:color-mix(in srgb, ${accent} 14%, transparent)`,
];

function colorRules(theme, rules) {
  const colors = group(theme, "colors");
  const radius = RADIUS[group(theme, "layout").radius];

  const accentDecls = [];
  for (const [key, cssVar] of Object.entries(ACCENT_VARS)) {
    const v = color(colors[key]);
    if (v) accentDecls.push(`${cssVar}:${v}`);
  }
  const accent = color(colors.accent);
  if (accent) accentDecls.push(...accentDerived(accent, color(colors.accentHover)));
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

  // Dark mode ke apne colors
  const dark = group(theme, "darkColors");
  const darkDecls = [];
  const darkAccent = color(dark.accent);
  if (darkAccent) darkDecls.push(`--user-accent:${darkAccent}`, ...accentDerived(darkAccent, false));
  for (const [key, cssVar] of Object.entries(SURFACE_VARS)) {
    const v = color(dark[key]);
    if (v) darkDecls.push(`${cssVar}:${v}`);
  }
  if (darkDecls.length) rules.push(`:root.user-dark #user-theme{${darkDecls.join(";")}}`);
}

function typographyRules(theme, rules) {
  const typography = group(theme, "typography");
  const body = font(typography.bodyFont);
  const heading = font(typography.headingFont);
  if (body) rules.push(`#user-theme[dir="ltr"]{font-family:"${body}",system-ui,sans-serif}`);
  if (heading) {
    rules.push(`#user-theme[dir="ltr"] :is(h1,h2,h3,h4){font-family:"${heading}",system-ui,sans-serif}`);
  }

  // Sirf page / section headings (h1, h2) — product card titles (h3/h4) waise hi
  const h = [];
  if (HEADING_WEIGHTS.has(typography.headingWeight)) h.push(`font-weight:${typography.headingWeight}`);
  if (HEADING_ZOOM[typography.headingSize]) h.push(`zoom:${HEADING_ZOOM[typography.headingSize]}`);
  if (typography.headingCase === "uppercase") h.push("text-transform:uppercase");
  if (HEADING_SPACING[typography.headingSpacing]) h.push(`letter-spacing:${HEADING_SPACING[typography.headingSpacing]}`);
  if (h.length) rules.push(`#user-theme :is(h1,h2){${h.join(";")}}`);

  // Poora UI rem par hai → root font-size se sab proportionally
  if (TEXT_SIZE[typography.textSize]) rules.push(`html{font-size:${TEXT_SIZE[typography.textSize]}}`);
}

// Primary buttons = accent background wale button / link (Add to cart, Buy, Subscribe ...)
const BTN = '#user-theme :is(button,a)[class~="bg-user-accent"]';
const NOT_ROUND = ':not([class~="rounded-full"])'; // gol icon buttons gol hi rahein

function buttonRules(theme, rules) {
  const b = group(theme, "buttons");
  if (b.shape === "square") rules.push(`${BTN}${NOT_ROUND}{border-radius:0}`);
  if (b.shape === "rounded") rules.push(`${BTN}${NOT_ROUND}{border-radius:var(--user-radius-md)}`);
  if (b.shape === "pill") rules.push(`${BTN}{border-radius:9999px}`);
  if (b.style === "outline") {
    rules.push(
      `${BTN}{background-color:var(--user-bg-card);color:var(--user-accent);box-shadow:inset 0 0 0 1.5px var(--user-accent)}`,
      `${BTN}:hover{background-color:var(--user-accent);color:var(--user-accent-text)}`,
    );
  }
  if (b.textCase === "uppercase") rules.push(`${BTN}{text-transform:uppercase;letter-spacing:.04em}`);
  if (b.hover === "lift") {
    rules.push(
      `${BTN}{transition:transform .15s ease,box-shadow .15s ease,background-color .15s ease}`,
      `${BTN}:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 18px -8px var(--user-accent)}`,
    );
  }
  if (b.hover === "glow") rules.push(`${BTN}:hover:not(:disabled){box-shadow:0 0 0 4px var(--user-accent-soft)}`);
}

const CARD = "#user-theme .product-card";

function cardRules(theme, rules) {
  const c = group(theme, "cards");
  if (c.style === "bordered") rules.push(`${CARD}{border:1px solid var(--user-border);border-radius:var(--user-radius-lg)}`);
  if (c.style === "shadow") {
    rules.push(
      `${CARD}{border-radius:var(--user-radius-lg);box-shadow:0 1px 3px rgb(0 0 0/.06),0 8px 24px -14px rgb(0 0 0/.22);transition:box-shadow .2s ease}`,
      `${CARD}:hover{box-shadow:0 2px 6px rgb(0 0 0/.08),0 16px 32px -14px rgb(0 0 0/.28)}`,
    );
  }
  if (IMAGE_RATIO[c.imageRatio]) rules.push(`${CARD} .product-card-media{height:auto;aspect-ratio:${IMAGE_RATIO[c.imageRatio]}}`);
  if (c.imageFit === "contain") rules.push(`${CARD} .product-card-media img{object-fit:contain}`);
  if (c.hoverZoom === false) rules.push(`${CARD}:hover .product-card-media img{scale:none;transform:none}`);
  if (c.textAlign === "center") {
    rules.push(`${CARD} .product-card-body{text-align:center}`, `${CARD} .product-card-body>div{justify-content:center}`);
  }
  if (c.showBrand === false) rules.push(`${CARD} .product-card-brand{display:none}`);
  if (c.showRating === false) rules.push(`${CARD} .product-card-rating{display:none}`);
  if (c.showWishlist === false) rules.push(`${CARD} .product-card-wishlist{display:none}`);
  if (c.quickActions === false) rules.push(`${CARD} :is(.product-card-action-overlay,.product-card-touch-actions){display:none!important}`);

  const badges = group(theme, "badges");
  if (badges.showDeal === false) rules.push(`${CARD} :is(.product-card-deal-badge,.product-card-deal-mention){display:none}`);
  if (badges.showStock === false) rules.push(`${CARD} .product-card-stock{display:none}`);
  if (badges.shape === "square") rules.push(`${CARD} :is(.product-card-badges>span,.product-card-deal-mention>span){border-radius:4px}`);
  const sale = color(badges.saleColor);
  if (sale) rules.push(`${CARD} .product-card-deal-badge{background:${sale};color:${readableOn(sale)}}`);
}

/* Header / nav / footer ka apna color: us bar ke andar --user-* tokens
   background ke hisaab se (readable text). Dropdowns (.storefront-popover)
   bar ke andar hote hue bhi page ke asli tokens wapas le lete hain:
   #user-theme par --sf-* = asli values (resolve ho kar inherit hoti hain). */
const BAR_TOKENS = [
  "bg-elevated",
  "bg-card",
  "bg-hover",
  "bg-input",
  "text",
  "text-secondary",
  "text-muted",
  "text-subtle",
  "border",
  "border-soft",
  "border-hover",
  "icon-color",
];

function barDecls(bg) {
  const fg = readableOn(bg);
  const mix = (pct) => `color-mix(in srgb, ${fg} ${pct}%, transparent)`;
  const tint = (pct) => `color-mix(in srgb, ${fg} ${pct}%, ${bg})`;
  return [
    `--user-bg-elevated:${bg}`,
    `--user-bg-card:${tint(8)}`,
    `--user-bg-hover:${mix(12)}`,
    `--user-bg-input:${tint(10)}`,
    `--user-text:${fg}`,
    `--user-text-secondary:${mix(85)}`,
    `--user-text-muted:${mix(72)}`,
    `--user-text-subtle:${mix(60)}`,
    `--user-border:${mix(18)}`,
    `--user-border-soft:${mix(12)}`,
    `--user-border-hover:${mix(30)}`,
    `--user-icon-color:${mix(80)}`,
    `background-color:${bg}`,
  ].join(";");
}

const BARS = [
  { group: "header", selector: ".storefront-header" },
  { group: "navigation", selector: ".user-home-nav" },
  { group: "footer", selector: ".storefront-footer" },
];

function barRules(theme, rules) {
  const colored = BARS.map((bar) => ({ ...bar, bg: color(group(theme, bar.group).background) })).filter((bar) => bar.bg);
  if (!colored.length) return;
  rules.push(`#user-theme{${BAR_TOKENS.map((t) => `--sf-${t}:var(--user-${t})`).join(";")}}`);
  const restore = BAR_TOKENS.map((t) => `--user-${t}:var(--sf-${t})`).join(";");
  for (const bar of colored) {
    rules.push(`#user-theme ${bar.selector}{${barDecls(bar.bg)}}`);
    rules.push(`#user-theme ${bar.selector} .storefront-popover{${restore}}`);
  }
  // Login pill accent rang ka hai → colored header par accent ke upar gayab na ho
  if (colored.some((bar) => bar.group === "header")) {
    rules.push("#user-theme .storefront-header .storefront-login{color:var(--user-text);border-color:var(--user-border);background-color:var(--user-bg-hover)}");
  }
}

function animationRules(theme, rules) {
  const from = REVEAL_FROM[group(theme, "animations").reveal];
  if (!from) return;
  // Sirf jahan browser scroll-timeline samjhe; reduced-motion par kabhi nahi.
  // End frame transform:none → wrapper containing block / stacking context na bane.
  rules.push(
    `@keyframes user-section-reveal{from{${from}}to{opacity:1;transform:none}}`,
    `@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){#user-theme [data-theme-section]{animation:user-section-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 40%}}}`,
  );
}

export function buildThemeCss(theme) {
  const rules = [];
  colorRules(theme, rules);
  typographyRules(theme, rules);
  buttonRules(theme, rules);
  cardRules(theme, rules);
  barRules(theme, rules);
  animationRules(theme, rules);
  return rules.join("\n");
}

/** Google Fonts stylesheet URL (sirf whitelist) — koi font na ho to null */
export function themeFontsHref(theme) {
  const typography = group(theme, "typography");
  const families = [...new Set([font(typography.bodyFont), font(typography.headingFont)].filter(Boolean))];
  if (!families.length) return null;
  const query = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@${FONT_WEIGHTS[f] || ALL_WEIGHTS}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
