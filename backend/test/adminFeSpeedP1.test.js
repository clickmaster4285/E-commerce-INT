// §9.4 FE speed: lazy heavy chunks, Redux removal, deferred storefront socket
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const fe = (...parts) => path.join(__dirname, "..", "..", "frontend", "src", ...parts);
const root = (...parts) => path.join(__dirname, "..", "..", "frontend", ...parts);

test("admin + SA dashboards lazy-load recharts", () => {
  const admin = fs.readFileSync(fe("app", "admin", "dashboard", "page.js"), "utf8");
  assert.match(admin, /dynamic\(/);
  assert.match(admin, /DashboardCharts/);
  assert.doesNotMatch(admin, /from ["']recharts["']/);

  const charts = fs.readFileSync(fe("components", "admin", "dashboard", "DashboardCharts.js"), "utf8");
  assert.match(charts, /from ["']recharts["']/);
  assert.match(charts, /export function RevenueOverview/);
  assert.match(charts, /export function SalesDistribution/);

  const sa = fs.readFileSync(fe("app", "super-admin", "(panel)", "dashboard", "page.js"), "utf8");
  assert.match(sa, /SignupChart/);
  assert.doesNotMatch(sa, /from ["']recharts["']/);
});

test("heavy editors are next/dynamic", () => {
  const terms = fs.readFileSync(fe("app", "admin", "terms-conditions", "page.js"), "utf8");
  assert.match(terms, /dynamic\(\(\) => import\("@\/components\/admin\/RichTextEditor"\)/);

  const fields = fs.readFileSync(fe("app", "admin", "store-editor", "components", "fields.js"), "utf8");
  assert.match(fields, /dynamic\(\(\) => import\("\.\/ColorPicker"\)/);

  const panel = fs.readFileSync(fe("app", "admin", "store-editor", "components", "ElementPanel.js"), "utf8");
  assert.match(panel, /dynamic\(\(\) => import\("\.\/ColorPicker"\)/);

  const product = fs.readFileSync(fe("app", "admin", "products", "[id]", "page.js"), "utf8");
  assert.match(product, /dynamic\(\(\) => import\("@\/components\/admin\/VariantForm"\)/);

  const po = fs.readFileSync(fe("app", "admin", "purchase-orders", "new", "page.js"), "utf8");
  assert.match(po, /dynamic\(\(\) => import\("@\/components\/admin\/VariantForm"\)/);

  const quote = fs.readFileSync(fe("app", "admin", "quotes", "[id]", "page.js"), "utf8");
  assert.match(quote, /dynamic\(\(\) => import\("@\/components\/admin\/QuoteTemplateDesigner"\)/);

  const invoice = fs.readFileSync(fe("app", "admin", "invoices", "[id]", "page.js"), "utf8");
  assert.match(invoice, /dynamic\(\(\) => import\("@\/components\/admin\/QuoteTemplateDesigner"\)/);
});

test("Redux removed; storeInfo uses React Query", () => {
  assert.equal(fs.existsSync(fe("redux", "store.js")), false);
  assert.equal(fs.existsSync(fe("redux", "slices", "storeInfoSlice.js")), false);

  const providers = fs.readFileSync(fe("app", "providers.js"), "utf8");
  assert.doesNotMatch(providers, /react-redux/);
  assert.doesNotMatch(providers, /@\/redux/);

  const sidebar = fs.readFileSync(fe("components", "adminComponents", "Sidebar.js"), "utf8");
  assert.match(sidebar, /\["admin-store-info"\]/);
  assert.doesNotMatch(sidebar, /react-redux/);

  const login = fs.readFileSync(fe("app", "admin", "login", "page.js"), "utf8");
  assert.doesNotMatch(login, /react-redux/);
  assert.match(login, /storeApi\.getPublic/);

  const pkg = JSON.parse(fs.readFileSync(root("package.json"), "utf8"));
  assert.equal(pkg.dependencies?.["@reduxjs/toolkit"], undefined);
  assert.equal(pkg.dependencies?.["react-redux"], undefined);
  assert.equal(pkg.dependencies?.["react-icons"], undefined);
});

test("storefront socket is deferred + SupportChatWidget dynamic", () => {
  const layout = fs.readFileSync(fe("app", "(user)", "UserLayoutClient.js"), "utf8");
  assert.match(layout, /dynamic\(\(\) => import\("@\/components\/chat\/SupportChatWidget"\)/);
  assert.match(layout, /useUserSocketSync\(\{ enabled: socketNeeded \}\)/);

  const sync = fs.readFileSync(fe("hooks", "user", "useUserSocketSync.js"), "utf8");
  assert.match(sync, /enabled = true/);

  const sock = fs.readFileSync(fe("hooks", "user", "useUserSocket.js"), "utf8");
  assert.match(sock, /enabled = true/);

  const widget = fs.readFileSync(fe("components", "chat", "SupportChatWidget.js"), "utf8");
  assert.match(widget, /useUserSocket\(\{ enabled: open \}\)/);
});

test("react-icons replaced with inline socialIcons", () => {
  const icons = fs.readFileSync(fe("lib", "socialIcons.js"), "utf8");
  assert.match(icons, /export function FaFacebookF/);
  assert.match(icons, /export function FaXTwitter/);

  for (const rel of [
    ["components", "user", "Footer.js"],
    ["components", "landing", "Footer.js"],
    ["components", "landing", "HowItWorks.js"],
  ]) {
    const src = fs.readFileSync(fe(...rel), "utf8");
    assert.match(src, /@\/lib\/socialIcons/);
    assert.doesNotMatch(src, /from ["']react-icons/);
  }
});
