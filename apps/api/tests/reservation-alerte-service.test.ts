import { test } from "node:test";
import assert from "node:assert/strict";
import { creerAccesReservationClient, creerAccesReservationRestaurant } from "../src/reservation/acces.ts";
import { creerServiceReservationClient } from "../src/reservation/client.ts";
import { creerServiceReservationRestaurant } from "../src/reservation/restaurateur.ts";
import { CRENEAU, MAINTENANT, RESTO_1, RESTO_2, RES_1, RES_AUTRE, TEL_A, UID_A, baseReservations, ligneReservation, ligneRestaurant, type Row } from "./reservation-base-factice.ts";
import type { ContexteRestaurant } from "../src/types.ts";
import type { DemandeReservation } from "@speedfood/shared/contracts/reservation";

/**
 * M4c : DÉCLENCHEMENT des notifications de la réservation par les services (sur la base factice). Ce que l'on prouve ici :
 *  - l'alerte du restaurant part UNE fois pour une réservation NOUVELLE, jamais pour un rejeu (200), jamais sur un refus ;
 *  - le message au client part après une décision RÉUSSIE du restaurateur (confirmer, refuser, annuler), jamais sur erreur, relecture, honorée / non honorée, ni pour l'annulation du client ;
 *  - rien de personnel (nom, téléphone, note, motif) n'est transmis ; l'échec ou l'absence de la notification ne change jamais la réponse.
 */
