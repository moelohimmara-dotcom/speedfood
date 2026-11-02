import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";

/**
 * Verrou de l'ORDRE des opérations de `creerCommande` (apps/web/src/lib/commande/creation.ts) : le rejeu par clé d'idempotence est traité AVANT le recalcul
 * des prix et des frais. L'application mobile en dépend : un 409 « prix » ou « frais » PROUVE qu'aucune commande n'existe pour cette clé, donc elle abandonne
 * la clé et en génère une nouvelle. Si un refactor plaçait le contrôle des prix avant la recherche de rejeu, une commande déjà créée dont un prix a changé
 * répondrait 409 au lieu de 200 : l'application referait une commande avec une nouvelle clé = DOUBLON silencieux.
 *
 * Le vrai `creation.ts` est exécuté avec ses dépendances remplacées. Limite assumée : la commande « déjà créée » est une ligne placée d'avance dans la fausse
 * table `orders` (l'insertion elle-même n'est pas exécutée, elle exige une vraie base) ; le test couvre exactement la chose qui compte : rejeu + prix modifié.
 */
const racineApi = fileURLToPath(new URL("..", import.meta.url));
const CREATION = join(racineApi, "..", "web", "src", "lib", "commande", "creation.ts");

interface Faux { commandes: Record<string, unknown>[]; recalculs: number; verifications: number; estimations: number; sousTotalServeur: number }
const g = globalThis as unknown as { __fauxCreation: Faux };

const FAUX: Record<string, string> = {
  "server-only": "export {};",
  "@/lib/db/admin": `export function creerClientAdmin() {
    const f = globalThis.__fauxCreation;
    return { from(table) {
      const filtres = {};
      const q = { select() { return q; }, eq(k, v) { filtres[k] = v; return q; },
        async maybeSingle() { if (table !== "orders") return { data: null }; return { data: f.commandes.find((c) => Object.entries(filtres).every(([k, v]) => c[k] === v)) ?? null }; } };
      return q;
    } };
  }`,
  "@/lib/fonctionnalites/lire": `export async function fonctionnaliteActive() { return true; }`,
  "./calculs": `export async function verifierRestaurantCommandable() { globalThis.__fauxCreation.verifications++; }
    export async function recalculerLignes() { const f = globalThis.__fauxCreation; f.recalculs++; return { lignes: [], sousTotal: f.sousTotalServeur }; }`,
  "./jetons": `export function genererJetonSuivi(cle) { return "J".repeat(40); } export function genererReference() { return "SF-X"; } export function estJetonValide() { return true; }`,
  "./transitions": `export async function appliquerTransitionStatut() {} export async function enregistrerEvenementStatut() {}`,
  "@/lib/livraison/lecture": `export function clientLivraison() { return {}; } export async function estimerLivraison() { globalThis.__fauxCreation.estimations++; return { statut: "ok", fraisGnf: 9999, distanceKm: 1, gratuite: false, arrivee: null }; }`,
  "@/lib/table/regles": `export const estReglageValidation = () => true; export const estServiceTable = () => true; export const prochainNumeroAppel = () => 1; export const validationRequise = () => false;`,
  "@/lib/table/cle": `export function cleDeTableValide() { return false; }`,
  "@/lib/table/service": `export async function ouvrirOuRejoindreSession() { return null; }`,
};
const fauxModules: Plugin = {
  name: "faux-modules",
  setup(b) {
    const filtre = new RegExp(`^(${Object.keys(FAUX).map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: filtre }, (args) => ({ path: args.path, namespace: "faux" }));
    b.onLoad({ filter: /.*/, namespace: "faux" }, (args) => ({ contents: FAUX[args.path], loader: "js", resolveDir: join(racineApi, "src") }));
  },
};

type Creer = (payload: unknown, utilisateurId: string | null, options?: unknown) => Promise<{ reference: string; jeton: string; idempotent: boolean }>;
let creerCommande: Creer;
let dossier: string;
before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-creation-"));
  const sortie = join(dossier, "creation.mjs");
  await build({ entryPoints: [CREATION], outfile: sortie, bundle: true, format: "esm", platform: "node", target: "es2022", tsconfig: join(racineApi, "tsconfig.json"), plugins: [fauxModules], logLevel: "error" });
  ({ creerCommande } = await import(pathToFileURL(sortie).href));
});
after(() => { rmSync(dossier, { recursive: true, force: true }); });

const JETON = "J".repeat(40);
const payload = (extra: object = {}) => ({
  cleIdempotence: "00000000-0000-4000-8000-000000000001", restaurantId: "resto-1", mode: "livraison", client: { nom: "Mariama", telephone: "+224622123456", adresse: "Rue KA 012" },
  lignes: [{ menuItemId: "p1", quantite: 1, optionIds: [] }], sousTotalAffiche: 25000, consentementReglement: true, destination: { quartierId: "q1" }, fraisAffiches: 8000, ...extra,
});

test("création : REJEU d'une commande existante dont le prix a changé depuis = 200 idempotent, sans recalcul des prix ni des frais (jamais 409)", async () => {
  g.__fauxCreation = { commandes: [{ id: "o1", reference: "SF-1", jeton_suivi: JETON, restaurant_id: "resto-1", client_user_id: "compte-1", est_test: false }], recalculs: 0, verifications: 0, estimations: 0, sousTotalServeur: 30000 /* prix changé : 25 000 -> 30 000 */ };
  const r = await creerCommande(payload(), "compte-1");
  assert.deepEqual(r, { id: "o1", reference: "SF-1", jeton: JETON, idempotent: true, estTest: false });
  assert.equal(g.__fauxCreation.recalculs, 0, "le recalcul des prix ne doit pas être atteint pour un rejeu");
  assert.equal(g.__fauxCreation.estimations, 0, "l'estimation des frais ne doit pas être atteinte pour un rejeu");
  assert.equal(g.__fauxCreation.verifications, 0);
});

test("création : SANS commande existante pour la clé, un prix changé donne bien 409 CONFLIT_ETAT (le cas que l'application traite comme « rien n'a été créé »)", async () => {
  g.__fauxCreation = { commandes: [], recalculs: 0, verifications: 0, estimations: 0, sousTotalServeur: 30000 };
  await assert.rejects(creerCommande(payload(), "compte-1"), (e: unknown) => (e as { code?: string }).code === "CONFLIT_ETAT" && (e as { champs?: Record<string, string> }).champs?.sousTotalServeur === "30000");
  assert.equal(g.__fauxCreation.recalculs, 1);
});
