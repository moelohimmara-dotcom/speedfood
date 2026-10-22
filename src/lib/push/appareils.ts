import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { compteServiceConfigure, envoyerFcm } from "./fcm-envoi";
import type { TypeNotification } from "./fcm";

/**
 * Appareils des applications natives et envoi des notifications poussées. Réservé au serveur (clé de service) : la table `appareils_push` n'a aucune policy.
 * Meilleur effort et jamais bloquant : aucune fonction d'envoi ne lève d'exception ni ne fait échouer l'action qui la déclenche.
 */
const sansTypes = () => creerClientAdmin() as unknown as SupabaseClient;

export const APPAREILS_MAX_PAR_UTILISATEUR = 10;
const ECHECS_AVANT_SUPPRESSION = 5;

export interface BilanFcm {
  appareils: number;
  envoyes: number;
  expires: number;
  echecs: number;
}

/**
 * Enregistre (ou met à jour) l'appareil d'un compte. Un jeton déjà connu change de propriétaire : l'appareil appartient à la dernière personne connectée dessus
 * (un restaurateur qui se déconnecte puis un livreur qui se connecte sur le même téléphone). Au plus [APPAREILS_MAX_PAR_UTILISATEUR] appareils par compte.
 */
export async function enregistrerAppareil(utilisateurId: string, jeton: string, plateforme: "android" | "ios", versionApp: string | null): Promise<boolean> {
  const db = sansTypes();
  const { error } = await db
    .from("appareils_push")
    .upsert({ utilisateur_id: utilisateurId, jeton, plateforme, version_app: versionApp, mis_a_jour_le: new Date().toISOString(), echecs: 0 }, { onConflict: "jeton" });
  if (error) return false;
  const { data } = await db.from("appareils_push").select("id").eq("utilisateur_id", utilisateurId).order("mis_a_jour_le", { ascending: false }).range(APPAREILS_MAX_PAR_UTILISATEUR, APPAREILS_MAX_PAR_UTILISATEUR + 50);
  const surplus = ((data ?? []) as Array<{ id: string }>).map((l) => l.id);
  if (surplus.length > 0) await db.from("appareils_push").delete().in("id", surplus);
  return true;
}

/** Retire l'appareil d'un compte (déconnexion) : il ne reçoit plus rien de ce compte. Sans effet si le jeton appartient à quelqu'un d'autre. */
export async function retirerAppareil(utilisateurId: string, jeton: string): Promise<void> {
  await sansTypes().from("appareils_push").delete().eq("utilisateur_id", utilisateurId).eq("jeton", jeton);
}

/** Notifie les appareils des comptes donnés. `null` si les notifications poussées ne sont pas configurées (secret absent). */
export async function notifierUtilisateursFcm(utilisateurIds: string[], type: TypeNotification): Promise<BilanFcm | null> {
  if (utilisateurIds.length === 0 || !compteServiceConfigure()) return null;
  const db = sansTypes();
  const { data, error } = await db.from("appareils_push").select("id, jeton, echecs").in("utilisateur_id", utilisateurIds).limit(100);
  if (error || !data) return null;
  const lignes = data as Array<{ id: string; jeton: string; echecs: number }>;
  const bilan: BilanFcm = { appareils: lignes.length, envoyes: 0, expires: 0, echecs: 0 };
  await Promise.all(
    lignes.map(async (l) => {
      const issue = await envoyerFcm(l.jeton, type);
      if (issue === "ok") {
        bilan.envoyes += 1;
        await db.from("appareils_push").update({ derniere_reussite_le: new Date().toISOString(), echecs: 0 }).eq("id", l.id);
      } else if (issue === "expire" || l.echecs + 1 >= ECHECS_AVANT_SUPPRESSION) {
        bilan.expires += 1;
        await db.from("appareils_push").delete().eq("id", l.id);
      } else {
        bilan.echecs += 1;
        await db.from("appareils_push").update({ echecs: l.echecs + 1 }).eq("id", l.id);
      }
    })
  );
  // Compteurs seulement : jamais de jeton ni de contenu dans les journaux.
  console.log("push_natif", JSON.stringify({ type, ...bilan }));
  return bilan;
}

/**
 * Prévient l'équipe Speedfood (rôles « operations » et « super_admin », leurs applications natives) qu'une commande vient d'arriver dans un établissement TENU PAR
 * L'ÉQUIPE (mode de vente « speedfood ») : personne d'autre ne la traitera. Sans effet pour un établissement autonome. Texte générique, aucune donnée de client.
 */
export async function notifierEquipeCommandeFcm(restaurantId: string): Promise<BilanFcm | null> {
  if (!compteServiceConfigure()) return null;
  const db = sansTypes();
  const { data: restaurant } = await db.from("restaurants").select("mode_vente").eq("id", restaurantId).maybeSingle();
  if ((restaurant as { mode_vente?: string } | null)?.mode_vente !== "speedfood") return null;
  const { data } = await db.from("system_admin_memberships").select("utilisateur_id").in("role", ["operations", "super_admin"]).limit(50);
  return notifierUtilisateursFcm(((data ?? []) as Array<{ utilisateur_id: string }>).map((m) => m.utilisateur_id), "equipe_commande");
}

/** Prévient les membres d'un restaurant (leurs applications natives) qu'une commande est arrivée. */
export async function notifierRestaurantFcm(restaurantId: string, type: TypeNotification = "commande_nouvelle"): Promise<BilanFcm | null> {
  if (!compteServiceConfigure()) return null;
  const { data } = await sansTypes().from("restaurant_memberships").select("utilisateur_id").eq("restaurant_id", restaurantId).limit(50);
  return notifierUtilisateursFcm(((data ?? []) as Array<{ utilisateur_id: string }>).map((m) => m.utilisateur_id), type);
}
