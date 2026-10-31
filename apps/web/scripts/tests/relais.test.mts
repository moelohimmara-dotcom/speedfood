import { STATUTS_SANS_CORPS, adresseIpPlausible, creerSignalUnique, decisionRelais, ipVisiteurDepuisEntetes, moduleRelaye, relayer } from "../../src/lib/api/relais-regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("éteint par défaut", [moduleRelaye(undefined, "client"), moduleRelaye("", "client"), moduleRelaye("non", "client"), moduleRelaye("NON", "client")], [false, false, false, false]);
verifier("tout", [moduleRelaye("tout", "client"), moduleRelaye("TOUT", "moi")], [true, true]);
verifier("liste de modules", [moduleRelaye("client, moi", "client"), moduleRelaye("client, moi", "moi"), moduleRelaye("client, moi", "aide"), moduleRelaye("Client", "client")], [true, true, false, true]);
verifier("un nom partiel ne correspond pas", moduleRelaye("clients", "client"), false);

verifier("adresses plausibles : IPv4, IPv6, IPv4 intégrée", [adresseIpPlausible("203.0.113.9"), adresseIpPlausible("2001:db8::1"), adresseIpPlausible("::ffff:203.0.113.9")], [true, true, true]);
verifier("adresses non plausibles : texte libre, vide, espaces, trop long, absent", [adresseIpPlausible("pas une ip"), adresseIpPlausible(""), adresseIpPlausible("1.1.1.1, 2.2.2.2"), adresseIpPlausible("a".repeat(46)), adresseIpPlausible("<script>"), adresseIpPlausible(null)], [false, false, false, false, false, false]);
verifier("45 caractères acceptés, 46 refusés", [adresseIpPlausible("a".repeat(45)), adresseIpPlausible("a".repeat(46))], [true, false]);
verifier("ip du visiteur : cf-connecting-ip d'abord, sinon premier x-forwarded-for", [ipVisiteurDepuisEntetes("203.0.113.9", "5.5.5.5"), ipVisiteurDepuisEntetes(null, "198.51.100.7, 10.0.0.1"), ipVisiteurDepuisEntetes(null, null)], ["203.0.113.9", "198.51.100.7", null]);
verifier("ip du visiteur : une valeur sans allure d'adresse est omise (jamais remplacée par un en-tête plus faible)", [ipVisiteurDepuisEntetes("n'importe quoi", "5.5.5.5"), ipVisiteurDepuisEntetes(null, "texte libre, 1.1.1.1")], [null, null]);

type Appel = { url: string; init: RequestInit };
const OPTIONS = { baseApi: "https://api.exemple.test/", secret: "s3cret", ipVisiteur: "203.0.113.9", delaiMs: 200 };

async function essai(requete: Request, repli: boolean, envoyer: typeof fetch) {
  return relayer(requete, "/api/v1/client/favoris", { ...OPTIONS, envoyer }, repli);
}

{
  const appels: Appel[] = [];
  const envoyer = (async (url: string, init: RequestInit) => {
    appels.push({ url, init });
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }) as unknown as typeof fetch;
  const requete = new Request("https://site.test/api/v1/client/favoris?x=1", { method: "POST", headers: { authorization: "Bearer a.b.c", "content-type": "application/json", cookie: "sb=SECRETCOOKIE" }, body: '{"restaurantId":"r1"}' });
  const reponse = await essai(requete, false, envoyer);
  verifier("réponse de l'API rendue telle quelle", [reponse?.status, await reponse?.text(), reponse?.headers.get("cache-control")], [200, '{"ok":true}', "no-store"]);
  const h = new Headers(appels[0]?.init.headers);
  verifier("URL : base de l'API + chemin + chaîne de requête, sans double barre", appels[0]?.url, "https://api.exemple.test/api/v1/client/favoris?x=1");
  verifier("méthode et corps transmis", [appels[0]?.init.method, String(appels[0]?.init.body ?? "")], ["POST", '{"restaurantId":"r1"}']);
  verifier("en-têtes transmis : jeton, type, secret, adresse du visiteur ; PAS de cookie", [h.get("authorization"), h.get("content-type"), h.get("x-relais-secret"), h.get("x-relais-ip"), h.get("cookie")], ["Bearer a.b.c", "application/json", "s3cret", "203.0.113.9", null]);
  verifier("aucun autre en-tête que ceux prévus", [...h.keys()].sort(), ["authorization", "content-type", "x-relais-ip", "x-relais-secret"]);
}

