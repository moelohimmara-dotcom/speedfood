import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import {
  creerJetonVapid,
  ECHECS_AVANT_SUPPRESSION,
  enteteAutorisationVapid,
  estPointAccesPushAutorise,
  interpreterReponsePush,
  sujetVapidValide,
  type ClesVapid,
} from "./vapid";

/**
 * Envoi des notifications push web (lot A2). Réservé au serveur : lit tous les abonnements d'un restaurant avec la clé
 * service-role, jamais depuis le navigateur.
 *
 * Aucun contenu n'est envoyé : le Service Worker affiche un texte générique. Rien de ce qui concerne un client (nom,
 * téléphone, adresse, montant) ne passe par Google, Mozilla ou Apple. Les journaux ne contiennent que des compteurs.
 */

/** Clés VAPID lues dans l'environnement du Worker ; `null` si la fonction n'est pas configurée (aucun envoi, aucun bouton). */
export function lireClesVapid(): ClesVapid | null {
  const clePublique = process.env.VAPID_PUBLIC_KEY;
  const clePrivee = process.env.VAPID_PRIVATE_KEY;
  const sujet = process.env.VAPID_SUBJECT;
  if (!clePublique || !clePrivee || !sujet || !sujetVapidValide(sujet)) {
    return null;
  }
  return { clePublique, clePrivee, sujet };
}

export type IssueEnvoi = "ok" | "expire" | "echec";

/** Envoie une notification vide à un point d'accès ; ne lève jamais d'exception. */
export async function envoyerNotification(endpoint: string, cles: ClesVapid): Promise<IssueEnvoi> {
  if (!estPointAccesPushAutorise(endpoint)) {
    // Abonnement forgé ou service inconnu : à supprimer, jamais à contacter.
    return "expire";
  }
  try {
    const jeton = await creerJetonVapid(endpoint, cles);
    const reponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: enteteAutorisationVapid(jeton, cles.clePublique),
        TTL: "3600",
        Urgency: "high",
        "Content-Length": "0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    return interpreterReponsePush(reponse.status);
  } catch {
    return "echec";
  }
}

export interface BilanEnvoi {
  abonnes: number;
  envoyes: number;
  expires: number;
  echecs: number;
}

interface LigneAbonnement {
  id: string;
  endpoint: string;
  echecs: number;
}

async function envoyerAuxAbonnements(lignes: LigneAbonnement[], cles: ClesVapid): Promise<BilanEnvoi> {
  const admin = creerClientAdmin();
  const bilan: BilanEnvoi = { abonnes: lignes.length, envoyes: 0, expires: 0, echecs: 0 };

  await Promise.all(
    lignes.map(async (ligne) => {
      const issue = await envoyerNotification(ligne.endpoint, cles);
      if (issue === "ok") {
        bilan.envoyes += 1;
        await admin
          .from("push_subscriptions")
          .update({ derniere_reussite_le: new Date().toISOString(), echecs: 0 })
          .eq("id", ligne.id);
      } else if (issue === "expire" || ligne.echecs + 1 >= ECHECS_AVANT_SUPPRESSION) {
        bilan.expires += 1;
        await admin.from("push_subscriptions").delete().eq("id", ligne.id);
      } else {
        bilan.echecs += 1;
        await admin.from("push_subscriptions").update({ echecs: ligne.echecs + 1 }).eq("id", ligne.id);
      }
    })
  );
  return bilan;
}

/** Prévient tous les appareils abonnés d'un restaurant qu'une commande est arrivée. Meilleur effort, jamais bloquant. */
export async function notifierRestaurant(restaurantId: string): Promise<BilanEnvoi | null> {
  const cles = lireClesVapid();
  if (!cles) {
    return null;
  }
  const { data, error } = await creerClientAdmin()
    .from("push_subscriptions")
    .select("id, endpoint, echecs")
    .eq("restaurant_id", restaurantId);
  if (error || !data || data.length === 0) {
    return error ? null : { abonnes: 0, envoyes: 0, expires: 0, echecs: 0 };
  }
  const bilan = await envoyerAuxAbonnements(data, cles);
  console.log("push_commande", JSON.stringify(bilan));
  return bilan;
}

/** Envoie la notification d'essai aux seuls appareils d'une personne (bouton « Envoyer un essai »). */
export async function notifierUtilisateur(utilisateurId: string): Promise<BilanEnvoi | null> {
  const cles = lireClesVapid();
  if (!cles) {
    return null;
  }
  const { data, error } = await creerClientAdmin()
    .from("push_subscriptions")
    .select("id, endpoint, echecs")
    .eq("utilisateur_id", utilisateurId);
  if (error || !data) {
    return null;
  }
  return envoyerAuxAbonnements(data, cles);
}
