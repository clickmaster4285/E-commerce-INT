// Store editor — theme validation + rich text sanitizer (pure functions, DB nahi)
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { buildDefaultTheme, LIMITS, SECTION_TYPES } = require("../config/themeSchema");
const { validateThemeData, sanitizeRichText, safeHref } = require("../utils/themeValidator");

const STORE = String(new mongoose.Types.ObjectId());
const OTHER = String(new mongoose.Types.ObjectId());
const validate = (data) => validateThemeData(data, { storeId: STORE });

const withSection = (id, section) => {
  const theme = buildDefaultTheme();
  theme.sections[id] = section;
  theme.order.push(id);
  return theme;
};

// ───────────────────────── Defaults ─────────────────────────
test("default theme is valid and round-trips unchanged", () => {
  const theme = buildDefaultTheme();
  const r = validate(theme);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.data, theme);
});

test("default theme keeps today's homepage order and built-in colors", () => {
  const theme = buildDefaultTheme();
  assert.deepEqual(theme.order, [
    "hero_banners", "category_tiles", "deals", "featured_products",
    "popular_categories", "brand_strip", "brand_showcase",
  ]);
  assert.ok(Object.values(theme.settings.colors).every((v) => v === null));
  assert.deepEqual(theme.menus, { main: [], footer: [] });
});

test("every section type has a valid default", () => {
  for (const type of Object.keys(SECTION_TYPES)) {
    const theme = { order: [`x_${type}`], sections: { [`x_${type}`]: { type } } };
    const r = validate(theme);
    assert.equal(r.ok, true, `${type}: ${JSON.stringify(r.errors)}`);
  }
});

// ───────────────────────── Rejections ─────────────────────────
test("rejects unknown section type", () => {
  const r = validate(withSection("evil", { type: "script_injector" }));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /unknown section type/);
});

test("rejects single-instance section added twice", () => {
  const r = validate(withSection("hero2", { type: "hero_banners" }));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /at most 1/);
});

test("rejects invalid section id and duplicate ids in order", () => {
  const theme = buildDefaultTheme();
  theme.order.push("Bad Id!", "deals");
  const r = validate(theme);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /invalid section id/);
  assert.match(r.errors.join(), /duplicate section id/);
});

test("rejects bad colors, accepts hex and null", () => {
  const theme = buildDefaultTheme();
  theme.settings.colors.accent = "red; background:url(x)";
  assert.equal(validate(theme).ok, false);
  theme.settings.colors.accent = "#F97316";
  const r = validate(theme);
  assert.equal(r.ok, true);
  assert.equal(r.data.settings.colors.accent, "#f97316");
});

test("rejects fonts outside the whitelist", () => {
  const theme = buildDefaultTheme();
  theme.settings.typography.headingFont = "Comic Sans MS";
  assert.equal(validate(theme).ok, false);
});

test("images must belong to this store's uploads", () => {
  const ok = withSection("iwt", { type: "image_with_text", settings: { image: `/uploads/stores/${STORE}/theme/a.webp` } });
  assert.equal(validate(ok).ok, true);

  for (const bad of [
    `/uploads/stores/${OTHER}/theme/a.webp`,
    "https://evil.example/a.png",
    `/uploads/stores/${STORE}/../${OTHER}/a.webp`,
    "javascript:alert(1)",
  ]) {
    const theme = withSection("iwt", { type: "image_with_text", settings: { image: bad } });
    assert.equal(validate(theme).ok, false, bad);
  }
});

test("links: only allowlisted types and safe urls", () => {
  const make = (link) => withSection("iwt", { type: "image_with_text", settings: { buttonLink: link } });
  assert.equal(validate(make({ type: "url", url: "https://example.com/x" })).ok, true);
  assert.equal(validate(make({ type: "url", url: "/filtering-product?deal=1" })).ok, true);
  assert.equal(validate(make({ type: "category", ref: String(new mongoose.Types.ObjectId()) })).ok, true);
  assert.equal(validate(make({ type: "page", ref: "about-us" })).ok, true);

  assert.equal(validate(make({ type: "url", url: "javascript:alert(1)" })).ok, false);
  assert.equal(validate(make({ type: "url", url: "//evil.example" })).ok, false);
  assert.equal(validate(make({ type: "category", ref: "not-an-id" })).ok, false);
  assert.equal(validate(make({ type: "eval" })).ok, false);
});

