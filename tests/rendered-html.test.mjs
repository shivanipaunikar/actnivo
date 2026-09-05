import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Actnivo marketing homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Your commerce/);
  assert.match(html, /running themselves/);
  assert.match(html, /Actnivo/);
  assert.match(html, /Built for action/);
  assert.match(html, /Intelligent by design/);
  assert.match(html, /Detect/);
  assert.match(html, /PREDICT/);
  assert.match(html, /AUTOMATE/);
  assert.match(html, /Built as infrastructure/);
  assert.doesNotMatch(html, /SIMPLE PRICING/);
  const homepageFlow = [
    "AI COMMERCE OPERATIONS",
    "PLATFORMS &amp; INTEGRATIONS",
    "THE ACTION PLATFORM",
    "Automate the operations you trust.",
    "SPOTLIGHT · ASK ACTNIVO",
    "QUICK COMMERCE",
    "CONNECTED INFRASTRUCTURE",
    "ONE OPERATING SYSTEM",
    "PRODUCT CONCEPT · API PREVIEW",
    "Commerce is complicated.",
  ];
  let previousIndex = -1;
  for (const section of homepageFlow) {
    const sectionIndex = html.indexOf(section);
    assert.ok(sectionIndex > previousIndex, `${section} renders in homepage order`);
    previousIndex = sectionIndex;
  }
  assert.doesNotMatch(html, /codex-preview/);
});

test("keeps pricing on its own route", async () => {
  const response = await render("/pricing");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /SIMPLE PRICING/);
  assert.match(html, /Starter/);
  assert.match(html, /Growth/);
  assert.match(html, /Pro/);
});

test("keeps the operations dashboard available", async () => {
  const response = await render("/dashboard");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Good morning, Shivani/);
  assert.match(html, /Revenue at risk/i);
  assert.match(html, /Channel performance/);
});
