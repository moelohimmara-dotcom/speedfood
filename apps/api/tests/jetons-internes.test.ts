import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { calculerJetonSuivi, cleIdempotenceValide } from "../../web/src/lib/commande/jetons-calcul.ts";
import { fournirJetonInterne } from "../src/commandes/jeton-interne.ts";

const cle = "2bb133fc-e6f9-43b3-bbb7-20daf88d7405";
test("calcul partagé : résultat historique conservé, y compris panier-", () => {
  for (const valeur of [cle, `panier-${cle}`]) {
    assert.equal(cleIdempotenceValide(valeur), true);
    assert.equal(calculerJetonSuivi(valeur, "secret-uniquement-factice"), createHmac("sha256", "secret-uniquement-factice")
      .update(`speedfood-jeton-suivi-v1:${valeur}`).digest("base64url").slice(0, 40));
  }
  assert.notEqual(calculerJetonSuivi(cle, "factice-a"), calculerJetonSuivi(cle, "factice-b"));
});
test("calcul partagé : refus des entrées et secrets absents", () => {
  for (const valeur of [null, {}, "texte-arbitraire", ` ${cle}`]) assert.equal(cleIdempotenceValide(valeur), false);
  assert.throws(() => calculerJetonSuivi(cle, ""), /^Error: calcul_jeton_indisponible$/);
  assert.throws(() => calculerJetonSuivi("texte-arbitraire", "factice"), /^Error: calcul_jeton_indisponible$/);
});
test("fournisseur : garde éteinte par défaut, aucun appel de liaison", async () => {
  let appels = 0;
  const fournir = fournirJetonInterne(() => ({ SITE_JETONS: { deriver() { appels++; return "x".repeat(40); } } }));
  await assert.rejects(fournir(cle), /^Error: calcul_jeton_indisponible$/);
  assert.equal(appels, 0);
});
test("fournisseur : liaison lue à chaque appel, clé transmise sans transformation", async () => {
  let appels = 0;
  let jeton = "x".repeat(40);
  const fournir = fournirJetonInterne(() => ({ CREATION_COMMANDE_API: "oui", SITE_JETONS: {
    deriver(valeur: string) { assert.equal(valeur, cle); appels++; return jeton; },
  } }));
  assert.equal(await fournir(cle), jeton);
  jeton = "y".repeat(40);
  assert.equal(await fournir(cle), jeton);
  assert.equal(appels, 2);
});
test("fournisseur : entrée invalide refusée avant RPC", async () => {
  let appels = 0;
  const fournir = fournirJetonInterne(() => ({ CREATION_COMMANDE_API: "oui", SITE_JETONS: { deriver() { appels++; return "x".repeat(40); } } }));
  await assert.rejects(fournir("arbitraire"), /^Error: calcul_jeton_indisponible$/);
  assert.equal(appels, 0);
});
test("fournisseur : liaison absente, réponse invalide ou erreur sensible => erreur fixe", async () => {
  for (const SITE_JETONS of [undefined, {}, { deriver: 3 }, { deriver: () => null }, { deriver: () => "court" },
    { deriver() { throw new Error("donnee-factice-a-ne-pas-afficher"); } }]) {
    const fournir = fournirJetonInterne(() => ({ CREATION_COMMANDE_API: "oui", SITE_JETONS }));
    await assert.rejects(fournir(cle), /^Error: calcul_jeton_indisponible$/);
  }
});
test("fournisseur : délai borné, sans relance du calcul", { timeout: 2000 }, async () => {
  let appels = 0;
  const fournir = fournirJetonInterne(() => ({ CREATION_COMMANDE_API: "oui", SITE_JETONS: {
    deriver() { appels++; return new Promise(() => {}); },
  } }), 20);
  await assert.rejects(fournir(cle), /^Error: calcul_jeton_indisponible$/);
  assert.equal(appels, 1);
});
