import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import {
  STATUT_APRES_ACTION,
  bornesDuJour,
  lireJourReservation,
  type ReglageReservation,
  type ReservationRestaurant,
  type ValeursReglageReservation,
} from "@speedfood/shared/contracts/reservation";
import type { StatutReservation } from "@speedfood/shared/reservation/statuts";
import type { ContexteRestaurant, Deps, Planifier } from "../types.ts";
import type { ResultatEcriture } from "./client.ts";
import type { StatutReponseReservation } from "../notifications/reservation-site.ts";
import { planifier } from "./planification.ts";
import { MESSAGE_BASE_INDISPONIBLE, actionsPossibles, traduireErreurBase, verifierAction } from "./regles.ts";

/**
 * Service de réservation côté RESTAURATEUR (lot M3), sans dépendance à Hono. `ctx` vient de `restaurant.contexte` : le restaurant est celui de l'appartenance du compte. Chaque port reçoit le
 * client du jeton (`ctx.supabase`, RLS appliquée) ET le restaurant du contexte, et filtre dessus : une réservation d'un autre restaurant est « introuvable », comme une réservation inexistante.
 */

/** Une ligne lue pour le restaurateur, avant le calcul des actions possibles. */
export type LigneReservationRestaurant = Omit<ReservationRestaurant, "actionsPossibles">;

export interface PortsReservationRestaurant {
  maintenant(): Date;
  /** Les réservations de ce restaurant dont le créneau est dans [debut, fin[, tous états. */
  lireDuJour(client: unknown, restaurantId: string, debut: Date, fin: Date): Promise<LigneReservationRestaurant[]>;
  /** Les demandes (état « demandée ») de ce restaurant dont le créneau n'est pas passé. */
  lireDemandesAVenir(client: unknown, restaurantId: string, maintenant: Date): Promise<LigneReservationRestaurant[]>;
  lire(client: unknown, restaurantId: string, id: string): Promise<LigneReservationRestaurant | null>;
  /** Compare-et-pose : ne change la ligne que si elle est encore à l'état `ancien`. `motif` n'est envoyé que s'il est fourni. */
  ecrireStatut(client: unknown, restaurantId: string, id: string, ancien: StatutReservation, nouveau: StatutReservation, motif: string | null): Promise<ResultatEcriture<LigneReservationRestaurant>>;
  /**
   * Lot M4c : prévient le client que le restaurant a répondu. Facultatif (absent = aucun message). Appelée seulement après une décision RÉUSSIE (écriture faite par cette requête), avec l'identifiant de
   * la réservation et la réponse : le site relit lui-même le compte du client (l'API ne le connaît pas). Ne doit jamais lever ; le service absorbe de toute façon une panne.
   */
  prevenirClient?(reservationId: string, statut: StatutReponseReservation, environnement: unknown): Promise<void>;
  lireReglage(client: unknown, restaurantId: string): Promise<ReglageReservation | null>;
  ecrireReglage(client: unknown, restaurantId: string, valeurs: ValeursReglageReservation): Promise<ResultatEcriture<ReglageReservation>>;
}

const INTROUVABLE_RESERVATION: ErreurApi = { code: "INTROUVABLE", message: "Réservation introuvable." };
const refus = (erreur: ErreurApi) => ({ ok: false as const, erreur });
/** Les seules décisions qui préviennent le client (jamais « honorée » ni « non honorée », qui n'ont plus d'enjeu pour lui). */
const MESSAGE_AU_CLIENT: ReadonlySet<StatutReservation> = new Set<StatutReservation>(["confirmee", "refusee", "annulee_restaurant"]);

export function creerServiceReservationRestaurant(p: PortsReservationRestaurant): Deps["reservationsRestaurant"] {
  const enrichir = (l: LigneReservationRestaurant, maintenantMs: number): ReservationRestaurant => ({ ...l, actionsPossibles: actionsPossibles(l.statut, Date.parse(l.creneau), maintenantMs) });
  return {
    async lister(ctx: ContexteRestaurant, jour) {
      const maintenant = p.maintenant();
      const jourLu = jour === null ? maintenant.toISOString().slice(0, 10) : lireJourReservation(jour);
      if (jourLu === null) return refus({ code: "VALIDATION", message: "Jour invalide. Utilisez le format AAAA-MM-JJ." });
      const { debut, fin } = bornesDuJour(jourLu);
      const [duJour, demandes] = await Promise.all([p.lireDuJour(ctx.supabase, ctx.restaurantId, debut, fin), p.lireDemandesAVenir(ctx.supabase, ctx.restaurantId, maintenant)]);
      const parId = new Map<string, LigneReservationRestaurant>();
      for (const l of [...duJour, ...demandes]) parId.set(l.id, l);
      const reservations = [...parId.values()]
        .sort((a, b) => Date.parse(a.creneau) - Date.parse(b.creneau) || (a.id < b.id ? -1 : 1))
        .map((l) => enrichir(l, maintenant.getTime()));
      return { ok: true as const, jour: jourLu, reservations };
    },

    async decider(ctx, id, decision, apres?: Planifier, environnement?: unknown) {
      const actuelle = await p.lire(ctx.supabase, ctx.restaurantId, id);
      if (!actuelle) return refus(INTROUVABLE_RESERVATION);
      const cible = STATUT_APRES_ACTION[decision.action];
      // La même décision rejouée (réponse perdue, double appui) répond la même chose, sans rien réécrire.
      if (actuelle.statut === cible) return { ok: true as const, reservation: enrichir(actuelle, p.maintenant().getTime()) };
      const interdit = verifierAction(actuelle.statut, decision.action, Date.parse(actuelle.creneau), p.maintenant().getTime());
      if (interdit) return refus(interdit);
      const r = await p.ecrireStatut(ctx.supabase, ctx.restaurantId, id, actuelle.statut, cible, decision.motif);
      if (r.ok) {
        if (MESSAGE_AU_CLIENT.has(cible)) planifier(apres, p.prevenirClient && (() => p.prevenirClient!(id, cible as StatutReponseReservation, environnement)));
        return { ok: true as const, reservation: enrichir(r.ligne, p.maintenant().getTime()) };
      }
      if (r.genre === "base") return refus(traduireErreurBase(r.erreur));
      // Aucune ligne modifiée : l'état a changé entre la lecture et l'écriture (autre appareil, annulation du client). On relit pour répondre juste.
      const relue = await p.lire(ctx.supabase, ctx.restaurantId, id);
      if (!relue) return refus(INTROUVABLE_RESERVATION);
      if (relue.statut === cible) return { ok: true as const, reservation: enrichir(relue, p.maintenant().getTime()) };
      return refus(verifierAction(relue.statut, decision.action, Date.parse(relue.creneau), p.maintenant().getTime()) ?? { code: "CONFLIT_ETAT", message: "Cette réservation vient de changer : relisez-la avant de recommencer." });
    },

    async lireReglage(ctx) {
      const reglage = await p.lireReglage(ctx.supabase, ctx.restaurantId);
      return reglage ? { ok: true as const, ...reglage } : refus({ code: "ERREUR_SERVEUR", message: "Vos réglages de réservation n'ont pas pu être chargés. Réessayez dans un instant." });
    },

    async ecrireReglage(ctx, valeurs) {
      const r = await p.ecrireReglage(ctx.supabase, ctx.restaurantId, valeurs);
      if (r.ok) return { ok: true as const, ...r.ligne };
      if (r.genre === "base") return refus(traduireErreurBase(r.erreur));
      return refus({ code: "ERREUR_SERVEUR", message: MESSAGE_BASE_INDISPONIBLE });
    },
  };
}
