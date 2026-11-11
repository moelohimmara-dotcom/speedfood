import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DERNIER_CRENEAU_HEURE,
  DERNIER_CRENEAU_MINUTES,
  MESSAGE_CRENEAU_HORS_PLAGE,
  PAS_CRENEAU_MINUTES,
  PREMIER_CRENEAU_HEURE,
  PREMIER_CRENEAU_MINUTES,
  creneauDansPlage,
  heureDeMinutes,
  heuresDeLaPlage,
  lireCorpsCreationReservation,
  minutesDuJourUtc,
} from "@speedfood/shared/contracts/reservation";
import { traduireRefusCreation, verifierPlageCreneau } from "../src/reservation/regles.ts";
import { creerAccesReservationClient } from "../src/reservation/acces.ts";
import { creerServiceReservationClient } from "../src/reservation/client.ts";
import { CRENEAU, MAINTENANT, RESTO_1, TEL_A, UID_A, baseReservations } from "./reservation-base-factice.ts";

/**
 * M5 : plage des créneaux de la réservation, de 10:00 à 22:45 inclus (heure de Conakry = UTC), décision de Malika du 10 novembre. Une seule constante partagée ;
 * le SERVEUR la fait respecter (corps, service, fonction SQL) même si l'application est modifiée.
 */
const RESTO = RESTO_1;
const corps = (creneau: string) => ({ restaurantId: RESTO, creneau, nbPersonnes: 4, nom: "Aminata Camara", telephone: "620 00 00 01" });
const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), "utf8").replace(/\r\n/g, "\n");

test("M5 plage : la constante partagée vaut 10:00 à 22:45, pas de 15 minutes, 52 créneaux, un seul jeu de bornes", () => {
  assert.equal(PREMIER_CRENEAU_MINUTES, 600);
  assert.equal(DERNIER_CRENEAU_MINUTES, 22 * 60 + 45);
  assert.equal(PREMIER_CRENEAU_HEURE, "10:00");
  assert.equal(DERNIER_CRENEAU_HEURE, "22:45");
  assert.equal(PAS_CRENEAU_MINUTES, 15);
  const heures = heuresDeLaPlage();
  assert.equal(heures.length, 52);
  assert.equal(heures[0], "10:00");
  assert.equal(heures[51], "22:45");
  assert.equal(heureDeMinutes(0), "00:00");
  assert.equal(heureDeMinutes(23 * 60 + 45), "23:45");
  assert.match(MESSAGE_CRENEAU_HORS_PLAGE, /10:00/);
  assert.match(MESSAGE_CRENEAU_HORS_PLAGE, /22:45/);
});

test("M5 plage : frontières exactes (09:45 refusé, 10:00 accepté, 22:45 accepté, 23:00 refusé, minuit refusé), jour par jour", () => {
  const cas: Array<[string, boolean]> = [
    ["09:45", false], ["09:59", false], ["10:00", true], ["10:15", true], ["12:00", true], ["22:30", true], ["22:45", true], ["22:46", false], ["23:00", false], ["23:45", false], ["00:00", false], ["03:15", false],
  ];
  for (const jour of ["2026-11-12", "2026-12-31", "2027-01-01", "2028-02-29"]) {
    for (const [heure, attendu] of cas) {
      const ms = Date.parse(`${jour}T${heure}:00.000Z`);
      assert.equal(creneauDansPlage(ms), attendu, `${jour} ${heure}`);
      assert.equal(verifierPlageCreneau(ms) === null, attendu, `${jour} ${heure} (règle du serveur)`);
    }
  }
  assert.equal(creneauDansPlage(Number.NaN), false);
  assert.equal(minutesDuJourUtc(Date.parse("2026-11-12T22:45:00.000Z")), DERNIER_CRENEAU_MINUTES);
});

