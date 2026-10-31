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
    const ecarts: string[] = await comparerRoutes(s1.base, s2.base, ["/x"]);
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
