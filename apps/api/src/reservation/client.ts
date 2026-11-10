import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import { MAX_RESERVATIONS_ACTIVES_PAR_COMPTE, type DemandeReservation, type ReservationClient } from "@speedfood/shared/contracts/reservation";
import type { Deps } from "../types.ts";
import { MESSAGE_BASE_INDISPONIBLE, traduireErreurBase, verifierAnnulationClient, verifierFenetreCreneau } from "./regles.ts";

/**
 * Service de réservation côté CLIENT (lot M3), sans dépendance à Hono : la base et l'horloge sont des PORTS injectés (câblage : `cablage.ts`, doublures dans les tests).
 * Le compte (`utilisateurId`) est celui du jeton vérifié par la route ; chaque lecture et chaque écriture est filtrée sur lui, aucune réservation d'un autre compte n'est jamais lue ni renvoyée.
 */

/** Ce que le service sait du restaurant : de quoi décider avant d'écrire (la base répète ces contrôles). */
export interface RestaurantPourReservation {
  id: string;
  publie: boolean;
  suspendu: boolean;
  accepteReservation: boolean;
  /** `null` = pas de plafond. */
  capaciteCouverts: number | null;
}

/** Ce que la disponibilité lit du restaurant (lot M4-0). */
export interface DisponibiliteRestaurant {
  publie: boolean;
  suspendu: boolean;
  accepteReservation: boolean;
}

export type ErreurBrute = { code?: unknown; message?: unknown };
export type ResultatEcriture<L> = { ok: true; ligne: L } | { ok: false; genre: "aucune_ligne" } | { ok: false; genre: "base"; erreur: ErreurBrute };
export type ResultatInsertion = { ok: true; reservation: ReservationClient } | { ok: false; genre: "reference_prise" } | { ok: false; genre: "base"; erreur: ErreurBrute };

export interface PortsReservationClient {
  maintenant(): Date;
  lireRestaurant(id: string): Promise<RestaurantPourReservation | null>;
  /** Les réservations du compte encore actives : demandée ou confirmée, créneau strictement après `maintenant`. */
  listerActives(utilisateurId: string, maintenant: Date): Promise<ReservationClient[]>;
  /** Somme des personnes des réservations demandées ET confirmées de ce restaurant à ce créneau (tous comptes). */
  sommeCouverts(restaurantId: string, creneau: Date): Promise<number>;
  /** La référence est tirée par la base ; une collision (contrainte d'unicité) répond `reference_prise` et l'appelant réessaie. */
  inserer(ligne: { restaurantId: string; clientUserId: string; nom: string; telephone: string; nbPersonnes: number; creneau: string; note: string | null }): Promise<ResultatInsertion>;
  /** Lot M4-0 : trois colonnes seulement (publié, suspendu, accepte) ; `null` si le restaurant n'existe pas. Ni capacité ni nom. */
  lireDisponibilite(id: string): Promise<DisponibiliteRestaurant | null>;
  lister(utilisateurId: string): Promise<ReservationClient[]>;
  lire(utilisateurId: string, id: string): Promise<ReservationClient | null>;
  /** Passe `annulee_client` si la réservation est celle du compte ET encore demandée ou confirmée (comparaison faite par la base). */
  annuler(utilisateurId: string, id: string): Promise<ResultatEcriture<ReservationClient>>;
}

/** Nombre total d'essais d'insertion quand la référence tirée existe déjà (une collision sur 28 millions : quatre essais suffisent largement). */
export const ESSAIS_INSERTION = 4;

const INTROUVABLE_RESERVATION: ErreurApi = { code: "INTROUVABLE", message: "Réservation introuvable." };
const refus = (erreur: ErreurApi) => ({ ok: false as const, erreur });

