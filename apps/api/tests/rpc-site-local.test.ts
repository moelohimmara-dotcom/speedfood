import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

// Banc local uniquement : vrai wrapper du site, moteur OpenNext remplacé par un faux.
// Aucun fichier généré OpenNext, .env, .dev.vars, réseau externe ou secret réel lu.
const dossierWeb = fileURLToPath(new URL("../../web/", import.meta.url));
const wrapper = readFileSync(new URL("../../web/worker-entree.js", import.meta.url), "utf8");

// Miniflare 5 alpha expose un type Fetcher incorrect dans cette installation.
// Vérifier la capacité réelle avant de typer l'adaptateur, sans masquer un échec runtime.
function avecFetch(valeur: unknown) {
  assert.ok(valeur !== null && typeof valeur === "object" && "fetch" in valeur && typeof valeur.fetch === "function");
  return valeur as { fetch(url: string, options?: { method: string; body: string }): Promise<Response> };
}

test("banc RPC local : wrapper du site avec OpenNext factice, sans accès HTTP au calcul", { timeout: 30000 }, async () => {
  const resultat = await build({
    stdin: { contents: wrapper, resolveDir: dossierWeb },
    write: false, bundle: true, format: "esm", platform: "neutral", target: "es2022",
    external: ["node:*", "cloudflare:*"], logLevel: "silent",
    plugins: [{ name: "faux-opennext-sans-secrets", setup(b) {
      b.onResolve({ filter: /\.open-next\/worker\.js$/ }, () => ({ path: "opennext-factice", namespace: "essai" }));
      b.onLoad({ filter: /.*/, namespace: "essai" }, () => ({ contents: `
        import { DurableObject } from 'cloudflare:workers';
        export class DOQueueHandler extends DurableObject {}
        export class DOShardedTagCache extends DurableObject {}
        export class BucketCachePurge extends DurableObject {}
        export default { fetch() { return new Response('opennext-factice', {status:404}); } };
      ` }));
    } }],
  });
  const apiCompilee = await build({
    stdin: { contents: `import { fournirJetonInterne } from './commandes/jeton-interne.ts';
      export default { async fetch(request, env) {
        try { const jeton=await fournirJetonInterne(() => env)(await request.text());
          return Response.json({jeton});
        } catch { return new Response('calcul-refuse', {status:503, headers: {
          'x-essai-type-liaison': typeof env.SITE_JETONS,
          'x-essai-type-methode': typeof env.SITE_JETONS?.deriver,
        }}); }
      } };`, resolveDir: fileURLToPath(new URL('../src/', import.meta.url)) },
    write: false, bundle: true, format: "esm", platform: "neutral", external: ["node:*"], logLevel: "silent",
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [
      { name: "site-local", modules: true, script: resultat.outputFiles[0].text,
        compatibilityDate: "2026-09-27", compatibilityFlags: ["nodejs_compat"],
        bindings: { COMMANDE_JETON_SECRET: "uniquement-factice-site" } },
      { name: "api-locale", modules: true, compatibilityDate: "2026-09-27", compatibilityFlags: ["nodejs_compat"],
        bindings: { COMMANDE_JETON_SECRET: "autre-valeur-factice-api", CREATION_COMMANDE_API: "oui" },
        serviceBindings: { SITE_JETONS: { name: "site-local", entrypoint: "JetonsCommande" } },
        script: apiCompilee.outputFiles[0].text },
      { name: "api-sans-liaison", modules: true, compatibilityDate: "2026-09-27", compatibilityFlags: ["nodejs_compat"],
        bindings: { CREATION_COMMANDE_API: "oui" }, script: apiCompilee.outputFiles[0].text },
      { name: "api-eteinte", modules: true, compatibilityDate: "2026-09-27", compatibilityFlags: ["nodejs_compat"],
        serviceBindings: { SITE_JETONS: { name: "site-local", entrypoint: "JetonsCommande" } }, script: apiCompilee.outputFiles[0].text },
    ],
  }));
  try {
    const api = avecFetch(await mf.getWorker("api-locale"));
    const site = avecFetch(await mf.getWorker("site-local"));
    const cle = "2bb133fc-e6f9-43b3-bbb7-20daf88d7405";
    const premiere = await api.fetch("https://essai.invalid/", { method: "POST", body: cle });
    assert.equal(premiere.status, 200, `liaison=${premiere.headers.get('x-essai-type-liaison')}, methode=${premiere.headers.get('x-essai-type-methode')}`);
    const a = await premiere.json() as { jeton: string };
    // Comparaison entre Node et workerd : c'est la valeur du site qui doit être utilisée.
    assert.equal(a.jeton, createHmac("sha256", "uniquement-factice-site")
      .update(`speedfood-jeton-suivi-v1:${cle}`).digest("base64url").slice(0, 40));
    const deuxieme = await api.fetch("https://essai.invalid/", { method: "POST", body: cle });
    assert.deepEqual(await deuxieme.json(), a);
    assert.match(a.jeton, /^[A-Za-z0-9_-]{40}$/);
    const autre = await api.fetch("https://essai.invalid/", { method: "POST", body: "3bb133fc-e6f9-43b3-bbb7-20daf88d7405" });
    assert.notEqual((await autre.json() as { jeton: string }).jeton, a.jeton);
    const refuse = await api.fetch("https://essai.invalid/", { method: "POST", body: "invalide" });
    assert.equal(refuse.status, 503);
    assert.equal(await refuse.text(), "calcul-refuse");
    // Le fetch public ne route pas vers l'entrée RPC, même en forgeant chemin et corps.
    const publicHttp = await site.fetch("https://essai.invalid/JetonsCommande/deriver", { method: "POST", body: cle });
    assert.equal(publicHttp.status, 404);
    assert.equal(await publicHttp.text(), "opennext-factice");
    for (const nom of ["api-sans-liaison", "api-eteinte"]) {
      const rep = await avecFetch(await mf.getWorker(nom)).fetch("https://essai.invalid/", { method: "POST", body: cle });
      assert.equal(rep.status, 503);
      assert.equal(await rep.text(), "calcul-refuse");
    }
  } finally { await mf.dispose(); }
});
