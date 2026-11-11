import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MAX_RESERVATIONS_ACTIVES_PAR_COMPTE } from "@speedfood/shared/contracts/reservation";
import { DELAI_MIN_MINUTES, HORIZON_MAX_JOURS } from "@speedfood/shared/reservation/statuts";
import { CODES_REFUS_CREATION, MESSAGE_BASE_INDISPONIBLE, traduireRefusCreation, verifierFenetreCreneau } from "../src/reservation/regles.ts";
import { creerAccesReservationClient, lireReponseCreation } from "../src/reservation/acces.ts";
import { creerServiceReservationClient } from "../src/reservation/client.ts";
import { CRENEAU, MAINTENANT, RESTO_1, TEL_A, UID_A, baseReservations } from "./reservation-base-factice.ts";

/**
 * M5 (M2b) : création ATOMIQUE. Ici : l'API traduit chaque réponse de la fonction SQL comme avant (mêmes codes, mêmes messages) et le fichier SQL contient bien ce qu'on promet
 * (verrous, droits, chemin de recherche, colonnes listées, mêmes limites que le code). Le COMPORTEMENT du SQL est joué sur une vraie base PostgreSQL jetable par `test:cloisonnement`.
 */
const SQL = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261110110000_reservation_creation_atomique.sql", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = (t: string) => t.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
const CODE = sansCommentaires(SQL);

