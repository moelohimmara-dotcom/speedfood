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

/** Forme d'un secret de relais acceptable (même règle que côté API) : 32 caractères au moins, ASCII visible seulement (ni espace, ni retour à la ligne, ni accent). Sinon le relais est mal configuré : une valeur hors de cette forme ferait planter l'en-tête ou serait modifiée en route (espaces de bord retirés), et l'API refuserait la confiance en silence. */
export const SECRET_RELAIS_VALIDE = /^[\x21-\x7E]{32,}$/;

const HOTES_LOCAUX = ["localhost", "127.0.0.1", "[::1]"];

/** Adresse de base de l'API acceptable : https://, ou http:// seulement vers la boucle locale ; sans identifiants, sans chemin (hors « / »), sans requête ni fragment ; lisible. Le secret ne part jamais en clair hors de la machine. */
export function baseApiAcceptable(texte: string | undefined): texte is string {
  if (!texte) return false;
  try {
    const url = new URL(texte);
    if (url.username !== "" || url.password !== "") return false;
    // Ni chaîne de requête, ni fragment, ni chemin : `relayer` colle le chemin de la requête à cette base, un préfixe de chemin serait gardé sans que personne l'ait voulu.
    if (url.search !== "" || url.hash !== "" || url.pathname !== "/") return false;
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
 * Réglages propres à une route (étape 1c-1). `lecture: true` déclare qu'une route en POST est une LECTURE (aucun effet en base, ex. `POST /suivi` qui porte le jeton de suivi dans le corps) :
 * le repli vers le site est alors permis sur panne ou délai. À ne JAMAIS poser sur une écriture (règle 5 : une écriture n'est jamais rejouée). `delaiMs` remplace le délai par défaut.
 */
export type OptionsRoute = { lecture?: boolean; delaiMs?: number };

/**
 * Décision pure du garde de relais. « eteint » : aucun effet (aucun appel, aucune lecture du corps, aucun journal). « mal-configure » : le site traite lui-même (et journalise une fois) ;
 * la décision ne porte ni le secret ni l'adresse. « relayer » : le repli est permis pour une lecture (GET, HEAD, ou route déclarée `lecture: true`), jamais pour une écriture.
 */
export function decisionRelais(env: ReglagesRelais, module: string, request: { method: string }, options?: OptionsRoute): DecisionRelais {
  if (!moduleRelaye(env.API_RELAIS, module)) return { type: "eteint" };
  const secret = env.RELAIS_SECRET;
  if (!baseApiAcceptable(env.API_URL) || !secret || !SECRET_RELAIS_VALIDE.test(secret)) return { type: "mal-configure" };
  const repliPossible = options?.lecture === true || request.method === "GET" || request.method === "HEAD";
  return { type: "relayer", baseApi: env.API_URL, secret, repliPossible };
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

/** Statuts sans corps constructibles par `new Response` (101 et 103 ne le sont pas : `fetch` ne les rend pas à l'appelant) : `new Response(texte, …)` lèverait une exception avec un corps. */
export const STATUTS_SANS_CORPS = [204, 205, 304];

export type OptionsRelais = { baseApi: string; secret: string; ipVisiteur: string | null; envoyer?: typeof fetch; delaiMs?: number };

const ERREUR_SERVEUR = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } };

/** Délai par défaut de l'appel à l'API (étape 1b). Un `delaiMs` absent, nul, négatif ou non fini retombe dessus (jamais un minuteur à 0 qui couperait tout). */
export const DELAI_RELAIS_DEFAUT_MS = 2500;

function delaiEffectif(delaiMs: number | undefined): number {
  return typeof delaiMs === "number" && Number.isFinite(delaiMs) && delaiMs > 0 ? delaiMs : DELAI_RELAIS_DEFAUT_MS;
}

/**
 * Transmet la requête à l'API. Rend la réponse de l'API, ou `null` pour dire « traite-la toi-même » (panne réseau ou délai dépassé, et SEULEMENT pour une lecture :
 * une écriture dont on ne sait pas si elle est partie ne se rejoue jamais, elle répond ERREUR_SERVEUR). Une réponse 5xx de l'API n'est jamais un repli.
 * Seuls le jeton, le type de contenu et le corps traversent, plus le secret et l'adresse du visiteur ; les cookies ne traversent jamais.
 * Corps conservé : quand le repli est possible et que la requête a un corps (POST déclaré en lecture), le corps est lu sur une COPIE (`request.clone()`) pour que la route du site
 * le retrouve intact en cas de repli ; sans repli possible, le corps est lu sur l'original, comme en 1b (aucune copie).
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
  const minuteur = setTimeout(() => arret.abort(), delaiEffectif(options.delaiMs));
  try {
    const avecCorps = request.method !== "GET" && request.method !== "HEAD";
    const corps = avecCorps ? await (repliPossible ? request.clone() : request).text() : undefined;
    const reponse = await envoyer(url, { method: request.method, headers: entetes, body: corps, redirect: "manual", signal: arret.signal });
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
