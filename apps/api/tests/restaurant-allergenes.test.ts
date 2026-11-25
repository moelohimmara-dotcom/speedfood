import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { creerApp } from "../src/app.ts";
import { definirAllergenesPlat } from "../src/restaurant/allergenes.ts";
import { lireDemandeAllergenes } from "@speedfood/shared/contracts/restaurant-allergenes";
import type { ContexteRestaurant, Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}`, "content-type": "application/json" };
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const PLAT = "44444444-4444-4444-8444-444444444444";
const CTX: ContexteRestaurant = { supabase: { marqueur: "client-lie-au-jeton" }, utilisateurId: "compte-1", restaurantId: RESTAURANT_A, role: "owner" };

test("contrat : liste, liste vide (aucun allergène) et null (retrait) sont acceptés", () => {
  assert.deepEqual(lireDemandeAllergenes({ platId: PLAT, allergenes: ["lait", "gluten"] }), { ok: true, platId: PLAT, allergenes: ["lait", "gluten"] });
  assert.deepEqual(lireDemandeAllergenes({ platId: PLAT, allergenes: [] }), { ok: true, platId: PLAT, allergenes: [] });
  assert.deepEqual(lireDemandeAllergenes({ platId: PLAT, allergenes: null }), { ok: true, platId: PLAT, allergenes: null });
});

test("contrat : tout écart est refusé (clé en plus ou en moins, allergène inconnu ou répété, identifiant faux)", () => {
  const mauvais: unknown[] = [null, [], "x", {}, { platId: PLAT }, { allergenes: [] }, { platId: PLAT, allergenes: [], restaurantId: RESTAURANT_A }, { platId: "pas-uuid", allergenes: [] },
    { platId: PLAT, allergenes: ["pizza"] }, { platId: PLAT, allergenes: ["lait", "lait"] }, { platId: PLAT, allergenes: "lait" }, { platId: PLAT, allergenes: undefined }];
  for (const m of mauvais) assert.equal(lireDemandeAllergenes(m).ok, false, JSON.stringify(m));
});

type Appel = { methode: string; recherche: string; corps?: Record<string, unknown> };
function base(reponse: () => unknown, journal: Appel[] = []) {
  return createClient("https://base-essai.invalid", "anon", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
    const u = new URL(String(url)); journal.push({ methode: init?.method ?? "GET", recherche: decodeURIComponent(u.search), corps: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(reponse()), { headers: { "content-type": "application/json" } });
  } } });
}
const maintenant = () => new Date("2026-11-26T09:00:00Z");

test("service : la déclaration écrit les deux colonnes, filtrées sur le restaurant du compte et le plat non archivé", async () => {
  const journal: Appel[] = [];
  const r = await definirAllergenesPlat(base(() => [{ id: PLAT }], journal), RESTAURANT_A, PLAT, ["lait"], maintenant);
  assert.deepEqual(r, { ok: true });
  assert.equal(journal[0].methode, "PATCH");
  assert.deepEqual(journal[0].corps, { allergenes: ["lait"], allergenes_declares_le: "2026-11-26T09:00:00.000Z" });
  assert.match(journal[0].recherche, new RegExp(`id=eq\\.${PLAT}`)); assert.match(journal[0].recherche, new RegExp(`restaurant_id=eq\\.${RESTAURANT_A}`)); assert.match(journal[0].recherche, /archive_le=is\.null/);
});

test("service : « aucun allergène » = liste vide datée ; retrait = les deux colonnes à null", async () => {
  const j1: Appel[] = []; await definirAllergenesPlat(base(() => [{ id: PLAT }], j1), RESTAURANT_A, PLAT, [], maintenant);
  assert.deepEqual(j1[0].corps, { allergenes: [], allergenes_declares_le: "2026-11-26T09:00:00.000Z" });
  const j2: Appel[] = []; await definirAllergenesPlat(base(() => [{ id: PLAT }], j2), RESTAURANT_A, PLAT, null, maintenant);
  assert.deepEqual(j2[0].corps, { allergenes: null, allergenes_declares_le: null });
});

test("service : plat d'un autre restaurant ou archivé (zéro ligne) = « Plat inconnu », jamais un succès ; panne = erreur serveur", async () => {
  assert.deepEqual(await definirAllergenesPlat(base(() => []), RESTAURANT_A, PLAT, ["lait"], maintenant), { ok: false, erreur: { code: "VALIDATION", message: "Plat inconnu." } });
  const panne = createClient("https://base-essai.invalid", "anon", { global: { fetch: async () => { throw new Error("réseau"); } } });
  const r = await definirAllergenesPlat(panne, RESTAURANT_A, PLAT, ["lait"], maintenant);
  assert.equal(r.ok, false); assert.equal(!r.ok && r.erreur.code, "ERREUR_SERVEUR");
});

function monter(surcharge: Partial<Deps["restaurant"]> = {}) {
  const appels: string[] = []; const ecritures: unknown[][] = [];
  const hors = async () => { throw new Error("hors sujet"); };
  const app = creerApp(depsEssai({
    verificateurs: { strict: async (j) => { appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    restaurant: { contexte: async () => { appels.push("contexte"); return CTX; }, lister: hors, traiter: hors, confirmerPaiement: hors, proposer: hors, modifierStatut: hors, lireReglages: hors, enregistrerReglages: hors, lireMenu: hors, actionMenu: hors, definirPhoto: hors, retirerPhoto: hors, agirSurLivraison: hors,
      definirAllergenes: async (ctx, platId, allergenes) => { ecritures.push([ctx.restaurantId, platId, allergenes]); return { ok: true }; }, ...surcharge } as Deps["restaurant"],
  }));
  return { app, appels, ecritures };
}
const poster = (app: ReturnType<typeof monter>["app"], corps: unknown, entetes: Record<string, string> = AUTH) => app.request("/api/v1/restaurant/menu/allergenes", { method: "POST", headers: entetes, body: JSON.stringify(corps) });

test("route : sans jeton valide, rien n'est écrit", async () => {
  const { app, ecritures } = monter();
  assert.equal((await poster(app, { platId: PLAT, allergenes: [] }, { "content-type": "application/json" })).status, 401);
  assert.equal((await poster(app, { platId: PLAT, allergenes: [] }, { authorization: "Bearer faux.faux.faux12345", "content-type": "application/json" })).status, 401);
  assert.equal(ecritures.length, 0);
});

test("route : le restaurant est celui du compte, jamais celui du corps ; le contexte passe avant le corps", async () => {
  const { app, appels, ecritures } = monter();
  assert.equal((await poster(app, { platId: PLAT, allergenes: ["lait", "oeuf"] })).status, 200);
  assert.deepEqual(ecritures, [[RESTAURANT_A, PLAT, ["lait", "oeuf"]]]);
  assert.deepEqual(appels, ["identite", "contexte"]);
  const triche = await poster(app, { platId: PLAT, allergenes: [], restaurantId: "22222222-2222-4222-8222-222222222222" });
  assert.equal(triche.status, 400); assert.equal(ecritures.length, 1);
});

test("route : corps invalide = VALIDATION sans écriture ; plat inconnu et panne remontent tels quels", async () => {
  const { app, ecritures } = monter();
  for (const corps of [{ platId: PLAT, allergenes: ["pizza"] }, { platId: "x", allergenes: [] }, "texte"]) { const r = await poster(app, corps); assert.equal(r.status, 400); assert.equal((await r.json()).erreur.code, "VALIDATION"); }
  assert.equal(ecritures.length, 0);
  const inconnu = monter({ definirAllergenes: async () => ({ ok: false, erreur: { code: "VALIDATION", message: "Plat inconnu." } }) });
  assert.equal((await poster(inconnu.app, { platId: PLAT, allergenes: [] })).status, 400);
  const panne = monter({ definirAllergenes: async () => ({ ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer les allergènes. Réessayez dans un instant." } }) });
  assert.equal((await poster(panne.app, { platId: PLAT, allergenes: [] })).status, 500);
});
