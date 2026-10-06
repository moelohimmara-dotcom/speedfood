import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleCache,
  estFrais,
  estVide,
  ttlEffectif,
  lireAvecCacheInjecte,
  invaliderInjecte,
  ENTETE_STOCKE_LE,
  type CacheMinimal,
} from "../../src/lib/cms/cache-regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

/** Faux cache : stocke les réponses par URL, compte les appels, peut échouer à la demande. */
function fauxCache(echec: Partial<Record<"match" | "put" | "delete", boolean>> = {}) {
  const magasin = new Map<string, Response>();
  const appels = { match: 0, put: 0, delete: 0 };
  const cache: CacheMinimal = {
    async match(cle) {
      appels.match++;
      if (echec.match) throw new Error("match en panne");
      return magasin.get(cle)?.clone();
    },
    async put(cle, reponse) {
      appels.put++;
      if (echec.put) throw new Error("put en panne");
      magasin.set(cle, reponse);
    },
    async delete(cle) {
      appels.delete++;
      if (echec.delete) throw new Error("delete en panne");
      return magasin.delete(cle);
    },
  };
  return { cache, magasin, appels };
}

function producteurCompte<T>(valeur: T) {
  const etat = { n: 0 };
  return { etat, produire: async () => (etat.n++, valeur) };
}

// --- Clé, fraîcheur, TTL --------------------------------------------------------------------------------------------
verifier("clé simple", cleCache("bannieres"), "https://cms.cache.interne/v1/bannieres");
verifier("clé page : deux-points échappé", cleCache("page:a-propos"), "https://cms.cache.interne/v1/page%3Aa-propos");
verifier("clé échappée : / ? # espace", cleCache("a/b?c#d e"), "https://cms.cache.interne/v1/a%2Fb%3Fc%23d%20e");
verifier("clé échappée : pas de segment ajouté", new URL(cleCache("../../x")).pathname.split("/").length, 3);
verifier("fraîcheur : dans le TTL", estFrais(10_000, 0, 60), true);
verifier("fraîcheur : à la limite exacte = périmé", estFrais(60_000, 0, 60), false);
verifier("fraîcheur : après le TTL", estFrais(61_000, 0, 60), false);
verifier("fraîcheur : horodatage futur = périmé", estFrais(0, 5_000, 60), false);
verifier("fraîcheur : horodatage illisible = périmé", estFrais(0, Number("x"), 60), false);
verifier("vide : null, undefined, []", [estVide(null), estVide(undefined), estVide([])], [true, true, true]);
verifier("vide : objet, tableau non vide, 0, chaîne vide", [estVide({}), estVide([1]), estVide(0), estVide("")], [false, false, false, false]);
verifier("TTL plein", ttlEffectif({ a: 1 }, 60), 60);
verifier("TTL valeur vide plafonné à 10 s", [ttlEffectif(null, 60), ttlEffectif([], 60)], [10, 10]);
verifier("TTL valeur vide inférieur au plafond conservé", ttlEffectif(null, 5), 5);
verifier("TTL invalide : repli sur 60", [ttlEffectif({}, 0), ttlEffectif({}, -3), ttlEffectif({}, Number.NaN)], [60, 60, 60]);

// --- Lecture à travers le cache -------------------------------------------------------------------------------------
{
  const f = fauxCache();
  let t = 1_000_000;
  const deps = { cache: f.cache, maintenant: () => t };
  const p = producteurCompte({ slug: "a", titre: "A" });
  const v1 = await lireAvecCacheInjecte(deps, "page:a", p.produire);
  t += 30_000;
  const v2 = await lireAvecCacheInjecte(deps, "page:a", p.produire);
  verifier("miss puis hit : valeur identique", [v1, v2], [{ slug: "a", titre: "A" }, { slug: "a", titre: "A" }]);
  verifier("miss puis hit : producteur appelé une seule fois", p.etat.n, 1);
  const stocke = f.magasin.get(cleCache("page:a"));
  verifier("en-tête Cache-Control public, max-age=60", stocke?.headers.get("cache-control"), "public, max-age=60");
  verifier("horodatage de stockage enregistré", stocke?.headers.get(ENTETE_STOCKE_LE), "1000000");

  t += 31_000; // 61 s après le stockage : périmé
  const v3 = await lireAvecCacheInjecte(deps, "page:a", p.produire);
  verifier("expiration : producteur rappelé", [p.etat.n, v3], [2, { slug: "a", titre: "A" }]);
  t += 10_000;
  await lireAvecCacheInjecte(deps, "page:a", p.produire);
  verifier("restocké après expiration : hit", p.etat.n, 2);
}

