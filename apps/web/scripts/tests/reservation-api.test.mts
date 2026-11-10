import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MESSAGE_CONNEXION_EXPIREE, MESSAGE_RESULTAT_INCERTAIN, MESSAGE_SERVICE_INDISPONIBLE, appelerApi, cheminDisponibilite, cheminListeRestaurant, cheminReservation, corpsCreation,
  decisionServiceReservation, messagePourErreur,
} from "../../src/lib/reservation/api-regles";
import {
  lireReponseCreationReservation, lireReponseDisponibiliteReservation, lireReponseListeReservations, type DemandeReservation,
} from "../../src/lib/contracts/reservation";

// Appel de l'API de réservation depuis le SERVEUR du site (lot M4b) : décision « service disponible », transmission du jeton de la session, jamais de rejeu,
// réponses lues par les parseurs stricts, messages en français. Aucun réseau réel : le `fetch` est factice.
let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const RESTO = "0b6f2a5e-9a7e-4f43-8a52-6d1b0c9e1a11";
const RESA = "7d0f6c0e-2c1b-4b8e-9f43-1a2b3c4d5e6f";
const SECRET = "s".repeat(40);
const SERVICE = { baseApi: "https://api.exemple.test/", secret: SECRET, ipVisiteur: "41.77.12.5" };
const JETON = "jeton.porteur.factice";

const RESERVATION = {
  id: RESA, reference: "SF-R-ABCDE", restaurantId: RESTO, restaurantNom: "Chez Fatou", creneau: "2026-11-12T19:15:00.000Z", nbPersonnes: 4, nom: "Aïssatou Diallo",
  telephone: "+224620000000", note: null, statut: "demandee", motif: null, creeLe: "2026-11-10T12:00:00.000Z",
};

type Appel = { url: string; init: RequestInit };
function faux(reponse: () => Promise<Response> | Response) {
  const appels: Appel[] = [];
  const envoyer = (async (url: string, init: RequestInit) => {
    appels.push({ url, init });
    return reponse();
  }) as unknown as typeof fetch;
  return { appels, envoyer };
}
const json = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });

// ---------- décision : le service est éteint par défaut ----------
const ENV_OK = { API_RELAIS: "reservation", API_URL: "https://api.exemple.test/", RELAIS_SECRET: SECRET };
verifier("service actif quand le module « reservation » est allumé, l'adresse et le secret valides", decisionServiceReservation(ENV_OK), { type: "actif", baseApi: "https://api.exemple.test/", secret: SECRET });
verifier("éteint par défaut : sans API_RELAIS", decisionServiceReservation({ API_URL: ENV_OK.API_URL, RELAIS_SECRET: SECRET }).type, "indisponible");
verifier("éteint : API_RELAIS=non", decisionServiceReservation({ ...ENV_OK, API_RELAIS: "non" }).type, "indisponible");
verifier("éteint : un autre module seulement (commandes, suivi, client...)", decisionServiceReservation({ ...ENV_OK, API_RELAIS: "commandes,suivi,client" }).type, "indisponible");
verifier("allumé aussi par « tout » (même règle que les autres modules)", decisionServiceReservation({ ...ENV_OK, API_RELAIS: "tout" }).type, "actif");
verifier("réglage de service en cours (public,moi,client,livraison) : réservation reste éteinte", decisionServiceReservation({ ...ENV_OK, API_RELAIS: "public,moi,client,livraison" }).type, "indisponible");
verifier("indisponible : sans adresse de l'API", decisionServiceReservation({ API_RELAIS: "reservation", RELAIS_SECRET: SECRET }).type, "indisponible");
verifier("indisponible : sans secret", decisionServiceReservation({ API_RELAIS: "reservation", API_URL: ENV_OK.API_URL }).type, "indisponible");
verifier("indisponible : secret trop court", decisionServiceReservation({ ...ENV_OK, RELAIS_SECRET: "court" }).type, "indisponible");
verifier("indisponible : adresse http hors machine locale (le secret ne part pas en clair)", decisionServiceReservation({ ...ENV_OK, API_URL: "http://api.exemple.test/" }).type, "indisponible");
verifier("indisponible : adresse avec chemin", decisionServiceReservation({ ...ENV_OK, API_URL: "https://api.exemple.test/v1" }).type, "indisponible");
verifier("actif : http vers la boucle locale (essais)", decisionServiceReservation({ ...ENV_OK, API_URL: "http://localhost:8787/" }).type, "actif");
verifier("la décision ne contient ni raison technique ni secret quand elle refuse", JSON.stringify(decisionServiceReservation({ ...ENV_OK, RELAIS_SECRET: "court" })).includes("court"), false);
verifier("message de service indisponible, en français", MESSAGE_SERVICE_INDISPONIBLE, "Le service de réservation est momentanément indisponible. Réessayez dans un instant.");

