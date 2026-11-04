import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";

/**
 * Cloisonnement des ÉCRITURES du menu (lot D4b), avec les VRAIS services du site `creerPlat`, `modifierPlat`, `archiverPlat`, `ajouterOption`, `retirerOption`
 * (apps/web/src/lib/menu/service-menu.ts). Seuls les accès lourds sont remplacés (`server-only`, les paramètres globaux). Le client de la base est un faux qui sert les lignes de
 * `menu_items`, `menu_sections` et `menu_item_options` (avec la jointure du supplément vers son plat) et note chaque écriture avec ses colonnes et ses filtres.
 *
 * Garantie visée : ni l'identifiant d'un plat, ni celui d'un supplément, ni celui d'une section reçus du réseau ne sont une autorisation. Le compte du restaurant A ne peut ni modifier, ni
 * archiver, ni compléter un plat de B, ni retirer un supplément de B ; le plat créé appartient à A ; seules les colonnes prévues sont écrites ; rien n'est jamais supprimé en base (sauf un supplément).
 */
const racineApi = fileURLToPath(new URL("..", import.meta.url));
const SERVICE = join(racineApi, "..", "web", "src", "lib", "menu", "service-menu.ts");

type Ligne = Record<string, unknown>;
interface Ecriture { table: string; op: "insert" | "update" | "delete"; valeurs: Ligne; filtres: Array<[string, string, unknown]> }
interface Faux { tables: Record<string, Ligne[]>; ecritures: Ecriture[] }
const g = globalThis as unknown as { __fauxEcr: Faux; __creerDbEcr: () => unknown };

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
interface BrutPlat { nom?: unknown; description?: unknown; prix?: unknown; prixPromo?: unknown; sectionId?: unknown }
let creerPlat: (db: unknown, restaurantId: string, brut: BrutPlat) => Promise<ResultatMenu>;
let modifierPlat: (db: unknown, restaurantId: string, id: unknown, brut: BrutPlat) => Promise<ResultatMenu>;
let archiverPlat: (db: unknown, restaurantId: string, id: unknown) => Promise<ResultatMenu>;
let ajouterOption: (db: unknown, restaurantId: string, platId: unknown, brut: { nom?: unknown; prix?: unknown }) => Promise<ResultatMenu>;
let retirerOption: (db: unknown, restaurantId: string, optionId: unknown) => Promise<ResultatMenu>;
let dossier: string;

let compteur = 0;
g.__creerDbEcr = () => ({
  from(table: string) {
    const q: { op: "select" | "insert" | "update" | "delete"; valeurs: Ligne; filtres: Array<[string, string, unknown]>; colonnes: string } = { op: "select", valeurs: {}, filtres: [], colonnes: "" };
    const lignes = () => (g.__fauxEcr.tables[table] ?? []).filter((r) => q.filtres.every(([op, c, v]) => (op === "eq" ? r[c] === v : (r[c] ?? null) === v)));
    const fin = (unique: boolean) => {
      if (q.op === "insert") {
        g.__fauxEcr.ecritures.push({ table, op: "insert", valeurs: q.valeurs, filtres: [] });
        (g.__fauxEcr.tables[table] ??= []).push({ id: `00000000-0000-4000-8000-${String(++compteur).padStart(12, "0")}`, ...q.valeurs });
        return { data: null, error: null };
      }
      if (q.op === "update") {
        g.__fauxEcr.ecritures.push({ table, op: "update", valeurs: q.valeurs, filtres: q.filtres });
        const touchees = lignes();
        for (const l of touchees) Object.assign(l, q.valeurs);
        return { data: touchees.map((l) => ({ id: l.id })), error: null };
      }
      if (q.op === "delete") {
        g.__fauxEcr.ecritures.push({ table, op: "delete", valeurs: {}, filtres: q.filtres });
        const supprimees = lignes();
        g.__fauxEcr.tables[table] = (g.__fauxEcr.tables[table] ?? []).filter((r) => !supprimees.includes(r));
        return { data: null, error: null };
      }
      let l = lignes();
      // Jointure du supplément vers son plat : `select("id, menu_items(restaurant_id)")`.
      if (table === "menu_item_options" && q.colonnes.includes("menu_items(")) {
        l = l.map((o) => ({ ...o, menu_items: (g.__fauxEcr.tables.menu_items ?? []).filter((p) => p.id === o.menu_item_id).map((p) => ({ restaurant_id: p.restaurant_id }))[0] ?? null }));
      }
      return { data: unique ? (l[0] ?? null) : l, error: null };
    };
    const chaine: Record<string, unknown> = {
      select: (colonnes?: string) => { if (q.op === "select") q.colonnes = colonnes ?? ""; return chaine; },
      eq: (c: string, v: unknown) => { q.filtres.push(["eq", c, v]); return chaine; },
      is: (c: string, v: unknown) => { q.filtres.push(["is", c, v]); return chaine; },
      order: () => chaine,
      limit: () => chaine,
      insert: (v: Ligne) => { q.op = "insert"; q.valeurs = v; return chaine; },
      update: (v: Ligne) => { q.op = "update"; q.valeurs = v; return chaine; },
      delete: () => { q.op = "delete"; return chaine; },
      maybeSingle: async () => fin(true),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(fin(false)).then(ok, ko),
    };
    return chaine;
  },
});