test("ranges are clamped, strings capped, unknown keys stripped", () => {
  const theme = withSection("sp", { type: "spacer", settings: { height: 9999, extra: "x" }, junk: true });
  theme.sections.deals.settings.heading = "h".repeat(LIMITS.text + 50);
  const r = validate(theme);
  assert.equal(r.ok, true);
  assert.equal(r.data.sections.sp.settings.height, 160);
  assert.equal(r.data.sections.sp.settings.extra, undefined);
  assert.equal(r.data.sections.sp.junk, undefined);
  assert.equal(r.data.sections.deals.settings.heading.length, LIMITS.text);
});

test("rejects too many sections and oversized payload", () => {
  const theme = { order: [], sections: {} };
  for (let i = 0; i <= LIMITS.maxSections; i += 1) {
    theme.order.push(`s${i}`);
    theme.sections[`s${i}`] = { type: "spacer" };
  }
  assert.equal(validate(theme).ok, false);

  const big = withSection("rt", { type: "rich_text", settings: { body: "x".repeat(LIMITS.maxPayloadBytes + 1) } });
  const r = validate(big);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /too large/);
});

test("menus: depth and item count limited, labels required", () => {
  const theme = buildDefaultTheme();
  theme.menus.main = [
    { id: "a", label: "Shop", link: { type: "home" }, children: [
      { id: "b", label: "Sub", link: { type: "none" }, children: [{ id: "c", label: "Too deep", link: { type: "none" } }] },
    ] },
  ];
  const r = validate(theme);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.menus.main[0].children[0].children, []);

  theme.menus.footer = Array.from({ length: LIMITS.maxMenuItems + 1 }, (_, i) => ({ label: `L${i}`, link: { type: "home" } }));
  assert.equal(validate(theme).ok, false);

  const noLabel = buildDefaultTheme();
  noLabel.menus.main = [{ label: "", link: { type: "home" } }];
  assert.equal(validate(noLabel).ok, false);
});

test("non-object input is rejected", () => {
  for (const bad of [null, "x", 42, []]) assert.equal(validateThemeData(bad, { storeId: STORE }).ok, false);
});

// ───────────────────────── Rich text ─────────────────────────
test("sanitizeRichText keeps allowlisted formatting", () => {
  assert.equal(sanitizeRichText("<p>Hello <strong>world</strong></p>"), "<p>Hello <strong>world</strong></p>");
  assert.equal(sanitizeRichText('<p style="text-align: center">x</p>'), "<p>x</p>");
  assert.equal(sanitizeRichText("<ul><li>a</li></ul><br/>"), "<ul><li>a</li></ul><br>");
});

test("sanitizeRichText neutralises scripts, handlers and bad links", () => {
  const cases = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    '<p onclick="alert(1)">x</p>',
    '<a href="javascript:alert(1)">x</a>',
    '<svg><script>alert(1)</script></svg>',
    "<iframe src=//evil></iframe>",
    '<a href="x" onmouseover="alert(1)">x</a>',
  ];
  for (const input of cases) {
    const out = sanitizeRichText(input);
    // Escaped text (&lt;img ...&gt;) inert hai — sirf REAL tags/attributes check
    assert.doesNotMatch(out, /<(script|img|svg|iframe)/i, `${input} → ${out}`);
    assert.doesNotMatch(out, /<[^>]*\s(on\w+|style|src)=/i, `${input} → ${out}`);
    assert.doesNotMatch(out, /href="(?!https?:|\/|mailto:)/i, `${input} → ${out}`);
  }
});

test("sanitizeRichText keeps safe links (Tiptap attribute order)", () => {
  const out = sanitizeRichText('<a target="_blank" rel="noopener" href="https://example.com/?a=1&amp;b=2">x</a>');
  assert.match(out, /^<a href="https:\/\/example\.com\/\?a=1&amp;b=2" rel="noopener noreferrer nofollow" target="_blank">x<\/a>$/);
  assert.equal(sanitizeRichText('<a href="/pages/about">x</a>'), '<a href="/pages/about">x</a>');
});

test("safeHref", () => {
  assert.equal(safeHref("/x"), "/x");
  assert.equal(safeHref("//x"), null);
  assert.equal(safeHref("mailto:a@b.co"), "mailto:a@b.co");
  assert.equal(safeHref("data:text/html,x"), null);
});

// ───────────────────────── Section style + presets + hero ─────────────────────────
test("section style is validated (colors, options) and defaulted", () => {
  const theme = buildDefaultTheme();
  theme.sections.deals.style = { background: "#FFEEDD", padding: "large", visibility: "mobile", junk: 1 };
  const r = validate(theme);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.data.sections.deals.style, { background: "#ffeedd", padding: "large", visibility: "mobile" });
  assert.deepEqual(r.data.sections.brand_strip.style, { background: null, padding: "none", visibility: "all" });

  const bad = buildDefaultTheme();
  bad.sections.deals.style = { background: "url(x)" };
  assert.equal(validate(bad).ok, false);
  bad.sections.deals.style = { padding: "huge" };
  assert.equal(validate(bad).ok, false);
});

