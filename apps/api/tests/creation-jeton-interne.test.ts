import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";

type Fournisseur = (cle: string) => Promise<string>;
let creer: (p: { cleIdempotence: string; restaurantId: string }, u: string, o: { fournirJeton?: Fournisseur }) => Promise<{ reference: string; jeton: string; idempotent: boolean }>;
const etat = { ouvertures: 0, requetes: 0, jetonRecherche: "", existante: null as null | Record<string, unknown> };
const g = globalThis as unknown as { __essaiCreationJeton: typeof etat };
g.__essaiCreationJeton = etat;
const cle = "2bb133fc-e6f9-43b3-bbb7-20daf88d7405";
const fichierTemporaire = join(tmpdir(), `speedfood-creation-jeton-${randomUUID()}.mjs`);
let ecrit = false;
after(() => { if (ecrit) unlinkSync(fichierTemporaire); });
before(async () => {
  const noms: Record<string, string[]> = {
    "@/lib/fonctionnalites/lire": ["fonctionnaliteActive"],
    "./calculs": ["recalculerLignes", "verifierRestaurantCommandable"],
    "./transitions": ["appliquerTransitionStatut", "enregistrerEvenementStatut"],
    "@/lib/livraison/lecture": ["clientLivraison", "estimerLivraison"],
    "@/lib/table/regles": ["estReglageValidation", "estServiceTable", "prochainNumeroAppel", "validationRequise"],
    "@/lib/table/cle": ["cleDeTableValide"],
    "@/lib/table/service": ["ouvrirOuRejoindreSession"],
  };
  const resultat = await build({
    entryPoints: [fileURLToPath(new URL("../../web/src/lib/commande/creation.ts", import.meta.url))],
    write: false, bundle: true, format: "esm", platform: "node",
    tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)), logLevel: "silent",
    plugins: [{ name: "base-en-memoire", setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => (a.path === "server-only" || a.path === "@/lib/db/admin" || noms[a.path]) ? { path: a.path, namespace: "faux" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "faux" }, (a) => ({ contents:
        a.path === "server-only" ? "export {};" : a.path === "@/lib/db/admin" ? `
          export function creerClientAdmin() {
            const s=globalThis.__essaiCreationJeton; s.ouvertures++;
            return { from(nom) { s.requetes++; if(nom!=='orders') throw new Error('table inattendue');
              return { select() { return this; }, eq(nom,valeur) { if(nom==='jeton_suivi') s.jetonRecherche=valeur; return this; },
                maybeSingle() { return Promise.resolve({data:s.existante}); } };
            } };
          }` : noms[a.path].map(n => `export function ${n}() { throw new Error('chemin hors essai'); }`).join("\n"),
      }));
    } }],
  });
  writeFileSync(fichierTemporaire, resultat.outputFiles[0].text); ecrit = true;
  creer = (await import(pathToFileURL(fichierTemporaire).href)).creerCommande;
});

test("vraie création : échec du fournisseur avant toute ouverture de base", async () => {
  etat.ouvertures = 0; etat.requetes = 0;
  await assert.rejects(creer({ cleIdempotence: cle, restaurantId: "resto-a" }, "compte-a", {
    fournirJeton: async () => { throw new Error("erreur-factice"); },
  }));
  assert.equal(etat.ouvertures, 0);
  assert.equal(etat.requetes, 0);
});
test("vraie création : jeton RPC invalide refusé avant toute ouverture de base", async () => {
  etat.ouvertures = 0;
  await assert.rejects(creer({ cleIdempotence: cle, restaurantId: "resto-a" }, "compte-a", { fournirJeton: async () => "court" }));
  assert.equal(etat.ouvertures, 0);
});
test("vraie création : recherche par jeton fourni, rejeu du même compte et restaurant", async () => {
  const jeton = "x".repeat(40);
  etat.existante = { id: "id-factice", reference: "SF-ABCDE", jeton_suivi: jeton, restaurant_id: "resto-a", client_user_id: "compte-a", est_test: true };
  const r = await creer({ cleIdempotence: cle, restaurantId: "resto-a" }, "compte-a", { fournirJeton: async valeur => { assert.equal(valeur, cle); return jeton; } });
  assert.equal(etat.jetonRecherche, jeton);
  assert.equal(r.idempotent, true);
  assert.equal(r.reference, "SF-ABCDE");
  for (const [restaurantId, compte] of [["resto-b", "compte-a"], ["resto-a", "compte-b"]]) {
    await assert.rejects(creer({ cleIdempotence: cle, restaurantId }, compte, { fournirJeton: async () => jeton }));
  }
});
