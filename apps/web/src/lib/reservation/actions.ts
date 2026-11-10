"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ACTIONS_RESERVATION_RESTAURANT, NB_PERSONNES_MAX, type ActionReservationRestaurant } from "@/lib/contracts/reservation";
import { construireDecision, construireReglage } from "./console";
import { validerFormulaireReservation, type ChampReservation } from "./formulaire";
import { annulerMaReservation, creerReservation, deciderReservation, ecrireReglageReservation } from "./api-serveur";

/**
 * Actions serveur de la réservation de table sur le site (lot M4b). Chacune revalide tout avec l'horloge du serveur et passe par `api-serveur.ts` : le jeton de la session
 * part vers l'API, l'identité ne vient jamais d'un champ du formulaire (seuls des identifiants de ressources — restaurant, réservation — sont lus, et l'API les contrôle
 * contre le compte). Aucune de ces actions ne rejoue un envoi : un résultat incertain renvoie vers « Mes réservations ».
 */

export interface EtatReservation {
  erreur?: string;
  succes?: string;
  /** Une écriture est partie sans réponse lisible : on ne sait pas si elle a abouti. */
  incertain?: boolean;
  erreurs?: Partial<Record<ChampReservation, string>>;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texte(donnees: FormData, nom: string): string {
  const v = donnees.get(nom);
  return typeof v === "string" ? v : "";
}

/** Envoi de la demande de réservation. Succès : on arrive sur la page de la réservation. */
export async function creerReservationAction(_precedent: EtatReservation, donnees: FormData): Promise<EtatReservation> {
  const restaurantId = texte(donnees, "restaurantId");
  const verdict = validerFormulaireReservation(
    {
      restaurantId,
      jour: texte(donnees, "jour"),
      heure: texte(donnees, "heure"),
      nbPersonnes: texte(donnees, "nbPersonnes"),
      nom: texte(donnees, "nom"),
      telephone: texte(donnees, "telephone"),
      note: texte(donnees, "note"),
    },
    new Date(),
    NB_PERSONNES_MAX,
  );
  if (!verdict.ok) return { erreur: verdict.message, erreurs: verdict.erreurs };

  const r = await creerReservation(verdict.demande);
  if (r.ok) redirect(`/compte/reservations/${r.donnees.reservation.id}?envoyee=1`);
  if (r.genre === "connexion") redirect(`/entrer?suite=${encodeURIComponent(`/restaurants/${verdict.demande.restaurantId}/reserver`)}`);
  return { erreur: r.message, incertain: r.genre === "incertain" };
}

/** Annulation par le client (la confirmation explicite est demandée par l'écran avant l'envoi). */
export async function annulerReservationAction(_precedent: EtatReservation, donnees: FormData): Promise<EtatReservation> {
  const id = texte(donnees, "reservationId");
  if (!REGEX_UUID.test(id)) return { erreur: "Réservation introuvable." };
  const r = await annulerMaReservation(id);
  if (r.ok) {
    revalidatePath("/compte/reservations");
    revalidatePath(`/compte/reservations/${id}`);
    return { succes: "Votre réservation est annulée." };
  }
  if (r.genre === "connexion") redirect(`/entrer?suite=${encodeURIComponent(`/compte/reservations/${id.toLowerCase()}`)}`);
  return { erreur: r.message, incertain: r.genre === "incertain" };
}

/** Décision du restaurateur. L'action doit faire partie de la liste fermée ; l'API vérifie qu'elle est possible pour cette réservation. */
export async function deciderReservationAction(_precedent: EtatReservation, donnees: FormData): Promise<EtatReservation> {
  const id = texte(donnees, "reservationId");
  const action = texte(donnees, "action");
  if (!REGEX_UUID.test(id)) return { erreur: "Réservation introuvable." };
  if (!(ACTIONS_RESERVATION_RESTAURANT as readonly string[]).includes(action)) return { erreur: "Action invalide." };
  const decision = construireDecision(action as ActionReservationRestaurant, texte(donnees, "motif"));
  if (!decision.ok) return { erreur: decision.message };
  const r = await deciderReservation(id, decision.corps);
  if (r.ok) {
    revalidatePath("/restaurant/reservations");
    return { succes: "La décision est enregistrée." };
  }
  if (r.genre === "connexion") redirect("/connexion?suite=/restaurant/reservations");
  return { erreur: r.message, incertain: r.genre === "incertain" };
}

/** Réglages du restaurant : accepter les réservations, capacité par créneau. */
export async function ecrireReglageReservationAction(_precedent: EtatReservation, donnees: FormData): Promise<EtatReservation> {
  const reglage = construireReglage(texte(donnees, "accepte") === "oui", texte(donnees, "capacite"));
  if (!reglage.ok) return { erreur: reglage.message };
  const r = await ecrireReglageReservation(reglage.corps);
  if (r.ok) {
    revalidatePath("/restaurant/reservations");
    return { succes: "Vos réglages sont enregistrés." };
  }
  if (r.genre === "connexion") redirect("/connexion?suite=/restaurant/reservations");
  return { erreur: r.message, incertain: r.genre === "incertain" };
}