{
  // TTL personnalisé et clés distinctes
  const f = fauxCache();
  let t = 0;
  const deps = { cache: f.cache, maintenant: () => t };
  const a = producteurCompte("A");
  const b = producteurCompte("B");
  await lireAvecCacheInjecte(deps, "page:a", a.produire, 5);
  await lireAvecCacheInjecte(deps, "page:b", b.produire, 5);
  verifier("clés distinctes : chacune produit", [a.etat.n, b.etat.n], [1, 1]);
  t = 6_000;
  await lireAvecCacheInjecte(deps, "page:a", a.produire, 5);
  verifier("TTL personnalisé de 5 s respecté", a.etat.n, 2);
}

{
  // Cache qui échoue : repli sur le producteur, jamais d'exception
  for (const casse of ["match", "put", "delete"] as const) {
    const f = fauxCache({ [casse]: true });
    const p = producteurCompte([1, 2]);
    let erreur: unknown = null;
    let v: unknown = null;
    try {
      v = await lireAvecCacheInjecte({ cache: f.cache, maintenant: () => 0 }, "bannieres", p.produire);
    } catch (e) {
      erreur = e;
    }
    verifier(`cache en panne (${casse}) : valeur du producteur, sans exception`, [erreur, v], [null, [1, 2]]);
  }
  const f = fauxCache({ match: true });
  const p = producteurCompte("x");
  await lireAvecCacheInjecte({ cache: f.cache, maintenant: () => 0 }, "k", p.produire);
  await lireAvecCacheInjecte({ cache: f.cache, maintenant: () => 0 }, "k", p.produire);
  verifier("match en panne : le producteur sert chaque fois", p.etat.n, 2);
  const sans = producteurCompte("y");
  verifier("sans cache (Node) : repli direct", await lireAvecCacheInjecte({ cache: null, maintenant: () => 0 }, "k", sans.produire), "y");
  verifier("sans cache (undefined) : repli direct", await lireAvecCacheInjecte({ cache: undefined, maintenant: () => 0 }, "k", sans.produire), "y");
}

{
  // Entrée corrompue ou sans horodatage : traitée comme absente
  const f = fauxCache();
  f.magasin.set(cleCache("k"), new Response("pas du json", { headers: { [ENTETE_STOCKE_LE]: "0", "x-cms-ttl": "60" } }));
  const p = producteurCompte("frais");
  verifier("entrée illisible : producteur", await lireAvecCacheInjecte({ cache: f.cache, maintenant: () => 1 }, "k", p.produire), "frais");
  f.magasin.set(cleCache("k2"), new Response(JSON.stringify({ v: "ancien" })));
  verifier("entrée sans horodatage : producteur", await lireAvecCacheInjecte({ cache: f.cache, maintenant: () => 1 }, "k2", p.produire), "frais");
}

{
  // Valeurs vides : TTL court de 10 s
  const f = fauxCache();
  let t = 0;
  const deps = { cache: f.cache, maintenant: () => t };
  const p = producteurCompte<string | null>(null);
  await lireAvecCacheInjecte(deps, "page:absente", p.produire);
  verifier("null stocké avec max-age=10", f.magasin.get(cleCache("page:absente"))?.headers.get("cache-control"), "public, max-age=10");
  t = 9_000;
  await lireAvecCacheInjecte(deps, "page:absente", p.produire);
  verifier("null : encore en cache à 9 s", p.etat.n, 1);
  t = 10_000;
  await lireAvecCacheInjecte(deps, "page:absente", p.produire);
  verifier("null : expiré à 10 s", p.etat.n, 2);

  const q = producteurCompte<string[]>([]);
  await lireAvecCacheInjecte(deps, "bannieres", q.produire);
  verifier("[] stocké avec max-age=10", f.magasin.get(cleCache("bannieres"))?.headers.get("cache-control"), "public, max-age=10");
  const vide = await lireAvecCacheInjecte(deps, "bannieres", q.produire);
  verifier("[] relu depuis le cache", [vide, q.etat.n], [[], 1]);
}

{
  // Erreur du producteur : remonte, jamais mise en cache
  const f = fauxCache();
  const deps = { cache: f.cache, maintenant: () => 0 };
  let appels = 0;
  const casse = async (): Promise<string> => {
    appels++;
    throw new Error("base en panne");
  };
  let message = "";
  try {
    await lireAvecCacheInjecte(deps, "k", casse);
  } catch (e) {
    message = (e as Error).message;
  }
  verifier("erreur du producteur : remontée", message, "base en panne");
  verifier("erreur du producteur : rien stocké", [f.magasin.size, f.appels.put], [0, 0]);
  const apres = await lireAvecCacheInjecte(deps, "k", async () => "ok");
  verifier("après erreur : le producteur est rappelé", [apres, appels], ["ok", 1]);
}

