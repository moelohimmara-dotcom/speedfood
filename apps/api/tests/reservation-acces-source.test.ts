import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COLONNES_DISPONIBILITE_RESERVATION, COLONNES_REGLAGE_RESERVATION, COLONNES_RESERVATION_CLIENT, COLONNES_RESERVATION_RESTAURANT, creerAccesReservationClient, creerAccesReservationRestaurant, lireReponseCreation } from "../src/reservation/acces.ts";
import { MAINTENANT, RESTO_1, RES_1, RES_AUTRE, UID_A, UID_B, baseReservations, ligneReservation, ligneRestaurant } from "./reservation-base-factice.ts";

/**
 * M3 : accès à la base (colonnes explicites, filtres sur le compte et le restaurant, jamais `select *`, jamais la colonne du condensé du jeton) et contrôles STATIQUES du source.
 * Les tests de service injectent des doublures et ne voient pas ce que les fichiers font vraiment : ceux-ci lisent le source.
 */
const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, "")).join("\n");

// ---------- accès : ce qui est réellement demandé à la base ----------

test("M3 accès client : toutes les requêtes listent leurs colonnes, aucune ne nomme le condensé du jeton, chaque lecture du compte est filtrée sur lui", async () => {
  const b = baseReservations({
    colonnesModifiables: ["statut"],
    reservations: [ligneReservation({ id: RES_1 }), ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, reference: "SF-R-AAAAB" })],
  });
  const acces = creerAccesReservationClient({ client: () => b.client });
  await acces.lister(UID_A);
  await acces.lire(UID_A, RES_1);
  await acces.creerAtomique({ restaurantId: RESTO_1, clientUserId: UID_A, nom: "Aminata Camara", telephone: "+224620000001", nbPersonnes: 2, creneau: "2026-11-20T19:00:00.000Z", note: null });
  await acces.annuler(UID_A, RES_1);
  assert.ok(b.operations.length >= 4);
  for (const o of b.operations) {
    assert.ok(o.op === "rpc" || (o.select.length > 0 && !o.select.includes("*")), `select explicite : ${o.select}`);
    assert.doesNotMatch(o.select, /jeton_suivi_hash/);
    assert.doesNotMatch(JSON.stringify(o.valeurs ?? {}), /jeton_suivi_hash/);
  }
  // Les lectures et l'annulation sont filtrées sur le compte ; la création (fonction SQL) reçoit le compte du jeton en argument, jamais ailleurs.
  for (const o of b.operations.filter((x) => x.table === "reservations_table")) assert.ok(o.filtres.includes("eq:client_user_id"), `filtre sur le compte : ${o.op} ${o.select}`);
  assert.equal(b.operations.find((o) => o.op === "rpc")?.valeurs?.p_client_user_id, UID_A);
});

test("M4-0 accès disponibilité : une seule lecture de `restaurants`, colonnes listées (publié, suspendu, accepte), filtrée sur l'identifiant, ni capacité ni nom", async () => {
  const b = baseReservations({ restaurants: [ligneRestaurant({ reservation_capacite_couverts: 30 })] });
  const acces = creerAccesReservationClient({ client: () => b.client });
  assert.deepEqual(await acces.lireDisponibilite(RESTO_1), { publie: true, suspendu: false, accepteReservation: true });
  assert.equal(await acces.lireDisponibilite("22222222-2222-4222-8222-222222222222"), null);
  assert.equal(COLONNES_DISPONIBILITE_RESERVATION, "publie, suspendu_le, accepte_reservation");
  assert.equal(b.operations.length, 2);
  for (const o of b.operations) {
    assert.equal(o.table, "restaurants");
    assert.equal(o.op, "select");
    assert.equal(o.select, COLONNES_DISPONIBILITE_RESERVATION);
    assert.deepEqual(o.filtres, ["eq:id"]);
  }
  const susp = baseReservations({ restaurants: [ligneRestaurant({ suspendu_le: "2026-11-01T00:00:00.000Z" })] });
  assert.equal((await creerAccesReservationClient({ client: () => susp.client }).lireDisponibilite(RESTO_1))?.suspendu, true);
  const panne = baseReservations({ erreurLecture: "restaurants" });
  await assert.rejects(() => creerAccesReservationClient({ client: () => panne.client }).lireDisponibilite(RESTO_1), (e: Error) => e.message === "RESTAURANT_INDISPONIBLE");
});

