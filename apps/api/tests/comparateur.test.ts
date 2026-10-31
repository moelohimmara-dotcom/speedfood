import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
// @ts-expect-error : module JavaScript sans déclaration de types
import { comparerRoutes } from "../scripts/comparateur.mjs";

type Reponse = { statut: number; type: string; cache?: string; corps: string };

async function serveur(routes: Record<string, Reponse>) {
  const http = createServer((requete, reponse) => {
    const r = routes[requete.url ?? ""];
    if (!r) { reponse.writeHead(404, { "content-type": "application/json" }).end("{}"); return; }
    reponse.writeHead(r.statut, { "content-type": r.type, ...(r.cache ? { "cache-control": r.cache } : {}) }).end(r.corps);
  });
  await new Promise<void>((ok) => http.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(http.address() as AddressInfo).port}`, fermer: () => new Promise<void>((ok) => http.close(() => ok())) };
}

const A: Reponse = { statut: 200, type: "application/json", cache: "public, max-age=300", corps: JSON.stringify({ ok: true, a: 1, b: [1, 2] }) };

test("deux réponses identiques (même si les clés sont dans un autre ordre) : aucun écart", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({ "/x": { ...A, type: "application/json; charset=utf-8", corps: JSON.stringify({ b: [1, 2], a: 1, ok: true }) } });
  try {
    assert.deepEqual(await comparerRoutes(s1.base, s2.base, ["/x"]), []);
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("statut, cache et corps différents : trois écarts nommés", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({ "/x": { statut: 500, type: "application/json", cache: "no-store", corps: JSON.stringify({ ok: false }) } });
  try {
    // Ce test vise la comparaison de statut/cache/corps sur une réponse 500 voulue : on tolère donc explicitement le hors 2xx (sinon un 4e écart « hors 2xx » s'ajoute).
    const ecarts: string[] = await comparerRoutes(s1.base, s2.base, ["/x"], fetch, { tolererNon2xx: true });
    assert.equal(ecarts.length, 3);
    assert.ok(ecarts.some((e) => e.includes("statut")) && ecarts.some((e) => e.includes("cache")) && ecarts.some((e) => e.includes("corps")));
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("une route absente d'un côté est un écart de statut", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({});
  try {
    const ecarts: string[] = await comparerRoutes(s1.base, s2.base, ["/x"]);
    assert.ok(ecarts.some((e) => e.includes("statut")));
  } finally { await s1.fermer(); await s2.fermer(); }
});

const E500: Reponse = { statut: 500, type: "application/json", cache: "no-store", corps: JSON.stringify({ ok: false, code: "ERREUR_SERVEUR" }) };

test("deux erreurs identiques (500 des deux côtés, même corps) : écart, pas un faux « 0 écart »", async () => {
  const s1 = await serveur({ "/x": E500 });
  const s2 = await serveur({ "/x": E500 });
  try {
    const ecarts: string[] = await comparerRoutes(s1.base, s2.base, ["/x"]);
    assert.ok(ecarts.length >= 1);
    assert.ok(ecarts.some((e) => e.includes("statut 500 hors 2xx (référence)")));
    assert.ok(ecarts.some((e) => e.includes("statut 500 hors 2xx (candidate)")));
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("avec la tolérance explicite, deux erreurs identiques ne donnent aucun écart", async () => {
  const s1 = await serveur({ "/x": E500 });
  const s2 = await serveur({ "/x": E500 });
  try {
    assert.deepEqual(await comparerRoutes(s1.base, s2.base, ["/x"], fetch, { tolererNon2xx: true }), []);
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("200 des deux côtés : inchangé, aucun écart par défaut", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({ "/x": A });
  try {
    assert.deepEqual(await comparerRoutes(s1.base, s2.base, ["/x"]), []);
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("les options entetes, methode et corps sont envoyés aux DEUX adresses", async () => {
  const vus: { methode: string; auth: string; corps: string; contentType: string }[] = [];
  const faux = async (_url: string, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    vus.push({ methode: init?.method ?? "GET", auth: h.get("authorization") ?? "", corps: String(init?.body ?? ""), contentType: h.get("content-type") ?? "" });
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
  };
  const ecarts = await comparerRoutes("http://a", "http://b", ["/x"], faux, { entetes: { authorization: "Bearer SECRET" }, methode: "POST", corps: '{"k":1}' });
  assert.deepEqual(ecarts, []);
  assert.equal(vus.length, 2);
  for (const v of vus) assert.deepEqual(v, { methode: "POST", auth: "Bearer SECRET", corps: '{"k":1}', contentType: "application/json" });
});

test("sans options, la requête reste un GET sans corps ni en-tête ajouté", async () => {
  const vus: { methode: string; corps: unknown; contentType: string | null }[] = [];
  const faux = async (_url: string, init?: RequestInit) => {
    vus.push({ methode: init?.method ?? "", corps: init?.body, contentType: new Headers(init?.headers).get("content-type") });
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
  };
  assert.deepEqual(await comparerRoutes("http://a", "http://b", ["/x"], faux), []);
  for (const v of vus) assert.deepEqual(v, { methode: "GET", corps: undefined, contentType: null });
});

test("un écart ne contient JAMAIS la valeur du jeton, même si le serveur la renvoie dans le corps", async () => {
  const reponses = [new Response('{"echo":"Bearer SECRET"}', { status: 200, headers: { "content-type": "application/json" } }), new Response('{"echo":"autre"}', { status: 200, headers: { "content-type": "application/json" } })];
  let i = 0;
  const ecarts: string[] = await comparerRoutes("http://a", "http://b", ["/x"], async () => reponses[i++], { entetes: { authorization: "Bearer SECRET" } });
  assert.ok(ecarts.length > 0);
  assert.ok(!JSON.stringify(ecarts).includes("SECRET"));
});

// --- Ligne de commande (serveurs locaux uniquement) ---
import { spawnSync, spawn as spawnAsync } from "node:child_process";
const SCRIPT = fileURLToPath(new URL("../scripts/comparer-routes.mjs", import.meta.url));

function lancer(args: string[], env: Record<string, string>) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env, ...env }, encoding: "utf8" });
  return { code: r.status, sortie: `${r.stdout}${r.stderr}` };
}

test("CLI : --jeton-env sur une variable absente sort en 2, « variable absente », sans aucune valeur", () => {
  const r = lancer(["--jeton-env", "VARIABLE_QUI_NEXISTE_PAS", "http://127.0.0.1:1", "http://127.0.0.1:1", "/x"], {});
  assert.equal(r.code, 2);
  assert.ok(r.sortie.includes("variable absente"));
});

test("CLI : --jeton-env sur une variable vide sort en 2", () => {
  const r = lancer(["--jeton-env", "JETON_VIDE", "http://127.0.0.1:1", "http://127.0.0.1:1", "/x"], { JETON_VIDE: "" });
  assert.equal(r.code, 2);
  assert.ok(r.sortie.includes("variable absente"));
});

test("CLI : le jeton est envoyé aux deux adresses avec méthode et corps, et n'apparaît jamais dans la sortie", async () => {
  const JETON = "JETON-CLI-SECRET-123";
  const recus: { methode: string; auth: string; corps: string }[] = [];
  const http = createServer((q, r) => {
    let corps = "";
    q.on("data", (d) => (corps += d));
    q.on("end", () => {
      recus.push({ methode: q.method ?? "", auth: String(q.headers.authorization ?? ""), corps });
      // Le serveur renvoie le jeton dans son corps, différemment des deux côtés : il ne doit pas fuiter dans les écarts.
      r.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ echo: recus.length === 1 ? q.headers.authorization : "autre" }));
    });
  });
  await new Promise<void>((ok) => http.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  try {
    const r = await new Promise<{ code: number | null; sortie: string }>((ok) => {

      const enfant = spawnAsync(process.execPath, [SCRIPT, "--jeton-env", "JETON_ESSAI", "--autoriser-ecriture", "--methode", "POST", "--corps", '{"a":1}', base, base, "/x"], { env: { ...process.env, JETON_ESSAI: JETON }, timeout: 15000 });
      let sortie = "";
      enfant.stdout.on("data", (d: Buffer) => (sortie += d));
      enfant.stderr.on("data", (d: Buffer) => (sortie += d));
      enfant.on("close", (code: number | null) => ok({ code, sortie }));
    });
    assert.equal(r.code, 1);
    assert.ok(r.sortie.includes("corps différent"));
    assert.ok(!r.sortie.includes(JETON));
    assert.equal(recus.length, 2);
    for (const v of recus) assert.deepEqual(v, { methode: "POST", auth: `Bearer ${JETON}`, corps: '{"a":1}' });
    // Le CLI signale où part le jeton : hôtes seulement.
    assert.ok(r.sortie.includes(`Jeton envoyé à : ${new URL(base).host}, ${new URL(base).host}`));
  } finally { await new Promise<void>((ok) => http.close(() => ok())); }
});

// --- Chemins d'erreur : code 2 et la valeur du jeton n'apparaît jamais (stdout + stderr) ---
const LOCAL = "http://127.0.0.1:1";

function verifierSansFuite(r: { code: number | null; sortie: string }, valeur: string) {
  assert.equal(r.code, 2);
  assert.ok(!r.sortie.includes(valeur), "la valeur ne doit jamais apparaître");
  assert.ok(!/TypeError|at .*\.mjs|node:internal/.test(r.sortie), "aucune trace d'exception");
}

test("CLI : jeton invalide (retour à la ligne interne) : code 2, aucune valeur ni trace", () => {
  const r = lancer(["--jeton-env", "JETON_ESSAI", LOCAL, LOCAL, "/x"], { JETON_ESSAI: "SECRET-ABC\nDEUX" });
  verifierSansFuite(r, "SECRET-ABC");
  assert.ok(!r.sortie.includes("DEUX"));
  assert.ok(r.sortie.includes("jeton invalide"));
});

test("CLI : jeton avec espace ou accent : code 2, valeur non affichée", () => {
  for (const jeton of ["SECRET ABC", "SECRETé-ABC"]) {
    verifierSansFuite(lancer(["--jeton-env", "JETON_ESSAI", LOCAL, LOCAL, "/x"], { JETON_ESSAI: jeton }), jeton);
  }
});

test("CLI : le jeton passé à la place du NOM de la variable n'est jamais répété", () => {
  const faux = "Bearer.SECRET-DIRECT=123";
  const r = lancer(["--jeton-env", faux, LOCAL, LOCAL, "/x"], {});
  verifierSansFuite(r, faux);
  assert.ok(!r.sortie.includes("SECRET-DIRECT"));
});

test("CLI : avec un jeton, une adresse http:// hors boucle locale est refusée (code 2), adresses non affichées", () => {
  const r = lancer(["--jeton-env", "JETON_ESSAI", "http://exemple.invalid", LOCAL, "/x"], { JETON_ESSAI: "SECRET-ABC" });
  verifierSansFuite(r, "SECRET-ABC");
  assert.ok(!r.sortie.includes("exemple.invalid"));
  assert.ok(!r.sortie.includes("Jeton envoyé à"));
});

test("CLI : avec un jeton, une adresse illisible est refusée (code 2)", () => {
  verifierSansFuite(lancer(["--jeton-env", "JETON_ESSAI", "pas-une-adresse", LOCAL, "/x"], { JETON_ESSAI: "SECRET-ABC" }), "SECRET-ABC");
});

test("CLI : rejet réseau avec jeton présent : code 2 (pas 1), message propre, aucune valeur ni trace", () => {
  const r = lancer(["--jeton-env", "JETON_ESSAI", LOCAL, LOCAL, "/x"], { JETON_ESSAI: "SECRET-ABC" });
  verifierSansFuite(r, "SECRET-ABC");
  assert.ok(r.sortie.includes("Requête impossible"));
});

test("CLI : méthode refusée par fetch avec jeton présent : code 2, aucune valeur ni trace", () => {
  const r = lancer(["--jeton-env", "JETON_ESSAI", "--autoriser-ecriture", "--methode", "PAS UNE METHODE", LOCAL, LOCAL, "/x"], { JETON_ESSAI: "SECRET-ABC" });
  verifierSansFuite(r, "SECRET-ABC");
  // Le message de l'exception de fetch cite la méthode fautive : il ne doit pas être réimprimé.
  assert.ok(!r.sortie.includes("PAS UNE"));
});

test("CLI : un chemin qui change l'hôte appelé est refusé (code 2), aucun jeton ni chemin affiché, aucune requête", async () => {
  let requetes = 0;
  const http = createServer((_q, r) => { requetes++; r.writeHead(200, { "content-type": "application/json" }).end("{}"); });
  await new Promise<void>((ok) => http.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  try {
    for (const chemin of [".evil.invalid", "//evil.invalid/x", "@evil.invalid/x", "x", "/\\evil.invalid/x"]) {
      for (const jeton of ["SECRET-ABC", ""]) {
        const r = lancer([...(jeton ? ["--jeton-env", "JETON_ESSAI"] : []), "http://localhost", base, chemin], { JETON_ESSAI: jeton });
        verifierSansFuite(r, "SECRET-ABC");
        assert.ok(!r.sortie.includes("evil.invalid"), "le chemin refusé n'est pas répété");
        assert.ok(!r.sortie.includes("Jeton envoyé à"));
      }
    }
    assert.equal(requetes, 0);
  } finally { await new Promise<void>((ok) => http.close(() => ok())); }
});

test("CLI : --corps sans --methode : code 2 et message propre", () => {
  const r = lancer(["--corps", '{"a":1}', LOCAL, LOCAL, "/x"], {});
  assert.equal(r.code, 2);
  assert.ok(r.sortie.includes("--corps exige --methode"));
});

// Version asynchrone de `lancer` : indispensable quand le serveur de l'essai tourne dans CE processus (spawnSync bloquerait sa boucle d'événements).
function lancerAsync(args: string[], env: Record<string, string>) {
  return new Promise<{ code: number | null; sortie: string }>((ok) => {
    // Délai maximal : une régression (processus qui ne rend jamais la main) fait échouer le test au lieu de le faire pendre.
    const enfant = spawnAsync(process.execPath, [SCRIPT, ...args], { env: { ...process.env, ...env }, timeout: 15000 });
    let sortie = "";
    enfant.stdout.on("data", (d: Buffer) => (sortie += d));
    enfant.stderr.on("data", (d: Buffer) => (sortie += d));
    enfant.on("close", (code: number | null) => ok({ code, sortie }));
  });
}

// --- Réserve 11 : une écriture avec jeton exige --autoriser-ecriture ---
async function serveurCompteur() {
  const recus: { methode: string; auth: string }[] = [];
  const http = createServer((q, r) => {
    recus.push({ methode: q.method ?? "", auth: String(q.headers.authorization ?? "") });
    r.writeHead(200, { "content-type": "application/json" }).end("{}");
    q.resume();
  });
  await new Promise<void>((ok) => http.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(http.address() as AddressInfo).port}`, recus, fermer: () => new Promise<void>((ok) => http.close(() => ok())) };
}

