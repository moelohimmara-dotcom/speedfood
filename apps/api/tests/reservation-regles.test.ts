import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACTIONS_RESERVATION_RESTAURANT, STATUT_APRES_ACTION } from "@speedfood/shared/contracts/reservation";
import { STATUTS_RESERVATION, TRANSITIONS_RESERVATION, type StatutReservation } from "@speedfood/shared/reservation/statuts";
import { MESSAGE_BASE_INDISPONIBLE, actionsPossibles, traduireErreurBase, verifierAction, verifierAnnulationClient, verifierFenetreCreneau } from "../src/reservation/regles.ts";

/** M3 : règles pures de la réservation (fenêtre du créneau, actions selon l'état et l'heure, annulation, traduction des erreurs de la base). */
const MIN = 60_000;
const NOW = Date.parse("2026-11-10T12:00:00.000Z");

test("M3 fenêtre : 30 minutes exactement et 60 jours exactement sont permis, une minute de moins ou de plus est refusée", () => {
  assert.equal(verifierFenetreCreneau(NOW + 30 * MIN, NOW), null);
  assert.equal(verifierFenetreCreneau(NOW + 60 * 24 * 60 * MIN, NOW), null);
  const tropProche = verifierFenetreCreneau(NOW + 29 * MIN, NOW);
  assert.equal(tropProche?.code, "VALIDATION");
  assert.match(tropProche?.message ?? "", /30 minutes/);
  assert.equal(verifierFenetreCreneau(NOW - 3600_000, NOW)?.code, "VALIDATION");
  const tropLoin = verifierFenetreCreneau(NOW + 60 * 24 * 60 * MIN + MIN, NOW);
  assert.equal(tropLoin?.code, "VALIDATION");
  assert.match(tropLoin?.message ?? "", /60 jours/);
});

test("M3 actions : chaque état n'offre que ses transitions de statuts.ts (parité avec la table des transitions)", () => {
  const loin = NOW + 48 * 3600_000;
  for (const statut of STATUTS_RESERVATION) {
    for (const action of ACTIONS_RESERVATION_RESTAURANT) {
      const cible = STATUT_APRES_ACTION[action];
      const permisParTable = (TRANSITIONS_RESERVATION[statut] as readonly string[]).includes(cible);
      // Créneau passé de 2 h : « honorée » et « non honorée » sont permises par le temps, « confirmer » ne l'est plus : on teste donc la table avec un créneau où le temps ne gêne pas.
      const instant = cible === "confirmee" ? loin : NOW - 2 * 3600_000;
      assert.equal(verifierAction(statut, action, instant, NOW) === null, permisParTable, `${statut} + ${action}`);
    }
  }
});

test("M3 actions : confirmer seulement tant que le créneau n'est pas passé (créneau exactement maintenant = passé)", () => {
  assert.equal(verifierAction("demandee", "confirmer", NOW + MIN, NOW), null);
  assert.equal(verifierAction("demandee", "confirmer", NOW, NOW)?.code, "CONFLIT_ETAT");
  assert.equal(verifierAction("demandee", "confirmer", NOW - MIN, NOW)?.code, "CONFLIT_ETAT");
});

test("M3 actions : honorée à partir d'une heure AVANT le créneau, non honorée seulement une fois le créneau passé", () => {
  const creneau = NOW + 60 * MIN;
  assert.equal(verifierAction("confirmee", "honoree", creneau, NOW), null, "exactement une heure avant");
  assert.equal(verifierAction("confirmee", "honoree", creneau + MIN, NOW)?.code, "CONFLIT_ETAT", "une heure et une minute avant");
  assert.equal(verifierAction("confirmee", "honoree", NOW - 5 * 3600_000, NOW), null, "bien après");
  assert.equal(verifierAction("confirmee", "non_honoree", NOW, NOW), null, "exactement au créneau");
  assert.equal(verifierAction("confirmee", "non_honoree", NOW + MIN, NOW)?.code, "CONFLIT_ETAT", "créneau à venir");
});

test("M3 actions : refuser et annuler n'ont aucune règle de temps (comme la base) ; un état final ne change plus", () => {
  assert.equal(verifierAction("demandee", "refuser", NOW - 3600_000, NOW), null);
  assert.equal(verifierAction("confirmee", "annuler", NOW - 3600_000, NOW), null);
  const final = verifierAction("honoree", "annuler", NOW, NOW);
  assert.equal(final?.code, "CONFLIT_ETAT");
  assert.match(final?.message ?? "", /honorée/);
  assert.equal(verifierAction("demandee", "annuler", NOW + 3600_000, NOW)?.code, "CONFLIT_ETAT", "annuler une demande non confirmée n'existe pas : on la refuse");
});

test("M3 actions possibles : calculées par le serveur selon l'état et l'heure", () => {
  assert.deepEqual(actionsPossibles("demandee", NOW + 24 * 3600_000, NOW), ["confirmer", "refuser"]);
  assert.deepEqual(actionsPossibles("confirmee", NOW + 24 * 3600_000, NOW), ["annuler"]);
  assert.deepEqual(actionsPossibles("confirmee", NOW + 30 * MIN, NOW), ["annuler", "honoree"]);
  assert.deepEqual(actionsPossibles("confirmee", NOW - 30 * MIN, NOW), ["annuler", "honoree", "non_honoree"]);
  assert.deepEqual(actionsPossibles("demandee", NOW - 30 * MIN, NOW), ["refuser"]);
  for (const final of ["refusee", "annulee_client", "annulee_restaurant", "honoree", "non_honoree"] as StatutReservation[]) assert.deepEqual(actionsPossibles(final, NOW, NOW), [], final);
});