export function creerServiceReservationClient(p: PortsReservationClient): Deps["reservations"] {
  return {
    async creer(utilisateurId, d: DemandeReservation) {
      const maintenant = p.maintenant();
      const creneauMs = Date.parse(d.creneau);
      const actives = await p.listerActives(utilisateurId, maintenant);

      // Rejeu idempotent : la table n'a pas de clé d'idempotence ; la même demande du même compte (restaurant, créneau, nombre de personnes) renvoie la réservation existante.
      // Cette vérification passe AVANT le plafond et le doublon de créneau, qui refuseraient à tort un rejeu.
      const existante = actives.find((r) => r.restaurantId === d.restaurantId && Date.parse(r.creneau) === creneauMs && r.nbPersonnes === d.nbPersonnes);
      if (existante) return { ok: true as const, reservation: existante, idempotent: true };

      const fenetre = verifierFenetreCreneau(creneauMs, maintenant.getTime());
      if (fenetre) return refus(fenetre);

      const restaurant = await p.lireRestaurant(d.restaurantId);
      if (!restaurant) return refus({ code: "INTROUVABLE", message: "Ce restaurant est introuvable." });
      if (!restaurant.publie || restaurant.suspendu) return refus({ code: "CONFLIT_ETAT", message: "Ce restaurant n'est pas disponible pour une réservation." });
      if (!restaurant.accepteReservation) return refus({ code: "CONFLIT_ETAT", message: "Ce restaurant n'accepte pas les réservations de table." });

      if (actives.length >= MAX_RESERVATIONS_ACTIVES_PAR_COMPTE) {
        return refus({ code: "CONFLIT_ETAT", message: `Vous avez déjà ${MAX_RESERVATIONS_ACTIVES_PAR_COMPTE} réservations à venir. Annulez-en une ou attendez qu'elle ait eu lieu.` });
      }
      if (actives.some((r) => Date.parse(r.creneau) === creneauMs)) {
        return refus({ code: "CONFLIT_ETAT", message: "Vous avez déjà une réservation à ce créneau. Choisissez un autre horaire." });
      }

      if (restaurant.capaciteCouverts !== null) {
        const deja = await p.sommeCouverts(d.restaurantId, new Date(creneauMs));
        if (deja + d.nbPersonnes > restaurant.capaciteCouverts) {
          return refus({ code: "CONFLIT_ETAT", message: `Il ne reste pas assez de places à ce créneau pour ${d.nbPersonnes} ${d.nbPersonnes === 1 ? "personne" : "personnes"}. Essayez un autre horaire.` });
        }
      }

      const ligne = { restaurantId: d.restaurantId, clientUserId: utilisateurId, nom: d.nom, telephone: d.telephone, nbPersonnes: d.nbPersonnes, creneau: new Date(creneauMs).toISOString(), note: d.note };
      for (let essai = 1; essai <= ESSAIS_INSERTION; essai++) {
        const r = await p.inserer(ligne);
        if (r.ok) return { ok: true as const, reservation: r.reservation, idempotent: false };
        if (r.genre === "base") return refus(traduireErreurBase(r.erreur));
        // « reference_prise » : la base tire une autre référence à l'essai suivant.
      }
      return refus({ code: "ERREUR_SERVEUR", message: MESSAGE_BASE_INDISPONIBLE });
    },

    async disponibilite(restaurantId) {
      // Inconnu, non publié, suspendu ou fermé aux réservations : la même réponse (`false`), jamais une erreur qui révélerait l'existence d'un restaurant non publié.
      const dispo = await p.lireDisponibilite(restaurantId);
      return { ok: true as const, accepteReservation: dispo !== null && dispo.publie && !dispo.suspendu && dispo.accepteReservation };
    },

    async lister(utilisateurId) {
      return { ok: true as const, reservations: await p.lister(utilisateurId) };
    },

    async lire(utilisateurId, id) {
      const reservation = await p.lire(utilisateurId, id);
      return reservation ? { ok: true as const, reservation } : refus(INTROUVABLE_RESERVATION);
    },

    async annuler(utilisateurId, id) {
      const actuelle = await p.lire(utilisateurId, id);
      if (!actuelle) return refus(INTROUVABLE_RESERVATION);
      // Déjà annulée par le client : réponse stable, rien n'est écrit.
      if (actuelle.statut === "annulee_client") return { ok: true as const, reservation: actuelle };
      const interdit = verifierAnnulationClient(actuelle.statut, Date.parse(actuelle.creneau), p.maintenant().getTime());
      if (interdit) return refus(interdit);
      const r = await p.annuler(utilisateurId, id);
      if (r.ok) return { ok: true as const, reservation: r.ligne };
      if (r.genre === "base") return refus(traduireErreurBase(r.erreur));
      // Aucune ligne modifiée : la réservation a changé entre la lecture et l'écriture. On relit pour répondre juste.
      const relue = await p.lire(utilisateurId, id);
      if (!relue) return refus(INTROUVABLE_RESERVATION);
      if (relue.statut === "annulee_client") return { ok: true as const, reservation: relue };
      return refus(verifierAnnulationClient(relue.statut, Date.parse(relue.creneau), p.maintenant().getTime()) ?? { code: "CONFLIT_ETAT", message: "Cette réservation vient de changer : relisez-la avant de recommencer." });
    },
  };
}