{
  // Écriture planifiée (waitUntil) : non bloquante pour la réponse
  const f = fauxCache();
  const planifies: Promise<unknown>[] = [];
  const deps = { cache: f.cache, maintenant: () => 0, planifier: (w: Promise<unknown>) => void planifies.push(w) };
  const v = await lireAvecCacheInjecte(deps, "k", async () => "v");
  verifier("waitUntil : une écriture planifiée", [v, planifies.length], ["v", 1]);
  await Promise.all(planifies);
  verifier("waitUntil : écriture effectuée une fois terminée", f.magasin.has(cleCache("k")), true);
  // planifier qui lève : repli sur l'attente de l'écriture
  const g = fauxCache();
  const deps2 = {
    cache: g.cache,
    maintenant: () => 0,
    planifier: () => {
      throw new Error("pas de contexte");
    },
  };
  await lireAvecCacheInjecte(deps2, "k", async () => "v");
  verifier("planifier en échec : écriture quand même faite", g.magasin.has(cleCache("k")), true);
}

// --- Invalidation ---------------------------------------------------------------------------------------------------
{
  const f = fauxCache();
  const deps = { cache: f.cache, maintenant: () => 0 };
  const p = producteurCompte("v");
  await lireAvecCacheInjecte(deps, "page:a", p.produire);
  await lireAvecCacheInjecte(deps, "bannieres", p.produire);
  await invaliderInjecte(f.cache, ["page:a"]);
  verifier("invalidation : seule la clé visée disparaît", [f.magasin.has(cleCache("page:a")), f.magasin.has(cleCache("bannieres"))], [false, true]);
  await lireAvecCacheInjecte(deps, "page:a", p.produire);
  verifier("après invalidation : relu depuis le producteur", p.etat.n, 3);
  verifier("invalidation sans cache : sans erreur", await invaliderInjecte(null, ["x"]), undefined);
  const casse = fauxCache({ delete: true });
  verifier("invalidation, cache en panne : sans erreur", await invaliderInjecte(casse.cache, ["a", "b"]), undefined);
  verifier("invalidation, cache en panne : chaque clé tentée", casse.appels.delete, 2);
}

// --- Garde-fou : le chemin des contenus publiés ne peut pas toucher un brouillon ---------------------------------
{
  const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
  const importe = (rel: string) =>
    [...readFileSync(join(racine, rel), "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
  for (const rel of ["src/lib/cms/lecture.ts", "src/lib/cms/cache.ts", "src/lib/cms/cache-regles.ts"]) {
    verifier(`${rel} n'importe pas apercu.ts`, importe(rel).filter((i) => /apercu/.test(i)), []);
  }
  const lecture = readFileSync(join(racine, "src/lib/cms/lecture.ts"), "utf8");
  verifier("lecture.ts n'a aucun accès à un statut brouillon", /brouillon/.test(lecture.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), false);
  const page = readFileSync(join(racine, "src/app/p/[slug]/page.tsx"), "utf8");
  verifier("p/[slug] n'enveloppe pas resoudre dans le cache", /lireAvecCache/.test(page), false);
}

// --- Erreur de base : jamais mise en cache comme « absence » (revue 2, I1) -------------------------------------------
{
  // Séparation producteur qui lève / enveloppe publique, comme dans lecture.ts (l'enveloppe réelle n'est pas pure :
  // server-only + Supabase ; elle est vérifiée par l'analyse statique ci-dessous et par l'essai de bout en bout).
  const f = fauxCache();
  const deps = { cache: f.cache, maintenant: () => 0 };
  const enveloppe = async (): Promise<string[]> => {
    try {
      return await lireAvecCacheInjecte(deps, "bannieres", async (): Promise<string[]> => {
        throw new Error("panne transitoire");
      });
    } catch {
      return [];
    }
  };
  verifier("producteur qui lève : l'enveloppe renvoie [] sans exception", await enveloppe(), []);
  verifier("producteur qui lève : rien écrit dans le cache", [f.magasin.size, f.appels.put], [0, 0]);
  const rétabli = await lireAvecCacheInjecte(deps, "bannieres", async () => ["b"]);
  verifier("base rétablie : valeur réelle servie aussitôt", rétabli, ["b"]);

  const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
  const lecture = readFileSync(join(racine, "src/lib/cms/lecture.ts"), "utf8");
  verifier("lecture.ts : les deux producteurs lèvent sur erreur", (lecture.match(/if \(error\) throw error;/g) ?? []).length, 2);
  verifier("lecture.ts : les deux enveloppes publiques rattrapent autour du cache", (lecture.match(/return await lireAvecCache\(/g) ?? []).length, 2);
}

if (ko) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests du cache passent.");
