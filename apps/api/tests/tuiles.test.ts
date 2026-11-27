import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { cleCache, urlFournisseur, validerTuile, ZOOM_MAX, ZOOM_MIN } from "../src/tuiles/relais.ts";
import { depsEssai } from "./deps-essai.ts";

/**
 * Relais des tuiles de carte (27/11/2026). Les tuiles publiques d'OpenStreetMap répondent 403 « Access blocked » aux applis mobiles ; l'API les relaie depuis MapTiler,
 * clé côté serveur, zoom 2 à 17, Guinée seulement.
 */
const CLE = "cle-d-essai-secrete";
// Tuile de Conakry (9,537 N ; 13,677 O) au zoom 16.
const CONAKRY = { z: 16, x: 30278, y: 31023 };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const png = () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });

/** `cle` : null = aucune clé posée (un `undefined` remettrait la clé d'essai par défaut). */
function appAvec(chercher: (url: string) => Promise<Response>, cle: string | null = CLE) {
  return creerApp(depsEssai({ tuiles: { cle: () => cle ?? undefined, chercher } }));
}
const demander = (app: ReturnType<typeof creerApp>, chemin: string) => app.request(`/api/v1/tuiles/${chemin}`);

test("validerTuile : Conakry est servie, avec ou sans « .png »", () => {
  assert.deepEqual(validerTuile("16", "30278", "31023"), CONAKRY);
  assert.deepEqual(validerTuile("2", "1", "1"), { z: 2, x: 1, y: 1 }); // la plus large : contient la Guinée
  assert.deepEqual(validerTuile("17", "60556", "62047"), { z: 17, x: 60556, y: 62047 }); // Conakry au zoom maximal
  assert.deepEqual(validerTuile("10", "473", "484"), { z: 10, x: 473, y: 484 }); // Conakry au zoom 10
  assert.notEqual(validerTuile("12", "1942", "1929"), null); // Kankan, à l'intérieur du pays
});

test("validerTuile : zooms, entiers et zones refusés (le quota du fournisseur ne se vide pas en parcourant le monde)", () => {
  assert.equal(validerTuile("1", "0", "0"), null); // sous le zoom minimal
  assert.equal(validerTuile(String(ZOOM_MAX + 1), "1", "1"), null);
  assert.equal(validerTuile(String(ZOOM_MIN - 1), "0", "0"), null);
  for (const z of ["abc", "", "-2", "2.5", "1e1", "99999999999"]) assert.equal(validerTuile(z, "1", "1"), null, `z=${z}`);
  assert.equal(validerTuile("16", "-1", "31023"), null);
  assert.equal(validerTuile("16", "30278", "x"), null);
  assert.equal(validerTuile("2", "4", "1"), null); // x hors de la grille du zoom 2
  assert.equal(validerTuile("16", "10000", "31023"), null); // Atlantique Nord-Ouest
  assert.equal(validerTuile("16", "30278", "10000"), null); // Arctique
  assert.equal(validerTuile("10", "518", "352"), null); // Paris
  assert.equal(validerTuile("10", "909", "403"), null); // Tokyo
  assert.equal(validerTuile("10", "301", "385"), null); // New York
});

test("urlFournisseur : la clé part au fournisseur, jamais dans l'adresse neutre du cache", () => {
  assert.equal(urlFournisseur(CONAKRY, CLE), `https://api.maptiler.com/maps/streets-v2/256/16/30278/31023.png?key=${CLE}`);
  assert.equal(urlFournisseur(CONAKRY, "a b&c"), "https://api.maptiler.com/maps/streets-v2/256/16/30278/31023.png?key=a%20b%26c");
  assert.doesNotMatch(cleCache(CONAKRY), /key|cle/i);
});

test("route : une tuile valable est relayée en image, avec cache d'un jour, et la clé n'apparaît dans aucun en-tête", async () => {
  let demandee = "";
  const app = appAvec(async (url) => { demandee = url; return png(); });
  const r = await demander(app, "16/30278/31023.png");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  assert.equal(r.headers.get("cache-control"), "public, max-age=86400");
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PNG);
  assert.equal(demandee, `https://api.maptiler.com/maps/streets-v2/256/16/30278/31023.png?key=${CLE}`);
  let fuite = false; r.headers.forEach((v) => { if (v.includes(CLE)) fuite = true; });
  assert.equal(fuite, false);
  const sans = await demander(app, "16/30278/31023"); // sans l'extension
  assert.equal(sans.status, 200);
});

test("route : hors zone ou zoom refusé = 404 sans appeler le fournisseur", async () => {
  let appels = 0;
  const app = appAvec(async () => { appels++; return png(); });
  for (const chemin of ["16/10000/31023.png", "1/0/0.png", "18/1/1.png", "abc/1/1.png", "10/518/352.png"]) {
    const r = await demander(app, chemin);
    assert.equal(r.status, 404, chemin);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
  assert.equal(appels, 0);
});

test("route : sans clé posée ou sans fournisseur câblé = 503, jamais d'appel", async () => {
  let appels = 0;
  const chercher = async () => { appels++; return png(); };
  assert.equal((await demander(appAvec(chercher, null), "16/30278/31023.png")).status, 503);
  assert.equal((await demander(appAvec(chercher, ""), "16/30278/31023.png")).status, 503);
  assert.equal((await demander(creerApp(depsEssai()), "16/30278/31023.png")).status, 503);
  assert.equal(appels, 0);
});

test("route : panne ou réponse invalide du fournisseur = 502 sans fuite de clé ni de détail", async () => {
  const cas: Array<() => Promise<Response>> = [
    async () => { throw new Error(`réseau coupé (${CLE})`); },
    async () => new Response("interdit", { status: 403 }),
    async () => new Response("trop de demandes", { status: 429 }),
    async () => new Response("erreur", { status: 500 }),
    async () => new Response("<html>pas une image</html>", { status: 200, headers: { "content-type": "text/html" } }),
    async () => new Response(new Uint8Array(0), { status: 200, headers: { "content-type": "image/png" } }),
    async () => new Response(new Uint8Array(400_000), { status: 200, headers: { "content-type": "image/png" } }),
  ];
  for (const chercher of cas) {
    const r = await demander(appAvec(chercher), "16/30278/31023.png");
    assert.equal(r.status, 502);
    const texte = await r.text();
    assert.equal(texte.includes(CLE), false);
    assert.doesNotMatch(texte, /maptiler|403|429|réseau/i);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
});
