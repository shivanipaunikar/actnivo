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
  assert.match(html, /fixes it/);
  assert.match(html, /Ask your/);
  assert.match(html, /business/);
  assert.match(html, /Built as an execution layer/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("keeps the operations dashboard available", async () => {
  const response = await render("/dashboard");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Good morning, Shivani/);
  assert.match(html, /Revenue at risk/i);
  assert.match(html, /Channel performance/);
});