before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-menu-ecr-"));
  const sortie = join(dossier, "service-menu.mjs");
  await build({ entryPoints: [SERVICE], outfile: sortie, bundle: true, format: "esm", platform: "node", target: "es2022", tsconfig: join(racineApi, "tsconfig.json"), plugins: [fauxModules], logLevel: "error" });
  ({ creerPlat, modifierPlat, archiverPlat, ajouterOption, retirerOption } = await import(pathToFileURL(sortie).href));
});
after(() => { rmSync(dossier, { recursive: true, force: true }); });

const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const RESTAURANT_B = "22222222-2222-4222-8222-222222222222";
const PLAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAT_A_ARCHIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const PLAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OPTION_A = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const OPTION_B = "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0";
const SECTION_A = "55555555-5555-4555-8555-555555555555";
const SECTION_B = "66666666-6666-4666-8666-666666666666";
const INCONNU = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const db = () => g.__creerDbEcr();

const plat = (id: string, restaurant: string, surcharge: Ligne = {}): Ligne => ({
  id, restaurant_id: restaurant, nom: "Plat " + id.slice(-2), description: "ancienne description", prix: 45000, prix_promo: null, disponible: true, disponibilite_confirmee_le: "2026-11-01T08:00:00.000Z",
  section_id: null, photo_url: "https://exemple.test/photo.jpg", archive_le: null, cree_le: "2026-10-01T00:00:00.000Z", ...surcharge,
});
const ligne = (table: string, id: string) => g.__fauxEcr.tables[table].find((p) => p.id === id) as Ligne | undefined;
const ecrituresDe = (table: string, op?: string) => g.__fauxEcr.ecritures.filter((e) => e.table === table && (op === undefined || e.op === op));
const filtre = (e: Ecriture, colonne: string) => e.filtres.find(([, c]) => c === colonne)?.[2];

beforeEach(() => {
  compteur = 0;
  g.__fauxEcr = {
    tables: {
      menu_items: [plat(PLAT_A, RESTAURANT_A), plat(PLAT_A_ARCHIVE, RESTAURANT_A, { archive_le: "2026-10-10T00:00:00Z" }), plat(PLAT_B, RESTAURANT_B)],
      menu_sections: [{ id: SECTION_A, restaurant_id: RESTAURANT_A, nom: "Plats", position: 1 }, { id: SECTION_B, restaurant_id: RESTAURANT_B, nom: "Autre", position: 1 }],
      menu_item_options: [{ id: OPTION_A, menu_item_id: PLAT_A, nom: "Sauce", prix: 1000, disponible: true }, { id: OPTION_B, menu_item_id: PLAT_B, nom: "Piment", prix: 500, disponible: true }],
    },
    ecritures: [],
  };
});

const VALIDE = { nom: "  Poulet braisé  ", description: " Avec frites ", prix: 45000, prixPromo: null, sectionId: SECTION_A };

