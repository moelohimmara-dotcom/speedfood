import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApercuCommandeRestaurant } from "@speedfood/shared/contracts/commande";
import { projeterCommandesRestaurant } from "../../web/src/lib/api/restaurant-commandes-projection.ts";

/** Projection des commandes du restaurant pour l'application (partagée avec la route du site) : le jeton du reçu n'en sort jamais. */
const JETON_RECU = "ab".repeat(32);
const COMMANDE_ID = "33333333-3333-4333-8333-333333333333";

function apercu(surcharge: Partial<ApercuCommandeRestaurant> = {}): ApercuCommandeRestaurant {
  return {
    id: COMMANDE_ID, reference: "SF-4KVB9", statut: "acceptee", etatDerive: "acceptee", mode: "retrait", tableNumero: null, clientNom: "Awa Diallo", clientTelephone: "+224 622 00 00 00",
    clientAdresse: null, sousTotal: 45000, fraisLivraisonEstime: 5000, creeLe: "2026-11-03T10:00:00.000Z", estTest: false,
    lignes: [{ nom: "Poulet braisé", prix: 45000, quantite: 1, options: [] }], propositionActive: null, propositions: [],
    paiementStatut: "non_demande", paiementMode: null, paiementReference: null, paiementRecuLe: null, jetonRecu: JETON_RECU, ...surcharge,
  };
}
const restaurant = { id: "11111111-1111-4111-8111-111111111111", nom: "Chez Fatou", ouvert: true, accepte_commandes: true };
const projeter = (commandes: ApercuCommandeRestaurant[], documents: Array<{ order_id: string; type: string; numero: string }> = []) =>
  projeterCommandesRestaurant({ commandes, documents, restaurant, origine: "https://site.exemple" });

test("projection : le champ jetonRecu n'est PAS dans la commande renvoyée", () => {
  const [c] = projeter([apercu()]).commandes;
  assert.ok(!("jetonRecu" in c));
  assert.ok(!Object.keys(c).some((cle) => /^jeton/i.test(cle)));
});

test("projection : le jeton du reçu n'apparaît que dans le lien WhatsApp prérempli (vers le téléphone du client), sur l'origine du site", () => {
  const reponse = projeter([apercu()]);
  const [c] = reponse.commandes;
  assert.ok(c.lienRecuWhatsApp?.startsWith("https://wa.me/224622000000?text="));
  assert.ok(decodeURIComponent(c.lienRecuWhatsApp ?? "").includes(`https://site.exemple/recu/${JETON_RECU}`));
  const sansLiens = JSON.stringify({ ...reponse, commandes: reponse.commandes.map(({ lienRecuWhatsApp, lienFactureWhatsApp, ...reste }) => reste) });
  assert.ok(!sansLiens.includes(JETON_RECU), "le jeton n'est nulle part ailleurs que dans le lien");
});

test("projection : paiement visible seulement une fois la commande acceptée (pas de lien de reçu avant)", () => {
  for (const etat of ["en_attente", "refusee", "annulee", "attente_confirmation_client"] as const) {
    const [c] = projeter([apercu({ statut: etat === "attente_confirmation_client" ? "en_attente" : etat, etatDerive: etat })]).commandes;
    assert.equal(c.paiementVisible, false, etat);
    assert.equal(c.lienRecuWhatsApp, null, etat);
  }
  for (const etat of ["acceptee", "prete", "terminee"] as const) assert.equal(projeter([apercu({ statut: etat, etatDerive: etat })]).commandes[0].paiementVisible, true, etat);
});

test("projection : documents, lien de facture, libellé de paiement et restaurant", () => {
  const reponse = projeter([apercu({ paiementStatut: "declare", paiementMode: "orange_money" })], [{ order_id: COMMANDE_ID, type: "recu", numero: "R-1" }, { order_id: COMMANDE_ID, type: "facture", numero: "F-1" }, { order_id: "autre", type: "facture", numero: "F-9" }]);
  const [c] = reponse.commandes;
  assert.deepEqual(c.documents, { recu: "R-1", facture: "F-1" });
  assert.match(decodeURIComponent(c.lienFactureWhatsApp ?? ""), /F-1.*50 000 GNF/s);
  assert.equal(c.paiementLibelle, "Paiement déclaré, en attente de confirmation du restaurant");
  assert.deepEqual(reponse.restaurant, { id: restaurant.id, nom: "Chez Fatou", ouvert: true, accepteCommandes: true });
  assert.equal(reponse.ok, true);
  assert.equal(projeterCommandesRestaurant({ commandes: [], documents: [], restaurant: null, origine: "x" }).restaurant, null);
});

test("projection : téléphone inexploitable, aucun lien (jamais un lien vers un mauvais numéro) ; montants entiers conservés", () => {
  const [c] = projeter([apercu({ clientTelephone: "12" })]).commandes;
  assert.equal(c.lienRecuWhatsApp, null);
  assert.equal(c.sousTotal, 45000);
  assert.equal(c.fraisLivraisonEstime, 5000);
  assert.ok(Number.isInteger(c.sousTotal));
});
