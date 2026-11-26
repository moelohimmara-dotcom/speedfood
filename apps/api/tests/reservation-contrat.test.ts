import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAPACITE_COUVERTS_MAX,
  NB_PERSONNES_MAX,
  construireReponseDisponibiliteReservation,
  lireReponseDisponibiliteReservation,
  lireCorpsCreationReservation,
  lireCorpsDecisionReservation,
  lireCorpsReglageReservation,
  lireJourReservation,
  lireReponseCreationReservation,
  lireReponseDecisionReservation,
  lireReponseListeReservations,
  lireReponseReglageReservation,
  lireReponseReservationClient,
  lireReponseReservationsRestaurant,
  lireReservationClient,
  lireReservationRestaurant,
  projeterReservationClient,
  projeterReservationRestaurant,
  bornesDuJour,
} from "@speedfood/shared/contracts/reservation";

/** M3 : contrat partagé de la réservation (corps stricts lus par le serveur, parseurs stricts lus par le client). Valeurs factices uniquement. */
const RESTO = "11111111-1111-4111-8111-111111111111";
const BASE = { restaurantId: RESTO, creneau: "2026-11-12T19:00:00Z", nbPersonnes: 4, nom: "Aminata Camara", telephone: "620 00 00 01" };

// ---------- corps de création ----------

test("M3 corps de création : une demande valide est normalisée (créneau canonique, téléphone +224, note vide = null)", () => {
  const r = lireCorpsCreationReservation({ ...BASE, note: "  " });
  assert.ok(r.ok);
  assert.deepEqual(r.valeurs, { restaurantId: RESTO, creneau: "2026-11-12T19:00:00.000Z", nbPersonnes: 4, nom: "Aminata Camara", telephone: "+224620000001", note: null });
});

test("M3 corps de création : la note facultative est reprise, rognée et nettoyée des retours à la ligne", () => {
  const r = lireCorpsCreationReservation({ ...BASE, note: " Table au calme\nsvp " });
  assert.ok(r.ok);
  assert.equal(r.valeurs.note, "Table au calme svp");
});

test("M3 corps de création : clés inconnues refusées (jamais de compte, de statut ni de jeton dans le corps)", () => {
  for (const extra of [{ clientUserId: "x" }, { utilisateurId: "x" }, { userId: "x" }, { statut: "confirmee" }, { jetonSuiviHash: "x" }, { reference: "SF-R-AAAAA" }]) {
    const r = lireCorpsCreationReservation({ ...BASE, ...extra });
    assert.equal(r.ok, false, JSON.stringify(extra));
  }
});

test("M3 corps de création : champs manquants, mal typés ou hors bornes refusés avec un message en français", () => {
  const invalides: unknown[] = [
    null, [], "x", 5,
    { ...BASE, restaurantId: undefined }, { ...BASE, restaurantId: "pas-un-uuid" }, { ...BASE, restaurantId: 12 },
    { ...BASE, creneau: undefined }, { ...BASE, creneau: "demain soir" }, { ...BASE, creneau: "2026-11-12T19:00:00" }, { ...BASE, creneau: "2026-11-12T19:00:00+01:00" }, { ...BASE, creneau: "2026-13-45T19:00:00Z" }, { ...BASE, creneau: 1789000000000 },
    { ...BASE, nbPersonnes: 0 }, { ...BASE, nbPersonnes: 13 }, { ...BASE, nbPersonnes: 2.5 }, { ...BASE, nbPersonnes: "4" }, { ...BASE, nbPersonnes: undefined },
    { ...BASE, nom: undefined }, { ...BASE, nom: "A" }, { ...BASE, nom: "  B  " }, { ...BASE, nom: "x".repeat(61) }, { ...BASE, nom: 42 },
    { ...BASE, telephone: undefined }, { ...BASE, telephone: "12345" }, { ...BASE, telephone: "+33612345678" }, { ...BASE, telephone: "+224520000001" },
    { ...BASE, note: "x".repeat(201) }, { ...BASE, note: 5 },
  ];
  for (const corps of invalides) {
    const r = lireCorpsCreationReservation(corps);
    assert.equal(r.ok, false, JSON.stringify(corps));
    if (!r.ok) assert.match(r.message, /[a-zéèêàç]/i);
  }
});

