"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { creerClientAdmin } from "@/lib/db/admin";
import { origineDuSite } from "@/lib/partage/origine";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { connexionClientActive } from "./reglage";
import { estAvatarValide, validerPseudo } from "./profil";
import { validerCoordonnees } from "./coordonnees";

export interface EtatProfil {
  erreur?: string;
}

function suiteSure(brute: string, defaut: string): string {
  return estCheminInterneSur(brute) ? brute : defaut;
}

/**
 * Départ de la connexion Facebook. Ne démarre que si l'administrateur l'a activée. On ne demande à Facebook que le
 * profil public et l'adresse e-mail : jamais les amis, les publications ni les pages.
 */
export async function continuerAvecFacebookAction(formData: FormData): Promise<void> {
  const suite = suiteSure(String(formData.get("suite") ?? ""), "/compte");
  if (!(await connexionClientActive())) {
    redirect("/entrer?indisponible=1");
  }
  const supabase = await creerClientServeur();
  const origine = await origineDuSite();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${origine}/auth/client?suite=${encodeURIComponent(suite)}`,
      scopes: "email public_profile",
    },
  });
  if (error || !data.url) {
    redirect("/entrer?erreur=depart");
  }
  redirect(data.url);
}

/** Crée ou met à jour le profil du client connecté (pseudo et avatar), puis renvoie vers la suite. */
export async function enregistrerProfilAction(_etat: EtatProfil, formData: FormData): Promise<EtatProfil> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/entrer");
  }

  const pseudo = validerPseudo(String(formData.get("pseudo") ?? ""));
  if (!pseudo.ok) {
    return { erreur: pseudo.erreur };
  }
  const avatar = formData.get("avatar");
  if (!estAvatarValide(avatar)) {
    return { erreur: "Choisissez un avatar dans la liste." };
  }

  const { error } = await supabase
    .from("client_profils")
    .upsert({ utilisateur_id: user.id, pseudo: pseudo.pseudo, avatar }, { onConflict: "utilisateur_id" });
  if (error) {
    return { erreur: "Impossible d'enregistrer votre profil. Réessayez dans un instant." };
  }

  revalidatePath("/compte");
  redirect(suiteSure(String(formData.get("suite") ?? ""), "/compte"));
}

export interface EtatSuppression {
  erreur?: string;
}

/**
 * Suppression par le client de son propre compte (droit à l'effacement). Réservée aux comptes clients : un compte
 * restaurateur ou système passe par l'équipe, qui vérifie d'abord les commandes et les membres.
 */
export async function supprimerMonCompteAction(_etat: EtatSuppression, formData: FormData): Promise<EtatSuppression> {
  if (formData.get("confirmation") !== "on") {
    return { erreur: "Cochez la case pour confirmer la suppression." };
  }
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/entrer");
  }

  const [{ data: membre }, { data: roleSysteme }] = await Promise.all([
    supabase.from("restaurant_memberships").select("restaurant_id").eq("utilisateur_id", user.id).maybeSingle(),
    supabase.from("system_admin_memberships").select("utilisateur_id").eq("utilisateur_id", user.id).maybeSingle(),
  ]);
  if (membre || roleSysteme) {
    return { erreur: "Ce compte gère un restaurant ou l'administration : écrivez-nous pour le fermer en sécurité." };
  }

  const { error } = await creerClientAdmin().auth.admin.deleteUser(user.id);
  if (error) {
    return { erreur: "Impossible de supprimer le compte pour le moment. Réessayez dans un instant." };
  }
  await supabase.auth.signOut();
  redirect("/restaurants?compte=supprime");
}

export async function deconnexionClientAction(): Promise<void> {
  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  redirect("/restaurants");
}

export interface ResultatMemorisation {
  ok: boolean;
}

/**
 * Mémorise (à la demande explicite du client, case cochée à la commande) ses coordonnées dans son compte, pour préremplir
 * la prochaine commande. Réservé au compte connecté qui a un profil ; revalidé côté serveur comme une commande. N'échoue
 * jamais bruyamment : la commande est déjà envoyée, l'enregistrement est un confort.
 */
export async function memoriserCoordonneesAction(brut: {
  nom: string;
  telephone: string;
  adresse: string | null;
}): Promise<ResultatMemorisation> {
  const valide = validerCoordonnees(brut);
  if (!valide.ok) {
    return { ok: false };
  }
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false };
  }
  const { data, error } = await supabase
    .from("client_profils")
    .update({
      nom_commande: valide.coordonnees.nom,
      telephone: valide.coordonnees.telephone,
      adresse: valide.coordonnees.adresse,
      coordonnees_enregistrees_le: new Date().toISOString(),
    })
    .eq("utilisateur_id", user.id)
    .select("utilisateur_id");
  revalidatePath("/compte");
  return { ok: !error && (data?.length ?? 0) === 1 };
}

/** Efface les coordonnées mémorisées (le pseudo et l'avatar restent). */
export async function oublierCoordonneesAction(): Promise<void> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/entrer");
  }
  await supabase
    .from("client_profils")
    .update({ nom_commande: null, telephone: null, adresse: null, coordonnees_enregistrees_le: null })
    .eq("utilisateur_id", user.id);
  revalidatePath("/compte");
}
