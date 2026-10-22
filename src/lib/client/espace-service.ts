import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import { validerAdresseClient, lireModePrefere } from "./espace";
import { estAvatarValide, validerPseudo } from "./profil";
import { listerMesAvis, type AvisLaisse } from "./mes-commandes";

/**
 * Espace client pour l'application (`/api/v1/client/*`) : profil, adresses, favoris, avis, préférences. Mêmes règles que les actions du site (`actions-espace.ts`) :
 * client de service, TOUJOURS filtré sur l'identité du jeton (jamais un identifiant envoyé par l'application), mêmes limites (5 adresses, 100 favoris, restaurant publié).
 * Aucune coordonnée d'un autre client ne passe par ici.
 */
const db = () => creerClientAdmin() as unknown as SupabaseClient;

export interface ProfilClientApi {
  pseudo: string;
  avatar: string;
  modePrefere: string | null;
  notificationsCommande: boolean;
}

export interface AdresseClientApi {
  id: string;
  libelle: string;
  adresse: string;
  parDefaut: boolean;
}

export interface FavoriClientApi {
  restaurantId: string;
  nom: string;
  ouvert: boolean;
}

export interface EspaceClientApi {
  profil: ProfilClientApi | null;
  adresses: AdresseClientApi[];
  favoris: FavoriClientApi[];
  avis: AvisLaisse[];
}

export async function lireEspaceClient(utilisateurId: string): Promise<EspaceClientApi> {
  const base = db();
  const [profil, adresses, favoris, avis] = await Promise.all([
    base.from("client_profils").select("pseudo, avatar, mode_prefere, notifications_commande").eq("utilisateur_id", utilisateurId).maybeSingle(),
    base.from("client_adresses").select("id, libelle, adresse, par_defaut").eq("utilisateur_id", utilisateurId).order("cree_le", { ascending: true }).limit(5),
    base.from("client_favoris").select("restaurant_id, restaurants(nom, ouvert)").eq("utilisateur_id", utilisateurId).order("cree_le", { ascending: false }).limit(100),
    listerMesAvis(utilisateurId),
  ]);
  const p = profil.data as { pseudo: string; avatar: string; mode_prefere: string | null; notifications_commande: boolean | null } | null;
  type LigneFavori = { restaurant_id: string; restaurants: { nom: string; ouvert: boolean } | { nom: string; ouvert: boolean }[] | null };
  return {
    profil: p ? { pseudo: p.pseudo, avatar: p.avatar, modePrefere: p.mode_prefere, notificationsCommande: p.notifications_commande !== false } : null,
    adresses: ((adresses.data ?? []) as Array<{ id: string; libelle: string; adresse: string; par_defaut: boolean }>).map((a) => ({ id: a.id, libelle: a.libelle, adresse: a.adresse, parDefaut: a.par_defaut })),
    favoris: ((favoris.data ?? []) as unknown as LigneFavori[]).map((f) => {
      const r = Array.isArray(f.restaurants) ? f.restaurants[0] : f.restaurants;
      return { restaurantId: f.restaurant_id, nom: r?.nom ?? "Restaurant", ouvert: r?.ouvert === true };
    }),
    avis,
  };
}

export type ResultatEspace = { ok: true; message: string; favori?: boolean } | { ok: false; message: string };
const echec = (message: string): ResultatEspace => ({ ok: false, message });

/** Profil : pseudo et avatar (liste fermée, comme la contrainte de la table), préférences de commande. Les champs absents ne changent pas. */
export async function enregistrerProfilClient(utilisateurId: string, c: Record<string, unknown>): Promise<ResultatEspace> {
  const base = db();
  const { data: existant } = await base.from("client_profils").select("utilisateur_id").eq("utilisateur_id", utilisateurId).maybeSingle();
  const champs: Record<string, unknown> = { mis_a_jour_le: new Date().toISOString() };
  if (c.pseudo !== undefined) {
    const v = validerPseudo(typeof c.pseudo === "string" ? c.pseudo : "");
    if (!v.ok) return echec(v.erreur);
    champs.pseudo = v.pseudo;
  }
  if (c.avatar !== undefined) {
    if (!estAvatarValide(c.avatar)) return echec("Choisissez un avatar dans la liste.");
    champs.avatar = c.avatar;
  }
  if (c.modePrefere !== undefined) {
    const mode = lireModePrefere(c.modePrefere);
    if (mode === undefined) return echec("Mode de commande inconnu.");
    champs.mode_prefere = mode;
  }
  if (c.notificationsCommande !== undefined) {
    if (typeof c.notificationsCommande !== "boolean") return echec("Réglage invalide.");
    champs.notifications_commande = c.notificationsCommande;
  }
  if (!existant) {
    if (typeof champs.pseudo !== "string" || typeof champs.avatar !== "string") return echec("Complétez d'abord votre profil : un pseudo et un avatar sont nécessaires.");
    const { error } = await base.from("client_profils").insert({ utilisateur_id: utilisateurId, ...champs });
    return error ? echec("Impossible d'enregistrer votre profil. Réessayez dans un instant.") : { ok: true, message: "Profil enregistré." };
  }
  const { error } = await base.from("client_profils").update(champs).eq("utilisateur_id", utilisateurId);
  return error ? echec("Impossible d'enregistrer vos modifications. Réessayez dans un instant.") : { ok: true, message: "Modifications enregistrées." };
}

