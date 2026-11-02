import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error : outil JavaScript sans declaration de types
import { essayerCreationApiSeule, creerEtatEssai, CIBLES_ESSAI } from "../scripts/essai-idempotence-reel.mjs";

type Requete = { method: string; headers: Record<string, string>; body?: string; redirect?: string };
type Options = { admin?: boolean; statut?: number; idempotent?: boolean; jeton?: string; reference?: string; estTest?: boolean; reserve?: boolean; panne?: boolean; panneListeFinale?: boolean; corpsIllisible?: boolean };
function scenario(options: Options = {}) {
  const appels: Array<{ url: string; options: Requete }> = [];
  const notes: Array<Record<string, unknown>> = [];
  let ecritures = 0;
  let reservations = 0;
  let reservationsAuPost = -1;
  const reference = options.reference ?? "SF-ABCDE";
  const envoyer = async (url: string, requete: Requete) => {
    appels.push({ url, options: requete });
    assert.equal(requete.redirect, "manual");
    if (url === CIBLES_ESSAI.moi) return Response.json({ ok: true, roles: { equipe: options.admin === false ? null : "super_admin" } });
    if (url === CIBLES_ESSAI.liste && requete.method === "GET") {
      if (ecritures > 0 && options.panneListeFinale) throw new Error("Lecture finale indisponible");
      const commandes = [{ reference: "SF-G8V6H", estTest: true, restaurantId: CIBLES_ESSAI.restaurant, jeton: "a".repeat(40) }];
      if (ecritures > 0) commandes.push({ reference, estTest: options.estTest ?? true, restaurantId: CIBLES_ESSAI.restaurant, jeton: "x".repeat(40) });
      return Response.json({ ok: true, commandes });
    }
    if (url === CIBLES_ESSAI.menu) return Response.json([{ id: CIBLES_ESSAI.plat, restaurant_id: CIBLES_ESSAI.restaurant, prix: 30000, prix_promo: 25000, disponible: true, archive_le: null }]);
    if ([CIBLES_ESSAI.creationSite, CIBLES_ESSAI.creationApi].includes(url) && requete.method === "POST") {
      ecritures++;
      reservationsAuPost = reservations;
      assert.equal(requete.headers.authorization, "Bearer session-factice");
      const corps = JSON.parse(requete.body ?? "{}");
      assert.equal(corps.mode, "retrait");
      assert.equal(corps.sousTotalAffiche, 25000);
      assert.equal(corps.client.nom, "ESSAI ALERTE API - NE PAS PREPARER");
      assert.equal(corps.client.telephone, "600000000");
      assert.equal(corps.client.adresse, null);
      assert.equal(corps.lignes.length, 1);
      assert.equal(corps.lignes[0].menuItemId, CIBLES_ESSAI.plat);
      assert.equal(corps.est_test, undefined);
      assert.match(corps.cleIdempotence, /^[0-9a-f-]{36}$/);
      if (options.panne) throw new Error("Detail factice qui ne doit pas sortir");
      if (options.corpsIllisible) return new Response("pas du JSON", { status: options.statut ?? 502 });
      return Response.json({ ok: true, reference, jeton: (options.jeton ?? "x".repeat(40)), idempotent: options.idempotent ?? false }, { status: options.statut ?? 201 });
    }
    throw new Error("Appel hors perimetre");
  };
  const etat = {
    reserver: () => { reservations++; return options.reserve ?? true; },
    noter: (note: Record<string, unknown>) => notes.push(note),
  };
  return { appels, notes, etat, envoyer, ecritures: () => ecritures, reservations: () => reservations, reservationsAuPost: () => reservationsAuPost };
}
const configuration = { acces: "session-factice", clePublique: "publique-factice", autoriserEcriture: true };
const posts = (s: ReturnType<typeof scenario>) => s.appels.filter(a => a.options.method === "POST");

