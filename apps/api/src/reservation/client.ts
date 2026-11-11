import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import type { DemandeReservation, ReservationClient } from "@speedfood/shared/contracts/reservation";
import type { Deps, Planifier } from "../types.ts";
import { planifier } from "./planification.ts";
import { traduireErreurBase, traduireRefusCreation, verifierAnnulationClient, verifierPlageCreneau, type CodeRefusCreation } from "./regles.ts";

/**
 * Service de réservation côté CLIENT (lot M3), sans dépendance à Hono : la base et l'horloge sont des PORTS injectés (câblage : `cablage.ts`, doublures dans les tests).
 * Le compte (`utilisateurId`) est celui du jeton vérifié par la route ; chaque lecture et chaque écriture est filtrée sur lui, aucune réservation d'un autre compte n'est jamais lue ni renvoyée.
 *
 * Lot M5 (M2b) : la CRÉATION est une seule fonction SQL (`fn_creer_reservation_atomique`) qui vérifie capacité, plafond, doublon, rejeu et restaurant dans UNE transaction, derrière des
 * verrous consultatifs : deux demandes simultanées ne peuvent plus dépasser la capacité ni le plafond. Le service ne garde que ce qui est pur (la plage horaire, refusée avant tout appel).
 */

/** Ce que la disponibilité lit du restaurant (lot M4-0). */
export interface DisponibiliteRestaurant {
  publie: boolean;
  suspendu: boolean;
  accepteReservation: boolean;
}

export type ErreurBrute = { code?: unknown; message?: unknown };
export type ResultatEcriture<L> = { ok: true; ligne: L } | { ok: false; genre: "aucune_ligne" } | { ok: false; genre: "base"; erreur: ErreurBrute };

/** Réponse de la fonction SQL de création : réservation créée, rejeu d'une réservation existante, refus (avec un code), ou erreur de la base (garde, contrainte). */
export type ResultatCreationAtomique =
  | { ok: true; etat: "creee" | "rejeu"; reservation: ReservationClient }
  | { ok: false; genre: "refus"; code: CodeRefusCreation }
  | { ok: false; genre: "base"; erreur: ErreurBrute };

export interface PortsReservationClient {
  maintenant(): Date;
  /**
   * Appelle la fonction SQL atomique. Le compte est celui du jeton (jamais du corps). Le statut, la référence et les horodatages sont posés par la base ; aucun jeton de suivi.
   * La même demande rejouée par le même compte renvoie `rejeu` avec la réservation existante (rien n'est écrit).
   */
  creerAtomique(ligne: { restaurantId: string; clientUserId: string; nom: string; telephone: string; nbPersonnes: number; creneau: string; note: string | null }): Promise<ResultatCreationAtomique>;
  /** Lot M4-0 : trois colonnes seulement (publié, suspendu, accepte) ; `null` si le restaurant n'existe pas. Ni capacité ni nom. */
  lireDisponibilite(id: string): Promise<DisponibiliteRestaurant | null>;
  lister(utilisateurId: string): Promise<ReservationClient[]>;
  lire(utilisateurId: string, id: string): Promise<ReservationClient | null>;
  /** Passe `annulee_client` si la réservation est celle du compte ET encore demandée ou confirmée (comparaison faite par la base). */
  annuler(utilisateurId: string, id: string): Promise<ResultatEcriture<ReservationClient>>;
  /**
   * Lot M4c : prévient les membres du restaurant qu'une demande vient d'arriver. Facultatif (absent = aucune alerte). Appelée seulement pour une réservation NOUVELLE, après la réponse, avec l'environnement
   * de la requête (la liaison vers le site y est lue à l'appel). Ne doit jamais lever ; le service absorbe de toute façon une panne.
   */
  alerterNouvelleDemande?(restaurantId: string, environnement: unknown): Promise<void>;
}

const INTROUVABLE_RESERVATION: ErreurApi = { code: "INTROUVABLE", message: "Réservation introuvable." };
const refus = (erreur: ErreurApi) => ({ ok: false as const, erreur });

export function creerServiceReservationClient(p: PortsReservationClient): Deps["reservations"] {
  return {
    async creer(utilisateurId, d: DemandeReservation, apres?: Planifier, environnement?: unknown) {
      // Plage horaire : refusée par le SERVEUR avant tout appel (le client peut être modifié). Le reste (rejeu, fenêtre, restaurant, plafond, doublon, capacité) est jugé par la fonction SQL.
      const horsPlage = verifierPlageCreneau(Date.parse(d.creneau));
      if (horsPlage) return refus(horsPlage);

      const r = await p.creerAtomique({ restaurantId: d.restaurantId, clientUserId: utilisateurId, nom: d.nom, telephone: d.telephone, nbPersonnes: d.nbPersonnes, creneau: new Date(Date.parse(d.creneau)).toISOString(), note: d.note });
      if (!r.ok) return refus(r.genre === "base" ? traduireErreurBase(r.erreur) : traduireRefusCreation(r.code, d.nbPersonnes));
      // Rejeu idempotent : la même demande du même compte renvoie la réservation existante, sans alerte.
      if (r.etat === "rejeu") return { ok: true as const, reservation: r.reservation, idempotent: true };
      // Une réservation NOUVELLE seulement (jamais le rejeu, renvoyé plus haut), et seulement après l'écriture : l'alerte ne part qu'après la réponse.
      planifier(apres, p.alerterNouvelleDemande && (() => p.alerterNouvelleDemande!(r.reservation.restaurantId, environnement)));
      return { ok: true as const, reservation: r.reservation, idempotent: false };
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