/** Carnet d'adresses : ajouter (cinq au plus, la première devient la principale), supprimer (la plus ancienne reprend le rôle de principale), définir la principale. */
export async function actionAdresseClient(utilisateurId: string, c: Record<string, unknown>): Promise<ResultatEspace> {
  const base = db();
  switch (c.action) {
    case "ajouter": {
      const v = validerAdresseClient(typeof c.libelle === "string" ? c.libelle : "", typeof c.adresse === "string" ? c.adresse : "");
      if (!v.ok) return echec(v.erreur);
      const { count } = await base.from("client_adresses").select("id", { count: "exact", head: true }).eq("utilisateur_id", utilisateurId);
      const { error } = await base.from("client_adresses").insert({ utilisateur_id: utilisateurId, libelle: v.libelle, adresse: v.adresse, par_defaut: (count ?? 0) === 0 });
      if (error) return echec(error.code === "23514" && (count ?? 0) >= 5 ? "Vous avez déjà 5 adresses : supprimez-en une avant d'en ajouter." : "Impossible d'enregistrer cette adresse pour le moment.");
      return { ok: true, message: "Adresse enregistrée." };
    }
    case "supprimer": {
      if (typeof c.adresseId !== "string" || !estUuid(c.adresseId)) return echec("Adresse inconnue.");
      const { data: supprimee } = await base.from("client_adresses").delete().eq("id", c.adresseId).eq("utilisateur_id", utilisateurId).select("par_defaut");
      if (!supprimee || supprimee.length === 0) return echec("Adresse inconnue.");
      if ((supprimee[0] as { par_defaut: boolean }).par_defaut) {
        const { data: reste } = await base.from("client_adresses").select("id").eq("utilisateur_id", utilisateurId).order("cree_le", { ascending: true }).limit(1);
        const premiere = (reste as Array<{ id: string }> | null)?.[0];
        if (premiere) await base.from("client_adresses").update({ par_defaut: true }).eq("id", premiere.id).eq("utilisateur_id", utilisateurId);
      }
      return { ok: true, message: "Adresse supprimée." };
    }
    case "defaut": {
      if (typeof c.adresseId !== "string" || !estUuid(c.adresseId)) return echec("Adresse inconnue.");
      const { data: cible } = await base.from("client_adresses").select("id").eq("id", c.adresseId).eq("utilisateur_id", utilisateurId).maybeSingle();
      if (!cible) return echec("Adresse inconnue.");
      // L'index unique n'admet qu'une adresse principale : on retire l'ancienne avant de poser la nouvelle.
      await base.from("client_adresses").update({ par_defaut: false }).eq("utilisateur_id", utilisateurId).eq("par_defaut", true);
      await base.from("client_adresses").update({ par_defaut: true }).eq("id", c.adresseId).eq("utilisateur_id", utilisateurId);
      return { ok: true, message: "Adresse principale mise à jour." };
    }
    default:
      return echec("Action inconnue.");
  }
}

/** Ajoute ou retire un restaurant des favoris (publié seulement, cent au plus). */
export async function basculerFavoriClient(utilisateurId: string, restaurantId: unknown): Promise<ResultatEspace> {
  if (typeof restaurantId !== "string" || !estUuid(restaurantId)) return echec("Restaurant introuvable.");
  const base = db();
  const { data: existe } = await base.from("client_favoris").select("restaurant_id").eq("utilisateur_id", utilisateurId).eq("restaurant_id", restaurantId).maybeSingle();
  if (existe) {
    const { error } = await base.from("client_favoris").delete().eq("utilisateur_id", utilisateurId).eq("restaurant_id", restaurantId);
    return error ? echec("Impossible de retirer ce favori pour le moment.") : { ok: true, message: "Favori retiré.", favori: false };
  }
  const { data: resto } = await base.from("restaurants").select("id").eq("id", restaurantId).eq("publie", true).maybeSingle();
  if (!resto) return echec("Restaurant introuvable.");
  const { error } = await base.from("client_favoris").insert({ utilisateur_id: utilisateurId, restaurant_id: restaurantId });
  if (error) {
    if (error.code === "23514") return echec("Vous avez déjà 100 favoris : retirez-en avant d'en ajouter.");
    if (error.code === "23505") return { ok: true, message: "Favori enregistré.", favori: true };
    return echec("Impossible d'enregistrer ce favori pour le moment.");
  }
  return { ok: true, message: "Favori enregistré.", favori: true };
}

/**
 * Suppression par le client de son propre compte depuis l'application (droit à l'effacement), mêmes règles que le site (`supprimerMonCompteAction`) : réservée aux comptes
 * clients (un compte qui gère un restaurant, un livreur ou un administrateur passe par l'équipe, qui vérifie d'abord les commandes et les membres). L'identité vient du
 * jeton ; la confirmation écrite « SUPPRIMER » évite une suppression par erreur ou par un appel automatique. Irréversible.
 */
export async function supprimerCompteClient(utilisateurId: string, confirmation: unknown): Promise<ResultatEspace> {
  if (typeof confirmation !== "string" || confirmation.trim().toUpperCase() !== "SUPPRIMER") return echec("Écrivez SUPPRIMER pour confirmer la suppression.");
  const base = db();
  const [{ data: membre }, { data: livreur }, { data: roleSysteme }] = await Promise.all([
    base.from("restaurant_memberships").select("restaurant_id").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
    base.from("livreurs").select("id").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
    base.from("system_admin_memberships").select("utilisateur_id").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
  ]);
  if (membre || livreur || roleSysteme) return echec("Ce compte a un espace professionnel (restaurant, livreur ou équipe) : écrivez-nous pour le fermer en toute sécurité.");
  const { error } = await creerClientAdmin().auth.admin.deleteUser(utilisateurId);
  if (error) return echec("Impossible de supprimer le compte pour le moment. Réessayez dans un instant.");
  console.log("compte_client_supprime_application");
  return { ok: true, message: "Votre compte a été supprimé." };
}
