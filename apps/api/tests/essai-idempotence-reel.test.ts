import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error : outil JavaScript sans declaration de types
import { essayerIdempotence, creerEtatEssai, CIBLES_ESSAI } from "../scripts/essai-idempotence-reel.mjs";

type Requete = { method: string; headers: Record<string, string>; body?: string; redirect?: string };
function scenario(options: { admin?: boolean; premierStatut?: number; premierTest?: boolean; deuxiemeStatut?: number; memeJeton?: boolean; idempotent?: boolean; menuPrix?: number; panneSite?: boolean; reserve?: boolean; panneVerificationFinale?: boolean } = {}) {
  const appels: Array<{ url: string; options: Requete }> = [];
  const notes: Array<Record<string, unknown>> = [];
  let ecritures = 0;
  let reservations = 0;
  const commande = { reference: "SF-ABCDE", restaurantId: CIBLES_ESSAI.restaurant, estTest: options.premierTest ?? true, jeton: "x".repeat(40) };
  const envoyer = async (url: string, requete: Requete) => {
    appels.push({ url, options: requete });
    assert.equal(requete.redirect, "manual");
    if (url === CIBLES_ESSAI.moi) return Response.json({ ok: true, roles: { equipe: options.admin === false ? null : "super_admin" } });
    if (url === CIBLES_ESSAI.liste && requete.method === "GET") {
      if (ecritures > 1 && options.panneVerificationFinale) throw new Error("Lecture finale indisponible");
      const commandes = [{ reference: "SF-G8V6H", estTest: true, restaurantId: CIBLES_ESSAI.restaurant, jeton: "a".repeat(40) }];
      if (ecritures > 0) commandes.push(commande);
      if (ecritures > 1 && options.deuxiemeStatut === 201) commandes.push({ ...commande, reference: "SF-FGHIJ" });
      return Response.json({ ok: true, commandes });
    }
    if (url === CIBLES_ESSAI.menu) return Response.json([{ id: CIBLES_ESSAI.plat, restaurant_id: CIBLES_ESSAI.restaurant, prix: options.menuPrix ?? 30000, prix_promo: 25000, disponible: true, archive_le: null }]);
    if ([CIBLES_ESSAI.creationSite, CIBLES_ESSAI.creationApi].includes(url) && requete.method === "POST") {
      ecritures++;
      assert.equal(requete.headers.authorization, "Bearer session-factice");
      const corps = JSON.parse(requete.body ?? "{}");
      assert.equal(corps.mode, "retrait");
      assert.equal(corps.sousTotalAffiche, 25000);
      assert.equal(corps.client.telephone, "600000000");
      assert.equal(corps.est_test, undefined);
      if (url === CIBLES_ESSAI.creationSite) {
        if (options.panneSite) throw new Error("Detail factice qui ne doit pas sortir");
        return Response.json({ ok: true, reference: "SF-ABCDE", jeton: "x".repeat(40), idempotent: false }, { status: options.premierStatut ?? 201 });
      }
      return Response.json({ ok: true, reference: options.deuxiemeStatut === 201 ? "SF-FGHIJ" : "SF-ABCDE", jeton: (options.memeJeton === false ? "y" : "x").repeat(40), idempotent: options.idempotent ?? options.deuxiemeStatut !== 201 }, { status: options.deuxiemeStatut ?? 200 });
    }
    throw new Error("Appel hors perimetre");
  };
  const etat = {
    reserver: () => { reservations++; return options.reserve ?? true; },
    noter: (note: Record<string, unknown>) => notes.push(note),
  };
  return { appels, notes, etat, envoyer, ecritures: () => ecritures, reservations: () => reservations };
}
const configuration = { acces: "session-factice", clePublique: "publique-factice", autoriserEcriture: true };