test("M3 accès client : listes et lectures ne rendent jamais la ligne d'un autre compte ; l'annulation d'un autre compte ne modifie rien", async () => {
  const b = baseReservations({ colonnesModifiables: ["statut"], reservations: [ligneReservation({ id: RES_1 }), ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, telephone: "+224699999999", reference: "SF-R-AAAAB" })] });
  const acces = creerAccesReservationClient({ client: () => b.client });
  assert.deepEqual((await acces.lister(UID_A)).map((r) => r.id), [RES_1]);
  assert.equal(await acces.lire(UID_A, RES_AUTRE), null);
  const r = await acces.annuler(UID_A, RES_AUTRE);
  assert.deepEqual(r, { ok: false, genre: "aucune_ligne" });
  assert.equal(b.tables.reservations_table.find((x) => x.id === RES_AUTRE)?.statut, "demandee");
});

test("M5 accès client : la création appelle UNE fonction SQL avec sept arguments nommés, rien d'autre (ni statut, ni référence, ni jeton, ni horodatage), et aucune écriture directe", async () => {
  const b = baseReservations();
  const acces = creerAccesReservationClient({ client: () => b.client });
  const r = await acces.creerAtomique({ restaurantId: RESTO_1, clientUserId: UID_A, nom: "Aminata Camara", telephone: "+224620000001", nbPersonnes: 2, creneau: "2026-11-20T19:00:00.000Z", note: "x" });
  assert.ok(r.ok && r.etat === "creee");
  assert.equal(b.operations.length, 1);
  const appel = b.operations[0];
  assert.equal(appel.op, "rpc");
  assert.equal(appel.table, "rpc:fn_creer_reservation_atomique");
  assert.deepEqual(Object.keys(appel.valeurs ?? {}).sort(), ["p_client_user_id", "p_creneau", "p_nb_personnes", "p_nom", "p_note", "p_restaurant_id", "p_telephone"]);
  assert.deepEqual(appel.valeurs, { p_client_user_id: UID_A, p_restaurant_id: RESTO_1, p_nom: "Aminata Camara", p_telephone: "+224620000001", p_nb_personnes: 2, p_creneau: "2026-11-20T19:00:00.000Z", p_note: "x" });
});

test("M5 accès client : une erreur de la base (garde, contrainte) est rendue brute au service, qui la traduit ; la réponse de la fonction est lue STRICTEMENT", async () => {
  const panne = baseReservations({ erreurRpc: { code: "P0001", message: "Ce restaurant n'accepte pas les réservations de table." } });
  const brute = await creerAccesReservationClient({ client: () => panne.client }).creerAtomique({ restaurantId: RESTO_1, clientUserId: UID_A, nom: "Aminata Camara", telephone: "+224620000001", nbPersonnes: 2, creneau: "2026-11-20T19:00:00.000Z", note: null });
  assert.deepEqual(brute, { ok: false, genre: "base", erreur: { code: "P0001", message: "Ce restaurant n'accepte pas les réservations de table." } });
  const refus = lireReponseCreation({ etat: "refus", code: "CAPACITE" });
  assert.deepEqual(refus, { ok: false, genre: "refus", code: "CAPACITE" });
  for (const douteuse of [null, undefined, "creee", 3, [], {}, { etat: "peut_etre" }, { etat: "refus" }, { etat: "refus", code: "AUTRE" }, { etat: "refus", code: "capacite" }, { etat: "creee" }, { etat: "creee", reservation: null }, { etat: "creee", reservation: { id: "x" } }]) {
    assert.throws(() => lireReponseCreation(douteuse), (e: Error) => e.message === "RESERVATION_ILLISIBLE", JSON.stringify(douteuse));
  }
});