test("M5 plage : changement de jour — le dernier créneau d'un jour (22:45) passe, 23:00 et minuit ne passent pas, le premier du lendemain (10:00) passe, 09:45 du lendemain non", () => {
  assert.ok(lireCorpsCreationReservation(corps("2026-11-12T22:45:00Z")).ok);
  assert.equal(lireCorpsCreationReservation(corps("2026-11-12T23:00:00Z")).ok, false);
  assert.equal(lireCorpsCreationReservation(corps("2026-11-13T00:00:00Z")).ok, false);
  assert.equal(lireCorpsCreationReservation(corps("2026-11-13T09:45:00Z")).ok, false);
  assert.ok(lireCorpsCreationReservation(corps("2026-11-13T10:00:00Z")).ok);
});

test("M5 corps de création : un créneau hors plage est refusé avec un message clair (VALIDATION, jamais la saisie reprise) ; le pas de 15 minutes reste jugé avant", () => {
  for (const ko of ["2026-11-12T09:45:00Z", "2026-11-12T23:00:00Z", "2026-11-12T00:00:00Z", "2026-11-12T07:30:00Z", "2026-11-12T23:45:00.000Z"]) {
    const r = lireCorpsCreationReservation(corps(ko));
    assert.equal(r.ok, false, ko);
    if (!r.ok) {
      assert.equal(r.message, MESSAGE_CRENEAU_HORS_PLAGE, ko);
      assert.doesNotMatch(r.message, new RegExp(ko.slice(0, 10)));
    }
  }
  const pas = lireCorpsCreationReservation(corps("2026-11-12T09:10:00Z"));
  assert.ok(!pas.ok && /15 minutes/.test(pas.message), "09:10 n'est pas un quart d'heure : le message du pas passe en premier");
  for (const ok of ["2026-11-12T10:00:00Z", "2026-11-12T22:45:00Z", "2026-11-12T19:00:00Z"]) assert.ok(lireCorpsCreationReservation(corps(ok)).ok, ok);
});

test("M5 serveur : le SERVICE refuse aussi un créneau hors plage (même si le corps n'avait pas été relu), sans appeler la base", async () => {
  const base = baseReservations();
  const service = creerServiceReservationClient({ maintenant: () => MAINTENANT, ...creerAccesReservationClient({ client: () => base.client }) });
  for (const creneau of ["2026-11-12T09:45:00.000Z", "2026-11-12T23:00:00.000Z", "2026-11-13T00:00:00.000Z"]) {
    const r = await service.creer(UID_A, { restaurantId: RESTO, creneau, nbPersonnes: 4, nom: "Aminata Camara", telephone: TEL_A, note: null });
    assert.equal(r.ok, false, creneau);
    if (!r.ok) {
      assert.equal(r.erreur.code, "VALIDATION");
      assert.equal(r.erreur.message, MESSAGE_CRENEAU_HORS_PLAGE);
    }
  }
  assert.equal(base.operations.length, 0, "aucun appel à la base : refus avant tout");
  for (const creneau of ["2026-11-12T10:00:00.000Z", "2026-11-12T22:45:00.000Z"]) {
    assert.ok((await service.creer(UID_A, { restaurantId: RESTO, creneau, nbPersonnes: 1, nom: "Aminata Camara", telephone: TEL_A, note: null })).ok, creneau);
  }
});

test("M5 serveur : la fonction SQL répète la plage (même refus HORS_PLAGE, même message côté client) et la traduction du code est celle de la constante", () => {
  const traduit = traduireRefusCreation("HORS_PLAGE", 4);
  assert.deepEqual(traduit, { code: "VALIDATION", message: MESSAGE_CRENEAU_HORS_PLAGE });
  const sql = lire("../../../supabase/migrations/20261110110000_reservation_creation_atomique.sql");
  assert.match(sql, new RegExp(`c_premier constant integer := ${PREMIER_CRENEAU_MINUTES / 60} \\* 60;`), "10:00 dans le SQL");
  assert.match(sql, new RegExp(`c_dernier constant integer := ${Math.floor(DERNIER_CRENEAU_MINUTES / 60)} \\* 60 \\+ ${DERNIER_CRENEAU_MINUTES % 60};`), "22:45 dans le SQL");
});
