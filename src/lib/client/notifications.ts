import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { notifierUtilisateursFcm } from "@/lib/push/appareils";
import { notifierClient } from "@/lib/push/envoi";
import { contenuNotificationClient, typeDepuisStatutCommande, type ContenuNotification } from "./notifications-regles";

/**
 * Notifications de suivi de commande pour le client connecté (espace client). Deux temps :
 *  1. `signalerChangementCommande` (au changement de statut) : enregistre la notification et envoie un push VIDE aux appareils du client ;
 *  2. `lireProchaineNotification` (appelée par le Service Worker du client, avec sa session) : rend le texte et marque « lue ».
 * Une commande sans compte (jeton seul), un client qui a coupé les notifications ou sans appareil abonné : aucun effet, sans erreur.
 */
const sansTypes = () => creerClientAdmin() as unknown as SupabaseClient;

export async function signalerChangementCommande(commandeId: string, statut: string): Promise<void> {
  const type = typeDepuisStatutCommande(statut);
  if (!type) return;
  const db = sansTypes();

  const { data: commande } = await db.from("orders").select("id, client_user_id, est_test").eq("id", commandeId).maybeSingle();
  if (!commande || typeof commande.client_user_id !== "string") return;
  const utilisateurId = commande.client_user_id as string;

  // Préférence du client : « Me prévenir quand ma commande avance ». Absente = activée.
  const { data: profil } = await db.from("client_profils").select("notifications_commande").eq("utilisateur_id", utilisateurId).maybeSingle();
  if (profil && profil.notifications_commande === false) return;

  // Application native du client (Firebase) : texte générique par étape, indépendant du push web ci-dessous. Meilleur effort.
  const typeNatif = ({ acceptee: "commande_acceptee", prete: "commande_prete", terminee: "commande_terminee", refusee: "commande_refusee", annulee: "commande_annulee" } as const)[statut as "acceptee"];
  if (typeNatif) await notifierUtilisateursFcm([utilisateurId], typeNatif).catch(() => undefined);

  // Aucun appareil : inutile de garder une notification que personne ne lira.
  const { count } = await db.from("client_push_subscriptions").select("id", { count: "exact", head: true }).eq("utilisateur_id", utilisateurId);
  if (!count) return;

  // Une fois par étape et par commande (index unique) : un deuxième appel est ignoré.
  const { error } = await db.from("client_notifications").insert({ utilisateur_id: utilisateurId, order_id: commandeId, type });
  if (error) return;
  await notifierClient(utilisateurId);
}

/** Texte de la plus récente notification non lue du client, marquée lue. `null` s'il n'y en a pas (le Service Worker affiche alors le texte de repli). */
export async function lireProchaineNotification(utilisateurId: string): Promise<ContenuNotification | null> {
  const db = sansTypes();
  const { data } = await db
    .from("client_notifications")
    .select("id, type, orders(mode, restaurants(nom))")
    .eq("utilisateur_id", utilisateurId)
    .is("lue_le", null)
    .order("cree_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  type Ligne = { id: number; type: string; orders: { mode: string; restaurants: { nom: string } | { nom: string }[] | null } | { mode: string; restaurants: { nom: string } | { nom: string }[] | null }[] | null };
  const ligne = data as unknown as Ligne;
  const type = typeDepuisStatutCommande(ligne.type);
  if (!type) return null;
  const commande = Array.isArray(ligne.orders) ? ligne.orders[0] : ligne.orders;
  const resto = Array.isArray(commande?.restaurants) ? commande?.restaurants[0] : commande?.restaurants;

  // Toutes les notifications en attente sont lues d'un coup : le client ne reçoit qu'UNE alerte, la plus récente.
  await db.from("client_notifications").update({ lue_le: new Date().toISOString() }).eq("utilisateur_id", utilisateurId).is("lue_le", null);
  return contenuNotificationClient(type, resto?.nom ?? "", commande?.mode ?? "retrait");
}