// ---------- créer ----------
test("creer : le plat appartient au restaurant du COMPTE ; seules les colonnes prévues sont écrites ; un restaurant (ou toute autre clé) du corps est ignoré", async () => {
  const brut = { ...VALIDE, restaurantId: RESTAURANT_B, restaurant_id: RESTAURANT_B, id: PLAT_B, archive_le: "2026-01-01", disponible: false, photo_url: "x", cree_le: "2020-01-01" };
  assert.deepEqual(await creerPlat(db(), RESTAURANT_A, brut), { ok: true });
  const [e] = ecrituresDe("menu_items", "insert");
  assert.deepEqual(Object.keys(e.valeurs).sort(), ["description", "nom", "prix", "prix_promo", "restaurant_id", "section_id"]);
  assert.equal(e.valeurs.restaurant_id, RESTAURANT_A);
  assert.deepEqual({ nom: e.valeurs.nom, description: e.valeurs.description, prix: e.valeurs.prix, section_id: e.valeurs.section_id }, { nom: "Poulet braisé", description: "Avec frites", prix: 45000, section_id: SECTION_A });
  assert.equal(g.__fauxEcr.tables.menu_items.length, 4);
  assert.equal(g.__fauxEcr.tables.menu_items.filter((p) => p.restaurant_id === RESTAURANT_B).length, 1, "rien n'est créé chez B");
});

test("creer : une section d'un AUTRE restaurant est refusée (« Section introuvable. ») et rien n'est écrit", async () => {
  assert.deepEqual(await creerPlat(db(), RESTAURANT_A, { ...VALIDE, sectionId: SECTION_B }), { ok: false, message: "Section introuvable." });
  assert.deepEqual(await creerPlat(db(), RESTAURANT_A, { ...VALIDE, sectionId: INCONNU }), { ok: false, message: "Section introuvable." });
  assert.deepEqual(ecrituresDe("menu_items"), []);
});

test("creer : le service refuse aussi, lui-même, un prix négatif, décimal ou au-dessus du réglage en vigueur, un nom vide ou trop long (aucune écriture)", async () => {
  for (const surcharge of [{ prix: -1 }, { prix: 10.5 }, { prix: 5_000_001 }, { prix: "45000" }, { prix: Number.NaN }, { prix: Infinity }, { nom: "" }, { nom: "x".repeat(121) }, { description: "x".repeat(501) }, { prixPromo: 50000 }]) {
    assert.equal((await creerPlat(db(), RESTAURANT_A, { ...VALIDE, ...surcharge })).ok, false, JSON.stringify(surcharge));
  }
  assert.deepEqual(ecrituresDe("menu_items"), []);
});

// ---------- modifier ----------
test("modifier : SON plat est modifié (colonnes prévues seulement), filtré sur le plat ET sur le restaurant du compte, non archivé", async () => {
  assert.deepEqual(await modifierPlat(db(), RESTAURANT_A, PLAT_A, { ...VALIDE, nom: "Poulet", prix: 50000, restaurantId: RESTAURANT_B, disponible: false, archive_le: "x" } as BrutPlat), { ok: true });
  const [e] = ecrituresDe("menu_items", "update");
  assert.deepEqual(Object.keys(e.valeurs).sort(), ["description", "nom", "prix", "prix_promo", "section_id"]);
  assert.equal(filtre(e, "id"), PLAT_A);
  assert.equal(filtre(e, "restaurant_id"), RESTAURANT_A);
  assert.ok(e.filtres.some(([op, c, v]) => op === "is" && c === "archive_le" && v === null));
  assert.equal(ligne("menu_items", PLAT_A)?.prix, 50000);
  assert.equal(ligne("menu_items", PLAT_A)?.restaurant_id, RESTAURANT_A);
  assert.equal(ligne("menu_items", PLAT_A)?.disponible, true, "la disponibilité n'est pas touchée par une modification");
  assert.equal(ligne("menu_items", PLAT_A)?.photo_url, "https://exemple.test/photo.jpg", "la photo n'est pas touchée");
});

test("CLOISONNEMENT modifier : le compte de A ne peut pas modifier un plat de B (« Plat introuvable. »), le plat de B ne bouge pas ; la réciproque aussi", async () => {
  const avant = JSON.stringify(ligne("menu_items", PLAT_B));
  assert.deepEqual(await modifierPlat(db(), RESTAURANT_A, PLAT_B, { ...VALIDE, nom: "Piraté", prix: 1 }), { ok: false, message: "Plat introuvable." });
  assert.equal(JSON.stringify(ligne("menu_items", PLAT_B)), avant);
  assert.ok(ecrituresDe("menu_items", "update").every((e) => filtre(e, "restaurant_id") === RESTAURANT_A), "toute écriture est filtrée sur le restaurant du compte");
  const avantA = JSON.stringify(ligne("menu_items", PLAT_A));
  assert.equal((await modifierPlat(db(), RESTAURANT_B, PLAT_A, VALIDE)).ok, false);
  assert.equal(JSON.stringify(ligne("menu_items", PLAT_A)), avantA);
});