const DEMANDE: DemandeReservation = { restaurantId: RESTO_1, creneau: CRENEAU, nbPersonnes: 4, nom: "Aminata Camara", telephone: TEL_A, note: "Près de la fenêtre" };
const ENV = { SITE_JETONS: "liaison de test" };
const MEMBRE = "00000000-0000-4000-8000-0000000000ff";
const le = (heures: number) => new Date(MAINTENANT.getTime() + heures * 3600_000).toISOString();
const CONFIRMEE: Row = { statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" };

type Planification = { taches: Array<() => Promise<void>>; apres: (t: () => Promise<void>) => void; jouer(): Promise<void> };
function planificateur(): Planification {
  const taches: Array<() => Promise<void>> = [];
  return { taches, apres: (t) => { taches.push(t); }, async jouer() { for (const t of taches.splice(0)) await t(); } };
}

function bancClient(options: Parameters<typeof baseReservations>[0] = {}, panne = false) {
  const base = baseReservations(options);
  const alertes: Array<{ restaurantId: string; environnement: unknown }> = [];
  const service = creerServiceReservationClient({
    maintenant: () => MAINTENANT,
    ...creerAccesReservationClient({ client: () => base.client }),
    alerterNouvelleDemande: async (restaurantId, environnement, ...reste: unknown[]) => { alertes.push({ restaurantId, environnement, ...(reste.length > 0 ? { reste } : {}) }); if (panne) throw new Error("panne du site"); },
  });
  return { ...base, service, alertes, plan: planificateur() };
}

function bancRestaurateur(options: Parameters<typeof baseReservations>[0] = {}) {
  const base = baseReservations({ colonnesModifiables: ["statut", "motif_refus", "accepte_reservation", "reservation_capacite_couverts"], ...options });
  const messages: Array<{ reservationId: string; statut: string; environnement: unknown }> = [];
  const service = creerServiceReservationRestaurant({
    maintenant: () => MAINTENANT,
    ...creerAccesReservationRestaurant(),
    prevenirClient: async (reservationId, statut, environnement, ...reste: unknown[]) => { messages.push({ reservationId, statut, environnement, ...(reste.length > 0 ? { reste } : {}) }); },
  });
  const ctx = (restaurantId = RESTO_1): ContexteRestaurant => ({ supabase: base.client, utilisateurId: MEMBRE, restaurantId, role: "manager" });
  return { ...base, service, messages, ctx, plan: planificateur() };
}

// ---------- alerte au restaurant ----------

test("M4c création : une réservation NOUVELLE planifie UNE alerte pour CE restaurant, jouée seulement après la réponse, avec l'environnement de la requête", async () => {
  const b = bancClient();
  const r = await b.service.creer(UID_A, DEMANDE, b.plan.apres, ENV);
  assert.ok(r.ok && r.idempotent === false);
  assert.equal(b.plan.taches.length, 1, "une seule tâche planifiée");
  assert.deepEqual(b.alertes, [], "rien n'est parti avant que la tâche soit jouée (après la réponse)");
  await b.plan.jouer();
  assert.deepEqual(b.alertes, [{ restaurantId: RESTO_1, environnement: ENV }]);
});

test("M4c création : l'alerte vise le restaurant de la réservation enregistrée, pas une autre valeur", async () => {
  const b = bancClient({ restaurants: [ligneRestaurant(), ligneRestaurant({ id: RESTO_2, nom: "Autre" })] });
  const r = await b.service.creer(UID_A, { ...DEMANDE, restaurantId: RESTO_2 }, b.plan.apres, ENV);
  assert.ok(r.ok);
  await b.plan.jouer();
  assert.deepEqual(b.alertes.map((a) => a.restaurantId), [RESTO_2]);
});

test("M4c création : un rejeu idempotent (200) ne planifie AUCUNE alerte", async () => {
  const b = bancClient({ reservations: [ligneReservation({ id: RES_1, creneau: CRENEAU, nb_personnes: 4 })] });
  const r = await b.service.creer(UID_A, DEMANDE, b.plan.apres, ENV);
  assert.ok(r.ok && r.idempotent === true);
  assert.equal(b.plan.taches.length, 0);
  await b.plan.jouer();
  assert.deepEqual(b.alertes, []);
});

test("M4c création : un refus (restaurant absent, fermé, créneau, plafond, doublon, capacité, erreur de la base) ne planifie AUCUNE alerte", async () => {
  const cas: Array<[string, Parameters<typeof baseReservations>[0], Partial<DemandeReservation>]> = [
    ["restaurant absent", { restaurants: [] }, {}],
    ["n'accepte pas", { restaurants: [ligneRestaurant({ accepte_reservation: false })] }, {}],
    ["non publié", { restaurants: [ligneRestaurant({ publie: false })] }, {}],
    ["créneau trop proche", {}, { creneau: new Date(MAINTENANT.getTime() + 10 * 60_000).toISOString() }],
    ["capacité dépassée", { restaurants: [ligneRestaurant({ reservation_capacite_couverts: 2 })] }, {}],
    ["doublon de créneau", { reservations: [ligneReservation({ id: RES_1, creneau: CRENEAU, nb_personnes: 2 })] }, {}],
    ["erreur de la base", { erreurRpc: { code: "XX000", message: "boom" } }, {}],
    ["références toujours prises", { collisionsReference: 99 }, {}],
  ];
  for (const [nom, options, surcharge] of cas) {
    const b = bancClient(options);
    const r = await b.service.creer(UID_A, { ...DEMANDE, ...surcharge }, b.plan.apres, ENV);
    assert.equal(r.ok, false, nom);
    assert.equal(b.plan.taches.length, 0, nom);
    await b.plan.jouer();
    assert.deepEqual(b.alertes, [], nom);
  }
});

test("M4c création : sans planificateur ni port d'alerte (anciens appels), la création réussit et rien ne part", async () => {
  const b = bancClient();
  const r = await b.service.creer(UID_A, DEMANDE);
  assert.ok(r.ok && r.idempotent === false);
  assert.deepEqual(b.alertes, []);
  const sansPort = creerServiceReservationClient({ maintenant: () => MAINTENANT, ...creerAccesReservationClient({ client: () => baseReservations().client }) });
  const plan = planificateur();
  assert.ok((await sansPort.creer(UID_A, DEMANDE, plan.apres, ENV)).ok);
  assert.equal(plan.taches.length, 0);
});

test("M4c création : un planificateur qui lève, ou une alerte qui échoue, ne change JAMAIS la réponse (réservation créée, 201)", async () => {
  const b = bancClient({}, true);
  const r = await b.service.creer(UID_A, DEMANDE, () => { throw new Error("pas de contexte d'exécution"); }, ENV);
  assert.ok(r.ok && r.idempotent === false);
  assert.equal(b.tables.reservations_table.length, 1);
  const c = bancClient({}, true);
  const r2 = await c.service.creer(UID_A, DEMANDE, c.plan.apres, ENV);
  assert.ok(r2.ok);
  await assert.doesNotReject(() => c.plan.jouer(), "la tâche planifiée ne lève jamais (aucune erreur non gérée dans waitUntil)");
});

test("M4c création : l'alerte ne reçoit que l'identifiant du restaurant et l'environnement (ni nom, ni téléphone, ni note, ni compte)", async () => {
  const b = bancClient();
  await b.service.creer(UID_A, DEMANDE, b.plan.apres, ENV);
  await b.plan.jouer();
  const vu = JSON.stringify(b.alertes);
  for (const interdit of ["Aminata", "Camara", TEL_A, "fenêtre", UID_A, "SF-R-"]) assert.ok(!vu.includes(interdit), interdit);
});

// ---------- message au client ----------

const decisions: Array<[string, "confirmer" | "refuser" | "annuler", Row, string]> = [
  ["confirmer", "confirmer", {}, "confirmee"],
  ["refuser", "refuser", {}, "refusee"],
  ["annuler une confirmée", "annuler", { ...CONFIRMEE }, "annulee_restaurant"],
];

for (const [nom, action, surcharge, attendu] of decisions) {
  test(`M4c décision « ${nom} » réussie : un message au client, de type « ${attendu} », pour CETTE réservation, joué après la réponse`, async () => {
    const b = bancRestaurateur({ reservations: [ligneReservation({ id: RES_1, ...surcharge })] });
    const motif = action === "confirmer" ? null : "Complet ce soir, désolé";
    const r = await b.service.decider(b.ctx(), RES_1, { action, motif }, b.plan.apres, ENV);
    assert.ok(r.ok);
    assert.equal(b.plan.taches.length, 1);
    assert.deepEqual(b.messages, []);
    await b.plan.jouer();
    assert.deepEqual(b.messages, [{ reservationId: RES_1, statut: attendu, environnement: ENV }]);
    // Rien de personnel ni de motif ne part.
    const vu = JSON.stringify(b.messages);
    for (const interdit of ["Aminata", TEL_A, "Complet", UID_A, "fenêtre"]) assert.ok(!vu.includes(interdit), interdit);
  });
}

test("M4c décision : honorée et non honorée ne préviennent JAMAIS le client", async () => {
  const proche = bancRestaurateur({ reservations: [ligneReservation({ id: RES_1, creneau: le(0.5), ...CONFIRMEE })] });
  assert.ok((await proche.service.decider(proche.ctx(), RES_1, { action: "honoree", motif: null }, proche.plan.apres, ENV)).ok);
  const passee = bancRestaurateur({ reservations: [ligneReservation({ id: RES_1, creneau: le(-2), ...CONFIRMEE })] });
  assert.ok((await passee.service.decider(passee.ctx(), RES_1, { action: "non_honoree", motif: null }, passee.plan.apres, ENV)).ok);
  for (const b of [proche, passee]) {
    assert.equal(b.plan.taches.length, 0);
    await b.plan.jouer();
    assert.deepEqual(b.messages, []);
  }
});

test("M4c décision : la même décision REJOUÉE (relecture) ne renvoie aucun message", async () => {
  const b = bancRestaurateur({ reservations: [ligneReservation({ id: RES_1, ...CONFIRMEE })] });
  const r = await b.service.decider(b.ctx(), RES_1, { action: "confirmer", motif: null }, b.plan.apres, ENV);
  assert.ok(r.ok && r.reservation.statut === "confirmee");
  assert.equal(b.plan.taches.length, 0);
  await b.plan.jouer();
  assert.deepEqual(b.messages, []);
});

test("M4c décision : changement concurrent déjà au même état (relecture après écriture sans ligne) ne renvoie aucun message", async () => {
  // Un autre appareil confirme entre la lecture et l'écriture : cette requête ne modifie rien, c'est l'autre qui prévient.
  const b = bancRestaurateur({
    reservations: [ligneReservation({ id: RES_1 })],
    avantMiseAJour: (t) => { Object.assign(t.reservations_table[0], { statut: "confirmee", traitee_le: "2026-11-10T11:30:00.000Z" }); },
  });
  const r = await b.service.decider(b.ctx(), RES_1, { action: "confirmer", motif: null }, b.plan.apres, ENV);
  assert.ok(r.ok && r.reservation.statut === "confirmee");
  assert.equal(b.plan.taches.length, 0);
});

test("M4c décision : erreur de la base, transition impossible, réservation introuvable ou d'un autre restaurant ne renvoient aucun message", async () => {
  const erreur = bancRestaurateur({ reservations: [ligneReservation({ id: RES_1 })], erreurMiseAJour: { code: "P0001", message: "Changement d'état impossible" } });
  assert.equal((await erreur.service.decider(erreur.ctx(), RES_1, { action: "confirmer", motif: null }, erreur.plan.apres, ENV)).ok, false);
  const impossible = bancRestaurateur({ reservations: [ligneReservation({ id: RES_1, statut: "refusee", motif_refus: "Complet", traitee_le: "2026-11-10T11:00:00.000Z" })] });
  assert.equal((await impossible.service.decider(impossible.ctx(), RES_1, { action: "confirmer", motif: null }, impossible.plan.apres, ENV)).ok, false);
  const autre = bancRestaurateur({ restaurants: [ligneRestaurant(), ligneRestaurant({ id: RESTO_2, nom: "Autre" })], reservations: [ligneReservation({ id: RES_AUTRE, restaurant_id: RESTO_2 })] });
  assert.equal((await autre.service.decider(autre.ctx(RESTO_1), RES_AUTRE, { action: "confirmer", motif: null }, autre.plan.apres, ENV)).ok, false);
  const inconnue = bancRestaurateur();
  assert.equal((await inconnue.service.decider(inconnue.ctx(), RES_1, { action: "confirmer", motif: null }, inconnue.plan.apres, ENV)).ok, false);
  for (const b of [erreur, impossible, autre, inconnue]) {
    assert.equal(b.plan.taches.length, 0);
    assert.deepEqual(b.messages, []);
  }
});

test("M4c décision : sans planificateur ni port, la décision réussit sans message ; un planificateur qui lève ne change pas la réponse", async () => {
  const b = bancRestaurateur({ reservations: [ligneReservation({ id: RES_1 })] });
  assert.ok((await b.service.decider(b.ctx(), RES_1, { action: "confirmer", motif: null })).ok);
  const c = bancRestaurateur({ reservations: [ligneReservation({ id: RES_1 })] });
  const r = await c.service.decider(c.ctx(), RES_1, { action: "confirmer", motif: null }, () => { throw new Error("pas de contexte"); }, ENV);
  assert.ok(r.ok && r.reservation.statut === "confirmee");
  assert.equal(c.tables.reservations_table[0].statut, "confirmee");
  const sansPort = creerServiceReservationRestaurant({ maintenant: () => MAINTENANT, ...creerAccesReservationRestaurant() });
  const base = baseReservations({ colonnesModifiables: ["statut", "motif_refus"], reservations: [ligneReservation({ id: RES_1 })] });
  const plan = planificateur();
  assert.ok((await sansPort.decider({ supabase: base.client, utilisateurId: MEMBRE, restaurantId: RESTO_1, role: "manager" }, RES_1, { action: "confirmer", motif: null }, plan.apres, ENV)).ok);
  assert.equal(plan.taches.length, 0);
});

test("M4c annulation par le CLIENT lui-même : aucun message (le restaurant n'a rien décidé)", async () => {
  const base = baseReservations({ reservations: [ligneReservation({ id: RES_1, ...CONFIRMEE })] });
  const messages: unknown[] = [];
  const alertes: unknown[] = [];
  const service = creerServiceReservationClient({
    maintenant: () => MAINTENANT,
    ...creerAccesReservationClient({ client: () => base.client }),
    alerterNouvelleDemande: async (...a) => { alertes.push(a); },
  });
  const r = await service.annuler(UID_A, RES_1);
  assert.ok(r.ok && r.reservation.statut === "annulee_client");
  assert.deepEqual([messages, alertes], [[], []]);
  // Le service client n'a même pas de moyen de prévenir un client.
  assert.equal("prevenirClient" in service, false);
});
