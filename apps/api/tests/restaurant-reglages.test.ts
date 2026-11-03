import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ecrireReglagesRestaurant, ecrireStatutRestaurant, lireReglagesRestaurant } from "../src/restaurant/reglages.ts";

/**
 * Lecture des réglages et écritures du statut / des réglages (lot D4a, `restaurant/reglages.ts`) contre un faux client de base qui sert les lignes filtrées et NOTE chaque écriture
 * (table, colonnes, filtres). Le client reçu est toujours celui du jeton : ce fichier ne sait pas en fabriquer un autre.
 */
type Ligne = Record<string, unknown>;
interface Ecriture { table: string; valeurs: Ligne; filtres: Array<[string, unknown]> }
const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const maintenant = new Date("2026-11-03T12:00:00.000Z");
const ilYa = (heures: number) => new Date(maintenant.getTime() - heures * 3_600_000).toISOString();

function faux(tables: Record<string, Ligne[]>, options: { erreur?: string[] } = {}) {
  const ecritures: Ecriture[] = [];
  const requetes: Array<{ table: string; colonnes: string; filtres: Array<[string, string, unknown]> }> = [];
  const db = {
    from(table: string) {
      const q: { op: "select" | "update"; colonnes: string; valeurs: Ligne; filtres: Array<[string, string, unknown]> } = { op: "select", colonnes: "", valeurs: {}, filtres: [] };
      const lignes = () => (tables[table] ?? []).filter((r) => q.filtres.every(([op, c, v]) => (op === "eq" ? r[c] === v : op === "is" ? (r[c] ?? null) === v : true)));
      const fin = (unique: boolean) => {
        if (options.erreur?.includes(table)) return { data: null, error: { message: "panne" } };
        if (q.op === "update") {
          ecritures.push({ table, valeurs: q.valeurs, filtres: q.filtres.map(([, c, v]) => [c, v]) });
          const touchees = lignes();
          for (const l of touchees) Object.assign(l, q.valeurs);
          return { data: touchees.map((l) => ({ id: l.id })), error: null };
        }
        requetes.push({ table, colonnes: q.colonnes, filtres: q.filtres });
        const l = lignes();
        return { data: unique ? (l[0] ?? null) : l, error: null };
      };
      const chaine: Record<string, unknown> = {
        select: (c?: string) => { if (q.op === "select") q.colonnes = c ?? ""; return chaine; },
        eq: (c: string, v: unknown) => { q.filtres.push(["eq", c, v]); return chaine; },
        is: (c: string, v: unknown) => { q.filtres.push(["is", c, v]); return chaine; },
        limit: () => chaine,
        update: (v: Ligne) => { q.op = "update"; q.valeurs = v; return chaine; },
        maybeSingle: async () => fin(true),
        then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(fin(false)).then(ok, ko),
      };
      return chaine;
    },
  };
  return { db: db as unknown as SupabaseClient, ecritures, requetes };
}

const restaurant = (id: string, surcharge: Ligne = {}): Ligne => ({ id, horaires: "Lun-Sam 8h-22h", ouvert: true, accepte_commandes: true, delai_preparation_minutes: 25, ...surcharge });
const plat = (id: string, restaurantId: string, surcharge: Ligne = {}): Ligne => ({ id, nom: "Plat " + id, restaurant_id: restaurantId, disponible: true, disponibilite_confirmee_le: ilYa(1), archive_le: null, ...surcharge });

// ---------- lecture ----------
test("réglages : horaires, état du service, délai ; un champ vide devient « » / null, jamais undefined", async () => {
  const { db } = faux({ restaurants: [restaurant(RESTAURANT_A, { horaires: null, delai_preparation_minutes: null, ouvert: false, accepte_commandes: false })], menu_items: [] });
  assert.deepEqual(await lireReglagesRestaurant(db, RESTAURANT_A, 6, maintenant), { ok: true, horaires: "", ouvert: false, accepteCommandes: false, delaiPreparationMinutes: null, platsAReconfirmer: [] });
});