// ---------- appel : le jeton de la SESSION part, rien d'autre ----------
{
  const { appels, envoyer } = faux(() => json({ ok: true, restaurantId: RESTO, accepteReservation: true, nbPersonnesMax: 12 }));
  const r = await appelerApi({ service: SERVICE, jeton: JETON, methode: "GET", chemin: cheminDisponibilite(RESTO) as string, lire: lireReponseDisponibiliteReservation, envoyer });
  verifier("lecture : réponse stricte lue", r, { ok: true, donnees: { restaurantId: RESTO, accepteReservation: true, nbPersonnesMax: 12 } });
  const h = new Headers(appels[0].init.headers);
  verifier("lecture : une seule requête, GET, sur l'adresse de l'API", [appels.length, appels[0].init.method, appels[0].url], [1, "GET", `https://api.exemple.test/api/v1/reservations/restaurants/${RESTO}/disponibilite`]);
  verifier("lecture : jeton porteur de la session transmis", h.get("authorization"), `Bearer ${JETON}`);
  verifier("lecture : secret de relais et adresse du visiteur transmis, aucun cookie", [h.get("x-relais-secret"), h.get("x-relais-ip"), h.get("cookie")], [SECRET, "41.77.12.5", null]);
  verifier("lecture : ni corps ni type de contenu", [appels[0].init.body ?? null, h.get("content-type")], [null, null]);
  verifier("lecture : redirections jamais suivies, jamais de cache", [appels[0].init.redirect, appels[0].init.cache], ["manual", "no-store"]);
  verifier("lecture : un délai est posé (signal d'arrêt)", appels[0].init.signal instanceof AbortSignal, true);
}
{
  const demande: DemandeReservation = { restaurantId: RESTO, creneau: "2026-11-12T19:15:00.000Z", nbPersonnes: 4, nom: "Aïssatou Diallo", telephone: "+224620000000", note: null };
  const { appels, envoyer } = faux(() => json({ ok: true, reservation: RESERVATION, idempotent: false }, 201));
  const r = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: corpsCreation(demande), lire: lireReponseCreationReservation, envoyer, delaiMs: 8000 });
  verifier("création : réservation lue", r.ok ? [r.donnees.reservation.reference, r.donnees.idempotent] : r, ["SF-R-ABCDE", false]);
  const h = new Headers(appels[0].init.headers);
  verifier("création : POST JSON avec le jeton", [appels[0].init.method, h.get("content-type"), h.get("authorization")], ["POST", "application/json", `Bearer ${JETON}`]);
  verifier("création : corps = exactement les six champs de la demande", Object.keys(JSON.parse(String(appels[0].init.body))).sort(), ["creneau", "nbPersonnes", "nom", "note", "restaurantId", "telephone"]);
  verifier("création : aucune clé d'identité dans le corps, même polluée en amont", (() => {
    const polluee = { ...demande, utilisateurId: "u-1", compte: "c-1", userId: "u-2", restaurant_id: "x" } as unknown as DemandeReservation;
    return Object.keys(corpsCreation(polluee)).sort();
  })(), ["creneau", "nbPersonnes", "nom", "note", "restaurantId", "telephone"]);
}

