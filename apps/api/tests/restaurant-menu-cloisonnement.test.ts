import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";

/**
 * Cloisonnement du MENU (lot D4a), avec les VRAIS services du site `lireMenu`, `basculerDisponibilite`, `confirmerDisponibilite`, `confirmerToutesDisponibilites`
 * (apps/web/src/lib/menu/service-menu.ts). Seuls les accès lourds sont remplacés (`server-only`, les paramètres globaux). Le client de la base est un faux qui sert les lignes
 * de `menu_items` / `menu_sections` filtrées et note chaque écriture avec ses colonnes et ses filtres.
 *
 * Garantie visée : l'identifiant de plat reçu du réseau n'est JAMAIS une autorisation. Le compte du restaurant A ne peut ni retirer de la vente, ni remettre en vente, ni
 * confirmer un plat du restaurant B, et « tout confirmer » ne touche que les plats de A.
 */
const racineApi = fileURLToPath(new URL("..", import.meta.url));
const SERVICE = join(racineApi, "..", "web", "src", "lib", "menu", "service-menu.ts");

type Ligne = Record<string, unknown>;
interface Ecriture { table: string; valeurs: Ligne; filtres: Array<[string, string, unknown]> }
interface Faux { tables: Record<string, Ligne[]>; ecritures: Ecriture[] }
const g = globalThis as unknown as { __fauxMenu: Faux; __creerDbMenu: () => unknown };

