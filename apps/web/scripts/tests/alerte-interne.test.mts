import { readFileSync } from "node:fs";
import { join } from "node:path";
import { secretAlerteValide, traiterAlerteInterne } from "../../src/lib/api/alerte-interne";
import { cheminInterneRefuse } from "../../src/lib/worker/garde-interne";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const SECRET = "S".repeat(40);
const RESTO = "2bb133fc-e6f9-43b3-bbb7-20daf88d7405";

async function essai(attendu: string | undefined, recu: string | null, corps: unknown, notifierPanne = false) {
  const notifies: string[] = [];
  const taches: Array<() => Promise<void>> = [];
  let corpsLu = 0;
  const reponse = await traiterAlerteInterne(
    { attendu, recu, lireCorps: async () => { corpsLu++; if (corps instanceof Error) throw corps; return corps; } },
    (t) => { taches.push(t); },
    async (id) => { if (notifierPanne) throw new Error(`fcm ${id}`); notifies.push(id); }
  );
  return { reponse, notifies, corpsLu, taches };
}

verifier("secret égal : valide", secretAlerteValide(SECRET, SECRET), true);
verifier("secret absent, vide ou différent : refusé", [secretAlerteValide(null, SECRET), secretAlerteValide("", SECRET), secretAlerteValide("T".repeat(40), SECRET), secretAlerteValide(`${SECRET}x`, SECRET), secretAlerteValide(SECRET.slice(1), SECRET)], [false, false, false, false, false]);
verifier("secret attendu absent, trop court ou hors forme : TOUJOURS refusé même si égal", [secretAlerteValide("court", "court"), secretAlerteValide(undefined, undefined), secretAlerteValide("", ""), secretAlerteValide("x".repeat(31), "x".repeat(31)), secretAlerteValide(`${"x".repeat(32)} `, `${"x".repeat(32)} `)], [false, false, false, false, false]);

{
  const r = await essai(SECRET, SECRET, { restaurantId: RESTO });
  verifier("bon jeton + uuid : 200 {ok:true} rendu AVANT l'envoi (une tâche planifiée, rien notifié encore)", [r.reponse, r.taches.length, r.notifies], [{ statut: 200, corps: { ok: true } }, 1, []]);
  await r.taches[0]();
  verifier("la tâche planifiée notifie une fois le restaurant", r.notifies, [RESTO]);
}
for (const [nom, recu] of [["sans secret", null], ["mauvais secret", "T".repeat(40)]] as const) {
  const r = await essai(SECRET, recu, { restaurantId: RESTO });
  verifier(`${nom} : 401 sans corps, corps jamais lu, rien notifié`, [r.reponse, r.notifies, r.corpsLu], [{ statut: 401, corps: null }, [], 0]);
}
{
  const r = await essai("court", "court", { restaurantId: RESTO });
  verifier("secret du site trop court : 401 toujours, rien notifié", [r.reponse, r.notifies], [{ statut: 401, corps: null }, []]);
  const s = await essai(undefined, "court", { restaurantId: RESTO });
  verifier("secret du site absent : 401", [s.reponse.statut, s.notifies], [401, []]);
}
for (const [nom, corps] of [["uuid invalide", { restaurantId: "pas-un-uuid" }], ["restaurantId absent", {}], ["restaurantId non texte", { restaurantId: 7 }], ["corps null", null], ["corps texte", "x"], ["JSON illisible", new Error()], ["uuid avec suffixe", { restaurantId: `${RESTO}x` }]] as const) {
  const r = await essai(SECRET, SECRET, corps);
  verifier(`${nom} : 400, rien notifié`, [r.reponse, r.notifies], [{ statut: 400, corps: { ok: false } }, []]);
}
{
  const r = await essai(SECRET, SECRET, { restaurantId: RESTO }, true);
  const lignes: string[] = [];
  const origine = console.error;
  console.error = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  let leve = false;
  try { await r.taches[0](); } catch { leve = true; } finally { console.error = origine; }
  verifier("panne d'envoi : la tâche ne lève jamais, 200 déjà rendu, seul le code fixe est journalisé (jamais l'uuid)", [r.reponse.statut, leve, lignes], [200, false, ["alerte_site_echec"]]);
}
for (const [nom, recu] of [["sans jeton", null], ["mauvais jeton", "T".repeat(40)]] as const) {
  const r = await essai(SECRET, recu, { restaurantId: RESTO });
  verifier(`${nom} : aucune tâche planifiée`, r.taches.length, 0);
}
const base = "https://h.test";
verifier("garde 404 externe : le chemin interne est refusé sous toutes ses formes", [
  "/api/v1/interne/alerte-commande", "/api/v1/interne", "/API/V1/INTERNE/x", "//api//v1//interne//x", "/api/v1/%69nterne/x", "/api/v1/./interne/x", "/api/v1/a/../interne/x",
  "/api%2Fv1%2Finterne%2Fx", "/api/v1/interne%5Cx", "/api/v1/x%2f..%2finterne/alerte-commande", "/api/v1/x%2F%2E%2E%2Finterne/alerte-commande",
  "/api/v1;x/interne/alerte-commande", "/api/v1/%2569nterne/alerte-commande", "/api/v1/%252569nterne/alerte-commande", "/api/v1/%25252569nterne/x", "/api/v1/interne%",
].map((c) => cheminInterneRefuse(base + c)), Array(16).fill(true));
verifier("garde 404 externe : les adresses légitimes passent", ["/", "/api/v1/version", "/api/v1/commandes", "/restaurant/cuisine-interne", "/restaurants?q=interne", "/api/v1/commandes?x=/api/v1/interne"].map((c) => cheminInterneRefuse(base + c)), [false, false, false, false, false, false]);
verifier("garde 404 externe : pourcentage mal formé SANS `interne` = réponse habituelle de Next (pas de 404 de la garde)", [cheminInterneRefuse(base + "/r/caf%"), cheminInterneRefuse(base + "/r/%E0%A4%A")], [false, false]);
verifier("garde 404 externe : chemin illisible refusé", cheminInterneRefuse("pas une url"), true);

