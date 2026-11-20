const test = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });

// sendEmail ko emailService load hone se PEHLE stub karo (wo import par destructure karta hai)
const mailer = require("../utils/sendEmail");
const sent = [];
mailer.sendEmail = async (message) => { sent.push(message); return { delivered: true }; };
const { sendApplicationReceivedEmail } = require("../services/emailService");

test("pending email links the new seller to their store admin panel", async () => {
  sent.length = 0;
  await sendApplicationReceivedEmail({
    name: "Ali",
    email: "ali@example.com",
    storeName: "Ali Electronics",
    adminUrl: "http://ali-electronics.example.test:3000",
  });
  assert.equal(sent.length, 1);
  const { to, subject, html, text } = sent[0];
  assert.equal(to, "ali@example.com");
  assert.match(subject, /pending approval/i);
  assert.match(html, /Your seller account has been created, Ali\./);
  assert.match(html, /Pending approval/);
  assert.match(html, /href="http:\/\/ali-electronics\.example\.test:3000\/admin\/login"/);
  assert.match(html, /Open your admin panel/);
  assert.match(text, /\/admin\/login/);
  assert.doesNotMatch(html, /\{\{\w+\}\}/, "no unfilled template placeholders");
  assert.doesNotMatch(html, /seller\/status/, "old 404 status link is gone");
});

test("pending email falls back to the platform link when no store URL exists", async () => {
  sent.length = 0;
  await sendApplicationReceivedEmail({ name: "Sara", email: "sara@example.com", storeName: "Sara Store" });
  const { html } = sent[0];
  assert.doesNotMatch(html, /Open your admin panel/);
  assert.match(html, /There is nothing else you need to do right now\./);
  assert.doesNotMatch(html, /\{\{\w+\}\}/);
});

test("pending email escapes user-supplied values", async () => {
  sent.length = 0;
  await sendApplicationReceivedEmail({ name: "<b>x</b>", email: "x@example.com", storeName: "A & B" });
  const { html } = sent[0];
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /A &amp; B/);
});

const { sendApplicationApprovedEmail } = require("../services/emailService");

test("approval email sends the seller to their admin panel and storefront", async () => {
  sent.length = 0;
  await sendApplicationApprovedEmail({
    name: "Ali",
    email: "ali@example.com",
    storeName: "Ali Electronics",
    storeUrl: "http://ali-electronics.example.test:3000",
  });
  const { subject, html, text } = sent[0];
  assert.match(subject, /approved/i);
  assert.match(html, /href="http:\/\/ali-electronics\.example\.test:3000\/admin\/login"[^>]*>Open your admin panel/);
  assert.match(html, /href="http:\/\/ali-electronics\.example\.test:3000"[^>]*>Visit your storefront/);
  assert.match(html, /ali-electronics\.example\.test:3000/);
  assert.match(text, /\/admin\/login/);
  assert.doesNotMatch(html, /seller\/dashboard/, "old 404 dashboard link is gone");
  assert.doesNotMatch(html, /\{\{\w+\}\}/);
});

test("approval email without a store URL falls back to platform sign-in and hides the storefront button", async () => {
  sent.length = 0;
  await sendApplicationApprovedEmail({ name: "Sara", email: "sara@example.com", storeName: "Sara Store" });
  const { html } = sent[0];
  assert.match(html, /\/admin\/login"[^>]*>Open your admin panel/);
  assert.match(html, /display:none;/);
  assert.doesNotMatch(html, /\{\{\w+\}\}/);
});
