import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COLONNES_REGLAGE_RESERVATION, COLONNES_RESERVATION_CLIENT, COLONNES_RESERVATION_RESTAURANT, COLONNES_RESTAURANT_RESERVATION, collisionDeReference, creerAccesReservationClient, creerAccesReservationRestaurant } from "../src/reservation/acces.ts";
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
  await acces.lireRestaurant(RESTO_1);
  await acces.listerActives(UID_A, MAINTENANT);
  await acces.sommeCouverts(RESTO_1, new Date("2026-11-12T19:00:00.000Z"));
  await acces.lister(UID_A);
  await acces.lire(UID_A, RES_1);
  await acces.inserer({ restaurantId: RESTO_1, clientUserId: UID_A, nom: "Aminata Camara", telephone: "+224620000001", nbPersonnes: 2, creneau: "2026-11-20T19:00:00.000Z", note: null });
  await acces.annuler(UID_A, RES_1);
  assert.ok(b.operations.length >= 7);
  for (const o of b.operations) {
    assert.ok(o.select.length > 0 && !o.select.includes("*"), `select explicite : ${o.select}`);
    assert.doesNotMatch(o.select, /jeton_suivi_hash/);
    assert.doesNotMatch(JSON.stringify(o.valeurs ?? {}), /jeton_suivi_hash/);
  }
  const surReservations = b.operations.filter((o) => o.table === "reservations_table" && o.select !== "nb_personnes");
  for (const o of surReservations) {
    if (o.op === "insert") continue;
    assert.ok(o.filtres.includes("eq:client_user_id"), `filtre sur le compte : ${o.op} ${o.select}`);
  }
  assert.equal(b.operations.find((o) => o.select === COLONNES_RESTAURANT_RESERVATION)?.table, "restaurants");
});

test("M3 accès client : listes et lectures ne rendent jamais la ligne d'un autre compte ; l'annulation d'un autre compte ne modifie rien", async () => {
  const b = baseReservations({ colonnesModifiables: ["statut"], reservations: [ligneReservation({ id: RES_1 }), ligneReservation({ id: RES_AUTRE, client_user_id: UID_B, telephone: "+224699999999", reference: "SF-R-AAAAB" })] });
  const acces = creerAccesReservationClient({ client: () => b.client });
  assert.deepEqual((await acces.lister(UID_A)).map((r) => r.id), [RES_1]);
  assert.deepEqual((await acces.listerActives(UID_A, MAINTENANT)).map((r) => r.id), [RES_1]);
  assert.equal(await acces.lire(UID_A, RES_AUTRE), null);
  const r = await acces.annuler(UID_A, RES_AUTRE);
  assert.deepEqual(r, { ok: false, genre: "aucune_ligne" });
  assert.equal(b.tables.reservations_table.find((x) => x.id === RES_AUTRE)?.statut, "demandee");
});

test("M3 accès client : l'insertion n'écrit que les colonnes prévues (ni statut, ni référence, ni jeton, ni horodatage)", async () => {
  const b = baseReservations();
  const acces = creerAccesReservationClient({ client: () => b.client });
  await acces.inserer({ restaurantId: RESTO_1, clientUserId: UID_A, nom: "Aminata Camara", telephone: "+224620000001", nbPersonnes: 2, creneau: "2026-11-20T19:00:00.000Z", note: "x" });
  const insertion = b.operations.find((o) => o.op === "insert");
  assert.deepEqual(Object.keys(insertion?.valeurs ?? {}).sort(), ["client_user_id", "creneau", "nb_personnes", "nom_client", "note", "restaurant_id", "telephone"]);
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

test("M3 accès : une collision de référence (23505 sur la référence) est reconnue ; toute autre erreur d'unicité ou autre code ne l'est pas", () => {
  assert.equal(collisionDeReference({ code: "23505", message: 'duplicate key value violates unique constraint "reservations_table_reference_key"' }), true);
  assert.equal(collisionDeReference({ code: "23505", message: "duplicate key", details: "Key (reference)=(SF-R-AAAAA) already exists." }), true);
  assert.equal(collisionDeReference({ code: "23505", message: 'duplicate key value violates unique constraint "reservations_table_pkey"' }), false);
  assert.equal(collisionDeReference({ code: "23514", message: "reference" }), false);
  assert.equal(collisionDeReference({}), false);
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
  const client = acces.slice(acces.indexOf("export function creerAccesReservationClient"), acces.indexOf("export function collisionDeReference"));
  assert.equal((client.match(/\.eq\("client_user_id", utilisateurId\)/g) ?? []).length, 4, "liste, actives, lecture et annulation : chacune filtrée sur le compte");
  assert.match(client, /\.insert\(\{ restaurant_id: ligne\.restaurantId, client_user_id: ligne\.clientUserId,/);
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
