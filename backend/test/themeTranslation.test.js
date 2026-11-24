// Theme translation — text collect + reuse plan (pure, LibreTranslate nahi)
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { buildDefaultTheme } = require("../config/themeSchema");
const { collectThemeTexts, planTranslations, publicTranslations } = require("../utils/themeTranslation");

const hash = (t) => crypto.createHash("md5").update(String(t).trim()).digest("hex").slice(0, 12);

function sampleTheme() {
  const theme = buildDefaultTheme();
  theme.sections.deals.settings.heading = "Hot deals";
  theme.sections.iwt = {
    type: "image_with_text",
    disabled: false,
    settings: { heading: "Our story", body: "<p>html skipped</p>", buttonLabel: "Read more", image: "" },
    blocks: [],
  };
  theme.sections.t1 = {
    type: "testimonials",
    disabled: false,
    settings: { heading: "Reviews" },
    blocks: [{ id: "b1", settings: { quote: "Great shop", author: "Ali", rating: 5 } }],
  };
  theme.sections.hidden = { type: "rich_text", disabled: true, settings: { heading: "Secret" }, blocks: [] };
  theme.order.push("iwt", "t1", "hidden");
  theme.menus.main = [{ id: "m1", label: "Shop", link: { type: "home" }, children: [{ id: "m2", label: "Phones", link: { type: "none" }, children: [] }] }];
  theme.settings.announcement = { enabled: true, text: "Free delivery", link: { type: "none" } };
  return theme;
}

test("collectThemeTexts picks translatable text fields only", () => {
  const map = Object.fromEntries(collectThemeTexts(sampleTheme()).map((e) => [e.key, e.text]));
  assert.deepEqual(map, {
    "s.deals.heading": "Hot deals",
    "s.iwt.heading": "Our story",
    "s.iwt.buttonLabel": "Read more",
    "s.t1.heading": "Reviews",
    "b.t1.b1.quote": "Great shop",
    "m.main.m1": "Shop",
    "m.main.m2": "Phones",
    "a.text": "Free delivery",
  });
  // richtext, author (not translatable), disabled sections, empty values → skip
});

test("planTranslations reuses unchanged complete entries", () => {
  const entries = [
    { key: "a", text: "Same" },
    { key: "b", text: "Changed" },
    { key: "c", text: "New" },
    { key: "d", text: "Partial" },
  ];
  const existing = {
    a: { h: hash("Same"), ur: "یکساں", ar: "نفس" },
    b: { h: hash("Old"), ur: "پرانا", ar: "قديم" },
    d: { h: hash("Partial"), ur: "جزوی" },
    gone: { h: "x", ur: "y" },
  };
  const { next, pending } = planTranslations(entries, existing, ["ur", "ar"], hash);
  assert.deepEqual(next.a, existing.a);
  assert.deepEqual(pending.map((p) => p.key), ["b", "c", "d"]);
  assert.equal(next.gone, undefined);
});

test("publicTranslations strips hashes and empty entries", () => {
  assert.deepEqual(publicTranslations({ a: { h: "1", ur: "x" }, b: { h: "2" } }), { a: { ur: "x" } });
});