test("réglages : « plats à reconfirmer » = règle du serveur (etatDisponibilite) : jamais confirmé, confirmé au-delà du seuil ; confirmé récemment ou épuisé : non", async () => {
  const { db } = faux({
    restaurants: [restaurant(RESTAURANT_A)],
    menu_items: [
      plat("p1", RESTAURANT_A, { disponibilite_confirmee_le: null }),
      plat("p2", RESTAURANT_A, { disponibilite_confirmee_le: ilYa(7) }),
      plat("p3", RESTAURANT_A, { disponibilite_confirmee_le: ilYa(5) }),
      plat("p4", RESTAURANT_A, { disponibilite_confirmee_le: ilYa(100), disponible: false }),
      plat("p5", RESTAURANT_A, { disponibilite_confirmee_le: ilYa(48), archive_le: "2026-10-01T00:00:00Z" }),
      plat("p6", RESTAURANT_A, { disponibilite_confirmee_le: "pas une date" }),
    ],
  });
  const r = await lireReglagesRestaurant(db, RESTAURANT_A, 6, maintenant);
  assert.deepEqual(r?.platsAReconfirmer, [
    { id: "p1", nom: "Plat p1", confirmeLe: null },
    { id: "p2", nom: "Plat p2", confirmeLe: ilYa(7) },
    { id: "p6", nom: "Plat p6", confirmeLe: null },
  ]);
  const strict = await lireReglagesRestaurant(db, RESTAURANT_A, 4, maintenant);
  assert.deepEqual(strict?.platsAReconfirmer.map((p) => p.id), ["p1", "p2", "p3", "p6"], "le seuil de fraîcheur du serveur est celui qui est passé");
});

test("réglages : lecture filtrée sur le restaurant du compte (les plats de B n'apparaissent jamais dans les réglages de A)", async () => {
  const { db, requetes } = faux({ restaurants: [restaurant(RESTAURANT_A), restaurant(RESTAURANT_B, { horaires: "AUTRE" })], menu_items: [plat("pa", RESTAURANT_A, { disponibilite_confirmee_le: null }), plat("pb", RESTAURANT_B, { disponibilite_confirmee_le: null })] });
  const r = await lireReglagesRestaurant(db, RESTAURANT_A, 6, maintenant);
  assert.equal(r?.horaires, "Lun-Sam 8h-22h");
  assert.deepEqual(r?.platsAReconfirmer.map((p) => p.id), ["pa"]);
  for (const q of requetes) assert.ok(q.filtres.some(([op, c, v]) => op === "eq" && (c === "id" || c === "restaurant_id") && v === RESTAURANT_A), q.table + " non filtré sur le restaurant du compte");
});

test("réglages : restaurant introuvable ou panne de la base = null (jamais des réglages inventés)", async () => {
  assert.equal(await lireReglagesRestaurant(faux({ restaurants: [], menu_items: [] }).db, RESTAURANT_A, 6, maintenant), null);
  assert.equal(await lireReglagesRestaurant(faux({ restaurants: [restaurant(RESTAURANT_A)], menu_items: [] }, { erreur: ["menu_items"] }).db, RESTAURANT_A, 6, maintenant), null);
  assert.equal(await lireReglagesRestaurant(faux({ restaurants: [restaurant(RESTAURANT_A)], menu_items: [] }, { erreur: ["restaurants"] }).db, RESTAURANT_A, 6, maintenant), null);
});

// ---------- statut ----------
test("statut : « ouvert » n'écrit QUE la colonne ouvert, « accepte_commandes » QUE accepte_commandes, sur le restaurant du compte", async () => {
  for (const [champ, colonne, autre] of [["ouvert", "ouvert", "accepte_commandes"], ["accepte_commandes", "accepte_commandes", "ouvert"]] as const) {
    const { db, ecritures } = faux({ restaurants: [restaurant(RESTAURANT_A), restaurant(RESTAURANT_B)] });
    assert.equal(await ecrireStatutRestaurant(db, RESTAURANT_A, { champ, valeur: false }), true);
    assert.deepEqual(ecritures.map((e) => [e.table, e.valeurs, e.filtres]), [["restaurants", { [colonne]: false }, [["id", RESTAURANT_A]]]]);
    assert.ok(!(autre in ecritures[0].valeurs), "l'autre interrupteur n'est pas touché");
  }
});