test("M5 traduction : chaque refus de la fonction SQL redonne exactement le code et le message d'avant (le client ne voit rien changer)", () => {
  const attendu: Record<string, [string, RegExp]> = {
    HORS_PLAGE: ["VALIDATION", /entre 10:00 et 22:45/],
    FENETRE_PROCHE: ["VALIDATION", /dans plus de 30 minutes\. Choisissez un horaire plus tard\./],
    FENETRE_LOIN: ["VALIDATION", /plus de 60 jours à l'avance/],
    RESTAURANT_INTROUVABLE: ["INTROUVABLE", /^Ce restaurant est introuvable\.$/],
    RESTAURANT_INDISPONIBLE: ["CONFLIT_ETAT", /^Ce restaurant n'est pas disponible pour une réservation\.$/],
    RESERVATION_FERMEE: ["CONFLIT_ETAT", /^Ce restaurant n'accepte pas les réservations de table\.$/],
    PLAFOND: ["CONFLIT_ETAT", /^Vous avez déjà 3 réservations à venir\. Annulez-en une ou attendez qu'elle ait eu lieu\.$/],
    DOUBLON: ["CONFLIT_ETAT", /^Vous avez déjà une réservation à ce créneau\. Choisissez un autre horaire\.$/],
    CAPACITE: ["CONFLIT_ETAT", /^Il ne reste pas assez de places à ce créneau pour 4 personnes\. Essayez un autre horaire\.$/],
    REFERENCE_INDISPONIBLE: ["ERREUR_SERVEUR", new RegExp(`^${MESSAGE_BASE_INDISPONIBLE.replace(/[.]/g, "\\.")}$`)],
  };
  assert.deepEqual([...CODES_REFUS_CREATION].sort(), Object.keys(attendu).sort(), "chaque code connu est couvert");
  for (const code of CODES_REFUS_CREATION) {
    const e = traduireRefusCreation(code, 4);
    assert.equal(e.code, attendu[code][0], code);
    assert.match(e.message, attendu[code][1], code);
  }
  assert.match(traduireRefusCreation("CAPACITE", 1).message, /pour 1 personne\./);
  assert.doesNotMatch(traduireRefusCreation("CAPACITE", 4).message, /\b(10|12|20|30|capacité)\b/i, "aucun chiffre de capacité n'est révélé");
});

test("M5 service : chaque refus de la fonction devient la bonne erreur du contrat, sans alerte ni écriture", async () => {
  for (const code of CODES_REFUS_CREATION) {
    const base = baseReservations({ reponseRpc: { etat: "refus", code } });
    const alertes: string[] = [];
    const service = creerServiceReservationClient({ maintenant: () => MAINTENANT, ...creerAccesReservationClient({ client: () => base.client }), alerterNouvelleDemande: async (id) => { alertes.push(id); } });
    const planifiees: Array<() => Promise<void>> = [];
    const r = await service.creer(UID_A, { restaurantId: RESTO_1, creneau: CRENEAU, nbPersonnes: 4, nom: "Aminata Camara", telephone: TEL_A, note: null }, (t) => { planifiees.push(t); }, {});
    assert.equal(r.ok, false, code);
    if (!r.ok) assert.deepEqual(r.erreur, traduireRefusCreation(code, 4), code);
    assert.equal(planifiees.length, 0, code);
    assert.deepEqual(alertes, []);
  }
});

test("M5 SQL : la fonction est SECURITY DEFINER, avec un chemin de recherche fixé, et réservée au seul rôle de service (jamais anon ni authenticated, révoquée à public)", () => {
  assert.match(CODE, /create or replace function public\.fn_creer_reservation_atomique\(/);
  const corps = CODE.slice(CODE.indexOf("create or replace function public.fn_creer_reservation_atomique("), CODE.indexOf("create or replace function public.fn_reservation_pour_client"));
  assert.match(corps, /security definer/);
  assert.match(corps, /set search_path = public\s*\n/);
  assert.match(CODE, /revoke all on function public\.fn_creer_reservation_atomique\(uuid, uuid, text, text, integer, timestamptz, text\) from public, anon, authenticated;/);
  assert.match(CODE, /grant execute on function public\.fn_creer_reservation_atomique\(uuid, uuid, text, text, integer, timestamptz, text\) to service_role;/);
  assert.match(CODE, /revoke all on function public\.fn_reservation_pour_client\(uuid\) from public, anon, authenticated;/);
  assert.match(CODE, /grant execute on function public\.fn_reservation_pour_client\(uuid\) to service_role;/);
  const beneficiaires = [...CODE.matchAll(/grant execute on function [^;]*\) to ([^;]*);/gi)].map((m) => m[1].trim());
  assert.deepEqual(beneficiaires, ["service_role", "service_role"], "seul le rôle de service reçoit un droit d'exécution (ni anon, ni authenticated, ni public)");
  assert.equal((CODE.match(/security definer/g) ?? []).length, 2);
  assert.equal((CODE.match(/set search_path = public/g) ?? []).length, 2, "chaque fonction fixe son chemin de recherche");
});

test("M5 SQL : deux verrous consultatifs de transaction, pris dans le même ordre (compte puis restaurant+créneau), AVANT toute lecture des réservations", () => {
  const verrous = [...CODE.matchAll(/perform pg_advisory_xact_lock\(hashtextextended\('([^']+)' \|\| ([^,]+), 0\)\);/g)];
  assert.equal(verrous.length, 2);
  assert.match(verrous[0][1], /compte/);
  assert.match(verrous[1][1], /creneau/);
  assert.match(CODE, /p_restaurant_id::text \|\| ':' \|\| extract\(epoch from p_creneau\)::text/, "le verrou du créneau est propre à un restaurant ET à un instant");
  const iVerrou = CODE.indexOf("perform pg_advisory_xact_lock");
  const iDernierVerrou = CODE.lastIndexOf("perform pg_advisory_xact_lock");
  const premiereLecture = CODE.indexOf("from public.reservations_table", CODE.indexOf("create or replace function public.fn_creer_reservation_atomique("));
  assert.ok(iVerrou > 0 && iDernierVerrou < premiereLecture, "les deux verrous précèdent la première lecture de `reservations_table`");
  assert.doesNotMatch(CODE, /pg_advisory_lock\(|pg_try_advisory/, "jamais un verrou de session (fuite possible)");
});

test("M5 SQL : jamais `select *` ni `returning *`, jamais le condensé du jeton de suivi, colonnes listées à l'insertion", () => {
  assert.doesNotMatch(CODE, /select\s+\*/i);
  assert.doesNotMatch(CODE, /returning\s+\*/i);
  assert.doesNotMatch(CODE, /jeton_suivi_hash|jetonSuivi/);
  assert.match(CODE, /insert into public\.reservations_table \(restaurant_id, client_user_id, nom_client, telephone, nb_personnes, creneau, note\)/);
});

test("M5 SQL : mêmes limites que le code partagé (plafond de 3, 30 minutes, 60 jours, 4 essais de référence) et mêmes ordres de contrôle que l'ancien service", () => {
  assert.match(CODE, new RegExp(`c_plafond constant integer := ${MAX_RESERVATIONS_ACTIVES_PAR_COMPTE};`));
  assert.match(CODE, new RegExp(`interval '${DELAI_MIN_MINUTES} minutes'`));
  assert.match(CODE, new RegExp(`interval '${HORIZON_MAX_JOURS} days'`));
  assert.match(CODE, /c_essais constant integer := 4;/);
  const ordre = ["'HORS_PLAGE'", "'rejeu'", "'FENETRE_PROCHE'", "'FENETRE_LOIN'", "'RESTAURANT_INTROUVABLE'", "'RESTAURANT_INDISPONIBLE'", "'RESERVATION_FERMEE'", "'PLAFOND'", "'DOUBLON'", "'CAPACITE'", "'REFERENCE_INDISPONIBLE'", "'creee'"];
  const positions = ordre.map((m) => CODE.indexOf(m));
  assert.ok(positions.every((p) => p > 0), JSON.stringify(positions));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "plage, rejeu, fenêtre, restaurant, plafond, doublon, capacité, insertion : dans cet ordre");
  // Chaque code de refus du SQL est connu de l'API (et inversement).
  const codesSql = [...CODE.matchAll(/'etat', 'refus', 'code', '([A-Z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(codesSql)].sort(), [...CODES_REFUS_CREATION].sort());
});

test("M5 SQL : le rejeu ne compte que les réservations ACTIVES et À VENIR du même compte, restaurant, créneau et nombre de personnes", () => {
  const rejeu = CODE.slice(CODE.indexOf("select r.id into v_existante"), CODE.indexOf("if p_creneau < now() + interval '30 minutes'"));
  for (const condition of ["r.client_user_id = p_client_user_id", "r.restaurant_id = p_restaurant_id", "r.creneau = p_creneau", "r.nb_personnes = p_nb_personnes", "r.statut in ('demandee', 'confirmee')", "r.creneau > now()"]) {
    assert.ok(rejeu.includes(condition), condition);
  }
});

test("M5 parité : la règle pure de fenêtre de l'API et celle de la fonction SQL parlent des mêmes bornes", () => {
  const maintenant = Date.parse("2026-11-10T12:00:00.000Z");
  assert.equal(verifierFenetreCreneau(maintenant + DELAI_MIN_MINUTES * 60_000, maintenant), null);
  assert.equal(verifierFenetreCreneau(maintenant + HORIZON_MAX_JOURS * 86_400_000, maintenant), null);
  assert.notEqual(verifierFenetreCreneau(maintenant + DELAI_MIN_MINUTES * 60_000 - 1, maintenant), null);
  assert.notEqual(verifierFenetreCreneau(maintenant + HORIZON_MAX_JOURS * 86_400_000 + 1, maintenant), null);
});

test("M5 lecture stricte : un état inconnu de la fonction SQL n'est jamais pris pour une réservation, même avec une réservation bien formée", () => {
  const reservation = { id: "11111111-1111-4111-8111-111111111111", reference: "SF-R-ABCDE", restaurant_id: RESTO_1, nom_client: "Aminata Camara", telephone: TEL_A, nb_personnes: 2, creneau: CRENEAU, note: null, statut: "demandee", motif_refus: null, cree_le: CRENEAU, restaurants: { nom: "Chez Fatou" } };
  assert.equal(lireReponseCreation({ etat: "creee", reservation }).ok, true);
  assert.equal(lireReponseCreation({ etat: "rejeu", reservation }).ok, true);
  assert.throws(() => lireReponseCreation({ etat: "autre", reservation }), /RESERVATION_ILLISIBLE/);
  assert.throws(() => lireReponseCreation({ reservation }), /RESERVATION_ILLISIBLE/);
});

test("M5 câblage : le Worker branche la vraie limite par adresse de la disponibilité publique (jamais un faux limiteur)", () => {
  const worker = readFileSync(fileURLToPath(new URL("../src/worker.ts", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
  assert.match(worker, /import \{[^}]*limiterDisponibiliteReservation[^}]*\} from "@\/lib\/securite\/limitation-debit";/);
  assert.match(worker, /^\s+limiterDisponibiliteReservation,$/m);
  assert.doesNotMatch(worker, /limiterDisponibiliteReservation:\s*async/);
});

test("M5 service : le créneau transmis à la fonction SQL est normalisé (ISO UTC avec millisecondes), jamais la chaîne du client telle quelle", async () => {
  const base = baseReservations();
  const service = creerServiceReservationClient({ maintenant: () => MAINTENANT, ...creerAccesReservationClient({ client: () => base.client }) });
  const r = await service.creer(UID_A, { restaurantId: RESTO_1, creneau: "2026-11-12T19:00:00Z", nbPersonnes: 2, nom: "Aminata Camara", telephone: TEL_A, note: null });
  assert.equal(r.ok, true);
  const appel = base.operations.find((o) => o.op === "rpc");
  assert.ok(appel);
  assert.equal(appel.valeurs?.p_creneau, "2026-11-12T19:00:00.000Z");
});
