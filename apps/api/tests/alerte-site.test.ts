import { test } from "node:test";
import assert from "node:assert/strict";
import { fournirAlerteSite } from "../src/commandes/alerte-site.ts";

const RESTO = "2bb133fc-e6f9-43b3-bbb7-20daf88d7405";

function liaisonFausse(comportement: (id: string) => unknown = () => undefined) {
  const appels: unknown[][] = [];
  return { appels, env: { SITE_JETONS: { alerter(...args: unknown[]) { appels.push(args); return comportement(args[0] as string); } } } };
}

/** Capture tout ce qui est écrit dans la console pendant `corps`. */
async function journaux(corps: () => Promise<void>): Promise<string[]> {
  const lignes: string[] = [];
  const e = console.error, l = console.log, w = console.warn;
  console.error = console.log = console.warn = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  try { await corps(); } finally { console.error = e; console.log = l; console.warn = w; }
  return lignes;
}

test("alerte : un seul appel RPC `alerter(restaurantId)`, rien d'autre transmis, aucun fetch public", async () => {
  const { appels, env } = liaisonFausse();
  const vrai = globalThis.fetch;
  let fetchs = 0;
  globalThis.fetch = (() => { fetchs++; throw new Error("fetch interdit"); }) as typeof fetch;
  try { await fournirAlerteSite(() => env)(RESTO); } finally { globalThis.fetch = vrai; }
  assert.deepEqual(appels, [[RESTO]]);
  assert.equal(fetchs, 0);
});

test("alerte : liaison lue à l'APPEL (une liaison changée entre deux appels est prise en compte)", async () => {
  const a = liaisonFausse(), b = liaisonFausse();
  let env: unknown = a.env;
  const alerter = fournirAlerteSite(() => env);
  await alerter(RESTO);
  env = b.env;
  await alerter(RESTO);
  assert.deepEqual([a.appels.length, b.appels.length], [1, 1]);
});

test("alerte : liaison absente ou non conforme => aucun appel, aucune erreur, aucun journal", async () => {
  const lignes = await journaux(async () => {
    for (const brut of [undefined, null, "texte", {}, { SITE_JETONS: undefined }, { SITE_JETONS: "x" }, { SITE_JETONS: {} }, { SITE_JETONS: { alerter: "pas une fonction" } }]) {
      await fournirAlerteSite(() => brut)(RESTO);
    }
  });
  assert.deepEqual(lignes, []);
});

test("alerte : échec de la RPC ou lecture qui lève => aucune erreur propagée, SEUL le code fixe est journalisé (jamais uuid ni message)", async () => {
  const lignes = await journaux(async () => {
    await fournirAlerteSite(() => liaisonFausse(() => { throw new Error(`panne ${RESTO} https://site.test secret`); }).env)(RESTO);
    await fournirAlerteSite(() => liaisonFausse(() => Promise.reject(new Error(RESTO))).env)(RESTO);
    await fournirAlerteSite(() => { throw new Error("boom"); })(RESTO);
  });
  assert.deepEqual(lignes, ["alerte_site_echec", "alerte_site_echec", "alerte_site_echec"]);
});

test("alerte : un échec n'est jamais rejoué", async () => {
  const { appels, env } = liaisonFausse(() => { throw new Error("x"); });
  await journaux(async () => { await fournirAlerteSite(() => env)(RESTO); });
  assert.equal(appels.length, 1);
});

test("alerte : délai dépassé => la fonction rend la main sans erreur et journalise le code fixe", { timeout: 2000 }, async () => {
  const { env } = liaisonFausse(() => new Promise(() => {}));
  const lignes = await journaux(async () => { await fournirAlerteSite(() => env, 20)(RESTO); });
  assert.deepEqual(lignes, ["alerte_site_echec"]);
});
