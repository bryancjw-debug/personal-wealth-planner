import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const directory = resolve(process.argv[2] || "docs");
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.display, "standalone");
assert.equal(manifest.scope, "./");
assert.equal(manifest.start_url, "./");
for (const icon of manifest.icons) {
  const data = await readFile(resolve(directory, icon.src));
  const size = Number(icon.sizes.split("x")[0]);
  assert.equal(data.readUInt32BE(16), size);
  assert.equal(data.readUInt32BE(20), size);
}
const source = await readFile(resolve(directory, "sw.js"), "utf8");
const handlers = {};
const stored = new Map();
const deleted = [];
let installed = [];
const scope = "https://example.invalid/finance-app/";
const cache = {
  addAll: async paths => { installed = paths.map(request => request.url); },
  put: async (key, value) => stored.set(key, value),
  match: async key => stored.get(key)
};
const context = vm.createContext({
  self: { registration: { scope }, location: new URL(scope), clients: { claim: async () => {} }, addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting() {} },
  URL, Request, Response, Set,
  caches: { open: async () => cache, keys: async () => ["unrelated-app-shell-v1", "other-finance-app-v1", context.pwaTest.PREFIX + "old"], delete: async key => { deleted.push(key); } },
  fetch: async () => { throw new Error("Offline"); }
});
vm.runInContext(source + "\nglobalThis.pwaTest = { CACHE, PREFIX, SHELL };", context);
const waitFor = async name => {
  let pending;
  handlers[name]({ waitUntil: promise => { pending = promise; } });
  await pending;
};
await waitFor("install");
assert(installed.includes(scope + "index.html"));
for (const file of context.pwaTest.SHELL) await readFile(resolve(directory, file));
await waitFor("activate");
assert.deepEqual(deleted, [context.pwaTest.PREFIX + "old"]);
stored.set(scope + "index.html", new Response("offline shell"));
let response;
handlers.fetch({ request: { url: scope, method: "GET", mode: "navigate" }, respondWith: promise => { response = promise; } });
assert.equal(await (await response).text(), "offline shell");
for (const request of [{ url: scope + "sensitive-client-data", method: "GET", mode: "cors" }, { url: scope, method: "POST", mode: "cors" }, { url: "https://example.invalid/another-app/", method: "GET", mode: "navigate" }]) {
  handlers.fetch({ request, respondWith: () => assert.fail("Unapproved request intercepted") });
}
console.log(`PWA checks passed: ${manifest.name}; icons, ${installed.length} shell assets, isolated cache cleanup, offline navigation and request boundaries.`);