const FAUX: Record<string, string> = {
  "server-only": "export {};",
  "@/lib/parametres/lire": `export async function obtenirParametresApplication() { return { commandePropositionDelaiMinutes: 30, prixPlatMaxGnf: 5000000, disponibiliteFraicheurHeures: 6 }; }`,
};
const fauxModules: Plugin = {
  name: "faux-modules",
  setup(b) {
    const filtre = new RegExp(`^(${Object.keys(FAUX).map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: filtre }, (args) => ({ path: args.path, namespace: "faux" }));
    b.onLoad({ filter: /.*/, namespace: "faux" }, (args) => ({ contents: FAUX[args.path], loader: "js", resolveDir: join(racineApi, "src") }));
  },
};

type ResultatMenu = { ok: true } | { ok: false; message: string };
let lireMenu: (db: unknown, restaurantId: string) => Promise<{ sections: Array<{ id: string; nom: string }>; plats: Array<Ligne> }>;
let basculerDisponibilite: (db: unknown, restaurantId: string, id: unknown, disponible: unknown) => Promise<ResultatMenu>;
let confirmerDisponibilite: (db: unknown, restaurantId: string, id: unknown) => Promise<ResultatMenu>;
let confirmerToutesDisponibilites: (db: unknown, restaurantId: string) => Promise<ResultatMenu>;
let dossier: string;

g.__creerDbMenu = () => ({
  from(table: string) {
    const q: { op: "select" | "update"; valeurs: Ligne; filtres: Array<[string, string, unknown]> } = { op: "select", valeurs: {}, filtres: [] };
    const lignes = () => (g.__fauxMenu.tables[table] ?? []).filter((r) => q.filtres.every(([op, c, v]) => (op === "eq" ? r[c] === v : (r[c] ?? null) === v)));
    const fin = (unique: boolean) => {
      if (q.op === "update") {
        g.__fauxMenu.ecritures.push({ table, valeurs: q.valeurs, filtres: q.filtres });
        const touchees = lignes();
        for (const l of touchees) Object.assign(l, q.valeurs);
        return { data: touchees.map((l) => ({ id: l.id })), error: null };
      }
      const l = lignes();
      return { data: unique ? (l[0] ?? null) : l, error: null };
    };
    const chaine: Record<string, unknown> = {
      select: () => chaine,
      eq: (c: string, v: unknown) => { q.filtres.push(["eq", c, v]); return chaine; },
      is: (c: string, v: unknown) => { q.filtres.push(["is", c, v]); return chaine; },
      order: () => chaine,
      limit: () => chaine,
      update: (v: Ligne) => { q.op = "update"; q.valeurs = v; return chaine; },
      maybeSingle: async () => fin(true),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(fin(false)).then(ok, ko),
    };
    return chaine;
  },
});

before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-menu-"));
  const sortie = join(dossier, "service-menu.mjs");
  await build({ entryPoints: [SERVICE], outfile: sortie, bundle: true, format: "esm", platform: "node", target: "es2022", tsconfig: join(racineApi, "tsconfig.json"), plugins: [fauxModules], logLevel: "error" });
  ({ lireMenu, basculerDisponibilite, confirmerDisponibilite, confirmerToutesDisponibilites } = await import(pathToFileURL(sortie).href));
});
after(() => { rmSync(dossier, { recursive: true, force: true }); });

const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const PLAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAT_A2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const PLAT_A_EPUISE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const PLAT_A_ARCHIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const PLAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INCONNU = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const db = () => g.__creerDbMenu();

const plat = (id: string, restaurant: string, surcharge: Ligne = {}): Ligne => ({
  id, restaurant_id: restaurant, nom: "Plat " + id.slice(-2), description: null, prix: 45000, prix_promo: null, disponible: true, disponibilite_confirmee_le: "2026-11-01T08:00:00.000Z",
  section_id: null, photo_url: null, archive_le: null, cree_le: "2026-10-01T00:00:00.000Z", menu_item_options: [], ...surcharge,
});
const ligne = (id: string) => g.__fauxMenu.tables.menu_items.find((p) => p.id === id) as Ligne;

beforeEach(() => {
  g.__fauxMenu = {
    tables: {
      menu_items: [plat(PLAT_A, RESTAURANT_A), plat(PLAT_A2, RESTAURANT_A), plat(PLAT_A_EPUISE, RESTAURANT_A, { disponible: false }), plat(PLAT_A_ARCHIVE, RESTAURANT_A, { archive_le: "2026-10-10T00:00:00Z" }), plat(PLAT_B, RESTAURANT_B)],
      menu_sections: [{ id: "55555555-5555-4555-8555-555555555555", restaurant_id: RESTAURANT_A, nom: "Plats", position: 1 }, { id: "66666666-6666-4666-8666-666666666666", restaurant_id: RESTAURANT_B, nom: "Autre", position: 1 }],
    },
    ecritures: [],
  };
});

test("lecture : le menu de A ne contient que les plats NON archivés de A (jamais ceux de B), avec leur dernière confirmation", async () => {
  const menu = await lireMenu(db(), RESTAURANT_A);
  assert.deepEqual(menu.plats.map((p) => p.id).sort(), [PLAT_A, PLAT_A2, PLAT_A_EPUISE].sort());
  assert.deepEqual(menu.sections.map((s) => s.nom), ["Plats"]);
  assert.equal(menu.plats.find((p) => p.id === PLAT_A)?.confirmeLe, "2026-11-01T08:00:00.000Z");
});

test("disponibilité : retirer de la vente puis remettre en vente SON plat : ok, colonne `disponible` seule, filtrée sur le plat ET sur le restaurant", async () => {
  assert.deepEqual(await basculerDisponibilite(db(), RESTAURANT_A, PLAT_A, false), { ok: true });
  assert.equal(ligne(PLAT_A).disponible, false);
  assert.deepEqual(await basculerDisponibilite(db(), RESTAURANT_A, PLAT_A, true), { ok: true });
  assert.equal(ligne(PLAT_A).disponible, true);
  for (const e of g.__fauxMenu.ecritures) {
    assert.deepEqual(Object.keys(e.valeurs), ["disponible"]);
    assert.ok(e.filtres.some(([, c, v]) => c === "id" && v === PLAT_A) && e.filtres.some(([, c, v]) => c === "restaurant_id" && v === RESTAURANT_A));
  }
});

test("CLOISONNEMENT : le compte de A ne peut ni retirer ni remettre en vente un plat de B (« Plat introuvable. »), le plat de B ne bouge pas", async () => {
  for (const disponible of [false, true]) {
    const r = await basculerDisponibilite(db(), RESTAURANT_A, PLAT_B, disponible);
    assert.deepEqual(r, { ok: false, message: "Plat introuvable." }, String(disponible));
  }
  assert.equal(ligne(PLAT_B).disponible, true);
  assert.ok(g.__fauxMenu.ecritures.every((e) => e.filtres.some(([, c, v]) => c === "restaurant_id" && v === RESTAURANT_A)), "toute écriture est filtrée sur le restaurant du compte");
  // Symétrique.
  assert.equal((await basculerDisponibilite(db(), RESTAURANT_B, PLAT_A, false)).ok, false);
  assert.equal(ligne(PLAT_A).disponible, true);
});

test("CLOISONNEMENT : le compte de A ne peut pas confirmer la disponibilité d'un plat de B, ni celle d'un plat inconnu ; la confirmation de B reste intacte", async () => {
  const avant = ligne(PLAT_B).disponibilite_confirmee_le;
  for (const id of [PLAT_B, INCONNU]) {
    const r = await confirmerDisponibilite(db(), RESTAURANT_A, id);
    assert.equal(r.ok, false, id);
  }
  assert.equal(ligne(PLAT_B).disponibilite_confirmee_le, avant);
});

test("confirmer SON plat : ok, seule `disponibilite_confirmee_le` est écrite ; un plat retiré de la vente ne peut pas être confirmé", async () => {
  assert.deepEqual(await confirmerDisponibilite(db(), RESTAURANT_A, PLAT_A), { ok: true });
  assert.notEqual(ligne(PLAT_A).disponibilite_confirmee_le, "2026-11-01T08:00:00.000Z");
  assert.deepEqual(Object.keys(g.__fauxMenu.ecritures[0].valeurs), ["disponibilite_confirmee_le"]);
  const epuise = await confirmerDisponibilite(db(), RESTAURANT_A, PLAT_A_EPUISE);
  assert.equal(epuise.ok, false);
  assert.equal(ligne(PLAT_A_EPUISE).disponibilite_confirmee_le, "2026-11-01T08:00:00.000Z");
});

test("CLOISONNEMENT : « tout confirmer » de A ne touche que les plats disponibles et non archivés de A", async () => {
  const avantB = ligne(PLAT_B).disponibilite_confirmee_le;
  assert.deepEqual(await confirmerToutesDisponibilites(db(), RESTAURANT_A), { ok: true });
  assert.notEqual(ligne(PLAT_A).disponibilite_confirmee_le, "2026-11-01T08:00:00.000Z");
  assert.notEqual(ligne(PLAT_A2).disponibilite_confirmee_le, "2026-11-01T08:00:00.000Z");
  assert.equal(ligne(PLAT_A_EPUISE).disponibilite_confirmee_le, "2026-11-01T08:00:00.000Z", "un plat épuisé n'est pas reconfirmé");
  assert.equal(ligne(PLAT_A_ARCHIVE).disponibilite_confirmee_le, "2026-11-01T08:00:00.000Z", "un plat archivé n'est pas reconfirmé");
  assert.equal(ligne(PLAT_B).disponibilite_confirmee_le, avantB, "le plat de B n'est pas reconfirmé");
  assert.equal(g.__fauxMenu.ecritures.length, 1);
  assert.ok(g.__fauxMenu.ecritures[0].filtres.some(([, c, v]) => c === "restaurant_id" && v === RESTAURANT_A));
});

test("identifiant ou valeur invalide : refus « Demande invalide. » du service, aucune écriture", async () => {
  for (const id of [undefined, null, 12, "", "abc", PLAT_A + "0", ["x"], { a: 1 }]) {
    assert.equal((await basculerDisponibilite(db(), RESTAURANT_A, id, true)).ok, false, JSON.stringify(id));
    assert.equal((await confirmerDisponibilite(db(), RESTAURANT_A, id)).ok, false, JSON.stringify(id));
  }
  for (const disponible of ["true", "false", 1, 0, null, undefined, "oui"]) assert.equal((await basculerDisponibilite(db(), RESTAURANT_A, PLAT_A, disponible)).ok, false, String(disponible));
  assert.deepEqual(g.__fauxMenu.ecritures, []);
});
