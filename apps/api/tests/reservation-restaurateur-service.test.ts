import { test } from "node:test";
import assert from "node:assert/strict";
import { creerAccesReservationRestaurant } from "../src/reservation/acces.ts";
import { creerServiceReservationRestaurant } from "../src/reservation/restaurateur.ts";
import { CRENEAU, MAINTENANT, RESTO_1, RESTO_2, RES_1, RES_2, RES_3, RES_4, RES_AUTRE, TEL_A, TEL_B, UID_A, UID_B, baseReservations, ligneReservation, ligneRestaurant, type Row } from "./reservation-base-factice.ts";
import type { ContexteRestaurant } from "../src/types.ts";

/** M3 : logique de la réservation côté restaurateur, sur la base factice (les ports de production tournent pour de vrai sur de fausses tables). */
const MEMBRE = "00000000-0000-4000-8000-0000000000ff";

function banc(options: Parameters<typeof baseReservations>[0] = {}, maintenant: Date = MAINTENANT) {
  const base = baseReservations({ colonnesModifiables: ["statut", "motif_refus", "accepte_reservation", "reservation_capacite_couverts"], ...options });
  const service = creerServiceReservationRestaurant({ maintenant: () => maintenant, ...creerAccesReservationRestaurant() });
  const ctx = (restaurantId = RESTO_1): ContexteRestaurant => ({ supabase: base.client, utilisateurId: MEMBRE, restaurantId, role: "manager" });
  return { ...base, service, ctx };
}
const ecritures = (b: { operations: { op: string }[] }) => b.operations.filter((o) => o.op !== "select");
const le = (heures: number) => new Date(MAINTENANT.getTime() + heures * 3600_000).toISOString();

// ---------- liste ----------

test("M3 liste restaurateur : les réservations du jour (heure de Conakry = UTC) plus TOUTES les demandes à venir, triées par créneau, avec les coordonnées du client", async () => {
  const lignes: Row[] = [
    ligneReservation({ id: RES_1, creneau: "2026-11-12T20:00:00.000Z", statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" }),
    ligneReservation({ id: RES_2, creneau: "2026-11-12T12:00:00.000Z", reference: "SF-R-AAAAB", nom_client: "Moussa Diallo", telephone: TEL_B }),
    ligneReservation({ id: RES_3, creneau: "2026-11-15T19:00:00.000Z", reference: "SF-R-AAAAC" }),
    ligneReservation({ id: RES_4, creneau: "2026-11-13T00:00:00.000Z", reference: "SF-R-AAAAD", statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" }),
    ligneReservation({ id: RES_AUTRE, creneau: "2026-11-11T19:00:00.000Z", reference: "SF-R-AAAAE", statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" }),
  ];
  const b = banc({ reservations: lignes });
  const r = await b.service.lister(b.ctx(), "2026-11-12");
  assert.ok(r.ok);
  assert.equal(r.jour, "2026-11-12");
  // RES_4 (13 nov 00:00 pile) est le jour suivant et confirmée : exclue ; RES_AUTRE (11 nov) confirmée : exclue ; RES_3 (demandée à venir) : incluse.
  assert.deepEqual(r.reservations.map((x) => x.id), [RES_2, RES_1, RES_3]);
  assert.equal(r.reservations[0].nom, "Moussa Diallo");
  assert.equal(r.reservations[0].telephone, TEL_B);
  assert.ok(r.reservations.every((x) => !("clientUserId" in x) && !("client_user_id" in x)));
});

test("M3 liste restaurateur : jamais les réservations d'un autre restaurant ; les demandes passées (créneau échu) ne sont pas à venir", async () => {
  const b = banc({
    restaurants: [ligneRestaurant(), ligneRestaurant({ id: RESTO_2, nom: "Autre" })],
    reservations: [
      ligneReservation({ id: RES_1, restaurant_id: RESTO_2, creneau: "2026-11-12T19:00:00.000Z", telephone: TEL_B, nom_client: "Client de l'autre" }),
      ligneReservation({ id: RES_2, creneau: "2026-11-09T19:00:00.000Z", reference: "SF-R-AAAAB" }),
    ],
  });
  const r = await b.service.lister(b.ctx(), "2026-11-12");
  assert.ok(r.ok);
  assert.deepEqual(r.reservations, []);
  assert.doesNotMatch(JSON.stringify(r), /autre|Autre/);
  for (const o of b.operations.filter((x) => x.table === "reservations_table")) assert.ok(o.filtres.includes("eq:restaurant_id"), "chaque requête est filtrée sur le restaurant du contexte");
});

test("M3 liste restaurateur : sans jour = aujourd'hui (UTC) ; jour invalide = refus clair sans lecture", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1, creneau: "2026-11-10T19:00:00.000Z", statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" })] });
  const r = await b.service.lister(b.ctx(), null);
  assert.ok(r.ok && r.jour === "2026-11-10" && r.reservations.length === 1);
  for (const jour of ["2026-02-30", "demain", "", "12/11/2026"]) {
    const b2 = banc();
    const ko = await b2.service.lister(b2.ctx(), jour);
    assert.equal(ko.ok, false, jour);
    if (!ko.ok) { assert.equal(ko.erreur.code, "VALIDATION"); assert.match(ko.erreur.message, /AAAA-MM-JJ/); }
    assert.equal(b2.operations.length, 0, jour);
  }
});

test("M3 liste restaurateur : chaque réservation porte les actions possibles calculées par le serveur", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1, creneau: "2026-11-12T19:00:00.000Z" }), ligneReservation({ id: RES_2, creneau: "2026-11-12T20:00:00.000Z", statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z", reference: "SF-R-AAAAB" })] });
  const r = await b.service.lister(b.ctx(), "2026-11-12");
  assert.ok(r.ok);
  assert.deepEqual(r.reservations.map((x) => x.actionsPossibles), [["confirmer", "refuser"], ["annuler"]]);
});

// ---------- décisions ----------

test("M3 décision : confirmer une demande à venir ; l'écriture ne touche que statut, filtrée sur le restaurant ET sur l'état attendu", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1 })] });
  const r = await b.service.decider(b.ctx(), RES_1, { action: "confirmer", motif: null });
  assert.ok(r.ok);
  assert.equal(r.reservation.statut, "confirmee");
  assert.deepEqual(r.reservation.actionsPossibles, ["annuler"]);
  const maj = b.operations.find((o) => o.op === "update");
  assert.deepEqual(maj?.valeurs, { statut: "confirmee" });
  assert.deepEqual(maj?.filtres, ["eq:id", "eq:restaurant_id", "eq:statut"]);
});

