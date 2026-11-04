import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { PHOTO_CORPS_MAX_OCTETS, PHOTO_TAILLE_MAX_OCTETS } from "@speedfood/shared/contracts/restaurant-photo";
import type { ContexteRestaurant, Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

/**
 * Route du lot D4c : `POST /api/v1/restaurant/menu/photo`, avec de fausses dépendances qui ENREGISTRENT ce qu'elles reçoivent. Le service réel (`photo.ts`) et les contrôles du fichier du site
 * (`images.ts`) sont testés à part (`restaurant-photo-service.test.ts`, `restaurant-photo-stockage.test.ts`).
 */
const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const PLAT = "44444444-4444-4444-8444-444444444444";
const CTX: ContexteRestaurant = { supabase: { marqueur: "client-lie-au-jeton" }, utilisateurId: "compte-1", restaurantId: RESTAURANT_A, role: "owner" };
const OCTETS_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);

interface Appel { appel: "definir" | "retirer"; ctx: ContexteRestaurant; platId: string; fichier?: File }
interface Journal { appels: string[]; photos: Appel[] }

function monter(surcharge: Partial<Deps["restaurant"]> = {}) {
  const journal: Journal = { appels: [], photos: [] };
  const app = creerApp(depsEssai({
    verificateurs: { strict: async (j) => { journal.appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    restaurant: {
      contexte: async (jeton, utilisateurId) => { journal.appels.push(`contexte:${utilisateurId}:${jeton === JETON}`); return CTX; },
      lister: async () => { throw new Error("hors sujet"); },
      traiter: async () => { throw new Error("hors sujet"); },
      confirmerPaiement: async () => { throw new Error("hors sujet"); },
      proposer: async () => { throw new Error("hors sujet"); },
      modifierStatut: async () => { throw new Error("hors sujet"); },
      lireReglages: async () => { throw new Error("hors sujet"); },
      enregistrerReglages: async () => { throw new Error("hors sujet"); },
      lireMenu: async () => { throw new Error("hors sujet"); },
      actionMenu: async () => { throw new Error("hors sujet"); },
      agirSurLivraison: async () => { throw new Error("hors sujet"); },
      definirPhoto: async (ctx, platId, fichier) => { journal.appels.push("photo-definir"); journal.photos.push({ appel: "definir", ctx, platId, fichier }); return { ok: true }; },
      retirerPhoto: async (ctx, platId) => { journal.appels.push("photo-retirer"); journal.photos.push({ appel: "retirer", ctx, platId }); return { ok: true }; },
      ...surcharge,
    },
  }));
  return { app, journal };
}
type App = ReturnType<typeof monter>["app"];
const aucunService = (j: Journal) => assert.ok(!j.appels.some((a) => a.startsWith("photo-")), "le service photo a été appelé : " + j.appels.join(","));

const URL_PHOTO = "/api/v1/restaurant/menu/photo";
const jpeg = (octets: Uint8Array = OCTETS_JPEG, nom = "plat.jpg", type = "image/jpeg") => new File([octets as BlobPart], nom, { type });
function formulaire(champs: Record<string, string | File | undefined>): FormData {
  const f = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) if (valeur !== undefined) f.append(cle, valeur);
  return f;
}
const envoyer = (app: App, corps: BodyInit | null, entetes: Record<string, string> = AUTH) => app.request(URL_PHOTO, { method: "POST", headers: entetes, body: corps });
const envoyerPhoto = (app: App, champs: Record<string, string | File | undefined> = { platId: PLAT, photo: jpeg() }, entetes: Record<string, string> = AUTH) => envoyer(app, formulaire(champs), entetes);
const code = async (r: Response) => ((await r.json()) as { erreur: { code: string } }).erreur.code;

/** Corps en flux dont on observe la lecture : `highWaterMark: 0` = rien n'est lu tant que personne ne le demande. */
function corpsEnFlux(octets: number, entetes: Record<string, string> = {}) {
  let lus = 0;
  const type = "multipart/form-data; boundary=----essai";
  const flux = new ReadableStream<Uint8Array>({
    pull(controle) {
      if (lus >= octets) { controle.close(); return; }
      const n = Math.min(65536, octets - lus);
      lus += n;
      controle.enqueue(new Uint8Array(n).fill(97));
    },
  }, { highWaterMark: 0 });
  return { corps: flux, entetes: { ...AUTH, "content-type": type, ...entetes }, lus: () => lus };
}
const demandeFlux = (app: App, f: ReturnType<typeof corpsEnFlux>) => app.request(URL_PHOTO, { method: "POST", headers: f.entetes, body: f.corps, duplex: "half" } as RequestInit);

// ---------- identité et refus du contexte ----------
test("D4c route : sans jeton porteur, 401 ; ni le contexte ni le service ne sont appelés (envoi et retrait)", async () => {
  for (const champs of [{ platId: PLAT, photo: jpeg() }, { platId: PLAT, retirer: "1" }]) {
    const { app, journal } = monter();
    assert.equal((await envoyerPhoto(app, champs, {})).status, 401);
    assert.ok(!journal.appels.some((a) => a.startsWith("contexte")));
    aucunService(journal);
  }
});

test("D4c route : un cookie n'est jamais une identité ; un jeton refusé par le vérificateur : 401", async () => {
  const { app, journal } = monter();
  assert.equal((await envoyerPhoto(app, undefined, { cookie: "sb-access-token=aaaaaaaa.bbbbbbbb.cccccccc" })).status, 401);
  assert.equal((await envoyerPhoto(app, undefined, { authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" })).status, 401);
  aucunService(journal);
});

test("D4c route : compte non membre : 403 NON_AUTORISE, aucun service appelé", async () => {
  const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant."); } });
  const reponse = await envoyerPhoto(app);
  assert.equal(reponse.status, 403);
  assert.equal(await code(reponse), "NON_AUTORISE");
  aucunService(journal);
});

test("D4c route : MFA ou questions de sécurité : 403 avec champs.securite et le message « Ouvrez Speedfood sur le site… »", async () => {
  for (const securite of ["mfa", "questions"]) {
    const { app, journal } = monter({ contexte: async () => { throw new ErreurMetier("NON_AUTORISE", "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.", { securite }); } });
    const reponse = await envoyerPhoto(app);
    assert.equal(reponse.status, 403);
    const corps = (await reponse.json()) as { ok: boolean; erreur: { code: string; message: string; champs: { securite: string } } };
    assert.equal(corps.ok, false);
    assert.equal(corps.erreur.champs.securite, securite);
    assert.equal(corps.erreur.message, "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.");
    aucunService(journal);
  }
});

test("D4c route : le PLAFOND par compte passe AVANT la lecture du corps : 429 sans lire un seul octet, même pour un corps énorme ou déclaré énorme", async () => {
  const contexte = async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); };
  for (const octets of [1000, 10 * 1024 * 1024]) {
    for (const declare of [{}, { "content-length": String(octets) }] as Array<Record<string, string>>) {
      const { app, journal } = monter({ contexte });
      const f = corpsEnFlux(octets, declare);
      const reponse = await demandeFlux(app, f);
      assert.equal(reponse.status, 429, `${octets}`);
      assert.equal(f.lus(), 0, "le corps n'a pas été lu avant le plafond");
      aucunService(journal);
    }
  }
});

// ---------- envoi ----------
test("D4c route : envoi valide : le service reçoit le contexte (client du jeton, restaurant du COMPTE), le plat et le fichier ; réponse { ok: true }, sans cache ni CORS ni jeton", async () => {
  const { app, journal } = monter();
  const reponse = await envoyerPhoto(app, { platId: PLAT, photo: jpeg(), origin: undefined });
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), { ok: true });
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.equal(reponse.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "photo-definir"]);
  const [appel] = journal.photos;
  assert.equal(appel.ctx, CTX);
  assert.equal(appel.platId, PLAT);
  assert.ok(appel.fichier instanceof File);
  assert.equal(appel.fichier!.type, "image/jpeg");
  assert.deepEqual(new Uint8Array(await appel.fichier!.arrayBuffer()), OCTETS_JPEG, "les octets arrivent intacts");
});

