import { test } from "node:test";
import assert from "node:assert/strict";
import { creerAccesReservationClient } from "../src/reservation/acces.ts";
import { ESSAIS_INSERTION, creerServiceReservationClient, type PortsReservationClient } from "../src/reservation/client.ts";
import { CRENEAU, MAINTENANT, RESTO_1, RESTO_2, RES_1, RES_2, RES_3, RES_4, RES_AUTRE, TEL_A, TEL_B, UID_A, UID_B, baseReservations, ligneReservation, ligneRestaurant, type Row } from "./reservation-base-factice.ts";
import type { DemandeReservation } from "@speedfood/shared/contracts/reservation";

/**
 * M3 : logique de la réservation côté client, sur la base factice (les ports de production `acces.ts` tournent pour de vrai sur de fausses tables) ; certains refus se jouent
 * sur des ports surchargés. Aucune connexion réelle, aucune valeur réelle.
 */
const DEMANDE: DemandeReservation = { restaurantId: RESTO_1, creneau: CRENEAU, nbPersonnes: 4, nom: "Aminata Camara", telephone: TEL_A, note: null };

function banc(options: Parameters<typeof baseReservations>[0] = {}, surcharge: Partial<PortsReservationClient> = {}, maintenant: Date = MAINTENANT) {
  const base = baseReservations(options);
  const acces = creerAccesReservationClient({ client: () => base.client });
  const service = creerServiceReservationClient({ maintenant: () => maintenant, ...acces, ...surcharge });
  return { ...base, service };
}
const ecritures = (b: { operations: { op: string }[] }) => b.operations.filter((o) => o.op !== "select");

// ---------- création : le chemin heureux ----------

test("M3 création : une demande valide crée une réservation « demandée » liée au compte, sans jeton ni confirmation automatique", async () => {
  const b = banc();
  const r = await b.service.creer(UID_A, { ...DEMANDE, note: "Près de la fenêtre" });
  assert.ok(r.ok);
  assert.equal(r.idempotent, false);
  assert.equal(r.reservation.statut, "demandee");
  assert.equal(r.reservation.restaurantNom, "Chez Fatou");
  assert.equal(r.reservation.creneau, CRENEAU);
  assert.equal(r.reservation.note, "Près de la fenêtre");
  assert.match(r.reservation.reference, /^SF-R-[2-9A-HJKMNP-Z]{5}$/);
  const insertion = b.operations.find((o) => o.op === "insert");
  assert.deepEqual(insertion?.valeurs, { restaurant_id: RESTO_1, client_user_id: UID_A, nom_client: "Aminata Camara", telephone: TEL_A, nb_personnes: 4, creneau: CRENEAU, note: "Près de la fenêtre" });
  assert.ok(!("jeton_suivi_hash" in (insertion?.valeurs ?? {})) && !("statut" in (insertion?.valeurs ?? {})) && !("reference" in (insertion?.valeurs ?? {})));
  assert.equal(b.tables.reservations_table.length, 1);
});

test("M3 création : le compte écrit est celui passé par la route (le jeton), jamais autre chose", async () => {
  const b = banc();
  await b.service.creer(UID_B, DEMANDE);
  assert.equal(b.tables.reservations_table[0].client_user_id, UID_B);
});

// ---------- création : refus ----------