test("M3 annulation client : demandée ou confirmée avec créneau futur ; passée ou autre état final refusé ; déjà annulée = idempotent", () => {
  assert.equal(verifierAnnulationClient("demandee", NOW + MIN, NOW), null);
  assert.equal(verifierAnnulationClient("confirmee", NOW + MIN, NOW), null);
  assert.equal(verifierAnnulationClient("confirmee", NOW, NOW)?.code, "CONFLIT_ETAT");
  assert.equal(verifierAnnulationClient("demandee", NOW - MIN, NOW)?.code, "CONFLIT_ETAT");
  assert.equal(verifierAnnulationClient("annulee_client", NOW + MIN, NOW), null);
  for (const final of ["refusee", "annulee_restaurant", "honoree", "non_honoree"] as StatutReservation[]) {
    const r = verifierAnnulationClient(final, NOW + MIN, NOW);
    assert.equal(r?.code, "CONFLIT_ETAT", final);
    assert.match(r?.message ?? "", /ne peut plus être annulée/);
  }
});

// ---------- traduction des erreurs de la base ----------

/** Les messages des `raise exception` de la migration M2 : lus dans le fichier, pour que toute nouvelle règle de la base soit forcée d'être traitée ici. */
function messagesDeLaBase(): string[] {
  const sql = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261110090000_reservations_table.sql", import.meta.url)), "utf8");
  const messages: string[] = [];
  for (const m of sql.matchAll(/raise exception '((?:[^']|'')*)'/g)) messages.push(m[1].replace(/''/g, "'").replace(/%/g, "x"));
  return messages;
}

test("M3 base : chaque message de la migration est RECONNU (jamais repris) ; seuls les cas internes tombent sur l'erreur générique", () => {
  const messages = messagesDeLaBase();
  assert.ok(messages.length >= 12, `messages lus : ${messages.length}`);
  const internes = [/ne peut plus etre modifiee/, /annulation par le client se fait par le serveur/, /commence toujours/, /doit etre liee a un compte/];
  for (const message of messages) {
    const r = traduireErreurBase({ code: "P0001", message });
    assert.doesNotMatch(r.message, /\bSQL\b|trigger|exception|« demandée »\.$/, message);
    const simplifie = message.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const interne = internes.some((m) => m.test(simplifie));
    if (interne) assert.deepEqual(r, { code: "ERREUR_SERVEUR", message: MESSAGE_BASE_INDISPONIBLE }, message);
    else assert.notEqual(r.code, "ERREUR_SERVEUR", `message de la base non traduit : ${message}`);
  }
});

test("M3 base : restaurant indisponible, n'accepte pas, créneau trop proche ou trop lointain, état impossible : codes et messages précis", () => {
  const cas: Array<[string, string, RegExp]> = [
    ["Ce restaurant n'est pas disponible pour une réservation.", "CONFLIT_ETAT", /n'est pas disponible/],
    ["Ce restaurant n'accepte pas les réservations de table.", "CONFLIT_ETAT", /n'accepte pas/],
    ["Le créneau doit être dans plus de 30 minutes.", "VALIDATION", /30 minutes/],
    ["Le créneau ne peut pas dépasser 60 jours.", "VALIDATION", /60 jours/],
    ["Changement d'état impossible : de « confirmee » à « demandee ».", "CONFLIT_ETAT", /vient de changer/],
    ["Le créneau est passé : cette réservation ne peut plus être confirmée ni annulée par le client.", "CONFLIT_ETAT", /créneau est passé/],
    ["Cette réservation est terminée : son motif ne peut plus changer.", "CONFLIT_ETAT", /terminée/],
  ];
  for (const [message, code, motif] of cas) {
    const r = traduireErreurBase({ code: "P0001", message });
    assert.equal(r.code, code, message);
    assert.match(r.message, motif, message);
  }
});

test("M3 base : une erreur inconnue, vide ou SQL brut devient une erreur serveur générique, sans fuite du détail", () => {
  for (const erreur of [null, undefined, {}, { code: "XX000", message: 'relation "reservations_table" does not exist' }, { code: "23505", message: 'duplicate key value violates unique constraint "reservations_table_reference_key"' }, { message: 12 }]) {
    const r = traduireErreurBase(erreur as never);
    assert.deepEqual(r, { code: "ERREUR_SERVEUR", message: MESSAGE_BASE_INDISPONIBLE });
    assert.doesNotMatch(JSON.stringify(r), /relation|duplicate|constraint|reservations_table/);
  }
  assert.equal(traduireErreurBase({ code: "42501", message: "permission denied for table reservations_table" }).code, "NON_AUTORISE");
  assert.equal(traduireErreurBase({ code: "23514", message: 'new row violates check constraint "reservations_table_motif_obligatoire"' }).code, "VALIDATION");
  assert.doesNotMatch(JSON.stringify(traduireErreurBase({ code: "23514", message: 'new row violates check constraint "reservations_table_motif_obligatoire"' })), /constraint|motif_obligatoire/);
});