test("statut : le restaurant de B n'est jamais modifié par le compte de A ; aucune ligne touchée (RLS, restaurant inconnu) = false, jamais « enregistré »", async () => {
  const { db, ecritures } = faux({ restaurants: [restaurant(RESTAURANT_A), restaurant(RESTAURANT_B)] });
  await ecrireStatutRestaurant(db, RESTAURANT_A, { champ: "ouvert", valeur: false });
  assert.equal(db && (await lireReglagesRestaurant(db, RESTAURANT_B, 6, maintenant))?.ouvert, true, "B est resté ouvert");
  assert.equal(ecritures.length, 1);
  const vide = faux({ restaurants: [] });
  assert.equal(await ecrireStatutRestaurant(vide.db, RESTAURANT_A, { champ: "ouvert", valeur: false }), false);
  const panne = faux({ restaurants: [restaurant(RESTAURANT_A)] }, { erreur: ["restaurants"] });
  assert.equal(await ecrireStatutRestaurant(panne.db, RESTAURANT_A, { champ: "ouvert", valeur: false }), false);
});

test("statut : l'heure du changement n'est jamais posée par l'application (aucune colonne de date écrite)", async () => {
  const { db, ecritures } = faux({ restaurants: [restaurant(RESTAURANT_A)] });
  await ecrireStatutRestaurant(db, RESTAURANT_A, { champ: "accepte_commandes", valeur: true });
  assert.deepEqual(Object.keys(ecritures[0].valeurs), ["accepte_commandes"]);
});

// ---------- réglages écrits ----------
test("réglages écrits : horaires et délai SEULEMENT, même si l'objet reçu porte d'autres clés (pas d'assignation de masse)", async () => {
  const { db, ecritures } = faux({ restaurants: [restaurant(RESTAURANT_A)] });
  const hostile = { horaires: "8h-22h", delaiPreparationMinutes: 30, ouvert: false, accepte_commandes: false, id: RESTAURANT_B, nom: "X", publie: true, suspendu_le: "2026-01-01", delai_preparation_minutes: 1 };
  assert.equal(await ecrireReglagesRestaurant(db, RESTAURANT_A, hostile), true);
  assert.deepEqual(ecritures.map((e) => [e.valeurs, e.filtres]), [[{ horaires: "8h-22h", delai_preparation_minutes: 30 }, [["id", RESTAURANT_A]]]]);
});

test("réglages écrits : un champ absent n'est pas écrit ; délai null efface ; horaires vides autorisés ; rien à écrire = false sans requête", async () => {
  const a = faux({ restaurants: [restaurant(RESTAURANT_A)] });
  await ecrireReglagesRestaurant(a.db, RESTAURANT_A, { delaiPreparationMinutes: null });
  assert.deepEqual(a.ecritures[0].valeurs, { delai_preparation_minutes: null });
  const b = faux({ restaurants: [restaurant(RESTAURANT_A)] });
  await ecrireReglagesRestaurant(b.db, RESTAURANT_A, { horaires: "" });
  assert.deepEqual(b.ecritures[0].valeurs, { horaires: "" });
  const c = faux({ restaurants: [restaurant(RESTAURANT_A)] });
  assert.equal(await ecrireReglagesRestaurant(c.db, RESTAURANT_A, {}), false);
  assert.deepEqual(c.ecritures, []);
});

test("réglages écrits : jamais « enregistré » sans confirmation de la base (aucune ligne touchée, panne) et B n'est pas touché", async () => {
  const vide = faux({ restaurants: [] });
  assert.equal(await ecrireReglagesRestaurant(vide.db, RESTAURANT_A, { horaires: "x" }), false);
  const panne = faux({ restaurants: [restaurant(RESTAURANT_A)] }, { erreur: ["restaurants"] });
  assert.equal(await ecrireReglagesRestaurant(panne.db, RESTAURANT_A, { horaires: "x" }), false);
  const deux = faux({ restaurants: [restaurant(RESTAURANT_A), restaurant(RESTAURANT_B)] });
  await ecrireReglagesRestaurant(deux.db, RESTAURANT_A, { horaires: "NOUVEAU" });
  assert.equal((await lireReglagesRestaurant(deux.db, RESTAURANT_B, 6, maintenant))?.horaires, "Lun-Sam 8h-22h");
  assert.equal((await lireReglagesRestaurant(deux.db, RESTAURANT_A, 6, maintenant))?.horaires, "NOUVEAU");
});