test("D4c route : un restaurantId (ou toute autre clé) du formulaire est IGNORÉ : le service reçoit exactement (contexte, plat, fichier)", async () => {
  const { app, journal } = monter();
  const reponse = await envoyerPhoto(app, { platId: PLAT, photo: jpeg(), restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, id: RESTAURANT_B, photo_url: "https://x/y.jpg", archive_le: "2026-01-01" });
  assert.equal(reponse.status, 200);
  assert.equal(journal.photos[0].ctx.restaurantId, RESTAURANT_A);
  assert.deepEqual(Object.keys(journal.photos[0]).sort(), ["appel", "ctx", "fichier", "platId"]);
});

test("D4c route : plat qui n'est pas un UUID (absent, texte, traversée de chemin) = 400 sans service ; le plafond est quand même consommé une fois", async () => {
  for (const platId of [undefined, "", "abc", "../../x", `${PLAT}x`, PLAT.toUpperCase().slice(0, 35)]) {
    const { app, journal } = monter();
    const reponse = await envoyerPhoto(app, { platId, photo: jpeg() });
    assert.equal(reponse.status, 400, String(platId));
    assert.equal(await code(reponse), "VALIDATION");
    assert.equal(journal.appels.filter((a) => a.startsWith("contexte")).length, 1);
    aucunService(journal);
  }
});