test("M3 corps de création : bornes exactes acceptées (1 et 12 personnes, nom de 2 et de 60 caractères, note de 200)", () => {
  assert.ok(lireCorpsCreationReservation({ ...BASE, nbPersonnes: 1 }).ok);
  assert.ok(lireCorpsCreationReservation({ ...BASE, nbPersonnes: 12 }).ok);
  assert.ok(lireCorpsCreationReservation({ ...BASE, nom: "Bo" }).ok);
  assert.ok(lireCorpsCreationReservation({ ...BASE, nom: "x".repeat(60) }).ok);
  assert.ok(lireCorpsCreationReservation({ ...BASE, note: "n".repeat(200) }).ok);
});

test("M3 corps de création : le créneau est un multiple de 15 minutes, secondes et millisecondes à zéro", () => {
  for (const ok of ["2026-11-12T19:00:00Z", "2026-11-12T19:15:00Z", "2026-11-12T19:30Z", "2026-11-12T19:45:00.000Z"]) assert.ok(lireCorpsCreationReservation({ ...BASE, creneau: ok }).ok, ok);
  for (const ko of ["2026-11-12T19:10:00Z", "2026-11-12T19:14:00Z", "2026-11-12T19:00:01Z", "2026-11-12T19:00:00.500Z", "2026-11-12T19:59:00Z"]) {
    const r = lireCorpsCreationReservation({ ...BASE, creneau: ko });
    assert.equal(r.ok, false, ko);
    if (!r.ok) assert.match(r.message, /15 minutes/);
  }
});

test("M3 corps de création : le téléphone suit la règle commune (mêmes formes que partout ailleurs)", () => {
  for (const [saisie, attendu] of [["620000001", "+224620000001"], ["0620000001", "+224620000001"], ["+224 620 00 00 01", "+224620000001"], ["00224720000001", "+224720000001"]] as const) {
    const r = lireCorpsCreationReservation({ ...BASE, telephone: saisie });
    assert.ok(r.ok, saisie);
    assert.equal(r.valeurs.telephone, attendu);
  }
});