test("M3 décision : refuser une demande avec motif ; annuler une confirmée avec motif ; le motif est écrit", async () => {
  const refus = banc({ reservations: [ligneReservation({ id: RES_1 })] });
  const r = await refus.service.decider(refus.ctx(), RES_1, { action: "refuser", motif: "Complet ce soir" });
  assert.ok(r.ok && r.reservation.statut === "refusee" && r.reservation.motif === "Complet ce soir");
  assert.deepEqual(refus.operations.find((o) => o.op === "update")?.valeurs, { statut: "refusee", motif_refus: "Complet ce soir" });
  const annul = banc({ reservations: [ligneReservation({ id: RES_1, statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" })] });
  const a = await annul.service.decider(annul.ctx(), RES_1, { action: "annuler", motif: "Fermeture exceptionnelle" });
  assert.ok(a.ok && a.reservation.statut === "annulee_restaurant" && a.reservation.motif === "Fermeture exceptionnelle");
});

test("M3 décision : honorée (dans l'heure qui précède ou après) et non honorée (créneau passé)", async () => {
  const proche = banc({ reservations: [ligneReservation({ id: RES_1, statut: "confirmee", creneau: le(0.5), traitee_le: "2026-11-10T11:00:00.000Z" })] });
  assert.ok((await proche.service.decider(proche.ctx(), RES_1, { action: "honoree", motif: null })).ok);
  const passee = banc({ reservations: [ligneReservation({ id: RES_1, statut: "confirmee", creneau: le(-2), traitee_le: "2026-11-09T11:00:00.000Z" })] });
  const r = await passee.service.decider(passee.ctx(), RES_1, { action: "non_honoree", motif: null });
  assert.ok(r.ok && r.reservation.statut === "non_honoree");
  assert.deepEqual(r.reservation.actionsPossibles, []);
});

test("M3 décision : règles de temps de la base, avec un message clair et RIEN d'écrit", async () => {
  const cas: Array<[Row, "confirmer" | "honoree" | "non_honoree", RegExp]> = [
    [{ statut: "demandee", creneau: le(-1) }, "confirmer", /créneau est passé/],
    [{ statut: "confirmee", creneau: le(5), traitee_le: "2026-11-10T11:00:00.000Z" }, "honoree", /heure qui précède/],
    [{ statut: "confirmee", creneau: le(5), traitee_le: "2026-11-10T11:00:00.000Z" }, "non_honoree", /une fois le créneau passé/],
  ];
  for (const [surcharge, action, motif] of cas) {
    const b = banc({ reservations: [ligneReservation({ id: RES_1, ...surcharge })] });
    const r = await b.service.decider(b.ctx(), RES_1, { action, motif: null });
    assert.equal(r.ok, false, action);
    if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, motif); }
    assert.equal(ecritures(b).length, 0, action);
  }
});

test("M3 décision : transition impossible (état final, ou action sans objet) = refus clair, rien d'écrit", async () => {
  const cas: Array<[Row, "confirmer" | "refuser" | "annuler" | "honoree", RegExp]> = [
    [{ statut: "refusee", motif_refus: "Complet", traitee_le: "2026-11-10T11:00:00.000Z" }, "confirmer", /déjà refusée/],
    [{ statut: "annulee_client", traitee_le: "2026-11-10T11:00:00.000Z" }, "confirmer", /annulée par le client/],
    [{ statut: "honoree", traitee_le: "2026-11-10T11:00:00.000Z" }, "refuser", /honorée/],
    [{ statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" }, "refuser", /pas possible/],
    [{ statut: "demandee" }, "annuler", /pas possible/],
    [{ statut: "demandee" }, "honoree", /pas possible/],
  ];
  for (const [surcharge, action, motif] of cas) {
    const b = banc({ reservations: [ligneReservation({ id: RES_1, ...surcharge })] });
    const r = await b.service.decider(b.ctx(), RES_1, { action, motif: action === "refuser" || action === "annuler" ? "Motif écrit" : null });
    assert.equal(r.ok, false, `${JSON.stringify(surcharge)} ${action}`);
    if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, motif); }
    assert.equal(ecritures(b).length, 0);
  }
});

test("M3 décision : la même décision rejouée répond la même chose sans réécrire (idempotence)", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1, statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" })] });
  const r = await b.service.decider(b.ctx(), RES_1, { action: "confirmer", motif: null });
  assert.ok(r.ok && r.reservation.statut === "confirmee");
  assert.equal(ecritures(b).length, 0);
});

test("M3 décision : la réservation d'un AUTRE restaurant est introuvable (même réponse qu'une inexistante) et RIEN n'est écrit", async () => {
  const b = banc({
    restaurants: [ligneRestaurant(), ligneRestaurant({ id: RESTO_2, nom: "Autre" })],
    reservations: [ligneReservation({ id: RES_AUTRE, restaurant_id: RESTO_2, telephone: TEL_B })],
  });
  const autre = await b.service.decider(b.ctx(RESTO_1), RES_AUTRE, { action: "confirmer", motif: null });
  const inexistante = await b.service.decider(b.ctx(RESTO_1), "dddddddd-0000-4000-8000-000000000009", { action: "confirmer", motif: null });
  assert.deepEqual(autre, inexistante);
  assert.equal(autre.ok, false);
  if (!autre.ok) assert.equal(autre.erreur.code, "INTROUVABLE");
  assert.equal(ecritures(b).length, 0);
  assert.equal(b.tables.reservations_table[0].statut, "demandee");
  assert.doesNotMatch(JSON.stringify(autre), new RegExp(TEL_B.replace("+", "\\+")));
});

test("M3 décision : changement concurrent entre la lecture et l'écriture = relecture et réponse juste (jamais un écrasement)", async () => {
  // Le client annule juste avant la confirmation du restaurant : l'écriture, filtrée sur l'état attendu, ne touche rien.
  const b = banc({
    reservations: [ligneReservation({ id: RES_1 })],
    avantMiseAJour: (t) => { Object.assign(t.reservations_table[0], { statut: "annulee_client", traitee_le: "2026-11-10T11:30:00.000Z" }); },
  });
  const r = await b.service.decider(b.ctx(), RES_1, { action: "confirmer", motif: null });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, /annulée par le client/); }
  assert.equal(b.tables.reservations_table[0].statut, "annulee_client", "l'annulation du client n'est pas écrasée");
});