test("every preset passes validation", () => {
  const { PRESETS } = require("../config/themeSchema");
  assert.ok(PRESETS.length >= 4);
  for (const preset of PRESETS) {
    const theme = buildDefaultTheme();
    theme.settings = { ...theme.settings, ...preset.settings };
    const r = validate(theme);
    assert.equal(r.ok, true, `${preset.id}: ${JSON.stringify(r.errors)}`);
  }
});

test("hero custom slides validate like blocks (own-store images, safe links)", () => {
  const theme = buildDefaultTheme();
  theme.sections.hero_banners.settings = { source: "custom", height: "large", autoplay: false, interval: 99 };
  theme.sections.hero_banners.blocks = [
    { id: "s1", settings: { image: `/uploads/stores/${STORE}/theme/a.webp`, heading: "Sale", buttonLabel: "Shop", buttonLink: { type: "url", url: "/deals" } } },
  ];
  const r = validate(theme);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.data.sections.hero_banners.settings.interval, 10);
  assert.equal(r.data.sections.hero_banners.blocks[0].settings.heading, "Sale");

  theme.sections.hero_banners.blocks[0].settings.image = `/uploads/stores/${OTHER}/theme/a.webp`;
  assert.equal(validate(theme).ok, false);
});

// ───────────────────────── Product page template ─────────────────────────
const productTheme = () => {
  const theme = buildDefaultTheme();
  const tpl = theme.templates.product;
  tpl.info.order = ["tb", "wa"];
  tpl.info.blocks = {
    tb: { type: "trust_badges", settings: { items: "Free delivery\nCOD" } },
    wa: { type: "whatsapp_button", settings: { phone: "+92 300 1234567", label: "Order" } },
  };
  return theme;
};

test("product template: default round-trips, missing template gets default", () => {
  const r = validate(buildDefaultTheme());
  assert.deepEqual(r.data.templates.product.below.order, ["description", "specifications", "reviews", "images", "related"]);
  const legacy = buildDefaultTheme();
  delete legacy.templates;
  const r2 = validate(legacy);
  assert.equal(r2.ok, true);
  assert.equal(r2.data.templates.product.settings.stickyBar, true);
});

test("product template: zone rules, limits, whatsapp phone normalized", () => {
  const r = validate(productTheme());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.data.templates.product.info.blocks.wa.settings.phone, "923001234567");

  const wrongZone = productTheme();
  wrongZone.templates.product.info.order.push("rv");
  wrongZone.templates.product.info.blocks.rv = { type: "reviews" };
  assert.equal(validate(wrongZone).ok, false);

  const badPhone = productTheme();
  badPhone.templates.product.info.blocks.wa.settings.phone = "call me";
  assert.equal(validate(badPhone).ok, false);

  const dup = buildDefaultTheme();
  dup.templates.product.below.order.push("related2");
  dup.templates.product.below.blocks.related2 = { type: "related" };
  assert.equal(validate(dup).ok, false);
});

test("product template text is collected for translation", () => {
  const { collectThemeTexts } = require("../utils/themeTranslation");
  const keys = collectThemeTexts(validate(productTheme()).data).map((e) => e.key);
  assert.ok(keys.includes("p.info.tb.items"));
  assert.ok(keys.includes("p.info.wa.label"));
  assert.ok(!keys.some((k) => k.endsWith(".phone")));
});

// ───────────────────────── Header / footer settings ─────────────────────────
test("header & footer settings default to today's layout and validate", () => {
  const r = validate(buildDefaultTheme());
  assert.deepEqual(r.data.settings.header, { sticky: true, logoSize: "default", showStoreName: true, showSearch: true });
  assert.equal(r.data.settings.footer.showBadges, true);
  assert.equal(r.data.settings.footer.copyright, "");

  const bad = buildDefaultTheme();
  bad.settings.header.logoSize = "huge";
  assert.equal(validate(bad).ok, false);

  const { collectThemeTexts } = require("../utils/themeTranslation");
  const theme = buildDefaultTheme();
  theme.settings.footer.aboutText = "Best electronics in town";
  theme.settings.footer.copyright = "All rights reserved";
  const keys = collectThemeTexts(validate(theme).data).map((e) => e.key);
  assert.ok(keys.includes("g.footer.aboutText"));
  assert.ok(keys.includes("g.footer.copyright"));
});