test("M3 création : restaurant introuvable, non publié, suspendu ou qui n'accepte pas les réservations = refus clairs, rien d'écrit", async () => {
  const cas: Array<[Row[], string, RegExp, string]> = [
    [[], "INTROUVABLE", /introuvable/, "absent"],
    [[ligneRestaurant({ publie: false })], "CONFLIT_ETAT", /pas disponible/, "non publié"],
    [[ligneRestaurant({ suspendu_le: "2026-11-01T00:00:00.000Z" })], "CONFLIT_ETAT", /pas disponible/, "suspendu"],
    [[ligneRestaurant({ accepte_reservation: false })], "CONFLIT_ETAT", /n'accepte pas/, "n'accepte pas"],
  ];
  for (const [restaurants, code, motif, nom] of cas) {
    const b = banc({ restaurants });
    const r = await b.service.creer(UID_A, DEMANDE);
    assert.equal(r.ok, false, nom);
    if (!r.ok) { assert.equal(r.erreur.code, code, nom); assert.match(r.erreur.message, motif, nom); }
    assert.equal(ecritures(b).length, 0, nom);
  }
});

test("M3 création : créneau à moins de 30 minutes ou à plus de 60 jours refusé ; 30 minutes pile et 60 jours pile acceptés", async () => {
  const maintenant = MAINTENANT.getTime();
  const trop = async (instant: number) => banc().service.creer(UID_A, { ...DEMANDE, creneau: new Date(instant).toISOString() });
  const proche = await trop(maintenant + 29 * 60_000);
  assert.equal(proche.ok, false);
  if (!proche.ok) { assert.equal(proche.erreur.code, "VALIDATION"); assert.match(proche.erreur.message, /30 minutes/); }
  const passe = await trop(maintenant - 3600_000);
  assert.equal(passe.ok, false);
  const loin = await trop(maintenant + 60 * 86400_000 + 60_000);
  assert.equal(loin.ok, false);
  if (!loin.ok) assert.match(loin.erreur.message, /60 jours/);
  assert.ok((await trop(maintenant + 30 * 60_000)).ok);
  assert.ok((await trop(maintenant + 60 * 86400_000)).ok);
});

test("M3 création : capacité exacte acceptée, dépassée refusée (somme des demandées ET confirmées du MÊME créneau)", async () => {
  const restaurants = [ligneRestaurant({ reservation_capacite_couverts: 10 })];
  const autres = [
    ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, nb_personnes: 3, statut: "demandee" }),
    ligneReservation({ id: RES_2, client_user_id: UID_B, nb_personnes: 3, statut: "confirmee", reference: "SF-R-AAAAB" }),
  ];
  // 3 + 3 déjà pris : il reste 4 places.
  const exact = banc({ restaurants, reservations: autres });
  assert.ok((await exact.service.creer(UID_A, { ...DEMANDE, nbPersonnes: 4 })).ok, "10 pile");
  const depasse = banc({ restaurants, reservations: autres });
  const r = await depasse.service.creer(UID_A, { ...DEMANDE, nbPersonnes: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, /pas assez de places/); assert.doesNotMatch(r.erreur.message, /\b10\b|\b6\b/, "aucun chiffre de capacité n'est révélé"); }
  assert.equal(ecritures(depasse).length, 0);
});

test("M3 création : seules les réservations demandées ou confirmées du MÊME créneau comptent pour la capacité", async () => {
  const restaurants = [ligneRestaurant({ reservation_capacite_couverts: 6 })];
  const nonComptees = [
    ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, nb_personnes: 6, statut: "refusee", motif_refus: "Complet", traitee_le: "2026-11-10T11:00:00.000Z" }),
    ligneReservation({ id: RES_2, client_user_id: UID_B, nb_personnes: 6, statut: "annulee_client", traitee_le: "2026-11-10T11:00:00.000Z", reference: "SF-R-AAAAB" }),
    ligneReservation({ id: RES_3, client_user_id: UID_B, nb_personnes: 6, statut: "demandee", creneau: "2026-11-12T20:00:00.000Z", reference: "SF-R-AAAAC" }),
    ligneReservation({ id: RES_4, restaurant_id: RESTO_2, client_user_id: UID_B, nb_personnes: 6, statut: "confirmee", reference: "SF-R-AAAAD" }),
  ];
  const b = banc({ restaurants: [...restaurants, ligneRestaurant({ id: RESTO_2, nom: "Autre" })], reservations: nonComptees });
  assert.ok((await b.service.creer(UID_A, { ...DEMANDE, nbPersonnes: 6 })).ok);
});

test("M3 création : sans plafond de capacité (null), aucune somme n'est lue", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, nb_personnes: 12 })] });
  assert.ok((await b.service.creer(UID_A, { ...DEMANDE, nbPersonnes: 12 })).ok);
  assert.equal(b.operations.filter((o) => o.select === "nb_personnes").length, 0);
});