test("D4c route : champ photo absent, champ texte, fichier vide, type interdit (gif, svg, pdf, html) = 400 sans service", async () => {
  const cas: Array<Record<string, string | File | undefined>> = [
    { platId: PLAT },
    { platId: PLAT, photo: "pas un fichier" },
    { platId: PLAT, photo: jpeg(new Uint8Array(0)) },
    { platId: PLAT, photo: jpeg(OCTETS_JPEG, "a.gif", "image/gif") },
    { platId: PLAT, photo: jpeg(OCTETS_JPEG, "a.svg", "image/svg+xml") },
    { platId: PLAT, photo: jpeg(OCTETS_JPEG, "a.pdf", "application/pdf") },
    { platId: PLAT, photo: jpeg(OCTETS_JPEG, "a.html", "text/html") },
    { platId: PLAT, photo: jpeg(OCTETS_JPEG, "a.jpg", "") },
  ];
  for (const champs of cas) {
    const { app, journal } = monter();
    const reponse = await envoyerPhoto(app, champs);
    assert.equal(reponse.status, 400, JSON.stringify(Object.keys(champs)) + String((champs.photo as File | undefined)?.type));
    assert.equal(await code(reponse), "VALIDATION");
    aucunService(journal);
  }
});

test("D4c route : une requête qui n'est pas du multipart (JSON, texte, sans type) = 400 sans service", async () => {
  for (const entetes of [{ ...AUTH, "content-type": "application/json" }, { ...AUTH, "content-type": "text/plain" }, { ...AUTH }]) {
    const { app, journal } = monter();
    assert.equal((await envoyer(app, JSON.stringify({ platId: PLAT }), entetes)).status, 400);
    aucunService(journal);
  }
});

test("D4c route : un corps multipart illisible = 400 sans service", async () => {
  const { app, journal } = monter();
  const reponse = await envoyer(app, "ceci n'est pas du multipart", { ...AUTH, "content-type": "multipart/form-data; boundary=----essai" });
  assert.equal(reponse.status, 400);
  aucunService(journal);
});

// ---------- taille ----------
test("D4c route : Content-Length au-dessus de la limite : 413 AVANT toute lecture du corps, sans service", async () => {
  for (const longueur of [PHOTO_CORPS_MAX_OCTETS + 1, 50 * 1024 * 1024, 999999999999]) {
    const { app, journal } = monter();
    const f = corpsEnFlux(2000, { "content-length": String(longueur) });
    const reponse = await demandeFlux(app, f);
    assert.equal(reponse.status, 413, String(longueur));
    assert.equal(await code(reponse), "VALIDATION");
    assert.equal(f.lus(), 0, "aucun octet lu");
    aucunService(journal);
  }
});

test("D4c route : Content-Length absent ou MENSONGER : le flux est compté, au-delà de la limite = 413 sans service", async () => {
  for (const declare of [{}, { "content-length": "100" }] as Array<Record<string, string>>) {
    const { app, journal } = monter();
    const f = corpsEnFlux(PHOTO_CORPS_MAX_OCTETS + 200000, declare);
    const reponse = await demandeFlux(app, f);
    assert.equal(reponse.status, 413, JSON.stringify(declare));
    assert.ok(f.lus() <= PHOTO_CORPS_MAX_OCTETS + 65536 * 2, "la lecture s'arrête à la limite (au plus un ou deux blocs de plus)");
    aucunService(journal);
  }
});

test("D4c route : Content-Length illisible = 400 sans service", async () => {
  for (const longueur of ["abc", "-5", "1e9", "12 34", "99999999999999999999"]) {
    const { app, journal } = monter();
    const f = corpsEnFlux(2000, { "content-length": longueur });
    const reponse = await demandeFlux(app, f);
    assert.ok(reponse.status === 400 || reponse.status === 413, `${longueur} : ${reponse.status}`);
    aucunService(journal);
  }
});