// Gardes statiques : comparaison à temps constant, route branchée sur le moteur d'envoi, jamais mise en cache.
const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const pur = readFileSync(join(racine, "src/lib/api/alerte-interne.ts"), "utf8");
verifier("comparaison du secret par timingSafeEqual, jamais par ===", [/timingSafeEqual\(/.test(pur), /(recu|attendu)\s*[!=]==/.test(pur)], [true, false]);
const route = readFileSync(join(racine, "src/app/api/v1/interne/alerte-commande/route.ts"), "utf8");
verifier("route : jeton interne x-alerte-interne, after + notifierRestaurant, force-dynamic, aucun RELAIS_SECRET", [/CLE_JETON_ALERTE/.test(route), /headers\.get\("x-alerte-interne"\)/.test(route), /traiterAlerteInterne\([\s\S]*after,\s*notifierRestaurant\s*\)/.test(route), /export const dynamic = "force-dynamic"/.test(route), /RELAIS_SECRET/.test(route)], [true, true, true, true, false]);
const entree = readFileSync(join(racine, "worker-entree.js"), "utf8");
const jetons = readFileSync(join(racine, "worker-jetons.js"), "utf8");
verifier("worker-entree : la garde 404 est la première instruction de fetch", /async fetch\(request, env, ctx\) \{\s*(\/\/[^\n]*\n\s*)*if \(cheminInterneRefuse\(request\.url\)\) return new Response\(null, \{ status: 404/.test(entree), true);
verifier("worker-jetons : alerter valide l'uuid et planifie par waitUntil", [/alerter\(restaurantId\)/.test(jetons), /UUID\.test\(restaurantId\)/.test(jetons), /this\.ctx\.waitUntil\(/.test(jetons)], [true, true, true]);
verifier("route : ni cookie ni journal", /cookies|console\./.test(route), false);

const cle = readFileSync(join(racine, "src/lib/worker/cle-alerte-interne.ts"), "utf8");
verifier("clé du jeton d'isolat définie UNE seule fois (module partagé), importée par worker-jetons.js et par alerte-interne.ts", [/Symbol\.for\("speedfood\.alerte-interne"\)/.test(cle), /Symbol\.for/.test(jetons), /Symbol\.for/.test(pur), /from "\.\/src\/lib\/worker\/cle-alerte-interne\.ts"/.test(jetons), /cle-alerte-interne"/.test(pur)], [true, false, false, true, true]);
verifier("worker-jetons : journaux à code fixe (statut non ok, échec), sans donnée", [/console\.error\("alerte_interne_statut", r\.status\)/.test(jetons), /console\.error\("alerte_interne_echec"\)/.test(jetons)], [true, true]);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nAlerte interne vérifiée.");
