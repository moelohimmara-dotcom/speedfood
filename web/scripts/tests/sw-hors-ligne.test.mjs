// Service worker `public/sw.js` : écran « hors connexion » sans jamais mettre en cache une page de l'application, et réessais automatiques des 503
// de Cloudflare (Worker coupé au hasard sur le forfait gratuit). Faux environnement Node (pas un navigateur) ; l'essai en navigateur réel reste à
// faire sur téléphone. Usage : npm run test:sw
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const code = fs.readFileSync(fileURLToPath(new URL("../../public/sw.js", import.meta.url)), "utf8");
const ORIGINE = "https://speedfood.test";
const store = new Map();
const handlers = {};
const mis = [];
const cache = { addAll: async (l) => { for (const u of l) store.set(u, "FICHIER:" + u); }, match: async (u) => store.get(u), put: async (...a) => mis.push(a) };
let scenario = []; // réponses successives de fetch ; "reseau" = panne réseau
let appels = [];

const reponse = (statut) => ({ status: statut, body: null, tag: "R" + statut });
const sandbox = {
  self: { location: { origin: ORIGINE }, addEventListener: (n, f) => (handlers[n] = f), skipWaiting: async () => {}, clients: { claim: async () => {} }, registration: {} },
  caches: { open: async () => cache, keys: async () => ["ancien", "speedfood-hors-ligne-v1"], delete: async (n) => { sandbox.supprime = n; return true; } },
  fetch: async (r) => {
    appels.push(r);
    const suivant = scenario.length > 1 ? scenario.shift() : scenario[0];
    if (suivant === "reseau") throw new TypeError("offline");
    return suivant;
  },
  Response: { error: () => "ERREUR" },
  URL,
  Promise,
  setTimeout: (f) => f(), // pas d'attente réelle dans les tests
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const attendre = [];
const ev = (extra) => ({ waitUntil: (p) => attendre.push(p), ...extra });
handlers.install(ev());
await Promise.all(attendre.splice(0));
assert.ok(store.has("/hors-ligne") && store.has("/icons/icon-192.png"), "precache");
handlers.activate(ev());
await Promise.all(attendre.splice(0));
assert.equal(sandbox.supprime, "ancien");

const requete = (o) => ({ mode: "cors", method: "GET", url: `${ORIGINE}/restaurants`, clone() { return { ...this, clone: this.clone }; }, ...o });
const repondre = async (r, reponses) => {
  scenario = [...reponses];
  appels = [];
  let p;
  handlers.fetch({ request: r, respondWith: (x) => (p = x) });
  return p === undefined ? "IGNORE" : await p;
};

// --- hors connexion (comportement d'origine)
assert.equal(await repondre(requete({ mode: "navigate" }), ["reseau"]), "FICHIER:/hors-ligne", "navigation sans réseau -> écran hors connexion");
assert.equal(await repondre(requete({ mode: "cors" }), ["reseau"]), "ERREUR", "lecture non navigationnelle sans réseau -> échec normal");
assert.equal((await repondre(requete({ mode: "navigate" }), ["reseau"])) === "FICHIER:/hors-ligne", true);

// --- réessais des 503
const ok = reponse(200);
assert.equal((await repondre(requete({ mode: "navigate" }), [reponse(503), ok])).tag, "R200", "503 puis 200 -> la page s'affiche");
assert.equal(appels.length, 2, "un seul réessai nécessaire");
assert.equal((await repondre(requete({ mode: "navigate" }), [reponse(503), reponse(503), ok])).tag, "R200", "503, 503 puis 200 -> la page s'affiche");
assert.equal(appels.length, 3, "deux réessais");
assert.equal((await repondre(requete({ mode: "navigate" }), [reponse(503)])).tag, "R503", "toujours 503 -> la dernière réponse est rendue");
assert.equal(appels.length, 3, "jamais plus de trois essais en tout");
assert.equal((await repondre(requete({ mode: "cors" }), [reponse(503), ok])).tag, "R200", "lecture de données (navigation interne) réessayée aussi");

// --- ce qui n'est PAS réessayé
for (const statut of [200, 301, 307, 400, 401, 403, 404, 429, 500, 502]) {
  const r = await repondre(requete({ mode: "navigate" }), [reponse(statut), ok]);
  assert.equal(r.tag, "R" + statut, `statut ${statut} : rendu tel quel`);
  assert.equal(appels.length, 1, `statut ${statut} : aucun réessai`);
}
assert.equal(await repondre(requete({ url: "https://autre.example/x" }), [reponse(503)]), "IGNORE", "autre origine : ignorée");
assert.equal(await repondre(requete({ method: "PUT" }), [reponse(503)]), "IGNORE", "PUT : ignoré");
assert.equal(await repondre(requete({ method: "DELETE" }), [reponse(503)]), "IGNORE", "DELETE : ignoré");

// --- envois (POST) : seulement les chemins sans danger
for (const chemin of ["/connexion", "/inscription", "/entrer", "/commande", "/panier", "/connexion/oubli"]) {
  const r = await repondre(requete({ method: "POST", url: `${ORIGINE}${chemin}` }), [reponse(503), ok]);
  assert.equal(r.tag, "R200", `POST ${chemin} : réessayé`);
  assert.equal(appels.length, 2, `POST ${chemin} : deux essais`);
}
for (const chemin of ["/restaurant/menu", "/restaurant/commandes", "/system/acces", "/suivi/abc", "/compte", "/connexionx", "/api/suivi/session", "/restaurant/tables"]) {
  assert.equal(await repondre(requete({ method: "POST", url: `${ORIGINE}${chemin}` }), [reponse(503), ok]), "IGNORE", `POST ${chemin} : jamais réessayé (doublon possible)`);
}
const post = requete({ method: "POST", url: `${ORIGINE}/connexion` });
await repondre(post, [reponse(503), reponse(503), ok]);
assert.equal(new Set(appels).size, 3, "chaque essai d'un envoi utilise une copie neuve de la requête (corps réutilisable)");
assert.equal(appels[0], post, "le premier essai est la requête d'origine");

// --- le cache n'est jamais alimenté à l'usage
assert.equal(mis.length, 0, "rien n'est mis en cache à l'usage");
console.log("sw: tous les contrôles OK (hors connexion et réessais 503)");