test("CLI : une écriture avec jeton sans --autoriser-ecriture est refusée (code 2), aucune requête, aucune valeur affichée", async () => {
  const s = await serveurCompteur();
  try {
    for (const methode of ["POST", "PUT", "PATCH", "DELETE", "post", "OPTIONS"]) {
      const r = await lancerAsync(["--jeton-env", "JETON_ESSAI", "--methode", methode, "--corps", '{"a":1}', s.base, s.base, "/x"], { JETON_ESSAI: "SECRET-ABC" });
      verifierSansFuite(r, "SECRET-ABC");
      assert.ok(r.sortie.includes("--autoriser-ecriture"), "le message nomme le drapeau");
      assert.ok(!r.sortie.includes("Jeton envoyé à"));
      assert.ok(!r.sortie.includes(s.base), "les adresses ne sont pas répétées");
    }
    assert.equal(s.recus.length, 0, "aucune requête n'est partie");
  } finally { await s.fermer(); }
});

test("CLI : une écriture avec jeton et --autoriser-ecriture vers 127.0.0.1 est envoyée aux deux adresses", async () => {
  const s = await serveurCompteur();
  try {
    const r = await lancerAsync(["--jeton-env", "JETON_ESSAI", "--autoriser-ecriture", "--methode", "PUT", "--corps", "{}", s.base, s.base, "/x"], { JETON_ESSAI: "SECRET-ABC" });
    assert.equal(r.code, 0);
    assert.ok(!r.sortie.includes("SECRET-ABC"));
    assert.deepEqual(s.recus, [{ methode: "PUT", auth: "Bearer SECRET-ABC" }, { methode: "PUT", auth: "Bearer SECRET-ABC" }]);
  } finally { await s.fermer(); }
});

