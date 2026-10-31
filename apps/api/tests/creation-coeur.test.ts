import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";

/**
 * Le cœur de création du SITE (`apps/web/src/lib/commande/creation-coeur.ts`), exécuté pour de vrai avec ses cinq dépendances remplacées par de faux
 * modules : c'est lui, et non la route, qui décide de planifier l'alerte du restaurant (`options.apres`) et seulement pour une commande NOUVELLE.
 * Sans ce test, l'appel à `apres` pouvait disparaître (ou partir aussi sur un rejeu idempotent) sans qu'aucun test ne casse (réserve de la Tâche 1).
 *
 * Le fichier est assemblé par esbuild (alias `@/` résolus par le tsconfig de l'API) ; aucune base, aucun réseau, aucun secret.
 */

const racineApi = fileURLToPath(new URL("..", import.meta.url));
const COEUR = join(racineApi, "..", "web", "src", "lib", "commande", "creation-coeur.ts");

/** État partagé entre le test et les faux modules (ils délèguent tous à `globalThis.__fauxCoeur`). */
interface Faux {
  appels: string[];
  creerCommande(valeurs: unknown, utilisateurId: string | null, ErreurMetier: new (code: string, message: string) => Error): Promise<{ reference: string; jeton: string; idempotent: boolean }>;
  notifierRestaurant(restaurantId: string): Promise<void>;
}
const g = globalThis as unknown as { __fauxCoeur: Faux };

/** Faux modules : le chemin importé par le cœur → le code qui le remplace. `ErreurMetier` vient du vrai contrat, assemblé dans le même paquet. */
const FAUX: Record<string, string> = {
  "server-only": "export {};",
  "@/lib/securite/limitation-debit": `export async function limiterCreationCommande(r, t, o) { globalThis.__fauxCoeur.appels.push("limiter"); }`,
  "@/lib/securite/turnstile": `export async function verifierAntiRobot() { globalThis.__fauxCoeur.appels.push("antiRobot"); }`,
  "@/lib/table/cle": `export function cleDeTableValide() { return false; }`,
  "@/lib/push/envoi": `export async function notifierRestaurant(id) { globalThis.__fauxCoeur.appels.push("notifier"); return globalThis.__fauxCoeur.notifierRestaurant(id); }`,
  "./creation": `import { ErreurMetier } from "@/lib/contracts/erreurs";
    export async function creerCommande(v, u) { globalThis.__fauxCoeur.appels.push("creer"); return globalThis.__fauxCoeur.creerCommande(v, u, ErreurMetier); }`,
};

const fauxModules: Plugin = {
  name: "faux-modules",
  setup(b) {
    const filtre = new RegExp(`^(${Object.keys(FAUX).map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: filtre }, (args) => ({ path: args.path, namespace: "faux" }));
    b.onLoad({ filter: /.*/, namespace: "faux" }, (args) => ({ contents: FAUX[args.path], loader: "js", resolveDir: join(racineApi, "src") }));
  },
};

type Coeur = (valeurs: unknown, utilisateurId: string | null, options: { antiRobot: boolean; apres: (t: () => Promise<void>) => void }) => Promise<unknown>;
let executerCreationCoeur: Coeur;
let dossier: string;

before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-coeur-"));
  const sortie = join(dossier, "coeur.mjs");
  await build({
    entryPoints: [COEUR],
    outfile: sortie,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    tsconfig: join(racineApi, "tsconfig.json"),
    plugins: [fauxModules],
    logLevel: "error",
  });
  ({ executerCreationCoeur } = await import(pathToFileURL(sortie).href));
});

after(() => { rmSync(dossier, { recursive: true, force: true }); });

const VALEURS = { restaurantId: "resto-1", mode: "retrait", client: { telephone: "+224620000777" }, jetonVerification: "turnstile-ignore" };

function preparer(creer: Faux["creerCommande"], notifier: Faux["notifierRestaurant"] = async () => {}) {
  g.__fauxCoeur = { appels: [], creerCommande: creer, notifierRestaurant: notifier };
  const planifiees: (() => Promise<void>)[] = [];
  return { apres: (t: () => Promise<void>) => { g.__fauxCoeur.appels.push("apres"); planifiees.push(t); }, planifiees };
}

test("cœur : commande NOUVELLE, l'alerte du restaurant est planifiée par `apres` (une fois), sans être exécutée avant la réponse", async () => {
  const notifies: string[] = [];
  const { apres, planifiees } = preparer(async () => ({ reference: "SF-1", jeton: "J".repeat(40), idempotent: false }), async (id) => { notifies.push(id); });
  const resultat = await executerCreationCoeur(VALEURS, "compte-1", { antiRobot: false, apres });
  assert.deepEqual(resultat, { ok: true, reference: "SF-1", jeton: "J".repeat(40), idempotent: false });
  assert.deepEqual(g.__fauxCoeur.appels, ["limiter", "creer", "apres"], "anti-robot jamais appelé avec antiRobot:false ; apres après la création");
  assert.equal(planifiees.length, 1);
  assert.deepEqual(notifies, [], "l'alerte ne part qu'au moment où la tâche planifiée s'exécute");
  await planifiees[0]();
  assert.deepEqual(notifies, ["resto-1"]);
});

test("cœur : REJEU idempotent, aucune tâche planifiée (pas de seconde alerte au restaurant)", async () => {
  const { apres, planifiees } = preparer(async () => ({ reference: "SF-1", jeton: "J".repeat(40), idempotent: true }));
  const resultat = await executerCreationCoeur(VALEURS, "compte-1", { antiRobot: false, apres });
  assert.deepEqual(resultat, { ok: true, reference: "SF-1", jeton: "J".repeat(40), idempotent: true });
  assert.equal(planifiees.length, 0);
  assert.ok(!g.__fauxCoeur.appels.includes("apres") && !g.__fauxCoeur.appels.includes("notifier"));
});

test("cœur : la tâche planifiée avale une panne de l'alerte (ne lève jamais) et ne journalise que « push_indisponible »", async () => {
  const { apres, planifiees } = preparer(async () => ({ reference: "SF-1", jeton: "J".repeat(40), idempotent: false }), async () => { throw new Error("fcm resto-1 +224620000777"); });
  await executerCreationCoeur(VALEURS, "compte-1", { antiRobot: false, apres });
  const lignes: string[] = [];
  const origine = console.error;
  console.error = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  try {
    await planifiees[0]();
  } finally { console.error = origine; }
  assert.deepEqual(lignes, ["push_indisponible"]);
});

test("cœur : création refusée (ErreurMetier), erreur au contrat et AUCUNE tâche planifiée", async () => {
  const { apres, planifiees } = preparer(async (_v, _u, ErreurMetier) => { throw new ErreurMetier("CONFLIT_ETAT", "Ce restaurant est fermé."); });
  const resultat = await executerCreationCoeur(VALEURS, "compte-1", { antiRobot: false, apres });
  // Comparaison sur la forme JSON (celle qui part sur le réseau) : `toApi()` pose `champs: undefined`, absent une fois sérialisé.
  assert.deepEqual(JSON.parse(JSON.stringify(resultat)), { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Ce restaurant est fermé." } });
  assert.equal(planifiees.length, 0);
});

test("cœur : l'identifiant de compte reçu est transmis tel quel à creerCommande", async () => {
  let recu: unknown;
  const { apres } = preparer(async (_v, u) => { recu = u; return { reference: "SF-1", jeton: "J".repeat(40), idempotent: false }; });
  await executerCreationCoeur(VALEURS, "compte-1", { antiRobot: false, apres });
  assert.equal(recu, "compte-1");
});
