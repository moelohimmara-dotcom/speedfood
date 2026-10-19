// Micro-cache des pages publiques (revue de charge du 19 octobre 2026) : surtout ce qui ne doit JAMAIS être mis en cache.
import { MicroCache, decisionCache, reponseConservable, type RequeteLue } from "../../src/lib/worker/microcache";

let echecs = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown): void {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(`${ok ? "OK  " : "KO  "}  ${nom}${ok ? "" : ` : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`}`);
  if (!ok) echecs += 1;
}

const H = "https://speedfood-app.moelohimmara.workers.dev";
const ID = "73bd8244-71ed-445c-862b-53b9b07ff207";
const base: RequeteLue = { methode: "GET", url: `${H}/`, cookie: null, accept: "text/html,application/xhtml+xml", entetesNext: false };
const avec = (o: Partial<RequeteLue>): RequeteLue => ({ ...base, ...o });
const HOTE = "speedfood-app.moelohimmara.workers.dev";
const cle = (r: RequeteLue) => {
  const c = decisionCache(r)?.cle ?? null;
  return c !== null && c.startsWith(HOTE) ? c.slice(HOTE.length) : c;
};

// Ce qui est mis en cache
verifier("accueil anonyme : mis en cache 30 s, clé avec le domaine", decisionCache(base), { cle: "speedfood-app.moelohimmara.workers.dev/", ttlMs: 30000 });
verifier("deux domaines, deux clés", cle(avec({ url: "https://autre.example/restaurants" })) !== cle(avec({ url: `${H}/restaurants` })), true);
verifier("liste des restaurants", cle(avec({ url: `${H}/restaurants` })), "/restaurants");
verifier("fiche d'un restaurant", cle(avec({ url: `${H}/restaurants/${ID}` })), `/restaurants/${ID}`);
verifier("fiche d'une localité", cle(avec({ url: `${H}/quartiers/kaporo-centre` })), "/quartiers/kaporo-centre");
verifier("page d'information : 120 s", decisionCache(avec({ url: `${H}/a-propos` }))?.ttlMs, 120000);
verifier("la clé garde les filtres (deux filtres, deux entrées)", cle(avec({ url: `${H}/restaurants?categorie=grillades` })), "/restaurants?categorie=grillades");
verifier("plusieurs filtres admis", cle(avec({ url: `${H}/restaurants?ouvert=1&tri=prix` })), "/restaurants?ouvert=1&tri=prix");
verifier("barre finale ignorée", cle(avec({ url: `${H}/restaurants/` })), "/restaurants");
verifier("cookie sans rapport (aucune session) : mis en cache", cle(avec({ url: `${H}/restaurants`, cookie: "autre=1; theme=sombre" })), "/restaurants");

