import { adresseIpPlausible, ipVisiteurDepuisEntetes, moduleRelaye, relayer } from "../../src/lib/api/relais-regles";

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

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nRègles du relais vérifiées.");