// ---------- jeton absent : rien n'est envoyé ----------
{
  const { appels, envoyer } = faux(() => json({}));
  const r = await appelerApi({ service: SERVICE, jeton: null, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer });
  verifier("sans session : refus « connexion », aucune requête", [r.ok ? "ok" : r.genre, appels.length], ["connexion", 0]);
}

// ---------- réponse illisible : rejetée par le parseur strict ----------
{
  const casse = { ...RESERVATION, compte: "u-1" };
  const lecture = faux(() => json({ ok: true, reservations: [casse] }));
  const r1 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "GET", chemin: "/api/v1/reservations", lire: lireReponseListeReservations, envoyer: lecture.envoyer });
  verifier("lecture : clé en trop dans une réservation = illisible = service indisponible", r1.ok ? "ok" : [r1.genre, r1.message], ["indisponible", MESSAGE_SERVICE_INDISPONIBLE]);
  const ecriture = faux(() => json({ ok: true, reservation: { ...RESERVATION, statut: "inventee" }, idempotent: false }, 201));
  const r2 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer: ecriture.envoyer });
  verifier("écriture : réponse illisible = résultat incertain (jamais « échec » sûr)", r2.ok ? "ok" : [r2.genre, r2.message], ["incertain", MESSAGE_RESULTAT_INCERTAIN]);
  const pasJson = faux(() => new Response("<html>oups</html>", { status: 200 }));
  const r3 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer: pasJson.envoyer });
  verifier("écriture : réponse qui n'est pas du JSON = incertain", r3.ok ? "ok" : r3.genre, "incertain");
}

// ---------- pannes : jamais de rejeu ----------
{
  const panne = faux(() => { throw new Error("réseau coupé"); });
  const r1 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "GET", chemin: "/api/v1/reservations", lire: lireReponseListeReservations, envoyer: panne.envoyer });
  verifier("lecture : panne réseau = service indisponible, une seule tentative", [r1.ok ? "ok" : r1.genre, panne.appels.length], ["indisponible", 1]);
  const panne2 = faux(() => { throw new Error("réseau coupé"); });
  const r2 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer: panne2.envoyer });
  verifier("écriture : panne réseau = incertain, une seule tentative (jamais de rejeu)", [r2.ok ? "ok" : r2.genre, panne2.appels.length], ["incertain", 1]);
  const erreur500 = faux(() => json({ ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } }, 500));
  const r3 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer: erreur500.envoyer });
  verifier("écriture : 500 = incertain, une seule tentative", [r3.ok ? "ok" : r3.genre, erreur500.appels.length], ["incertain", 1]);
  const erreur503 = faux(() => new Response("Service Unavailable", { status: 503 }));
  const r4 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "GET", chemin: "/api/v1/reservations", lire: lireReponseListeReservations, envoyer: erreur503.envoyer });
  verifier("lecture : 503 = service indisponible", r4.ok ? "ok" : r4.genre, "indisponible");
  const redirection = faux(() => new Response(null, { status: 302, headers: { location: "https://autre.test/" } }));
  const r5 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer: redirection.envoyer });
  verifier("écriture : redirection non suivie = incertain", [r5.ok ? "ok" : r5.genre, redirection.appels.length], ["incertain", 1]);
}

// ---------- délai ----------
{
  const lent = (async (_url: string, init: RequestInit) =>
    new Promise<Response>((_ok, ko2) => init.signal?.addEventListener("abort", () => ko2(new Error("coupé"))))) as unknown as typeof fetch;
  const debut = Date.now();
  const r = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer: lent, delaiMs: 30 });
  verifier("écriture : délai dépassé = incertain, sans attendre indéfiniment", [r.ok ? "ok" : r.genre, Date.now() - debut < 2000], ["incertain", true]);
  const r2 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "GET", chemin: "/api/v1/reservations", lire: lireReponseListeReservations, envoyer: lent, delaiMs: 30 });
  verifier("lecture : délai dépassé = service indisponible", r2.ok ? "ok" : r2.genre, "indisponible");
}