test("M3 création : au plus 3 réservations actives à venir par compte, tous restaurants confondus ; refus à la 4e", async () => {
  const actives = [
    ligneReservation({ id: RES_1, creneau: "2026-11-12T19:00:00.000Z" }),
    ligneReservation({ id: RES_2, creneau: "2026-11-13T19:00:00.000Z", statut: "confirmee", reference: "SF-R-AAAAB", restaurant_id: RESTO_2 }),
    ligneReservation({ id: RES_3, creneau: "2026-11-14T19:00:00.000Z", reference: "SF-R-AAAAC" }),
  ];
  const restaurants = [ligneRestaurant(), ligneRestaurant({ id: RESTO_2, nom: "Autre" })];
  const b = banc({ restaurants, reservations: actives });
  const r = await b.service.creer(UID_A, { ...DEMANDE, creneau: "2026-11-15T19:00:00.000Z" });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, /3 réservations/); }
  assert.equal(ecritures(b).length, 0);
});

test("M3 création : seulement 2 actives = la 3e passe ; les terminées, annulées et passées ne comptent pas dans le plafond", async () => {
  const toutesNonActives = [
    ligneReservation({ id: RES_1, statut: "annulee_client", traitee_le: "2026-11-10T11:00:00.000Z", creneau: "2026-11-13T19:00:00.000Z" }),
    ligneReservation({ id: RES_2, statut: "refusee", motif_refus: "Complet", traitee_le: "2026-11-10T11:00:00.000Z", creneau: "2026-11-14T19:00:00.000Z", reference: "SF-R-AAAAB" }),
    ligneReservation({ id: RES_3, statut: "confirmee", creneau: "2026-11-09T19:00:00.000Z", reference: "SF-R-AAAAC", traitee_le: "2026-11-08T11:00:00.000Z" }),
    ligneReservation({ id: RES_4, statut: "honoree", creneau: "2026-11-16T19:00:00.000Z", reference: "SF-R-AAAAD", traitee_le: "2026-11-08T11:00:00.000Z" }),
  ];
  const b = banc({ reservations: [...toutesNonActives, ligneReservation({ id: RES_AUTRE, creneau: "2026-11-17T19:00:00.000Z", reference: "SF-R-AAAAE" })] });
  assert.ok((await b.service.creer(UID_A, DEMANDE)).ok);
});

test("M3 création : les réservations des AUTRES comptes ne comptent ni dans le plafond ni dans le doublon de créneau du compte", async () => {
  const deB = [RES_1, RES_2, RES_3].map((id, i) => ligneReservation({ id, client_user_id: UID_B, creneau: CRENEAU, nb_personnes: 1, reference: `SF-R-AAAA${"BCD"[i]}` }));
  const b = banc({ reservations: deB });
  assert.ok((await b.service.creer(UID_A, DEMANDE)).ok);
});

test("M3 création : pas deux réservations actives au même créneau (autre restaurant, autre nombre de personnes), sauf rejeu identique", async () => {
  const restaurants = [ligneRestaurant(), ligneRestaurant({ id: RESTO_2, nom: "Autre" })];
  const memeCreneauAilleurs = banc({ restaurants, reservations: [ligneReservation({ id: RES_1, restaurant_id: RESTO_2 })] });
  const r = await memeCreneauAilleurs.service.creer(UID_A, DEMANDE);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, /déjà une réservation à ce créneau/); }
  const autreNombre = banc({ reservations: [ligneReservation({ id: RES_1, nb_personnes: 2 })] });
  const r2 = await autreNombre.service.creer(UID_A, { ...DEMANDE, nbPersonnes: 4 });
  assert.equal(r2.ok, false, "même restaurant, même créneau, autre nombre : ce n'est pas un rejeu");
  assert.equal(ecritures(autreNombre).length, 0);
});

// ---------- création : rejeu idempotent ----------

test("M3 rejeu idempotent : la même demande du même compte renvoie la réservation existante, sans en créer une seconde ni écrire", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1 })] });
  const r = await b.service.creer(UID_A, DEMANDE);
  assert.ok(r.ok);
  assert.equal(r.idempotent, true);
  assert.equal(r.reservation.id, RES_1);
  assert.equal(b.tables.reservations_table.length, 1);
  assert.equal(ecritures(b).length, 0);
});