test("M3 décision : une erreur de la base (garde de transition) est traduite, jamais reprise ; une erreur inconnue reste générique", async () => {
  const garde = banc({ reservations: [ligneReservation({ id: RES_1 })], erreurMiseAJour: { code: "P0001", message: "Changement d'état impossible : de « demandee » à « confirmee »." } });
  const r = await garde.service.decider(garde.ctx(), RES_1, { action: "confirmer", motif: null });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.doesNotMatch(r.erreur.message, /« demandee »/); }
  const inconnue = banc({ reservations: [ligneReservation({ id: RES_1 })], erreurMiseAJour: { code: "XX000", message: "boom secret SQL" } });
  const r2 = await inconnue.service.decider(inconnue.ctx(), RES_1, { action: "confirmer", motif: null });
  assert.equal(r2.ok, false);
  if (!r2.ok) { assert.equal(r2.erreur.code, "ERREUR_SERVEUR"); assert.doesNotMatch(JSON.stringify(r2.erreur), /boom|secret|SQL/); }
});

test("M3 décision : le restaurateur ne peut écrire QUE le statut et le motif (la base factice refuse toute autre colonne, comme les droits de colonne)", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1 })] });
  await b.service.decider(b.ctx(), RES_1, { action: "refuser", motif: "Complet" });
  for (const o of b.operations.filter((x) => x.op === "update")) for (const k of Object.keys(o.valeurs ?? {})) assert.ok(["statut", "motif_refus"].includes(k), k);
});