// ---------- refus de l'API : message affiché tel quel, en français ----------
const REFUS: [string, number, string, string][] = [
  ["capacité", 409, "CONFLIT_ETAT", "Il ne reste pas assez de places à ce créneau pour 4 personnes. Essayez un autre horaire."],
  ["plafond de 3", 409, "CONFLIT_ETAT", "Vous avez déjà 3 réservations à venir. Annulez-en une ou attendez qu'elle ait eu lieu."],
  ["doublon", 409, "CONFLIT_ETAT", "Vous avez déjà une réservation à ce créneau. Choisissez un autre horaire."],
  ["créneau trop proche", 400, "VALIDATION", "Le créneau doit être dans plus de 30 minutes. Choisissez un horaire plus tard."],
  ["créneau trop lointain", 400, "VALIDATION", "On ne peut pas réserver plus de 60 jours à l'avance."],
  ["restaurant sans réservation", 409, "CONFLIT_ETAT", "Ce restaurant n'accepte pas les réservations de table."],
];
for (const [nom, statut, code, message] of REFUS) {
  const { appels, envoyer } = faux(() => json({ ok: false, erreur: { code, message } }, statut));
  const r = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer });
  verifier(`refus de l'API (${nom}) : message affiché tel quel, aucun rejeu`, r.ok ? "ok" : [r.genre, r.code, r.message, appels.length], ["refus", code, message, 1]);
}
{
  const { envoyer } = faux(() => json({ ok: false, erreur: { code: "NON_AUTHENTIFIE", message: "Connectez-vous pour gérer vos réservations." } }, 401));
  const r = await appelerApi({ service: SERVICE, jeton: JETON, methode: "GET", chemin: "/api/v1/reservations", lire: lireReponseListeReservations, envoyer });
  verifier("401 : renvoi vers la connexion", r.ok ? "ok" : [r.genre, r.message], ["connexion", MESSAGE_CONNEXION_EXPIREE]);
  const trop = faux(() => json({ ok: false, erreur: { code: "TROP_DE_REQUETES", message: "Trop de requêtes." } }, 429));
  const r2 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer: trop.envoyer });
  verifier("429 : refus avec message de patience", r2.ok ? "ok" : [r2.genre, r2.message], ["refus", "Trop de demandes en peu de temps. Patientez un instant, puis réessayez."]);
  const bizarre = faux(() => new Response("Bad Request", { status: 400 }));
  const r3 = await appelerApi({ service: SERVICE, jeton: JETON, methode: "POST", chemin: "/api/v1/reservations", corps: {}, lire: lireReponseCreationReservation, envoyer: bizarre.envoyer });
  verifier("400 sans corps lisible : refus générique, pas de texte brut affiché", r3.ok ? "ok" : [r3.genre, r3.message], ["refus", "La demande n'a pas pu être traitée. Vérifiez les informations et réessayez."]);
}

// ---------- traduction des messages ----------
verifier("message : celui de l'API quand il est propre", messagePourErreur("CONFLIT_ETAT", "Ce restaurant n'accepte pas les réservations de table."), "Ce restaurant n'accepte pas les réservations de table.");
verifier("message : code inconnu = message générique", messagePourErreur("BIZARRE", "x"), "La demande n'a pas pu être traitée. Vérifiez les informations et réessayez.");
verifier("message : trop long = générique", messagePourErreur("VALIDATION", "x".repeat(301)), "La demande n'a pas pu être traitée. Vérifiez les informations et réessayez.");
verifier("message : balise ou caractère de contrôle = générique", [messagePourErreur("VALIDATION", "<script>alert(1)</script>"), messagePourErreur("VALIDATION", "a\u0000b")], ["La demande n'a pas pu être traitée. Vérifiez les informations et réessayez.", "La demande n'a pas pu être traitée. Vérifiez les informations et réessayez."]);
verifier("message : ERREUR_SERVEUR = service indisponible", messagePourErreur("ERREUR_SERVEUR", "Réessayez dans un instant."), MESSAGE_SERVICE_INDISPONIBLE);
verifier("message : non autorisé", messagePourErreur("NON_AUTORISE", "Vous n'avez pas le droit d'effectuer cette action."), "Vous n'avez pas le droit d'effectuer cette action.");