test("M3 rejeu idempotent : passe AVANT le plafond de 3 et le doublon de créneau (un rejeu n'est jamais refusé à tort)", async () => {
  const trois = [
    ligneReservation({ id: RES_1 }),
    ligneReservation({ id: RES_2, creneau: "2026-11-13T19:00:00.000Z", reference: "SF-R-AAAAB" }),
    ligneReservation({ id: RES_3, creneau: "2026-11-14T19:00:00.000Z", reference: "SF-R-AAAAC" }),
  ];
  const r = await banc({ reservations: trois }).service.creer(UID_A, DEMANDE);
  assert.ok(r.ok && r.idempotent && r.reservation.id === RES_1);
});

test("M3 rejeu idempotent : fonctionne même si la capacité est atteinte (la réservation existante y est déjà comptée)", async () => {
  const b = banc({ restaurants: [ligneRestaurant({ reservation_capacite_couverts: 4 })], reservations: [ligneReservation({ id: RES_1, nb_personnes: 4 })] });
  const r = await b.service.creer(UID_A, DEMANDE);
  assert.ok(r.ok && r.idempotent);
});

test("M3 rejeu idempotent : une réservation du même compte mais confirmée est aussi rejouée ; annulée ou refusée = nouvelle réservation", async () => {
  const confirmee = await banc({ reservations: [ligneReservation({ id: RES_1, statut: "confirmee", traitee_le: "2026-11-10T11:00:00.000Z" })] }).service.creer(UID_A, DEMANDE);
  assert.ok(confirmee.ok && confirmee.idempotent);
  for (const [statut, motif] of [["annulee_client", null], ["refusee", "Complet"]] as const) {
    const b = banc({ reservations: [ligneReservation({ id: RES_1, statut, motif_refus: motif, traitee_le: "2026-11-10T11:00:00.000Z" })] });
    const r = await b.service.creer(UID_A, DEMANDE);
    assert.ok(r.ok && !r.idempotent, statut);
    assert.equal(b.tables.reservations_table.length, 2, statut);
  }
});

test("M3 rejeu idempotent : la réservation d'UN AUTRE compte n'est jamais renvoyée (ni son téléphone)", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, telephone: TEL_B })] });
  const r = await b.service.creer(UID_A, DEMANDE);
  assert.ok(r.ok);
  assert.equal(r.idempotent, false);
  assert.notEqual(r.reservation.id, RES_AUTRE);
  assert.equal(r.reservation.telephone, TEL_A);
  assert.doesNotMatch(JSON.stringify(r), new RegExp(TEL_B.replace("+", "\\+")));
});

// ---------- création : collision de référence, erreurs de la base ----------

test("M3 création : collision de référence = nouvel essai (la base tire une autre référence), puis succès", async () => {
  const b = banc({ collisionsReference: 2 });
  const r = await b.service.creer(UID_A, DEMANDE);
  assert.ok(r.ok);
  assert.equal(b.operations.filter((o) => o.op === "insert").length, 3);
  assert.equal(b.tables.reservations_table.length, 1);
});

test("M3 création : collisions répétées au-delà du nombre d'essais = erreur propre (jamais un 500 brut ni le texte SQL)", async () => {
  const b = banc({ collisionsReference: 99 });
  const r = await b.service.creer(UID_A, DEMANDE);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.erreur.code, "ERREUR_SERVEUR");
    assert.doesNotMatch(JSON.stringify(r.erreur), /duplicate|constraint|reference_key|SF-R-/);
  }
  assert.equal(b.operations.filter((o) => o.op === "insert").length, ESSAIS_INSERTION);
  assert.equal(b.tables.reservations_table.length, 0);
});

