/** Règles pures du relais du site vers l'API (voir docs/API-UNIQUE.md) : aucune lecture d'environnement ici, tout est injecté, tout est testé. */

/** `API_RELAIS` : absent, vide ou « non » = éteint ; « tout » = tous les modules ; sinon une liste de modules séparés par des virgules. */
export function moduleRelaye(reglage: string | undefined, module: string): boolean {
  const valeur = (reglage ?? "").trim().toLowerCase();
  if (valeur === "" || valeur === "non") return false;
  if (valeur === "tout") return true;
  return valeur.split(",").map((m) => m.trim()).includes(module.toLowerCase());
}

/** Une valeur a « l'allure » d'une adresse IP : caractères hexadécimaux, `:` et `.` seulement, 45 caractères au plus (IPv6 avec IPv4 intégrée). Ne prouve pas que l'adresse est valide : écarte le texte libre. */
export function adresseIpPlausible(valeur: string | null | undefined): valeur is string {
  return typeof valeur === "string" && valeur.length > 0 && valeur.length <= 45 && /^[0-9a-fA-F:.]+$/.test(valeur);
}

/** Adresse du visiteur à transmettre : `cf-connecting-ip` à défaut le premier `x-forwarded-for`, et seulement si elle a l'allure d'une adresse IP (sinon `null`, l'en-tête est omis). */
export function ipVisiteurDepuisEntetes(cfConnectingIp: string | null, xForwardedFor: string | null): string | null {
  const brute = cfConnectingIp ?? xForwardedFor?.split(",")[0]?.trim() ?? null;
  return adresseIpPlausible(brute) ? brute : null;
}

/** Réglages lus dans l'environnement par la colle (`relais.ts`) et injectés ici : aucune lecture de `process.env` dans ce fichier. */
export type ReglagesRelais = { API_RELAIS?: string; API_URL?: string; RELAIS_SECRET?: string };

/** Longueur minimale du secret partagé (même seuil que côté API) : en dessous, le relais est considéré mal configuré. */
export const LONGUEUR_MIN_SECRET = 32;

const HOTES_LOCAUX = ["localhost", "127.0.0.1", "[::1]"];

/** Adresse de base de l'API acceptable : https://, ou http:// seulement vers la boucle locale ; sans identifiants ; lisible. Le secret ne part jamais en clair hors de la machine. */
export function baseApiAcceptable(texte: string | undefined): texte is string {
  if (!texte) return false;
  try {
    const url = new URL(texte);
    if (url.username !== "" || url.password !== "") return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && HOTES_LOCAUX.includes(url.hostname);
  } catch {
    return false;
  }
}

export type DecisionRelais =
  | { type: "eteint" }
  | { type: "mal-configure" }
  | { type: "relayer"; baseApi: string; secret: string; repliPossible: boolean };

/**
 * Décision pure du garde de relais. « eteint » : aucun effet (aucun appel, aucune lecture du corps, aucun journal). « mal-configure » : le site traite lui-même (et journalise une fois) ;
 * la décision ne porte ni le secret ni l'adresse. « relayer » : le repli est permis pour une lecture (GET, HEAD), jamais pour une écriture.
 */
export function decisionRelais(env: ReglagesRelais, module: string, request: { method: string }): DecisionRelais {
  if (!moduleRelaye(env.API_RELAIS, module)) return { type: "eteint" };
  const secret = env.RELAIS_SECRET;
  if (!baseApiAcceptable(env.API_URL) || !secret || secret.length < LONGUEUR_MIN_SECRET) return { type: "mal-configure" };
  return { type: "relayer", baseApi: env.API_URL, secret, repliPossible: request.method === "GET" || request.method === "HEAD" };
}

/** Rend une fonction qui n'exécute `ecrire` qu'à son premier appel (un drapeau par signal : l'isolat en crée un au chargement du module, un test en recrée un pour repartir de zéro). */
export function creerSignalUnique(ecrire: () => void): () => void {
  let fait = false;
  return () => {
    if (fait) return;
    fait = true;
    ecrire();
  };
}

/** Statuts qui n'ont jamais de corps : `new Response(texte, …)` lèverait une exception. */
const STATUTS_SANS_CORPS = [101, 103, 204, 205, 304];

export type OptionsRelais = { baseApi: string; secret: string; ipVisiteur: string | null; envoyer?: typeof fetch; delaiMs?: number };

const ERREUR_SERVEUR = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } };

/**
 * Transmet la requête à l'API. Rend la réponse de l'API, ou `null` pour dire « traite-la toi-même » (panne réseau ou délai dépassé, et SEULEMENT pour une lecture :
 * une écriture dont on ne sait pas si elle est partie ne se rejoue jamais, elle répond ERREUR_SERVEUR). Une réponse 5xx de l'API n'est jamais un repli.
 * Seuls le jeton, le type de contenu et le corps traversent, plus le secret et l'adresse du visiteur ; les cookies ne traversent jamais.
 */
export async function relayer(request: Request, chemin: string, options: OptionsRelais, repliPossible: boolean): Promise<Response | null> {
  const envoyer = options.envoyer ?? fetch;
  const adresse = new URL(request.url);
  const url = `${options.baseApi.replace(/\/+$/, "")}${chemin}${adresse.search}`;
  const entetes = new Headers();
  const jeton = request.headers.get("authorization");
  const type = request.headers.get("content-type");
  if (jeton) entetes.set("authorization", jeton);
  if (type) entetes.set("content-type", type);
  entetes.set("x-relais-secret", options.secret);
  if (adresseIpPlausible(options.ipVisiteur)) entetes.set("x-relais-ip", options.ipVisiteur);

  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), options.delaiMs ?? 2500);
  try {
    const avecCorps = request.method !== "GET" && request.method !== "HEAD";
    const reponse = await envoyer(url, { method: request.method, headers: entetes, body: avecCorps ? await request.text() : undefined, redirect: "manual", signal: arret.signal });
    const sortie = new Headers();
    for (const nom of ["content-type", "cache-control"]) {
      const valeur = reponse.headers.get(nom);
      if (valeur) sortie.set(nom, valeur);
    }
    const sansCorps = STATUTS_SANS_CORPS.includes(reponse.status);
    return new Response(sansCorps ? null : await reponse.text(), { status: reponse.status, headers: sortie });
  } catch {
    if (repliPossible) return null;
    return new Response(JSON.stringify(ERREUR_SERVEUR), { status: 500, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } finally {
    clearTimeout(minuteur);
  }
}
