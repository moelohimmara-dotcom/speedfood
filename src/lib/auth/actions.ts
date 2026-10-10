"use server";

import { redirect } from "next/navigation";
import { estUuid } from "@/lib/commande/commun";
import { creerClientServeur } from "@/lib/db/server";
import { origineDuSite } from "@/lib/partage/origine";
import { estCheminInterneSur } from "./redirection";
import { validerCoordonnees } from "@/lib/client/coordonnees";
import { assurerProfilClient } from "@/lib/client/profil-serveur";

export interface EtatFormulaire {
  erreur?: string;
}

export interface EtatInscription extends EtatFormulaire {
  /** Compte créé mais pas encore actif : la confirmation par e-mail est exigée. */
  confirmationRequise?: boolean;
  /** Adresse saisie, renvoyée pour l'afficher dans la confirmation (jamais pour dire si un compte existe déjà). */
  email?: string;
}

/**
 * Inscription complète via formulaire (nom, téléphone, email, double mot de passe, adresse).
 * Crée le compte Supabase et mémorise les coordonnées dans `client_profils`.
 *
 * Deux cas, volontairement distincts :
 * - session immédiate (confirmation d'e-mail désactivée) : le profil est créé tout de suite ;
 * - confirmation d'e-mail requise (le réglage retenu en production) : AUCUNE session n'existe encore, donc
 *   aucune écriture possible (RLS : un client ne peut écrire que son propre profil). Les coordonnées sont alors
 *   conservées dans les métadonnées du compte, et `assurerProfilClient` les reprend à la première visite
 *   authentifiée de `/compte`. Les données ne sont donc jamais perdues, mais le profil n'apparaît pas avant.
 */
export async function inscriptionCompleteAction(
  _etatPrecedent: EtatInscription,
  formData: FormData
): Promise<EtatInscription> {
  const suiteDemandee = String(formData.get("suite") ?? "").trim();
  const suite = estCheminInterneSur(suiteDemandee) ? suiteDemandee : "/compte";
  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");
  const motDePasseConfirmation = String(formData.get("mot_de_passe_confirmation") ?? "");
  const residence = String(formData.get("residence") ?? "").trim();
  const ville = String(formData.get("ville") ?? "").trim();
  const quartier = String(formData.get("quartier") ?? "").trim();
  const pays = String(formData.get("pays") ?? "").trim();

  if (!nom || !telephone || !email || !motDePasse || !motDePasseConfirmation || !ville) {
    return { erreur: "Tous les champs obligatoires doivent être remplis." };
  }
  if (nom.length < 2 || nom.length > 120) {
    return { erreur: "Le nom doit contenir entre 2 et 120 caractères." };
  }
  if (motDePasse.length < 8) {
    return { erreur: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (motDePasse !== motDePasseConfirmation) {
    return { erreur: "Les deux mots de passe ne correspondent pas." };
  }

  const coord = validerCoordonnees({
    nom,
    telephone,
    adresse: `${residence}, ${quartier}, ${ville}, ${pays || "Guinée"}`.trim(),
  });
  if (!coord.ok) {
    return { erreur: coord.erreur };
  }

  const supabase = await creerClientServeur();
  const origine = await origineDuSite();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      // Un client qui confirme son adresse arrive sur SON compte, pas sur l'inscription d'un restaurant.
      emailRedirectTo: `${origine}/auth/confirmation?suite=${encodeURIComponent(suite)}`,
      data: {
        nom_commande: coord.coordonnees.nom,
        telephone: coord.coordonnees.telephone,
        adresse: coord.coordonnees.adresse,
      },
    },
  });
  if (error) {
    return { erreur: traduireErreurAuth(error.message) };
  }

  if (!data.session || !data.user) {
    // Confirmation d'e-mail requise : la session n'existe pas encore. Le profil sera créé à la première
    // visite authentifiée (`assurerProfilClient`), à partir des métadonnées ci-dessus.
    return { confirmationRequise: true, email };
  }

  await assurerProfilClient(supabase, data.user);

  redirect(suite);
}

/** Alias pour l'ancien composant InscriptionForm (email + mot de passe seul). */
export const inscriptionAction = inscriptionCompleteAction;

export async function connexionAction(
  _etatPrecedent: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");
  const suite = String(formData.get("suite") ?? "").trim();

  if (!email || !motDePasse) {
    return { erreur: "Email et mot de passe sont obligatoires." };
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });

  if (error) {
    return { erreur: traduireErreurAuth(error.message) };
  }

  // Destination explicite (utilisateur redirigé depuis une page protégée) :
  // uniquement un chemin interne. `//hote`, `/\hote`, un schéma ou un caractère
  // de contrôle seraient une redirection ouverte (hameçonnage après connexion).
  if (estCheminInterneSur(suite)) {
    redirect(suite);
  }

  // Sinon, routage par type de compte (deux consoles distinctes, ADR-010) :
  // un admin système pur va dans son CMS, un restaurateur dans sa console.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: roleSysteme }, { data: membership }] = await Promise.all([
    supabase
      .from("system_admin_memberships")
      .select("utilisateur_id")
      .eq("utilisateur_id", user?.id ?? "")
      .maybeSingle(),
    supabase
      .from("restaurant_memberships")
      .select("restaurant_id")
      .eq("utilisateur_id", user?.id ?? "")
      .maybeSingle(),
  ]);

  if (roleSysteme && !membership) {
    redirect("/system");
  }
  redirect("/restaurant");
}

export async function deconnexionAction(): Promise<void> {
  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  redirect("/connexion");
}

export async function creerEtablissementAction(
  _etatPrecedent: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const nom = String(formData.get("nom") ?? "").trim();
  const categorieId = String(formData.get("categorie_id") ?? "");
  const quartierId = String(formData.get("quartier_id") ?? "");

  if (!nom || !categorieId || !quartierId) {
    return { erreur: "Tous les champs sont obligatoires." };
  }
  if (nom.length < 2 || nom.length > 120) {
    return { erreur: "Le nom de l'établissement doit compter de 2 à 120 caractères." };
  }
  if (!estUuid(categorieId) || !estUuid(quartierId)) {
    return { erreur: "Catégorie ou quartier invalide." };
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("fn_creer_restaurant_et_owner", {
    p_nom: nom,
    p_categorie_id: categorieId,
    p_quartier_id: quartierId,
  });

  if (error) {
    // Jamais le message brut de la base (revue de sécurité, point 14).
    return { erreur: "Impossible de créer l'établissement pour le moment. Réessayez dans un instant." };
  }

  redirect("/restaurant");
}

/** Messages Supabase Auth traduits en français, compréhensibles sans jargon (TDR.md §7). */
function traduireErreurAuth(message: string): string {
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (message.includes("Email not confirmed")) {
    // Confirmation d'e-mail activée : le compte existe mais le lien n'a pas été suivi.
    return "Confirmez d'abord votre adresse : ouvrez le lien reçu par e-mail (regardez aussi les courriers indésirables).";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Password should be at least")) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  return "Une erreur est survenue. Réessayez dans un instant.";
}
