import "server-only";
import type { User } from "@supabase/supabase-js";
import type { creerClientServeur } from "@/lib/db/server";
import { avatarPourGraine, pseudoPourCompte } from "./profil";

/** Client Supabase de session : on n'écrit que le profil du client connecté (RLS). */
type ClientSession = Awaited<ReturnType<typeof creerClientServeur>>;

/**
 * Garantit l'existence du profil client d'un utilisateur inscrit par le formulaire, en reprenant les coordonnées
 * déposées dans les métadonnées du compte à l'inscription.
 *
 * Pourquoi ici et pas dans l'action d'inscription : avec la confirmation d'e-mail activée (le réglage en production),
 * aucune session n'existe à l'instant de l'inscription — la RLS interdit alors toute écriture. Le compte porte donc
 * ses coordonnées dans `user_metadata`, et le profil est créé à la première visite authentifiée (`/compte`).
 *
 * Sans effet si le profil existe déjà (compte Facebook, ou compte déjà passé par ici) et sans jamais bloquer la page :
 * un échec est journalisé puis oublié, le client reste utilisable.
 */
export async function assurerProfilClient(supabase: ClientSession, user: User): Promise<void> {
  const meta = (user.user_metadata ?? {}) as {
    nom_commande?: unknown;
    telephone?: unknown;
    adresse?: unknown;
  };
  const nom = typeof meta.nom_commande === "string" ? meta.nom_commande.trim() : "";
  const telephone = typeof meta.telephone === "string" ? meta.telephone.trim() : "";

  // Pas de signature d'inscription par formulaire : rien à créer (compte Facebook, restaurateur, simple visite).
  if (!nom || !telephone) {
    return;
  }

  const { data: existant } = await supabase
    .from("client_profils")
    .select("utilisateur_id")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (existant) {
    return;
  }

  const adresseBrute = typeof meta.adresse === "string" ? meta.adresse.trim() : "";
  const { error } = await supabase.from("client_profils").insert({
    utilisateur_id: user.id,
    pseudo: pseudoPourCompte(nom),
    avatar: avatarPourGraine(user.id),
    nom_commande: nom,
    telephone,
    adresse: adresseBrute.length >= 5 ? adresseBrute : null,
    coordonnees_enregistrees_le: new Date().toISOString(),
  });
  if (error && error.code !== "23505") {
    // 23505 = créé entre-temps par un autre onglet : ce n’est pas un problème.
    console.error("client_profil_creation_impossible");
  }
}