test("modifier : un plat inconnu ou archivé est « introuvable » ; une section d'un autre restaurant est refusée avant l'écriture ; un identifiant invalide aussi", async () => {
  for (const id of [INCONNU, PLAT_A_ARCHIVE]) assert.deepEqual(await modifierPlat(db(), RESTAURANT_A, id, VALIDE), { ok: false, message: "Plat introuvable." }, id);
  assert.deepEqual(await modifierPlat(db(), RESTAURANT_A, PLAT_A, { ...VALIDE, sectionId: SECTION_B }), { ok: false, message: "Section introuvable." });
  for (const id of [undefined, null, 12, "", "abc", PLAT_A + "0", ["x"], { a: 1 }]) assert.equal((await modifierPlat(db(), RESTAURANT_A, id, VALIDE)).ok, false, JSON.stringify(id));
  assert.equal(ligne("menu_items", PLAT_A)?.nom, "Plat aa", "aucune modification partielle");
  assert.equal(ligne("menu_items", PLAT_A_ARCHIVE)?.archive_le, "2026-10-10T00:00:00Z");
});

test("modifier ≠ creer : modifier n'insère jamais de ligne et creer ne modifie jamais une ligne existante", async () => {
  await modifierPlat(db(), RESTAURANT_A, PLAT_A, VALIDE);
  assert.deepEqual(ecrituresDe("menu_items", "insert"), []);
  assert.equal(g.__fauxEcr.tables.menu_items.length, 3);
  await creerPlat(db(), RESTAURANT_A, VALIDE);
  assert.equal(ecrituresDe("menu_items", "update").length, 1, "seule la modification a écrit un update");
  assert.equal(g.__fauxEcr.tables.menu_items.length, 4);
});

// ---------- archiver ----------
test("archiver : SON plat est archivé (colonne `archive_le` seule, jamais supprimé), filtré sur le plat ET sur le restaurant du compte", async () => {
  assert.deepEqual(await archiverPlat(db(), RESTAURANT_A, PLAT_A), { ok: true });
  const [e] = ecrituresDe("menu_items");
  assert.equal(e.op, "update");
  assert.deepEqual(Object.keys(e.valeurs), ["archive_le"]);
  assert.equal(filtre(e, "id"), PLAT_A);
  assert.equal(filtre(e, "restaurant_id"), RESTAURANT_A);
  assert.ok(typeof ligne("menu_items", PLAT_A)?.archive_le === "string", "archivé");
  assert.ok(ligne("menu_items", PLAT_A), "la ligne existe toujours en base");
  assert.deepEqual(ecrituresDe("menu_items", "delete"), []);
});

test("CLOISONNEMENT archiver : le compte de A ne peut pas archiver un plat de B (« Plat introuvable. ») ni un plat inconnu ; le plat de B reste vendu", async () => {
  for (const id of [PLAT_B, INCONNU]) assert.deepEqual(await archiverPlat(db(), RESTAURANT_A, id), { ok: false, message: "Plat introuvable." }, id);
  assert.equal(ligne("menu_items", PLAT_B)?.archive_le, null);
  assert.ok(ecrituresDe("menu_items").every((e) => filtre(e, "restaurant_id") === RESTAURANT_A));
  assert.equal((await archiverPlat(db(), RESTAURANT_B, PLAT_A)).ok, false);
  assert.equal(ligne("menu_items", PLAT_A)?.archive_le, null);
  for (const id of [undefined, null, 12, "", "abc", PLAT_A + "0", ["x"]]) assert.equal((await archiverPlat(db(), RESTAURANT_A, id)).ok, false, JSON.stringify(id));
});

