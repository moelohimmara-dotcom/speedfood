import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
// @ts-expect-error : module JavaScript sans déclaration de types
import { comparerRoutes } from "../scripts/comparateur.mjs";

type Reponse = { statut: number; type: string; cache?: string; corps: string };

async function serveur(routes: Record<string, Reponse>) {
  const http = createServer((requete, reponse) => {
    const r = routes[requete.url ?? ""];
    if (!r) { reponse.writeHead(404, { "content-type": "application/json" }).end("{}"); return; }
    reponse.writeHead(r.statut, { "content-type": r.type, ...(r.cache ? { "cache-control": r.cache } : {}) }).end(r.corps);
  });
  await new Promise<void>((ok) => http.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(http.address() as AddressInfo).port}`, fermer: () => new Promise<void>((ok) => http.close(() => ok())) };
}

const A: Reponse = { statut: 200, type: "application/json", cache: "public, max-age=300", corps: JSON.stringify({ ok: true, a: 1, b: [1, 2] }) };

test("deux réponses identiques (même si les clés sont dans un autre ordre) : aucun écart", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({ "/x": { ...A, type: "application/json; charset=utf-8", corps: JSON.stringify({ b: [1, 2], a: 1, ok: true }) } });
  try {
    assert.deepEqual(await comparerRoutes(s1.base, s2.base, ["/x"]), []);
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("statut, cache et corps différents : trois écarts nommés", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({ "/x": { statut: 500, type: "application/json", cache: "no-store", corps: JSON.stringify({ ok: false }) } });
  try {
    // Ce test vise la comparaison de statut/cache/corps sur une réponse 500 voulue : on tolère donc explicitement le hors 2xx (sinon un 4e écart « hors 2xx » s'ajoute).
    const ecarts: string[] = await comparerRoutes(s1.base, s2.base, ["/x"], fetch, { tolererNon2xx: true });
    assert.equal(ecarts.length, 3);
    assert.ok(ecarts.some((e) => e.includes("statut")) && ecarts.some((e) => e.includes("cache")) && ecarts.some((e) => e.includes("corps")));
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("une route absente d'un côté est un écart de statut", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({});
  try {
    const ecarts: string[] = await comparerRoutes(s1.base, s2.base, ["/x"]);
    assert.ok(ecarts.some((e) => e.includes("statut")));
  } finally { await s1.fermer(); await s2.fermer(); }
});

const E500: Reponse = { statut: 500, type: "application/json", cache: "no-store", corps: JSON.stringify({ ok: false, code: "ERREUR_SERVEUR" }) };

test("deux erreurs identiques (500 des deux côtés, même corps) : écart, pas un faux « 0 écart »", async () => {
  const s1 = await serveur({ "/x": E500 });
  const s2 = await serveur({ "/x": E500 });
  try {
    const ecarts: string[] = await comparerRoutes(s1.base, s2.base, ["/x"]);
    assert.ok(ecarts.length >= 1);
    assert.ok(ecarts.some((e) => e.includes("statut 500 hors 2xx (référence)")));
    assert.ok(ecarts.some((e) => e.includes("statut 500 hors 2xx (candidate)")));
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("avec la tolérance explicite, deux erreurs identiques ne donnent aucun écart", async () => {
  const s1 = await serveur({ "/x": E500 });
  const s2 = await serveur({ "/x": E500 });
  try {
    assert.deepEqual(await comparerRoutes(s1.base, s2.base, ["/x"], fetch, { tolererNon2xx: true }), []);
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("200 des deux côtés : inchangé, aucun écart par défaut", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({ "/x": A });
  try {
    assert.deepEqual(await comparerRoutes(s1.base, s2.base, ["/x"]), []);
  } finally { await s1.fermer(); await s2.fermer(); }
});