test("M3 accès restaurateur : chaque requête est filtrée sur le restaurant du contexte, colonnes explicites, jamais le compte du client ni le condensé du jeton", async () => {
  const b = baseReservations({ reservations: [ligneReservation({ id: RES_1 }), ligneReservation({ id: RES_AUTRE, restaurant_id: "22222222-2222-4222-8222-222222222222", reference: "SF-R-AAAAB" })], restaurants: [ligneRestaurant()] });
  const acces = creerAccesReservationRestaurant();
  const debut = new Date("2026-11-12T00:00:00.000Z");
  const fin = new Date("2026-11-13T00:00:00.000Z");
  assert.deepEqual((await acces.lireDuJour(b.client, RESTO_1, debut, fin)).map((r) => r.id), [RES_1]);
  assert.deepEqual((await acces.lireDemandesAVenir(b.client, RESTO_1, MAINTENANT)).map((r) => r.id), [RES_1]);
  assert.equal(await acces.lire(b.client, RESTO_1, RES_AUTRE), null);
  await acces.lireReglage(b.client, RESTO_1);
  for (const o of b.operations) {
    assert.ok(o.select.length > 0 && !o.select.includes("*"), o.select);
    assert.doesNotMatch(o.select, /jeton_suivi_hash|client_user_id/);
    if (o.table === "reservations_table") assert.ok(o.filtres.includes("eq:restaurant_id"), o.select);
  }
  assert.equal(COLONNES_RESERVATION_RESTAURANT.includes("client_user_id"), false);
  assert.equal(COLONNES_RESERVATION_CLIENT.includes("jeton"), false);
  assert.equal(COLONNES_REGLAGE_RESERVATION, "accepte_reservation, reservation_capacite_couverts");
});

test("M3 accès : une ligne illisible venue de la base est une panne (jamais une réservation tronquée)", async () => {
  const b = baseReservations({ reservations: [ligneReservation({ id: RES_1, statut: "statut-inconnu" })] });
  const acces = creerAccesReservationClient({ client: () => b.client });
  await assert.rejects(() => acces.lister(UID_A), (e: Error) => e.message === "RESERVATION_ILLISIBLE");
});

// ---------- source ----------

const FICHIERS_RESERVATION = () => readdirSync(fileURLToPath(new URL("../src/reservation/", import.meta.url))).filter((f) => f.endsWith(".ts")).map((f) => `../src/reservation/${f}`);