test("D4c route : fichier de 5 Mo + 1 octet dont le corps tient dans la marge = 413 (contrôle du fichier), 5 Mo pile = accepté", async () => {
  const exact = new Uint8Array(PHOTO_TAILLE_MAX_OCTETS); exact.set(OCTETS_JPEG);
  const { app, journal } = monter();
  assert.equal((await envoyerPhoto(app, { platId: PLAT, photo: jpeg(exact) })).status, 200);
  assert.equal(journal.photos.length, 1);
  const trop = new Uint8Array(PHOTO_TAILLE_MAX_OCTETS + 1); trop.set(OCTETS_JPEG);
  const autre = monter();
  const reponse = await envoyerPhoto(autre.app, { platId: PLAT, photo: jpeg(trop) });
  assert.equal(reponse.status, 413);
  assert.equal(await code(reponse), "VALIDATION");
  aucunService(autre.journal);
});

// ---------- retrait ----------
test("D4c route : retrait (platId + retirer=1, sans fichier) : le service de retrait reçoit le contexte et le plat ; jamais le service d'envoi", async () => {
  const { app, journal } = monter();
  const reponse = await envoyerPhoto(app, { platId: PLAT, retirer: "1" });
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), { ok: true });
  assert.deepEqual(journal.appels, ["identite", "contexte:compte-1:true", "photo-retirer"]);
  assert.equal(journal.photos[0].ctx, CTX);
  assert.equal(journal.photos[0].platId, PLAT);
});

test("D4c route : retrait ambigu (retirer ≠ « 1 », ou avec un fichier) ou plat invalide = 400 sans service", async () => {
  for (const champs of [{ platId: PLAT, retirer: "0" }, { platId: PLAT, retirer: "true" }, { platId: PLAT, retirer: "" }, { platId: PLAT, retirer: "1", photo: jpeg() }, { platId: "abc", retirer: "1" }, { retirer: "1" }]) {
    const { app, journal } = monter();
    assert.equal((await envoyerPhoto(app, champs as Record<string, string | File>)).status, 400, JSON.stringify(Object.keys(champs)));
    aucunService(journal);
  }
});

// ---------- erreurs du service ----------
test("D4c route : les refus du service gardent leur code : plat inconnu 400, quota d'envois 429, panne 500 (envoi et retrait)", async () => {
  const cas: Array<[Awaited<ReturnType<Deps["restaurant"]["definirPhoto"]>>, number, string]> = [
    [{ ok: false, erreur: { code: "VALIDATION", message: "Plat inconnu." } }, 400, "VALIDATION"],
    [{ ok: false, erreur: { code: "TROP_DE_REQUETES", message: "Trop d'images envoyées. Réessayez plus tard." } }, 429, "TROP_DE_REQUETES"],
    [{ ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer la photo. Réessayez dans un instant." } }, 500, "ERREUR_SERVEUR"],
  ];
  for (const [resultat, statut, codeAttendu] of cas) {
    const e = monter({ definirPhoto: async () => resultat, retirerPhoto: async () => resultat });
    for (const champs of [{ platId: PLAT, photo: jpeg() }, { platId: PLAT, retirer: "1" }]) {
      const reponse = await envoyerPhoto(e.app, champs);
      assert.equal(reponse.status, statut);
      assert.equal(await code(reponse), codeAttendu);
    }
  }
});

test("D4c route : une panne inattendue du service = 500 sans détail interne", async () => {
  const panne = monter({ definirPhoto: async () => { throw new Error("secret interne SQL"); }, retirerPhoto: async () => { throw new Error("secret interne SQL"); } }).app;
  for (const champs of [{ platId: PLAT, photo: jpeg() }, { platId: PLAT, retirer: "1" }]) {
    const reponse = await envoyerPhoto(panne, champs);
    assert.equal(reponse.status, 500);
    assert.ok(!(await reponse.text()).includes("secret interne"));
  }
});

test("D4c route : aucune réponse ne contient le jeton ; pas de CORS, même en préliminaire", async () => {
  const { app } = monter();
  for (const champs of [{ platId: PLAT, photo: jpeg() }, { platId: PLAT, retirer: "1" }, { platId: "x", photo: jpeg() }]) {
    const texte = await (await envoyerPhoto(app, champs, { ...AUTH, origin: "https://exemple.test" })).text();
    assert.ok(!texte.includes(JETON) && !/jeton|token/i.test(texte));
  }
  const pre = await app.request(URL_PHOTO, { method: "OPTIONS", headers: { origin: "https://exemple.test", "access-control-request-method": "POST" } });
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
});
