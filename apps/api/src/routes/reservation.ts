import { Hono, type Context } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { lireBearer } from "@speedfood/shared/api/v1-regles";
import {
  construireReponseDisponibiliteReservation,
  lireCorpsCreationReservation,
  lireCorpsDecisionReservation,
  lireCorpsReglageReservation,
  lireReglageReservation,
  projeterReservationClient,
  projeterReservationRestaurant,
  type ReglageReservation,
} from "@speedfood/shared/contracts/reservation";
import { identifier, limiterParCompte, type Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre, reponseErreur } from "../http.ts";
import type { Deps, Planifier } from "../types.ts";

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTROUVABLE = { code: "INTROUVABLE", message: "Réservation introuvable." } as const;

/** Une réponse douteuse est une panne (500 générique), jamais une réservation tronquée : `onError` ne journalise que le nom de l'erreur. */
function illisible(): never {
  throw new Error("RESERVATION_ILLISIBLE");
}
const versClient = (brute: unknown) => projeterReservationClient(brute) ?? illisible();
const versRestaurant = (brute: unknown) => projeterReservationRestaurant(brute) ?? illisible();

/**
 * Réservation de table, côté CLIENT (lot M3). Jeton porteur STRICT (une réservation est une écriture), plafond par compte (`limiterClientApplication`, comme `routes/client.ts`).
 * L'identité et le plafond sont posés PAR ROUTE ET PAR MÉTHODE, jamais sur « * » : une méthode inconnue répond 404 sans appeler le service d'authentification.
 *
 *  - Le compte vient UNIQUEMENT du jeton vérifié : le corps n'a aucune clé « compte » (une clé inconnue refuse le corps).
 *  - Les réponses sont reprojetées sur les champs du contrat : aucun compte, aucun jeton ni condensé de jeton ne peut sortir. Réponses jamais mises en cache, aucun CORS (natif seulement),
 *    rien du corps (nom, téléphone, note) n'est journalisé.
 *  - POST : 201 pour une réservation nouvelle, 200 pour un rejeu idempotent. Une réservation est une DEMANDE (« demandée ») que le restaurant confirme ou refuse.
 */
export function routeReservations(deps: Pick<Deps, "verificateurs" | "limiterClientApplication" | "reservations">) {
  const route = new Hono<{ Variables: Variables }>();
  const garde = [identifier(deps.verificateurs.strict, "Connectez-vous pour gérer vos réservations."), limiterParCompte(deps.limiterClientApplication)] as const;

  route.get("/", ...garde, async (c) => {
    const r = await deps.reservations.lister(c.get("utilisateurId"));
    if (!r.ok) return reponseErreur(c, r.erreur);
    return repondre(c, { ok: true, reservations: r.reservations.map(versClient) });
  });

  route.post("/", ...garde, async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = lireCorpsCreationReservation(lu.corps);
    if (!corps.ok) return reponseErreur(c, { code: "VALIDATION", message: corps.message });
    // « Après la réponse » (alerte du restaurant, M4c) : `waitUntil` du Worker, lu seulement quand le service planifie (réservation nouvelle). L'environnement vient de la requête, jamais du corps.
    const apres: Planifier = (tache) => c.executionCtx.waitUntil(tache());
    const r = await deps.reservations.creer(c.get("utilisateurId"), corps.valeurs, apres, c.env);
    if (!r.ok) return reponseErreur(c, r.erreur);
    return repondre(c, { ok: true, reservation: versClient(r.reservation), idempotent: r.idempotent === true }, r.idempotent ? 200 : 201);
  });

  // Lot M4-0 : « ce restaurant accepte-t-il les réservations ? », lu AVANT d'afficher le bouton. Un identifiant mal formé = 400 (VALIDATION) ; inconnu, non publié, suspendu ou fermé = `false`
  // avec la même forme (jamais de 404). La réponse est construite ici avec la constante partagée : rien du service amont (capacité, nom) ne peut y entrer.
  route.get("/restaurants/:restaurantId/disponibilite", ...garde, async (c) => {
    const restaurantId = c.req.param("restaurantId");
    if (!REGEX_UUID.test(restaurantId)) return reponseErreur(c, { code: "VALIDATION", message: "Restaurant invalide." });
    const r = await deps.reservations.disponibilite(restaurantId.toLowerCase());
    if (!r.ok) return reponseErreur(c, r.erreur);
    if (typeof r.accepteReservation !== "boolean") illisible();
    return repondre(c, construireReponseDisponibiliteReservation(restaurantId, r.accepteReservation));
  });

  route.get("/:id", ...garde, async (c) => {
    const id = c.req.param("id");
    // Un identifiant mal formé répond comme une réservation inexistante (ou d'un autre compte), sans appeler le service.
    if (!REGEX_UUID.test(id)) return reponseErreur(c, INTROUVABLE);
    const r = await deps.reservations.lire(c.get("utilisateurId"), id.toLowerCase());
    if (!r.ok) return reponseErreur(c, r.erreur);
    return repondre(c, { ok: true, reservation: versClient(r.reservation) });
  });

  route.post("/:id/annuler", ...garde, async (c) => {
    const id = c.req.param("id");
    if (!REGEX_UUID.test(id)) return reponseErreur(c, INTROUVABLE);
    const r = await deps.reservations.annuler(c.get("utilisateurId"), id.toLowerCase());
    if (!r.ok) return reponseErreur(c, r.erreur);
    return repondre(c, { ok: true, reservation: versClient(r.reservation) });
  });

  return route;
}