test("M3 source : aucun `select *`, aucun `select()` sans colonne, jamais la colonne du condensé du jeton dans le code de réservation", () => {
  const fichiers = [...FICHIERS_RESERVATION(), "../src/routes/reservation.ts"];
  assert.ok(fichiers.length >= 6);
  for (const f of fichiers) {
    const code = sansCommentaires(lire(f));
    assert.doesNotMatch(code, /\.select\(\s*\)/, `${f} : select() sans colonne`);
    assert.doesNotMatch(code, /\.select\(\s*["'`]\s*\*/, `${f} : select *`);
    assert.doesNotMatch(code, /select\(["'`][^"'`]*\*[^"'`]*["'`]\)/, `${f} : étoile dans select`);
    assert.doesNotMatch(code, /jeton_suivi_hash|jetonSuiviHash/, `${f} : condensé du jeton`);
  }
});

test("M3 source : le code de réservation n'écrit ni ne journalise jamais de téléphone, de nom ni de note (aucun console.* hors erreurs sans valeur)", () => {
  for (const f of [...FICHIERS_RESERVATION(), "../src/routes/reservation.ts"]) {
    assert.doesNotMatch(sansCommentaires(lire(f)), /console\./, f);
  }
});

test("M3 source : les services de réservation ne dépendent ni de Hono ni de la base (ports injectés) ; seul le câblage touche au client administrateur", () => {
  for (const f of ["../src/reservation/client.ts", "../src/reservation/restaurateur.ts", "../src/reservation/regles.ts"]) {
    const code = sansCommentaires(lire(f));
    assert.doesNotMatch(code, /from ["']hono|@supabase|SupabaseClient|creerClientAdmin|@\/lib/, f);
  }
  const cablage = sansCommentaires(lire("../src/reservation/cablage.ts"));
  assert.equal((cablage.match(/creerClientAdmin\(/g) ?? []).length, 1, "un seul appel au client administrateur, dans le port CLIENT");
  assert.match(cablage, /creerAccesReservationClient\(\{ client: \(\) => creerClientAdmin\(\) as unknown as SupabaseClient \}\)/);
  assert.match(cablage, /\.\.\.creerAccesReservationRestaurant\(\)/, "le port restaurateur ne reçoit aucun client : il utilise celui du jeton, fourni à chaque appel");
  assert.doesNotMatch(cablage, /creerClientJeton|creerAccesReservationRestaurant\([^)]/);
  const acces = sansCommentaires(lire("../src/reservation/acces.ts"));
  assert.doesNotMatch(acces, /creerClientAdmin/, "acces.ts ne choisit jamais le client : il le reçoit");
});

test("M3 source : le port restaurateur filtre TOUJOURS sur le restaurant ET écrit avec une comparaison d'état ; le port client filtre sur le compte", () => {
  const acces = sansCommentaires(lire("../src/reservation/acces.ts"));
  const restaurateur = acces.slice(acces.indexOf("export function creerAccesReservationRestaurant"));
  assert.equal((restaurateur.match(/\.from\(TABLE\)/g) ?? []).length, 4, "quatre requêtes sur la table, côté restaurateur");
  assert.equal((restaurateur.match(/\.eq\("restaurant_id", restaurantId\)/g) ?? []).length, 4, "chacune filtrée sur le restaurant du contexte");
  assert.match(restaurateur, /\.eq\("statut", ancien\)\s*\n\s*\.select/, "compare-et-pose sur l'état attendu");
  const client = acces.slice(acces.indexOf("export function creerAccesReservationClient"), acces.indexOf("export function lireReponseCreation"));
  assert.equal((client.match(/\.eq\("client_user_id", utilisateurId\)/g) ?? []).length, 3, "liste, lecture et annulation : chacune filtrée sur le compte");
  assert.match(client, /\.rpc\("fn_creer_reservation_atomique", \{\s*p_client_user_id: ligne\.clientUserId,/, "la création passe par la fonction SQL, avec le compte du jeton");
  assert.doesNotMatch(client, /\.insert\(/, "aucune insertion directe côté client : la création est la fonction SQL");
});

test("M3 source : les routes sont montées dans app.ts (sans CORS) et câblées dans worker.ts", () => {
  const app = sansCommentaires(lire("../src/app.ts"));
  assert.match(app, /app\.route\("\/api\/v1\/reservations", routeReservations\(deps\)\)/);
  assert.match(app, /app\.route\("\/api\/v1\/restaurant\/reservations", routeReservationsRestaurant\(deps\)\)/);
  assert.match(app, /app\.route\("\/api\/v1\/restaurant\/reservation-reglage", routeReservationReglage\(deps\)\)/);
  assert.doesNotMatch(app, /Access-Control-Allow-Origin[^\n]*reservation|'\/api\/v1\/reservations'/, "aucun CORS sur la réservation");
  const worker = sansCommentaires(lire("../src/worker.ts"));
  assert.match(worker, /reservations: serviceReservations,/);
  assert.match(worker, /reservationsRestaurant: serviceReservationsRestaurant,/);
});

test("M3 source : aucune route Next.js de réservation, aucun relais allumé ni réglage de relais modifié par le lot", () => {
  const relais = lire("../../web/src/lib/api/relais.ts");
  assert.doesNotMatch(relais, /reservation/i, "le relais du site n'a pas été touché par la réservation");
});
