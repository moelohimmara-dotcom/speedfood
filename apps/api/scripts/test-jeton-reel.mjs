// Test de parité avec un vrai jeton : le mot de passe est saisi par la personne, masqué, jamais écrit ni affiché.
// Le jeton reste en mémoire et n'est transmis au comparateur que par variable d'environnement.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const SITE = "https://speedfood-app.moelohimmara.workers.dev";
const API = "https://speedfood-api.moelohimmara.workers.dev";

function lireEnv() {
  const texte = readFileSync(join(ici, "..", "..", "web", ".env.local"), "utf8");
  const valeurs = {};
  for (const ligne of texte.split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) valeurs[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return valeurs;
}

function demander(question, masque) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (masque) rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (r) => { rl.close(); if (masque) process.stdout.write("\n"); resolve(r); });
  });
}

const env = lireEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const cle = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !cle) { console.error("Variables Supabase introuvables dans apps/web/.env.local"); process.exit(2); }

const email = (await demander("E-mail du compte : ", false)).trim();
const motDePasse = await demander("Mot de passe (masqué) : ", true);

const rep = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: cle, "content-type": "application/json" },
  body: JSON.stringify({ email, password: motDePasse }),
});
if (!rep.ok) { console.error(`Connexion refusée (HTTP ${rep.status}). Ce compte a-t-il un mot de passe ? (une connexion Google n'en a pas)`); process.exit(2); }
const { access_token } = await rep.json();
if (!access_token) { console.error("Pas de jeton reçu."); process.exit(2); }

const r = spawnSync(
  process.execPath,
  [join(ici, "comparer-routes.mjs"), "--jeton-env", "SF_JETON_TEST", SITE, API, "/api/v1/moi", "/api/v1/client/espace"],
  { stdio: "inherit", env: { ...process.env, SF_JETON_TEST: access_token } },
);
process.exit(r.status ?? 2);