test("CLI : --autoriser-ecriture ne desserre pas les autres gardes (http hors boucle locale toujours refusé)", () => {
  const r = lancer(["--jeton-env", "JETON_ESSAI", "--autoriser-ecriture", "--methode", "POST", "http://exemple.invalid", LOCAL, "/x"], { JETON_ESSAI: "SECRET-ABC" });
  verifierSansFuite(r, "SECRET-ABC");
  assert.ok(!r.sortie.includes("exemple.invalid"));
});

test("CLI : lecture (GET, HEAD ou méthode absente) avec jeton : inchangé, sans drapeau", async () => {
  const s = await serveurCompteur();
  try {
    for (const args of [[], ["--methode", "GET"], ["--methode", "get"], ["--methode", "HEAD"]]) {
      const r = await lancerAsync(["--jeton-env", "JETON_ESSAI", ...args, s.base, s.base, "/x"], { JETON_ESSAI: "SECRET-ABC" });
      assert.equal(r.code, 0, r.sortie);
      assert.ok(!r.sortie.includes("SECRET-ABC"));
    }
    assert.equal(s.recus.length, 8);
    assert.ok(s.recus.every((v) => v.auth === "Bearer SECRET-ABC"));
  } finally { await s.fermer(); }
});

test("CLI : une écriture SANS jeton exige aussi le drapeau (refus code 2, aucune requête, casse indifférente)", async () => {
  const s = await serveurCompteur();
  try {
    for (const methode of ["POST", "post", "Post", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const r = await lancerAsync(["--methode", methode, "--corps", "{}", s.base, s.base, "/x"], {});
      assert.equal(r.code, 2, r.sortie);
      assert.ok(r.sortie.includes("--autoriser-ecriture"));
      assert.ok(!r.sortie.includes(s.base), "les adresses ne sont pas répétées");
    }
    assert.equal(s.recus.length, 0, "aucune requête n'est partie");
  } finally { await s.fermer(); }
});

test("CLI : une écriture SANS jeton avec --autoriser-ecriture est envoyée (boucle locale)", async () => {
  const s = await serveurCompteur();
  try {
    const r = await lancerAsync(["--autoriser-ecriture", "--methode", "Post", "--corps", "{}", s.base, s.base, "/x"], {});
    assert.equal(r.code, 0, r.sortie);
    assert.deepEqual(s.recus, [{ methode: "POST", auth: "" }, { methode: "POST", auth: "" }]);
  } finally { await s.fermer(); }
});

test("CLI : une lecture SANS jeton (GET, HEAD, get) n'exige pas le drapeau", async () => {
  const s = await serveurCompteur();
  try {
    for (const args of [[], ["--methode", "GET"], ["--methode", "get"], ["--methode", "HEAD"]]) {
      const r = await lancerAsync([...args, s.base, s.base, "/x"], {});
      assert.equal(r.code, 0, r.sortie);
    }
    assert.equal(s.recus.length, 8);
  } finally { await s.fermer(); }
});

// --- Tâche 9 : --corps-env NOM (corps secret lu dans l'environnement, jamais affiché) ---
const CORPS_SECRET = '{"jeton":"CLE-ACCES-SECRETE-XYZ"}';

async function serveurEcho() {
  const recus: { methode: string; corps: string; contentType: string; auth: string }[] = [];
  const http = createServer((q, r) => {
    let corps = "";
    q.on("data", (d) => (corps += d));
    q.on("end", () => {
      recus.push({ methode: q.method ?? "", corps, contentType: String(q.headers["content-type"] ?? ""), auth: String(q.headers.authorization ?? "") });
      // Le serveur renvoie le corps reçu, différemment des deux côtés : l'écart ne doit jamais le citer.
      r.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ echo: recus.length % 2 === 1 ? corps : "autre" }));
    });
  });
  await new Promise<void>((ok) => http.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(http.address() as AddressInfo).port}`, recus, fermer: () => new Promise<void>((ok) => http.close(() => ok())) };
}

test("CLI : --corps-env envoie le corps aux DEUX serveurs et ne l'affiche nulle part (même renvoyé par le serveur)", async () => {
  const s = await serveurEcho();
  try {
    const r = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--autoriser-ecriture", "--methode", "POST", s.base, s.base, "/x"], { CORPS_ESSAI: CORPS_SECRET });
    assert.equal(r.code, 1, r.sortie);
    assert.ok(r.sortie.includes("corps différent"));
    assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE"), "le corps ne doit jamais apparaître");
    assert.equal(s.recus.length, 2);
    for (const v of s.recus) assert.deepEqual(v, { methode: "POST", corps: CORPS_SECRET, contentType: "application/json", auth: "" });
    assert.ok(r.sortie.includes(`Corps secret envoyé à : ${new URL(s.base).host}, ${new URL(s.base).host}`));
  } finally { await s.fermer(); }
});

test("CLI : --corps-env sans écart : code 0 et corps absent de la sortie", async () => {
  const s = await serveurCompteur();
  try {
    const r = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--autoriser-ecriture", "--methode", "POST", s.base, s.base, "/x"], { CORPS_ESSAI: CORPS_SECRET });
    assert.equal(r.code, 0, r.sortie);
    assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE"));
    assert.equal(s.recus.length, 2);
  } finally { await s.fermer(); }
});

test("CLI : --corps-env avec une variable absente ou vide : code 2, aucune requête, message sans valeur", async () => {
  const s = await serveurCompteur();
  try {
    for (const env of [{}, { CORPS_ESSAI: "" }] as Record<string, string>[]) {
      const r = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--autoriser-ecriture", "--methode", "POST", s.base, s.base, "/x"], env);
      assert.equal(r.code, 2, r.sortie);
      assert.ok(r.sortie.includes("variable absente"));
    }
    assert.equal(s.recus.length, 0);
  } finally { await s.fermer(); }
});

test("CLI : --corps-env contenant un JSON illisible : code 2, aucune requête, la valeur n'est jamais affichée", async () => {
  const s = await serveurCompteur();
  try {
    for (const valeur of ["{CLE-ACCES-SECRETE-XYZ", "CLE-ACCES-SECRETE-XYZ", '{"jeton":"CLE-ACCES-SECRETE-XYZ"', "{'jeton':'CLE-ACCES-SECRETE-XYZ'}"]) {
      const r = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--autoriser-ecriture", "--methode", "POST", s.base, s.base, "/x"], { CORPS_ESSAI: valeur });
      assert.equal(r.code, 2, r.sortie);
      assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE"), "la valeur ne doit jamais apparaître");
      assert.ok(!/SyntaxError|Unexpected|at .*\.mjs|node:internal/.test(r.sortie), "ni le message ni la trace de JSON.parse");
      assert.ok(r.sortie.includes("JSON"));
    }
    assert.equal(s.recus.length, 0);
  } finally { await s.fermer(); }
});

test("CLI : --corps et --corps-env ensemble : refusé (code 2), aucune requête, aucune des deux valeurs affichée", async () => {
  const s = await serveurCompteur();
  try {
    const r = await lancerAsync(["--corps", '{"visible":"CORPS-ARGUMENT"}', "--corps-env", "CORPS_ESSAI", "--autoriser-ecriture", "--methode", "POST", s.base, s.base, "/x"], { CORPS_ESSAI: CORPS_SECRET });
    assert.equal(r.code, 2, r.sortie);
    assert.ok(r.sortie.includes("--corps-env"));
    assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE") && !r.sortie.includes("CORPS-ARGUMENT"));
    // Même refus dans l'autre ordre.
    const r2 = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--corps", "{}", "--autoriser-ecriture", "--methode", "POST", s.base, s.base, "/x"], { CORPS_ESSAI: CORPS_SECRET });
    assert.equal(r2.code, 2, r2.sortie);
    assert.equal(s.recus.length, 0);
  } finally { await s.fermer(); }
});

test("CLI : la garde d'écriture reste appliquée avec --corps-env (sans --autoriser-ecriture : refus, aucune requête)", async () => {
  const s = await serveurCompteur();
  try {
    for (const methode of ["POST", "post", "PUT", "DELETE"]) {
      const r = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--methode", methode, s.base, s.base, "/x"], { CORPS_ESSAI: CORPS_SECRET });
      assert.equal(r.code, 2, r.sortie);
      assert.ok(r.sortie.includes("--autoriser-ecriture"));
      assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE"));
    }
    assert.equal(s.recus.length, 0);
  } finally { await s.fermer(); }
});

test("CLI : --corps-env exige --methode (code 2, valeur non affichée)", () => {
  const r = lancer(["--corps-env", "CORPS_ESSAI", LOCAL, LOCAL, "/x"], { CORPS_ESSAI: CORPS_SECRET });
  assert.equal(r.code, 2);
  assert.ok(r.sortie.includes("--corps-env exige --methode"));
  assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE"));
});

test("CLI : --corps-env reçoit la valeur au lieu du NOM : refusé, jamais répétée", () => {
  const r = lancer(["--corps-env", '{"jeton":"CLE-ACCES-SECRETE-XYZ"}', "--autoriser-ecriture", "--methode", "POST", LOCAL, LOCAL, "/x"], {});
  assert.equal(r.code, 2);
  assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE"));
  assert.ok(!r.sortie.includes("jeton"));
});

test("CLI : --corps-env sans valeur après l'option : usage, code 2", () => {
  const r = lancer(["--autoriser-ecriture", "--methode", "POST", LOCAL, LOCAL, "/x", "--corps-env"], {});
  assert.equal(r.code, 2);
  assert.ok(r.sortie.includes("Usage"));
});

test("CLI : un corps secret n'est envoyé qu'en https (ou boucle locale) et sur l'hôte de la base : sinon refus, adresses non affichées", async () => {
  const s = await serveurCompteur();
  try {
    const r = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--autoriser-ecriture", "--methode", "POST", "http://exemple.invalid", LOCAL, "/x"], { CORPS_ESSAI: CORPS_SECRET });
    assert.equal(r.code, 2, r.sortie);
    assert.ok(!r.sortie.includes("exemple.invalid") && !r.sortie.includes("CLE-ACCES-SECRETE"));
    for (const chemin of [".evil.invalid", "//evil.invalid/x", "@evil.invalid/x"]) {
      const r2 = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--autoriser-ecriture", "--methode", "POST", "http://localhost", s.base, chemin], { CORPS_ESSAI: CORPS_SECRET });
      assert.equal(r2.code, 2, r2.sortie);
      assert.ok(!r2.sortie.includes("evil.invalid") && !r2.sortie.includes("CLE-ACCES-SECRETE"));
    }
    assert.equal(s.recus.length, 0);
  } finally { await s.fermer(); }
});

test("CLI : rejet réseau avec --corps-env : code 2, message propre, corps jamais affiché", () => {
  const r = lancer(["--corps-env", "CORPS_ESSAI", "--autoriser-ecriture", "--methode", "POST", LOCAL, LOCAL, "/x"], { CORPS_ESSAI: CORPS_SECRET });
  assert.equal(r.code, 2);
  assert.ok(r.sortie.includes("Requête impossible"));
  assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE"));
  assert.ok(!/TypeError|at .*\.mjs|node:internal/.test(r.sortie));
});

test("CLI : --corps-env et --jeton-env ensemble : les deux sont envoyés, aucun n'est affiché", async () => {
  const s = await serveurEcho();
  try {
    const r = await lancerAsync(["--corps-env", "CORPS_ESSAI", "--jeton-env", "JETON_ESSAI", "--autoriser-ecriture", "--methode", "POST", s.base, s.base, "/x"], { CORPS_ESSAI: CORPS_SECRET, JETON_ESSAI: "JETON-PORTEUR-QRS" });
    assert.ok(!r.sortie.includes("CLE-ACCES-SECRETE") && !r.sortie.includes("JETON-PORTEUR-QRS"));
    for (const v of s.recus) assert.deepEqual(v, { methode: "POST", corps: CORPS_SECRET, contentType: "application/json", auth: "Bearer JETON-PORTEUR-QRS" });
    assert.equal(s.recus.length, 2);
  } finally { await s.fermer(); }
});