// ---------- réglages ----------

test("M3 réglage : lecture des deux valeurs du restaurant du contexte, avec le client du jeton", async () => {
  const b = banc({ restaurants: [ligneRestaurant({ accepte_reservation: true, reservation_capacite_couverts: 40 }), ligneRestaurant({ id: RESTO_2, accepte_reservation: false, reservation_capacite_couverts: 7 })] });
  const r = await b.service.lireReglage(b.ctx());
  assert.deepEqual(r, { ok: true, accepteReservation: true, capaciteCouverts: 40 });
  const requete = b.operations[0];
  assert.equal(requete.select, "accepte_reservation, reservation_capacite_couverts");
  assert.deepEqual(requete.filtres, ["eq:id"]);
});

test("M3 réglage : restaurant illisible = erreur serveur claire", async () => {
  const b = banc({ restaurants: [] });
  const r = await b.service.lireReglage(b.ctx());
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erreur.code, "ERREUR_SERVEUR");
});

test("M3 réglage : écriture de l'un, de l'autre ou des deux, uniquement sur le restaurant du contexte ; null retire le plafond", async () => {
  const b = banc({ restaurants: [ligneRestaurant({ accepte_reservation: false, reservation_capacite_couverts: 40 }), ligneRestaurant({ id: RESTO_2, accepte_reservation: false, reservation_capacite_couverts: 7 })] });
  assert.deepEqual(await b.service.ecrireReglage(b.ctx(), { accepteReservation: true }), { ok: true, accepteReservation: true, capaciteCouverts: 40 });
  assert.deepEqual(await b.service.ecrireReglage(b.ctx(), { capaciteCouverts: null }), { ok: true, accepteReservation: true, capaciteCouverts: null });
  assert.deepEqual(await b.service.ecrireReglage(b.ctx(), { accepteReservation: false, capaciteCouverts: 12 }), { ok: true, accepteReservation: false, capaciteCouverts: 12 });
  const maj = b.operations.filter((o) => o.op === "update");
  assert.deepEqual(maj.map((o) => o.valeurs), [{ accepte_reservation: true }, { reservation_capacite_couverts: null }, { accepte_reservation: false, reservation_capacite_couverts: 12 }]);
  assert.ok(maj.every((o) => o.filtres.includes("eq:id")));
  const autre = b.tables.restaurants.find((r) => r.id === RESTO_2);
  assert.equal(autre?.accepte_reservation, false);
  assert.equal(autre?.reservation_capacite_couverts, 7, "le réglage d'un autre restaurant n'est jamais touché");
});

test("M3 réglage : une erreur de la base est traduite ; aucune ligne modifiée = erreur serveur claire", async () => {
  const b = banc({ erreurMiseAJour: { code: "42501", message: "permission denied for table restaurants" } });
  const r = await b.service.ecrireReglage(b.ctx(), { accepteReservation: true });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.erreur.code, "NON_AUTORISE"); assert.doesNotMatch(r.erreur.message, /restaurants|permission denied/); }
  const vide = banc({ restaurants: [] });
  const r2 = await vide.service.ecrireReglage(vide.ctx(), { accepteReservation: true });
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.erreur.code, "ERREUR_SERVEUR");
});

test("M3 restaurateur : aucun accès ne nomme le compte du client ni ne le renvoie", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1, client_user_id: UID_B })] });
  const r = await b.service.lister(b.ctx(), "2026-11-12");
  assert.ok(r.ok);
  assert.doesNotMatch(JSON.stringify(r), new RegExp(`${UID_B}|client_user_id|clientUserId`));
  for (const o of b.operations) assert.doesNotMatch(o.select, /client_user_id/);
  assert.ok(UID_A && CRENEAU);
});