test("sans autorisation explicite, aucun appel et aucune reservation", async () => {
  const s = scenario();
  const r = await essayerIdempotence({ ...configuration, autoriserEcriture: false }, s.envoyer, s.etat);
  assert.equal(r.code, 2);
  assert.equal(s.appels.length, 0);
  assert.equal(s.reservations(), 0);
});
test("refuse un compte sans role equipe avant toute creation", async () => {
  const s = scenario({ admin: false });
  assert.equal((await essayerIdempotence(configuration, s.envoyer, s.etat)).code, 2);
  assert.equal(s.ecritures(), 0);
});
test("verrou deja present : aucun POST commandes", async () => {
  const s = scenario({ reserve: false });
  assert.equal((await essayerIdempotence(configuration, s.envoyer, s.etat)).code, 2);
  assert.equal(s.ecritures(), 0);
});
test("nominal : corps identique, 201 puis 200 idempotent, references et jetons identiques", async () => {
  const s = scenario();
  const r = await essayerIdempotence(configuration, s.envoyer, s.etat);
  assert.equal(r.code, 0);
  assert.equal(r.memeJeton, true);
  const ecritures = s.appels.filter(a => a.options.method === "POST");
  assert.equal(ecritures.length, 2);
  assert.equal(ecritures[0].options.body, ecritures[1].options.body);
  assert.equal(ecritures[0].url, CIBLES_ESSAI.creationSite);
  assert.equal(ecritures[1].url, CIBLES_ESSAI.creationApi);
  assert.equal(s.reservations(), 1);
  const sortie = JSON.stringify({ r, notes: s.notes });
  assert.ok(!sortie.includes("session-factice"));
  assert.ok(!sortie.includes("x".repeat(40)));
  assert.ok(!sortie.includes("cleIdempotence"));
});
test("premiere reponse inattendue : aucun envoi API", async () => {
  const s = scenario({ premierStatut: 500 });
  assert.equal((await essayerIdempotence(configuration, s.envoyer, s.etat)).code, 1);
  assert.equal(s.ecritures(), 1);
});
test("premiere commande non TEST : arret avant le POST API", async () => {
  const s = scenario({ premierTest: false });
  assert.equal((await essayerIdempotence(configuration, s.envoyer, s.etat)).code, 1);
  assert.equal(s.ecritures(), 1);
});
test("panne apres envoi site : aucune relance automatique", async () => {
  const s = scenario({ panneSite: true });
  const r = await essayerIdempotence(configuration, s.envoyer, s.etat);
  assert.equal(r.code, 2);
  assert.equal(s.ecritures(), 1);
  assert.ok(!JSON.stringify(r).includes("Detail factice"));
});
test("jeton different : echec sans afficher les valeurs", async () => {
  const s = scenario({ memeJeton: false });
  const r = await essayerIdempotence(configuration, s.envoyer, s.etat);
  assert.equal(r.code, 1);
  assert.equal(r.memeJeton, false);
  assert.ok(!JSON.stringify(r).includes("y".repeat(40)));
});
test("API 201 : detecte une seconde creation et aucun troisieme envoi", async () => {
  const s = scenario({ deuxiemeStatut: 201 });
  const r = await essayerIdempotence(configuration, s.envoyer, s.etat);
  assert.equal(r.code, 1);
  assert.equal(s.ecritures(), 2);
  assert.equal(r.creationSupplementaire, true);
});
test("API 201 puis lecture en panne : conserve l alerte de seconde creation", async () => {
  const s = scenario({ deuxiemeStatut: 201, panneVerificationFinale: true });
  const r = await essayerIdempotence(configuration, s.envoyer, s.etat);
  assert.equal(r.code, 1);
  assert.equal(r.creationSupplementaire, true);
  assert.equal(r.apiEstTest, null);
  assert.equal(s.ecritures(), 2);
});
test("API 200 sans idempotent true : echec", async () => {
  const s = scenario({ idempotent: false });
  assert.equal((await essayerIdempotence(configuration, s.envoyer, s.etat)).code, 1);
});
test("prix non entier : arret avant toute creation", async () => {
  const s = scenario({ menuPrix: 30000.5 });
  assert.equal((await essayerIdempotence(configuration, s.envoyer, s.etat)).code, 2);
  assert.equal(s.ecritures(), 0);
});
test("verrou durable : deux instances ne peuvent pas reserver le meme essai", () => {
  const dossier = mkdtempSync(join(tmpdir(), "speedfood-idempotence-"));
  const fichier = join(dossier, "etat.json");
  try {
    const a = creerEtatEssai(fichier);
    const b = creerEtatEssai(fichier);
    assert.equal(a.reserver(), true);
    assert.equal(b.reserver(), false);
    a.noter({ phase: "termine", reference: "SF-ABCDE" });
    assert.equal(creerEtatEssai(fichier).reserver(), false);
  } finally { unlinkSync(fichier); rmdirSync(dossier); }
});
test("le fichier d etat refuse un champ secret ou une reference non conforme", () => {
  const dossier = mkdtempSync(join(tmpdir(), "speedfood-idempotence-"));
  const fichier = join(dossier, "etat.json");
  try {
    const e = creerEtatEssai(fichier);
    assert.equal(e.reserver(), true);
    assert.throws(() => e.noter({ phase: "termine", jeton: "valeur-factice-a-refuser" }));
    assert.throws(() => e.noter({ phase: "termine", reference: "valeur-factice-a-refuser" }));
    assert.ok(!readFileSync(fichier, "utf8").includes("valeur-factice-a-refuser"));
  } finally { unlinkSync(fichier); rmdirSync(dossier); }
});