test("M3 création : une erreur de la base (garde de création, contrainte) est traduite proprement, jamais reprise telle quelle", async () => {
  const cas: Array<[{ code: string; message: string }, string, RegExp]> = [
    [{ code: "P0001", message: "Ce restaurant n'accepte pas les réservations de table." }, "CONFLIT_ETAT", /n'accepte pas/],
    [{ code: "P0001", message: "Le créneau doit être dans plus de 30 minutes." }, "VALIDATION", /30 minutes/],
    [{ code: "P0001", message: "Le créneau ne peut pas dépasser 60 jours." }, "VALIDATION", /60 jours/],
    [{ code: "23514", message: 'new row for relation "reservations_table" violates check constraint "reservations_table_telephone_check"' }, "VALIDATION", /refusées/],
    [{ code: "XX000", message: 'relation "reservations_table" does not exist' }, "ERREUR_SERVEUR", /Réessayez/],
  ];
  for (const [erreurInsertion, code, motif] of cas) {
    const b = banc({ erreurInsertion });
    const r = await b.service.creer(UID_A, DEMANDE);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.erreur.code, code);
      assert.match(r.erreur.message, motif);
      assert.doesNotMatch(r.erreur.message, /relation|constraint|reservations_table|new row/);
    }
    assert.equal(b.operations.filter((o) => o.op === "insert").length, 1, "une erreur de la base n'est pas réessayée");
  }
});

test("M3 création : une lecture impossible (base en panne) lève une erreur générique sans détail (500 par onError)", async () => {
  const b = banc({ erreurLecture: "reservations_table" });
  await assert.rejects(() => b.service.creer(UID_A, DEMANDE), (e: Error) => e.message === "RESERVATIONS_INDISPONIBLES");
});

// ---------- lecture ----------

test("M3 liste : les réservations du compte seulement, 50 au plus, les plus récentes d'abord, avec le nom du restaurant", async () => {
  const lignes: Row[] = [
    ligneReservation({ id: RES_1, cree_le: "2026-11-01T10:00:00.000Z" }),
    ligneReservation({ id: RES_2, cree_le: "2026-11-05T10:00:00.000Z", reference: "SF-R-AAAAB", creneau: "2026-11-20T19:00:00.000Z" }),
    ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, telephone: TEL_B, cree_le: "2026-11-09T10:00:00.000Z", reference: "SF-R-AAAAC" }),
  ];
  const b = banc({ reservations: lignes });
  const r = await b.service.lister(UID_A);
  assert.ok(r.ok);
  assert.deepEqual(r.reservations.map((x) => x.id), [RES_2, RES_1]);
  assert.ok(r.reservations.every((x) => x.restaurantNom === "Chez Fatou"));
  assert.doesNotMatch(JSON.stringify(r), new RegExp(TEL_B.replace("+", "\\+")));
  const requete = b.operations.find((o) => o.op === "select" && o.table === "reservations_table");
  assert.equal(requete?.limite, 50);
  assert.ok(requete?.filtres.includes("eq:client_user_id"));
});

test("M3 lecture d'une réservation : la sienne est rendue ; celle d'un autre compte ou inexistante = même réponse introuvable", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1 }), ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, telephone: TEL_B, reference: "SF-R-AAAAB" })] });
  const sienne = await b.service.lire(UID_A, RES_1);
  assert.ok(sienne.ok && sienne.reservation.id === RES_1);
  const autre = await b.service.lire(UID_A, RES_AUTRE);
  const inexistante = await b.service.lire(UID_A, "dddddddd-0000-4000-8000-000000000009");
  assert.deepEqual(autre, inexistante);
  assert.equal(autre.ok, false);
  if (!autre.ok) assert.equal(autre.erreur.code, "INTROUVABLE");
  assert.doesNotMatch(JSON.stringify(autre), new RegExp(TEL_B.replace("+", "\\+")));
});

// ---------- annulation par le client ----------

test("M3 annulation : demandée ou confirmée à venir passe à « annulée par le client » ; la requête est filtrée sur le compte et les états actifs", async () => {
  for (const statut of ["demandee", "confirmee"]) {
    const b = banc({ colonnesModifiables: ["statut"], reservations: [ligneReservation({ id: RES_1, statut, traitee_le: statut === "confirmee" ? "2026-11-10T11:00:00.000Z" : null })] });
    const r = await b.service.annuler(UID_A, RES_1);
    assert.ok(r.ok, statut);
    assert.equal(r.reservation.statut, "annulee_client");
    const maj = b.operations.find((o) => o.op === "update");
    assert.deepEqual(maj?.valeurs, { statut: "annulee_client" });
    assert.ok(maj?.filtres.includes("eq:client_user_id") && maj?.filtres.includes("in:statut") && maj?.filtres.includes("eq:id"));
  }
});