// ---------- suppléments ----------
test("option_ajouter : sur SON plat non archivé ; seules les colonnes `menu_item_id`, `nom`, `prix` sont écrites", async () => {
  assert.deepEqual(await ajouterOption(db(), RESTAURANT_A, PLAT_A, { nom: "  Sauce piquante ", prix: 2000, restaurantId: RESTAURANT_B, disponible: false, id: OPTION_B } as { nom?: unknown; prix?: unknown }), { ok: true });
  const [e] = ecrituresDe("menu_item_options", "insert");
  assert.deepEqual(Object.keys(e.valeurs).sort(), ["menu_item_id", "nom", "prix"]);
  assert.deepEqual(e.valeurs, { menu_item_id: PLAT_A, nom: "Sauce piquante", prix: 2000 });
});

test("CLOISONNEMENT option_ajouter : on ne peut pas ajouter un supplément à un plat de B, à un plat archivé ou inconnu ; rien n'est inséré", async () => {
  for (const id of [PLAT_B, PLAT_A_ARCHIVE, INCONNU]) assert.deepEqual(await ajouterOption(db(), RESTAURANT_A, id, { nom: "Sauce", prix: 100 }), { ok: false, message: "Plat introuvable." }, id);
  assert.deepEqual(ecrituresDe("menu_item_options"), []);
  assert.equal(g.__fauxEcr.tables.menu_item_options.length, 2);
});

test("option_ajouter : nom vide ou trop long, prix négatif, décimal, énorme, texte, NaN refusés par le service (aucune écriture) ; identifiant de plat invalide aussi", async () => {
  for (const surcharge of [{ nom: "" }, { nom: "x".repeat(81) }, { nom: 3 }, { prix: -1 }, { prix: 1.5 }, { prix: 5_000_001 }, { prix: 1e300 }, { prix: "100" }, { prix: Number.NaN }, { prix: Infinity }]) {
    assert.equal((await ajouterOption(db(), RESTAURANT_A, PLAT_A, { nom: "Sauce", prix: 100, ...surcharge })).ok, false, JSON.stringify(surcharge));
  }
  for (const id of [undefined, null, 12, "", "abc", ["x"]]) assert.equal((await ajouterOption(db(), RESTAURANT_A, id, { nom: "Sauce", prix: 100 })).ok, false, JSON.stringify(id));
  assert.deepEqual(ecrituresDe("menu_item_options"), []);
});

test("option_retirer : SON supplément est supprimé, filtré sur l'identifiant du supplément ; l'autre supplément reste", async () => {
  assert.deepEqual(await retirerOption(db(), RESTAURANT_A, OPTION_A), { ok: true });
  const [e] = ecrituresDe("menu_item_options", "delete");
  assert.equal(filtre(e, "id"), OPTION_A);
  assert.equal(ligne("menu_item_options", OPTION_A), undefined);
  assert.ok(ligne("menu_item_options", OPTION_B), "le supplément de B est intact");
  assert.deepEqual(ecrituresDe("menu_items"), [], "aucun plat n'est touché");
});

test("CLOISONNEMENT option_retirer : le compte de A ne peut pas retirer un supplément de B (ni un supplément inconnu) ; aucune suppression n'est émise", async () => {
  for (const id of [OPTION_B, INCONNU]) assert.deepEqual(await retirerOption(db(), RESTAURANT_A, id), { ok: false, message: "Supplément introuvable." }, id);
  assert.ok(ligne("menu_item_options", OPTION_B), "le supplément de B est intact");
  assert.deepEqual(ecrituresDe("menu_item_options", "delete"), []);
  // Réciproque : B ne peut pas retirer le supplément de A.
  assert.equal((await retirerOption(db(), RESTAURANT_B, OPTION_A)).ok, false);
  assert.ok(ligne("menu_item_options", OPTION_A));
  for (const id of [undefined, null, 12, "", "abc", OPTION_A + "0", ["x"]]) assert.equal((await retirerOption(db(), RESTAURANT_A, id)).ok, false, JSON.stringify(id));
  assert.equal(g.__fauxEcr.tables.menu_item_options.length, 2);
});

test("un identifiant de plat n'est pas un identifiant de supplément : retirerOption(plat) échoue, ajouterOption(supplément) échoue", async () => {
  assert.equal((await retirerOption(db(), RESTAURANT_A, PLAT_A)).ok, false);
  assert.equal((await ajouterOption(db(), RESTAURANT_A, OPTION_A, { nom: "x", prix: 1 })).ok, false);
  assert.deepEqual(ecrituresDe("menu_item_options"), []);
});