test("sans autorisation explicite, aucun appel et aucune reservation", async () => {
  const s = scenario();
  const r = await essayerCreationApiSeule({ ...configuration, autoriserEcriture: false }, s.envoyer, s.etat);
  assert.equal(r.code, 2);
  assert.equal(s.appels.length, 0);
  assert.equal(s.reservations(), 0);
});
test("refuse un compte sans role equipe : aucun POST, aucune reservation", async () => {
  const s = scenario({ admin: false });
  assert.equal((await essayerCreationApiSeule(configuration, s.envoyer, s.etat)).code, 2);
  assert.equal(s.ecritures(), 0);
  assert.equal(s.reservations(), 0);
});
test("verrou deja present : zero POST", async () => {
  const s = scenario({ reserve: false });
  assert.equal((await essayerCreationApiSeule(configuration, s.envoyer, s.etat)).code, 2);
  assert.equal(s.ecritures(), 0);
  assert.equal(posts(s).length, 0);
});
test("nominal : un seul POST, uniquement vers l API, verrou reserve avant, marquage TEST confirme", async () => {
  const s = scenario();
  const r = await essayerCreationApiSeule(configuration, s.envoyer, s.etat);
  assert.equal(r.code, 0);
  assert.equal(r.referenceApi, "SF-ABCDE");
  assert.equal(r.estTest, true);
  assert.ok(Number.isInteger(r.dureeMs));
  assert.ok(r.message.includes("telephone du restaurateur"));
  assert.ok(r.message.includes("CPU"));
  const ecritures = posts(s);
  assert.equal(ecritures.length, 1);
  assert.equal(ecritures[0].url, CIBLES_ESSAI.creationApi);
  assert.ok(!s.appels.some(a => a.url === CIBLES_ESSAI.creationSite && a.options.method === "POST"));
  assert.equal(s.reservations(), 1);
  assert.equal(s.reservationsAuPost(), 1, "le verrou doit etre reserve AVANT le POST");
  assert.deepEqual(s.notes.map(n => n.phase), ["envoi-api-seule", "api-creee", "termine-api-seule"]);
  const sortie = JSON.stringify({ r, notes: s.notes });
  assert.ok(!sortie.includes("session-factice"));
  assert.ok(!sortie.includes("x".repeat(40)));
  assert.ok(!sortie.includes("cleIdempotence"));
});
for (const [nom, options] of [
  ["200 idempotent", { statut: 200, idempotent: true }],
  ["201 mais idempotent true", { idempotent: true }],
  ["statut 500", { statut: 500 }],
  ["statut 502 sans JSON", { corpsIllisible: true }],
  ["jeton mal forme", { jeton: "court" }],
  ["reference mal formee", { reference: "SF-abc" }],
] as Array<[string, Options]>) {
  test(`reponse inattendue (${nom}) : code 1 et aucune relance`, async () => {
    const s = scenario(options);
    const r = await essayerCreationApiSeule(configuration, s.envoyer, s.etat);
    assert.equal(r.code, 1);
    assert.equal(posts(s).length, 1);
    assert.equal(s.notes.at(-1)?.phase, "api-a-auditer");
    assert.ok(!JSON.stringify(r).includes("x".repeat(40)));
  });
}
test("marquage TEST non confirme : code 1, une seule ecriture", async () => {
  const s = scenario({ estTest: false });
  const r = await essayerCreationApiSeule(configuration, s.envoyer, s.etat);
  assert.equal(r.code, 1);
  assert.equal(posts(s).length, 1);
});
test("lecture finale en panne : code 1, pas de retry", async () => {
  const s = scenario({ panneListeFinale: true });
  assert.equal((await essayerCreationApiSeule(configuration, s.envoyer, s.etat)).code, 1);
  assert.equal(posts(s).length, 1);
});
test("panne reseau apres envoi : code 2, une seule tentative, verrou conserve, rien de sensible", async () => {
  const s = scenario({ panne: true });
  const r = await essayerCreationApiSeule(configuration, s.envoyer, s.etat);
  assert.equal(r.code, 2);
  assert.equal(s.ecritures(), 1);
  assert.equal(posts(s).length, 1);
  assert.equal(s.reservations(), 1);
  assert.ok(r.message.includes("peut-etre"));
  assert.ok(!JSON.stringify({ r, notes: s.notes }).includes("Detail factice"));
});
test("verrou durable : le fichier de verrou accepte les phases de l essai API seule et refuse les secrets", () => {
  const dossier = mkdtempSync(join(tmpdir(), "speedfood-api-seule-"));
  const fichier = join(dossier, "etat.json");
  try {
    const e = creerEtatEssai(fichier);
    assert.equal(e.reserver(), true);
    assert.equal(creerEtatEssai(fichier).reserver(), false);
    for (const phase of ["envoi-api-seule", "api-creee", "api-a-auditer", "termine-api-seule"]) e.noter({ phase, referenceApi: "SF-ABCDE" });
    assert.throws(() => e.noter({ phase: "api-creee", jeton: "valeur-factice-a-refuser" }));
    assert.throws(() => e.noter({ phase: "inconnue" }));
    assert.ok(!readFileSync(fichier, "utf8").includes("valeur-factice-a-refuser"));
  } finally { unlinkSync(fichier); rmdirSync(dossier); }
});