test("M3 annulation : déjà annulée = réponse idempotente stable (la même réservation, rien d'écrit)", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_1, statut: "annulee_client", traitee_le: "2026-11-10T11:00:00.000Z" })] });
  const premiere = await b.service.annuler(UID_A, RES_1);
  const seconde = await b.service.annuler(UID_A, RES_1);
  assert.ok(premiere.ok && seconde.ok);
  assert.deepEqual(premiere, seconde);
  assert.equal(premiere.reservation.statut, "annulee_client");
  assert.equal(ecritures(b).length, 0);
});

test("M3 annulation : créneau passé, refusée, annulée par le restaurant, honorée, non honorée = refus clair, rien d'écrit", async () => {
  const cas: Array<[Row, RegExp]> = [
    [{ statut: "confirmee", creneau: "2026-11-10T11:00:00.000Z", traitee_le: "2026-11-09T11:00:00.000Z" }, /créneau est passé/],
    [{ statut: "demandee", creneau: "2026-11-10T11:00:00.000Z" }, /créneau est passé/],
    [{ statut: "refusee", motif_refus: "Complet", traitee_le: "2026-11-10T11:00:00.000Z" }, /refusée.*ne peut plus être annulée/],
    [{ statut: "annulee_restaurant", motif_refus: "Fermeture", traitee_le: "2026-11-10T11:00:00.000Z" }, /annulée par le restaurant/],
    [{ statut: "honoree", traitee_le: "2026-11-10T11:00:00.000Z" }, /honorée/],
    [{ statut: "non_honoree", traitee_le: "2026-11-10T11:00:00.000Z" }, /non honorée/],
  ];
  for (const [surcharge, motif] of cas) {
    const b = banc({ reservations: [ligneReservation({ id: RES_1, ...surcharge })] });
    const r = await b.service.annuler(UID_A, RES_1);
    assert.equal(r.ok, false, JSON.stringify(surcharge));
    if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, motif); }
    assert.equal(ecritures(b).length, 0);
  }
});

test("M3 annulation : la réservation d'un autre compte est introuvable et RIEN n'est écrit", async () => {
  const b = banc({ reservations: [ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, telephone: TEL_B })] });
  const r = await b.service.annuler(UID_A, RES_AUTRE);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erreur.code, "INTROUVABLE");
  assert.equal(ecritures(b).length, 0);
  assert.equal(b.tables.reservations_table[0].statut, "demandee");
});

test("M3 annulation : changement concurrent (le restaurant confirme ou refuse entre la lecture et l'écriture) = réponse juste après relecture", async () => {
  // Le restaurant refuse juste avant l'écriture du client : aucune ligne modifiée (le filtre d'état échoue), on relit et on répond « déjà refusée ».
  const b = banc({
    colonnesModifiables: ["statut"],
    reservations: [ligneReservation({ id: RES_1 })],
    avantMiseAJour: (t) => { Object.assign(t.reservations_table[0], { statut: "refusee", motif_refus: "Complet" }); },
  });
  const r = await b.service.annuler(UID_A, RES_1);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, /refusée/); }
});

test("M3 annulation : une erreur de la base est traduite, jamais reprise", async () => {
  const b = banc({ colonnesModifiables: ["statut"], reservations: [ligneReservation({ id: RES_1 })], erreurMiseAJour: { code: "P0001", message: "Le créneau est passé : cette réservation ne peut plus être confirmée ni annulée par le client." } });
  const r = await b.service.annuler(UID_A, RES_1);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.erreur.code, "CONFLIT_ETAT"); assert.match(r.erreur.message, /créneau est passé/); }
  const b2 = banc({ colonnesModifiables: ["statut"], reservations: [ligneReservation({ id: RES_1 })], erreurMiseAJour: { code: "XX000", message: "boom secret SQL" } });
  const r2 = await b2.service.annuler(UID_A, RES_1);
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.doesNotMatch(JSON.stringify(r2.erreur), /boom|secret|SQL/);
});
