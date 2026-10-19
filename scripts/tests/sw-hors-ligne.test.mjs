// Service worker `public/sw.js` : écran « hors connexion » sans jamais mettre en cache une page de l'application.
// Faux environnement Node (pas un navigateur) ; l'essai en navigateur réel reste à faire sur téléphone. Usage : npm run test:sw
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const code = fs.readFileSync(fileURLToPath(new URL("../../public/sw.js", import.meta.url)), "utf8");
const store = new Map(); const handlers = {}; let reseau = false; const mis = [];
const cache = { addAll: async (l) => { for (const u of l) store.set(u, "FICHIER:" + u); }, match: async (u) => store.get(u), put: async (...a) => mis.push(a) };
const sandbox = {
  self: { addEventListener: (n, f) => (handlers[n] = f), skipWaiting: async () => {}, clients: { claim: async () => {} }, registration: {} },
  caches: { open: async () => cache, keys: async () => ["ancien", "speedfood-hors-ligne-v1"], delete: async (n) => { sandbox.supprime = n; return true; } },
  fetch: async (r) => { if (!reseau) throw new TypeError("offline"); return "REPONSE_RESEAU"; },
  Response: { error: () => "ERREUR" }, URL, Promise,
};
vm.createContext(sandbox); vm.runInContext(code, sandbox);
const attendre = []; const ev = (extra) => ({ waitUntil: (p) => attendre.push(p), ...extra });
handlers.install(ev()); await Promise.all(attendre.splice(0));
assert.ok(store.has("/hors-ligne.html") && store.has("/icons/icon-192.png"), "precache");
handlers.activate(ev()); await Promise.all(attendre.splice(0)); assert.equal(sandbox.supprime, "ancien");
const repondre = async (requete) => { let p; const e = { request: requete, respondWith: (x) => (p = x) }; handlers.fetch(e); return p === undefined ? "IGNORE" : await p; };
assert.equal(await repondre({ mode: "navigate", method: "GET" }), "FICHIER:/hors-ligne.html", "hors ligne -> page hors ligne");
assert.equal(await repondre({ mode: "cors", method: "GET" }), "IGNORE", "non-navigation ignoree");
assert.equal(await repondre({ mode: "navigate", method: "POST" }), "IGNORE", "POST ignore");
reseau = true;
assert.equal(await repondre({ mode: "navigate", method: "GET" }), "REPONSE_RESEAU", "en ligne -> reseau");
assert.equal(mis.length, 0, "rien n'est mis en cache a l'usage");
console.log("sw: 7 controles OK");