// Ce qui ne l'est JAMAIS
verifier("session Supabase : jamais", cle(avec({ cookie: "sb-abcdef-auth-token=xyz" })), null);
verifier("session Supabase en morceaux : jamais", cle(avec({ cookie: "a=1; sb-abcdef-auth-token.0=xyz; sb-abcdef-auth-token.1=uvw" })), null);
verifier("cookie de suivi de commande : jamais", cle(avec({ cookie: "speedfood_suivi=abc" })), null);
verifier("POST : jamais", cle(avec({ methode: "POST" })), null);
verifier("HEAD : jamais", cle(avec({ methode: "HEAD" })), null);
verifier("action serveur / navigation interne de Next : jamais", cle(avec({ entetesNext: true })), null);
verifier("requête qui n'attend pas du HTML : jamais", cle(avec({ accept: "application/json" })), null);
verifier("sans en-tête Accept : jamais", cle(avec({ accept: null })), null);
verifier("paramètre _rsc : jamais", cle(avec({ url: `${H}/restaurants?_rsc=abc12` })), null);
verifier("aperçu des textes : jamais", cle(avec({ url: `${H}/?apercu_textes=1` })), null);
verifier("paramètre inconnu : jamais (pas de variantes à volonté)", cle(avec({ url: `${H}/restaurants?x=1` })), null);
verifier("recherche libre q : jamais", cle(avec({ url: `${H}/restaurants?q=poulet` })), null);
verifier("accueil avec paramètre : jamais", cle(avec({ url: `${H}/?s=qr` })), null);
verifier("aperçu de l'accueil : jamais", cle(avec({ url: `${H}/?apercu=b` })), null);
verifier("fiche avec table et clé du QR : jamais", cle(avec({ url: `${H}/restaurants/${ID}?table=5&k=0123456789abcdef` })), null);
verifier("bandeau de suppression de compte : jamais", cle(avec({ url: `${H}/restaurants?compte=supprime` })), null);
verifier("recherche trop longue : jamais (pas d'explosion de clés)", cle(avec({ url: `${H}/restaurants?q=${"a".repeat(300)}` })), null);
for (const chemin of ["/panier", "/commande", "/connexion", "/inscription", "/compte", "/suivi", `/suivi/${"x".repeat(40)}`, "/restaurant", "/restaurant/commandes", "/system", "/system/acces", "/livreur", "/recu/abc", "/api/suivi/session", "/entrer", "/aide-au-choix", `/restaurants/${ID}/alternatives`, "/restaurants/pas-un-identifiant", "/quartiers/a/b", "/r/abcd12", "/.well-known/assetlinks.json", "/sw.js"]) {
  verifier(`${chemin} : jamais`, cle(avec({ url: `${H}${chemin}` })), null);
}
verifier("adresse illisible : jamais", cle(avec({ url: "pas une adresse" })), null);

// Ce qui est conservé après rendu
const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });
verifier("200 HTML sans cookie : conservé", reponseConservable(200, h({ "content-type": "text/html; charset=utf-8" })), true);
verifier("200 HTML avec Set-Cookie : jamais conservé", reponseConservable(200, h({ "content-type": "text/html", "set-cookie": "a=b" })), false);
verifier("redirection : jamais conservée", reponseConservable(307, h({ "content-type": "text/html" })), false);
verifier("404 : jamais conservé", reponseConservable(404, h({ "content-type": "text/html" })), false);
verifier("500 : jamais conservé", reponseConservable(500, h({ "content-type": "text/html" })), false);
verifier("JSON : jamais conservé", reponseConservable(200, h({ "content-type": "application/json" })), false);

// Le cache lui-même
const corps = (n: number) => new ArrayBuffer(n);
const entree = (n: number, expireLe: number) => ({ statut: 200, entetes: [] as [string, string][], corps: corps(n), expireLe, creeLe: 0 });
const c = new MicroCache(3, 1000, 600);
c.set("a", entree(100, 1000));
verifier("lecture avant expiration", c.get("a", 999) !== null, true);
verifier("lecture à l'expiration : absente et retirée", c.get("a", 1000), null);
verifier("après expiration la taille revient à 0", c.taille, 0);
c.set("1", entree(10, 5000)); c.set("2", entree(10, 5000)); c.set("3", entree(10, 5000)); c.set("4", entree(10, 5000));
verifier("au plus 3 entrées : la plus ancienne sort", [c.get("1", 0), c.get("4", 0)].map((x) => x !== null), [false, true]);
verifier("trop gros pour une entrée : refusé", c.set("gros", entree(601, 5000)), false);
// Le plus récemment utilisé survit (LRU)
const l = new MicroCache(2, 1000, 600);
l.set("p", entree(10, 9000)); l.set("q", entree(10, 9000));
l.get("p", 0);
l.set("r", entree(10, 9000));
verifier("LRU : la page relue survit, la plus ancienne sort", [l.get("p", 0), l.get("q", 0), l.get("r", 0)].map((x) => x !== null), [true, false, true]);
const d = new MicroCache(10, 250, 200);
d.set("x", entree(130, 5000)); d.set("y", entree(130, 5000));
verifier("plafond d'octets : la plus ancienne sort", [d.get("x", 0), d.get("y", 0)].map((x) => x !== null), [false, true]);

if (echecs > 0) {
  console.log(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\nTout est bon (micro-cache).");