// ---------- chemins : identifiants contrôlés, jamais de chemin libre ----------
verifier("chemin de réservation", cheminReservation(RESA), `/api/v1/reservations/${RESA}`);
verifier("chemin d'annulation", cheminReservation(RESA, "annuler"), `/api/v1/reservations/${RESA}/annuler`);
verifier("identifiant mal formé : pas de chemin", [cheminReservation("../../x"), cheminReservation(`${RESA}/../x`), cheminDisponibilite("pas-un-uuid")], [null, null, null]);
verifier("liste du restaurant : jour valide", cheminListeRestaurant("2026-11-12"), "/api/v1/restaurant/reservations?jour=2026-11-12");
verifier("liste du restaurant : sans jour = aujourd'hui côté API", cheminListeRestaurant(null), "/api/v1/restaurant/reservations");
verifier("liste du restaurant : jour invalide refusé", cheminListeRestaurant("2026-02-30"), null);
verifier("identifiant en majuscules : accepté et mis en minuscules", cheminReservation(RESA.toUpperCase()), `/api/v1/reservations/${RESA}`);

// ---------- gardes statiques : aucun secret côté navigateur ----------
const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}
const sources = ["src/app/restaurants/[id]/reserver", "src/app/compte/reservations", "src/app/restaurant/(console)/reservations", "src/lib/reservation", "src/components/reservation"]
  .flatMap((d) => { try { return fichiers(join(racine, d)); } catch { return []; } })
  .filter((f) => /\.(ts|tsx)$/.test(f));
verifier("des fichiers de réservation du site existent", sources.length >= 10, true);
const contenu = new Map(sources.map((f) => [f, readFileSync(f, "utf8")]));
const clients = [...contenu].filter(([, t]) => /^\s*["']use client["']/.test(t));
verifier("des composants navigateur existent", clients.length >= 3, true);
for (const [f, t] of clients) {
  const nom = f.slice(racine.length + 1).replaceAll("\\", "/");
  verifier(`composant navigateur sans secret ni module serveur : ${nom}`, /API_URL|RELAIS_SECRET|API_RELAIS|x-relais|api-serveur|api-regles|server-only|SERVICE_ROLE|process\.env/.test(t), false);
}
for (const [f, t] of contenu) {
  const nom = f.slice(racine.length + 1).replaceAll("\\", "/");
  verifier(`aucune variable publique pour l'API : ${nom}`, /NEXT_PUBLIC_[A-Z_]*(API|RELAIS|SECRET)/.test(t), false);
  verifier(`aucun style en ligne pour la mise en page : ${nom}`, /style=\{\{/.test(t), false);
  verifier(`aucune mention d'espèces : ${nom}`, /esp[eè]ces|\bcash\b/i.test(t), false);
}
const serveur = contenu.get(join(racine, "src/lib/reservation/api-serveur.ts")) ?? "";
verifier("api-serveur.ts : réservé au serveur (server-only)", serveur.includes('import "server-only";'), true);
verifier("api-serveur.ts : le jeton vient de la session, pas d'un paramètre de formulaire", /getSession\(\)/.test(serveur) && !/formData|FormData/.test(serveur), true);
const actions = contenu.get(join(racine, "src/lib/reservation/actions.ts")) ?? "";
verifier("actions.ts : action serveur", /^\s*["']use server["']/.test(actions), true);
verifier("actions.ts : aucune identité lue du formulaire (utilisateur, compte, jeton)", /get\(\s*["'](utilisateur|compte|user|jeton|token|restaurant_?id_?membre)/i.test(actions), false);
verifier("aucun appel de fetch vers l'API dans les composants et pages", [...contenu].filter(([f, t]) => /\.tsx$/.test(f) && /\bfetch\(/.test(t)).map(([f]) => f.slice(racine.length + 1)), []);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nAppel de l'API de réservation depuis le site vérifié.");