test("M3 corps de création : les messages ne reprennent jamais la saisie", () => {
  const r = lireCorpsCreationReservation({ ...BASE, telephone: "SECRET-TEL-12345" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.doesNotMatch(r.message, /SECRET/);
});

// ---------- corps de décision ----------

test("M3 décision : les cinq actions, motif obligatoire pour refuser et annuler (3 à 200 caractères)", () => {
  assert.deepEqual(lireCorpsDecisionReservation({ action: "confirmer" }), { ok: true, valeurs: { action: "confirmer", motif: null } });
  assert.deepEqual(lireCorpsDecisionReservation({ action: "honoree" }), { ok: true, valeurs: { action: "honoree", motif: null } });
  assert.deepEqual(lireCorpsDecisionReservation({ action: "non_honoree", motif: null }), { ok: true, valeurs: { action: "non_honoree", motif: null } });
  assert.deepEqual(lireCorpsDecisionReservation({ action: "refuser", motif: "  Complet ce soir  " }), { ok: true, valeurs: { action: "refuser", motif: "Complet ce soir" } });
  assert.deepEqual(lireCorpsDecisionReservation({ action: "annuler", motif: "abc" }), { ok: true, valeurs: { action: "annuler", motif: "abc" } });
  assert.ok(lireCorpsDecisionReservation({ action: "refuser", motif: "m".repeat(200) }).ok);
  for (const action of ["refuser", "annuler"]) {
    for (const motif of [undefined, null, "", "  ", "ab", "m".repeat(201), 12]) {
      assert.equal(lireCorpsDecisionReservation({ action, motif }).ok, false, `${action} ${String(motif)}`);
    }
    assert.equal(lireCorpsDecisionReservation({ action }).ok, false, `${action} sans motif`);
  }
});

test("M3 décision : action inconnue, clé en trop (restaurant, compte, statut) et motif sur une action sans motif refusés", () => {
  for (const corps of [null, [], {}, { action: "supprimer" }, { action: 3 }, { action: "confirmer", restaurantId: RESTO }, { action: "confirmer", statut: "confirmee" }, { action: "confirmer", utilisateurId: "x" }, { action: "confirmer", motif: "Pourquoi pas" }, { action: "honoree", motif: "x y z" }]) {
    assert.equal(lireCorpsDecisionReservation(corps).ok, false, JSON.stringify(corps));
  }
});

// ---------- corps du réglage ----------

test("M3 réglage : accepteReservation booléen et capaciteCouverts entier de 1 à 500 ou null, au moins un des deux", () => {
  assert.deepEqual(lireCorpsReglageReservation({ accepteReservation: true }), { ok: true, valeurs: { accepteReservation: true } });
  assert.deepEqual(lireCorpsReglageReservation({ capaciteCouverts: null }), { ok: true, valeurs: { capaciteCouverts: null } });
  assert.deepEqual(lireCorpsReglageReservation({ accepteReservation: false, capaciteCouverts: 1 }), { ok: true, valeurs: { accepteReservation: false, capaciteCouverts: 1 } });
  assert.ok(lireCorpsReglageReservation({ capaciteCouverts: CAPACITE_COUVERTS_MAX }).ok);
  for (const corps of [null, [], {}, { accepteReservation: "oui" }, { accepteReservation: 1 }, { capaciteCouverts: 0 }, { capaciteCouverts: 501 }, { capaciteCouverts: 2.5 }, { capaciteCouverts: "20" }, { capaciteCouverts: -3 }, { accepteReservation: true, restaurantId: RESTO }, { accepte_reservation: true }]) {
    assert.equal(lireCorpsReglageReservation(corps).ok, false, JSON.stringify(corps));
  }
});

// ---------- jour ----------

test("M3 jour : AAAA-MM-JJ réel du calendrier, bornes en UTC (heure de Conakry)", () => {
  assert.equal(lireJourReservation("2026-11-12"), "2026-11-12");
  assert.equal(lireJourReservation("2028-02-29"), "2028-02-29");
  for (const ko of ["2026-02-30", "2026-13-01", "12/11/2026", "2026-11-12T00:00:00Z", "", undefined, 20261112]) assert.equal(lireJourReservation(ko), null, String(ko));
  const { debut, fin } = bornesDuJour("2026-11-12");
  assert.equal(debut.toISOString(), "2026-11-12T00:00:00.000Z");
  assert.equal(fin.toISOString(), "2026-11-13T00:00:00.000Z");
});

// ---------- parseurs stricts des réponses ----------

const resClient = (surcharge: Record<string, unknown> = {}) => ({
  id: "aaaaaaaa-0000-4000-8000-000000000001", reference: "SF-R-AAAAA", restaurantId: RESTO, restaurantNom: "Chez Fatou", creneau: "2026-11-12T19:00:00.000Z", nbPersonnes: 4,
  nom: "Aminata Camara", telephone: "+224620000001", note: null, statut: "demandee", motif: null, creeLe: "2026-11-10T10:00:00.000Z", ...surcharge,
});
const resResto = (surcharge: Record<string, unknown> = {}) => {
  const { restaurantId: _a, restaurantNom: _b, ...reste } = resClient();
  return { ...reste, actionsPossibles: ["confirmer", "refuser"], ...surcharge };
};

test("M3 parseur strict : une réservation du client valide est lue telle quelle", () => {
  assert.deepEqual(lireReservationClient(resClient()), resClient());
  assert.deepEqual(lireReservationClient(resClient({ note: "Fenêtre", statut: "refusee", motif: "Complet ce soir" })), resClient({ note: "Fenêtre", statut: "refusee", motif: "Complet ce soir" }));
});

test("M3 parseur strict : champ manquant, champ en trop, statut inconnu, valeur hors bornes ou forme inattendue = réponse illisible", () => {
  const base = resClient();
  const illisibles: unknown[] = [
    null, [], "x", 3,
    ...Object.keys(base).map((cle) => { const { [cle]: _omis, ...sans } = base as Record<string, unknown>; return sans; }),
    { ...base, clientUserId: "x" }, { ...base, jetonSuiviHash: "a".repeat(64) }, { ...base, traiteePar: "x" },
    resClient({ statut: "inconnue" }), resClient({ statut: "" }), resClient({ statut: null }),
    resClient({ nbPersonnes: 0 }), resClient({ nbPersonnes: 13 }), resClient({ nbPersonnes: 2.5 }), resClient({ nbPersonnes: "4" }),
    resClient({ reference: "SF-4KVB9" }), resClient({ reference: "SF-R-AAAA0" }), resClient({ id: "pas-un-uuid" }), resClient({ restaurantId: "x" }),
    resClient({ creneau: "bientôt" }), resClient({ creneau: 1789000000000 }), resClient({ creeLe: "" }),
    resClient({ telephone: "620000001" }), resClient({ telephone: "+33612345678" }),
    resClient({ nom: "A" }), resClient({ nom: "" }), resClient({ restaurantNom: "" }), resClient({ note: 5 }), resClient({ note: "x".repeat(201) }),
    resClient({ motif: "ab" }), resClient({ motif: 12 }), resClient({ motif: "" }),
  ];
  for (const brut of illisibles) assert.throws(() => lireReservationClient(brut), /RESERVATION_ILLISIBLE/, JSON.stringify(brut));
});

test("M3 parseur strict : la réservation vue par le restaurant porte les actions possibles (liste fermée, sans doublon) et jamais de compte", () => {
  assert.deepEqual(lireReservationRestaurant(resResto()), resResto());
  assert.deepEqual(lireReservationRestaurant(resResto({ actionsPossibles: [] })).actionsPossibles, []);
  for (const brut of [resResto({ actionsPossibles: ["confirmer", "confirmer"] }), resResto({ actionsPossibles: ["supprimer"] }), resResto({ actionsPossibles: "confirmer" }), resResto({ actionsPossibles: undefined }), resResto({ clientUserId: "x" }), resResto({ restaurantId: RESTO }), resResto({ statut: "inconnue" }), { ...resResto(), telephone: undefined }]) {
    assert.throws(() => lireReservationRestaurant(brut), /RESERVATION_ILLISIBLE/, JSON.stringify(brut));
  }
});

test("M3 parseurs des enveloppes : ok:true exact, forme exacte, aucune clé en trop", () => {
  assert.deepEqual(lireReponseCreationReservation({ ok: true, reservation: resClient(), idempotent: false }), { reservation: resClient(), idempotent: false });
  assert.deepEqual(lireReponseReservationClient({ ok: true, reservation: resClient() }), resClient());
  assert.deepEqual(lireReponseListeReservations({ ok: true, reservations: [resClient(), resClient({ id: "aaaaaaaa-0000-4000-8000-000000000002" })] }).length, 2);
  assert.deepEqual(lireReponseReservationsRestaurant({ ok: true, jour: "2026-11-12", reservations: [resResto()] }), { jour: "2026-11-12", reservations: [resResto()] });
  assert.deepEqual(lireReponseDecisionReservation({ ok: true, reservation: resResto() }), resResto());
  assert.deepEqual(lireReponseReglageReservation({ ok: true, accepteReservation: true, capaciteCouverts: 30 }), { accepteReservation: true, capaciteCouverts: 30 });
  assert.deepEqual(lireReponseReglageReservation({ ok: true, accepteReservation: false, capaciteCouverts: null }), { accepteReservation: false, capaciteCouverts: null });
  const illisibles: Array<() => unknown> = [
    () => lireReponseCreationReservation({ ok: true, reservation: resClient() }),
    () => lireReponseCreationReservation({ ok: true, reservation: resClient(), idempotent: "non" }),
    () => lireReponseCreationReservation({ ok: false, reservation: resClient(), idempotent: false }),
    () => lireReponseCreationReservation({ ok: true, reservation: resClient(), idempotent: false, jeton: "x" }),
    () => lireReponseReservationClient({ ok: true, reservation: resClient(), extra: 1 }),
    () => lireReponseReservationClient({ reservation: resClient() }),
    () => lireReponseListeReservations({ ok: true, reservations: "aucune" }),
    () => lireReponseListeReservations({ ok: true, reservations: Array.from({ length: 51 }, () => resClient()) }),
    () => lireReponseListeReservations({ ok: true, reservations: [resClient({ statut: "x" })] }),
    () => lireReponseReservationsRestaurant({ ok: true, jour: "2026-02-30", reservations: [] }),
    () => lireReponseReservationsRestaurant({ ok: true, reservations: [] }),
    () => lireReponseDecisionReservation({ ok: true, reservation: resClient() }),
    () => lireReponseReglageReservation({ ok: true, accepteReservation: "oui", capaciteCouverts: null }),
    () => lireReponseReglageReservation({ ok: true, accepteReservation: true, capaciteCouverts: 0 }),
    () => lireReponseReglageReservation({ ok: true, accepteReservation: true }),
  ];
  for (const [i, f] of illisibles.entries()) assert.throws(f, /RESERVATION_ILLISIBLE/, `cas ${i}`);
});

test("M3 projection défensive du serveur : ne garde que les champs du contrat, null si douteux", () => {
  const avecExces = { ...resClient(), clientUserId: "uid", jetonSuiviHash: "h", traiteePar: "t" };
  const p = projeterReservationClient(avecExces);
  assert.deepEqual(p, resClient());
  assert.ok(!p || !("clientUserId" in p));
  assert.equal(projeterReservationClient({ ...resClient(), statut: "bizarre" }), null);
  assert.equal(projeterReservationClient(null), null);
  const q = projeterReservationRestaurant({ ...resResto(), clientUserId: "uid", restaurantId: RESTO });
  assert.deepEqual(q, resResto());
  assert.equal(projeterReservationRestaurant({ ...resResto(), actionsPossibles: ["x"] }), null);
});

test("M3 contrat : aucune borne dupliquée, celles de statuts.ts sont reprises (nombre de personnes, délai, horizon)", async () => {
  const contrat = await import("@speedfood/shared/contracts/reservation");
  const statuts = await import("@speedfood/shared/reservation/statuts");
  assert.equal(contrat.NB_PERSONNES_MIN, statuts.NB_PERSONNES_MIN);
  assert.equal(contrat.NB_PERSONNES_MAX, statuts.NB_PERSONNES_MAX);
  assert.equal(contrat.DELAI_MIN_MINUTES, statuts.DELAI_MIN_MINUTES);
  assert.equal(contrat.HORIZON_MAX_JOURS, statuts.HORIZON_MAX_JOURS);
});

// ---------- disponibilité (lot M4-0) ----------

test("M4-0 disponibilité : la réponse est construite avec la constante partagée (aucune autre clé) et relue strictement", () => {
  const vraie = construireReponseDisponibiliteReservation(RESTO.toUpperCase(), true);
  assert.deepEqual(vraie, { ok: true, restaurantId: RESTO, accepteReservation: true, nbPersonnesMax: NB_PERSONNES_MAX });
  assert.equal(NB_PERSONNES_MAX, 12);
  assert.deepEqual(Object.keys(construireReponseDisponibiliteReservation(RESTO, false)).sort(), ["accepteReservation", "nbPersonnesMax", "ok", "restaurantId"]);
  assert.deepEqual(lireReponseDisponibiliteReservation(vraie), { restaurantId: RESTO, accepteReservation: true, nbPersonnesMax: 12 });
  assert.deepEqual(lireReponseDisponibiliteReservation(construireReponseDisponibiliteReservation(RESTO, false)), { restaurantId: RESTO, accepteReservation: false, nbPersonnesMax: 12 });
});

test("M4-0 disponibilité : le parseur strict refuse clé en trop ou manquante, types faux, ok différent de true, identifiant mal formé, borne hors contrat", () => {
  const bon = { ok: true, restaurantId: RESTO, accepteReservation: true, nbPersonnesMax: 12 };
  const illisibles: unknown[] = [
    { ...bon, capaciteCouverts: 30 }, { ...bon, nom: "Chez Fatou" },
    { ok: true, restaurantId: RESTO, accepteReservation: true }, { ok: true, restaurantId: RESTO, nbPersonnesMax: 12 }, { ok: true, accepteReservation: true, nbPersonnesMax: 12 },
    { ...bon, ok: false }, { ...bon, ok: "true" }, { ...bon, accepteReservation: "oui" }, { ...bon, accepteReservation: 1 }, { ...bon, accepteReservation: null },
    { ...bon, restaurantId: "pas-un-uuid" }, { ...bon, restaurantId: 12 },
    { ...bon, nbPersonnesMax: 13 }, { ...bon, nbPersonnesMax: 0 }, { ...bon, nbPersonnesMax: 2.5 }, { ...bon, nbPersonnesMax: "12" },
    null, [], "texte", 12, undefined,
  ];
  for (const [i, brut] of illisibles.entries()) assert.throws(() => lireReponseDisponibiliteReservation(brut), /RESERVATION_ILLISIBLE/, `cas ${i}`);
});