/**
 * Réservation de table, côté RESTAURATEUR : liste du jour et décisions (`/api/v1/restaurant/reservations`). Même entrée que `routes/restaurant.ts` : jeton porteur STRICT puis `deps.restaurant.contexte`
 * (plafond par compte, second facteur, questions de sécurité, appartenance) AVANT le corps et la validation. Le restaurant vient de l'appartenance du compte ; ni le corps ni l'URL ne le désignent
 * (une clé `restaurantId` dans le corps refuse le corps). Aucun CORS, aucune mise en cache.
 */
export function routeReservationsRestaurant(deps: Pick<Deps, "verificateurs" | "restaurant" | "reservationsRestaurant">) {
  const route = new Hono<{ Variables: Variables }>();
  const identite = identifier(deps.verificateurs.strict, "Connectez-vous avec votre compte restaurateur.");

  route.get("/", identite, async (c) => {
    const ctx = await contexteRestaurant(deps, c);
    // `jour` : AAAA-MM-JJ (heure de Conakry = UTC) ; absent = aujourd'hui. Toute autre forme est refusée par le service (VALIDATION).
    const jour = c.req.query("jour");
    const r = await deps.reservationsRestaurant.lister(ctx, jour === undefined ? null : jour);
    if (!r.ok) return reponseErreur(c, r.erreur);
    return repondre(c, { ok: true, jour: r.jour, reservations: r.reservations.map(versRestaurant) });
  });

  route.post("/:id/decision", identite, async (c) => {
    const ctx = await contexteRestaurant(deps, c);
    const id = c.req.param("id");
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = lireCorpsDecisionReservation(lu.corps);
    if (!corps.ok) return reponseErreur(c, { code: "VALIDATION", message: corps.message });
    // Identifiant mal formé : même réponse qu'une réservation inexistante ou d'un autre restaurant, sans appeler le service.
    if (!REGEX_UUID.test(id)) return reponseErreur(c, INTROUVABLE);
    // Message au client (M4c) : même mécanisme, seulement après une décision réussie.
    const apres: Planifier = (tache) => c.executionCtx.waitUntil(tache());
    const r = await deps.reservationsRestaurant.decider(ctx, id.toLowerCase(), corps.valeurs, apres, c.env);
    if (!r.ok) return reponseErreur(c, r.erreur);
    return repondre(c, { ok: true, reservation: versRestaurant(r.reservation) });
  });

  return route;
}

/**
 * Réglages de réservation du restaurant (`/api/v1/restaurant/reservation-reglage`) : `accepteReservation` et `capaciteCouverts`. Même règle d'accès que les autres réglages du restaurant
 * (`accepte_sur_place`, horaires, délai) : tout membre du restaurant, sans rôle particulier ; la RLS (`membres_maj_leur_restaurant`) borne l'écriture à son restaurant.
 */
export function routeReservationReglage(deps: Pick<Deps, "verificateurs" | "restaurant" | "reservationsRestaurant">) {
  const route = new Hono<{ Variables: Variables }>();
  const identite = identifier(deps.verificateurs.strict, "Connectez-vous avec votre compte restaurateur.");
  const sortie = (r: ReglageReservation) => ({ ok: true, ...lireReglageReservation({ accepteReservation: r.accepteReservation, capaciteCouverts: r.capaciteCouverts }) });

  route.get("/", identite, async (c) => {
    const ctx = await contexteRestaurant(deps, c);
    const r = await deps.reservationsRestaurant.lireReglage(ctx);
    if (!r.ok) return reponseErreur(c, r.erreur);
    return repondre(c, sortie(r));
  });

  route.put("/", identite, async (c) => {
    const ctx = await contexteRestaurant(deps, c);
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = lireCorpsReglageReservation(lu.corps);
    if (!corps.ok) return reponseErreur(c, { code: "VALIDATION", message: corps.message });
    const r = await deps.reservationsRestaurant.ecrireReglage(ctx, corps.valeurs);
    if (!r.ok) return reponseErreur(c, r.erreur);
    return repondre(c, sortie(r));
  });

  return route;
}

async function contexteRestaurant(deps: Pick<Deps, "restaurant">, c: Context<{ Variables: Variables }>) {
  const jeton = lireBearer(c.req.header("authorization"));
  if (!jeton) throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
  return deps.restaurant.contexte(jeton, c.get("utilisateurId"));
}