{
  const appels: Appel[] = [];
  const envoyer = (async (url: string, init: RequestInit) => { appels.push({ url, init }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  const requete = new Request("https://site.test/api/v1/aide", { method: "GET" });
  await relayer(requete, "/api/v1/aide", { ...OPTIONS, ipVisiteur: "texte libre\ninjecté", envoyer }, true);
  const h = new Headers(appels[0]?.init.headers);
  verifier("adresse du visiteur sans allure d'IP : x-relais-ip omis (le secret passe quand même)", [h.get("x-relais-ip"), h.get("x-relais-secret"), appels[0]?.init.body], [null, "s3cret", undefined]);
}

{
  const envoyer = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  const lecture = new Request("https://site.test/api/v1/client/espace", { method: "GET", headers: { authorization: "Bearer a.b.c" } });
  verifier("lecture : panne réseau → repli (null, le site traite lui-même)", await essai(lecture, true, envoyer), null);
  const ecriture = new Request("https://site.test/api/v1/client/favoris", { method: "POST", headers: { authorization: "Bearer a.b.c", "content-type": "application/json" }, body: "{}" });
  const r = await essai(ecriture, false, envoyer);
  verifier("écriture : panne réseau → ERREUR_SERVEUR 500, jamais rejouée par le site", [r?.status, await r?.json()], [500, { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } }]);
}

{
  const lent = (async (_u: string, init: RequestInit) => new Promise<Response>((_ok, ko2) => init.signal?.addEventListener("abort", () => ko2(new DOMException("abort", "AbortError"))))) as unknown as typeof fetch;
  const lecture = new Request("https://site.test/api/v1/client/espace", { method: "GET" });
  verifier("délai dépassé sur une lecture → repli", await essai(lecture, true, lent), null);
  const ecriture = new Request("https://site.test/api/v1/client/favoris", { method: "POST", body: "{}" });
  const r = await essai(ecriture, false, lent);
  verifier("délai dépassé sur une écriture → ERREUR_SERVEUR 500", r?.status, 500);
}

{
  const cinqCents = (async () => new Response('{"ok":false,"erreur":{"code":"ERREUR_SERVEUR","message":"x"}}', { status: 500, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  const lecture = new Request("https://site.test/api/v1/client/espace", { method: "GET" });
  const r = await essai(lecture, true, cinqCents);
  verifier("une réponse 5xx de l'API n'est PAS un déclencheur de repli (la requête a pu être traitée)", r?.status, 500);
}

{
  const appels: Appel[] = [];
  const envoyer = (async (url: string, init: RequestInit) => { appels.push({ url, init }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  const requete = new Request("https://site.test/api/v1/aide", { method: "GET", headers: { "x-relais-secret": "pirate", "x-relais-ip": "1.1.1.1" } });
  await relayer(requete, "/api/v1/aide", { ...OPTIONS, envoyer }, true);
  const h = new Headers(appels[0]?.init.headers);
  verifier("un visiteur ne peut pas injecter ses propres en-têtes de relais", [h.get("x-relais-secret"), h.get("x-relais-ip")], ["s3cret", "203.0.113.9"]);
}

{
  const envoyer = (async () => { throw new TypeError("fetch failed s3cret"); }) as unknown as typeof fetch;
  const ecriture = new Request("https://site.test/api/v1/client/favoris", { method: "POST", headers: { authorization: "Bearer jeton.secret.x" }, body: "{}" });
  const r = await essai(ecriture, false, envoyer);
  const texte = (await r?.text()) ?? "";
  verifier("la réponse d'erreur ne contient ni le secret ni le jeton", [texte.includes("s3cret"), texte.includes("jeton.secret.x")], [false, false]);
}

// --- Réserves 4 et 12 : réponses de l'API sans corps (null body status) ---
for (const statut of [204, 205, 304]) {
  const envoyer = (async () => new Response(null, { status: statut, headers: { "cache-control": "no-store" } })) as unknown as typeof fetch;
  const lecture = new Request("https://site.test/api/v1/client/espace", { method: "GET" });
  let r: Response | null | undefined;
  let leve = false;
  try { r = await essai(lecture, true, envoyer); } catch { leve = true; }
  verifier(`réponse ${statut} de l'API sans corps : rendue telle quelle, sans plantage ni repli`, [leve, r?.status, r?.body, r?.headers.get("cache-control")], [false, statut, null, "no-store"]);
}
{
  const envoyer = (async () => new Response("", { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  const r = await essai(new Request("https://site.test/api/v1/aide", { method: "GET" }), true, envoyer);
  verifier("réponse 200 au corps vide : rendue (200, texte vide)", [r?.status, await r?.text()], [200, ""]);
}
{
  // Une écriture suivie d'un 204 ne devient jamais une erreur 500.
  const envoyer = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
  const r = await essai(new Request("https://site.test/api/v1/client/favoris", { method: "DELETE", body: "{}" }), false, envoyer);
  verifier("écriture suivie d'un 204 : 204 rendu, pas ERREUR_SERVEUR", r?.status, 204);
}

// --- Réserve 3 : HEAD ---
{
  const appels: Appel[] = [];
  const envoyer = (async (url: string, init: RequestInit) => { appels.push({ url, init }); return new Response(null, { status: 200, headers: { "content-type": "application/json" } }); }) as unknown as typeof fetch;
  const r = await essai(new Request("https://site.test/api/v1/aide", { method: "HEAD" }), true, envoyer);
  verifier("HEAD relayé sans corps", [r?.status, appels[0]?.init.method, appels[0]?.init.body], [200, "HEAD", undefined]);
  const panne = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  verifier("HEAD : panne réseau → repli (null)", await essai(new Request("https://site.test/api/v1/aide", { method: "HEAD" }), true, panne), null);
}

// --- Réserves 1, 2, 3, 10 : décision pure ---
const SECRET32 = "0123456789abcdef0123456789abcdef";
const ENV_OK = { API_RELAIS: "tout", API_URL: "https://api.exemple.test", RELAIS_SECRET: SECRET32 };
const req = (methode: string) => ({ method: methode });
const type = (d: { type: string }) => d.type;

verifier("décision : éteint si API_RELAIS absent, vide, « non » (même mal configuré)", [
  type(decisionRelais({}, "client", req("GET"))),
  type(decisionRelais({ ...ENV_OK, API_RELAIS: "" }, "client", req("GET"))),
  type(decisionRelais({ ...ENV_OK, API_RELAIS: "non" }, "client", req("GET"))),
  type(decisionRelais({ API_RELAIS: "non", API_URL: "http://pirate.test", RELAIS_SECRET: "x" }, "client", req("GET"))),
], ["eteint", "eteint", "eteint", "eteint"]);
verifier("décision : éteint pour un module non listé", type(decisionRelais({ ...ENV_OK, API_RELAIS: "moi" }, "client", req("GET"))), "eteint");
verifier("décision : relayer, avec base, secret et repli possible pour GET", decisionRelais(ENV_OK, "client", req("GET")), { type: "relayer", baseApi: "https://api.exemple.test", secret: SECRET32, repliPossible: true });
verifier("décision : repli permis pour GET et HEAD seulement", ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].map((m) => { const d = decisionRelais(ENV_OK, "client", req(m)); return d.type === "relayer" && d.repliPossible; }), [true, true, false, false, false, false, false]);
verifier("décision : mal configuré si API_URL ou RELAIS_SECRET absent ou vide", [
  type(decisionRelais({ API_RELAIS: "tout", RELAIS_SECRET: SECRET32 }, "client", req("GET"))),
  type(decisionRelais({ API_RELAIS: "tout", API_URL: "", RELAIS_SECRET: SECRET32 }, "client", req("GET"))),
  type(decisionRelais({ API_RELAIS: "tout", API_URL: "https://api.exemple.test" }, "client", req("GET"))),
  type(decisionRelais({ ...ENV_OK, RELAIS_SECRET: "" }, "client", req("GET"))),
], ["mal-configure", "mal-configure", "mal-configure", "mal-configure"]);
verifier("décision : secret de moins de 32 caractères = mal configuré (31 refusé, 32 accepté)", [
  type(decisionRelais({ ...ENV_OK, RELAIS_SECRET: "a".repeat(31) }, "client", req("GET"))),
  type(decisionRelais({ ...ENV_OK, RELAIS_SECRET: "a".repeat(32) }, "client", req("GET"))),
], ["mal-configure", "relayer"]);
verifier("décision : API_URL en http:// hors boucle locale = mal configuré (le secret ne part jamais en clair)", [
  "http://api.exemple.test", "http://localhost.evil.test", "http://10.0.0.1", "ftp://api.exemple.test", "api.exemple.test", "//api.exemple.test", "https:/", "pas une adresse",
].map((u) => type(decisionRelais({ ...ENV_OK, API_URL: u }, "client", req("GET")))), Array(8).fill("mal-configure"));
verifier("décision : http:// toléré seulement vers localhost, 127.0.0.1 et [::1]", [
  "http://localhost:8788", "http://127.0.0.1:8788", "http://[::1]:8788", "http://LOCALHOST",
].map((u) => type(decisionRelais({ ...ENV_OK, API_URL: u }, "client", req("GET")))), Array(4).fill("relayer"));
verifier("décision : https:// accepté, avec port", type(decisionRelais({ ...ENV_OK, API_URL: "https://api.exemple.test:8443" }, "client", req("GET"))), "relayer");
verifier("décision : API_URL avec identifiants (user:pass@) refusée, en https comme en http local", [
  "https://user:pass@api.exemple.test", "https://user@api.exemple.test", "http://u:p@localhost:8788",
].map((u) => type(decisionRelais({ ...ENV_OK, API_URL: u }, "client", req("GET")))), Array(3).fill("mal-configure"));
verifier("décision : la décision mal configurée ne contient ni le secret ni l'adresse", JSON.stringify(decisionRelais({ ...ENV_OK, API_URL: "http://api.exemple.test" }, "client", req("GET"))), '{"type":"mal-configure"}');

verifier("décision : secret de forme invalide (retour à la ligne, accent, espace, tabulation, DEL) = mal configuré, sans plantage", [
  SECRET32 + "\n", SECRET32.slice(0, 10) + "\n" + SECRET32.slice(10), SECRET32 + "\r\n", SECRET32 + "é", " " + SECRET32, SECRET32 + " ", SECRET32.slice(0, 10) + " " + SECRET32.slice(10), SECRET32 + "\t", SECRET32 + "\x7f",
].map((secret) => type(decisionRelais({ ...ENV_OK, RELAIS_SECRET: secret }, "client", req("GET")))), Array(9).fill("mal-configure"));
verifier("décision : secret en ASCII visible (bornes ! et ~), 32 caractères = relayer ; 31 = mal configuré", [
  type(decisionRelais({ ...ENV_OK, RELAIS_SECRET: "!".repeat(32) }, "client", req("GET"))),
  type(decisionRelais({ ...ENV_OK, RELAIS_SECRET: "~".repeat(32) }, "client", req("GET"))),
  type(decisionRelais({ ...ENV_OK, RELAIS_SECRET: "~".repeat(31) }, "client", req("GET"))),
], ["relayer", "relayer", "mal-configure"]);
verifier("décision : API_URL avec chaîne de requête, fragment ou chemin = mal configuré", [
  "https://api.exemple.test?x=1", "https://api.exemple.test/?x=1", "https://api.exemple.test/#f", "https://api.exemple.test#f", "https://api.exemple.test/v1", "https://api.exemple.test/v1/", "http://localhost:8788/api",
].map((u) => type(decisionRelais({ ...ENV_OK, API_URL: u }, "client", req("GET")))), Array(7).fill("mal-configure"));
verifier("décision : API_URL avec barre finale seule ou sans chemin = relayer", [
  type(decisionRelais({ ...ENV_OK, API_URL: "https://api.exemple.test/" }, "client", req("GET"))),
  type(decisionRelais({ ...ENV_OK, API_URL: "http://localhost:8788/" }, "client", req("GET"))),
], ["relayer", "relayer"]);
verifier("statuts sans corps : 204, 205, 304 seulement (101 et 103 ne peuvent pas être construits)", STATUTS_SANS_CORPS, [204, 205, 304]);
verifier("chaque statut sans corps se reconstruit sans exception", STATUTS_SANS_CORPS.map((st) => new Response(null, { status: st }).status), [204, 205, 304]);

// --- Réserve 5 : journal une seule fois par isolat ---
{
  let ecritures = 0;
  const signaler = creerSignalUnique(() => { ecritures++; });
  signaler(); signaler(); signaler();
  verifier("signal unique : écrit une seule fois malgré trois appels", ecritures, 1);
  const autre = creerSignalUnique(() => { ecritures++; });
  autre();
  verifier("signal unique : chaque signal a son propre drapeau (réinitialisable en recréant le signal)", ecritures, 2);
}

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nRègles du relais vérifiées.");
