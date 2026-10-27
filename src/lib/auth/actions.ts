"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NOM_COOKIE_SUIVI, optionsCookieSuivi } from "@/lib/commande/sessionSuivi";
import { creerClientServeur } from "@/lib/db/server";
import { origineDuSite } from "@/lib/partage/origine";
import { estCheminInterneSur } from "./redirection";
import { lireRoleChoisi, typeDeCompte, verifierPiste } from "./acces";
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
  if (motDePasse.length < 12) {
    return { erreur: "Le mot de passe doit contenir au moins 12 caractères." };
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: roleSysteme }, { data: membership }, { data: profil }] = await Promise.all([
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
    supabase
      .from("client_profils")
      .select("utilisateur_id")
      .eq("utilisateur_id", user?.id ?? "")
      .maybeSingle(),
  ]);

  // Filtre d'entrée : la personne a dit au départ si elle est client ou restaurateur ; le compte doit correspondre.
  // Sinon on referme la session aussitôt et on l'oriente vers la bonne piste (aucun accès accordé « par erreur »).
  const piste = lireRoleChoisi(formData.get("role"));
  const reel = typeDeCompte({ roleSysteme: !!roleSysteme, membreRestaurant: !!membership, profilClient: !!profil });
  const verdict = verifierPiste(piste, reel);
  if (!verdict.ok) {
    await supabase.auth.signOut();
    return { erreur: verdict.message };
  }

  // Destination explicite (utilisateur redirigé depuis une page protégée) :
  // uniquement un chemin interne. `//hote`, `/\hote`, un schéma ou un caractère
  // de contrôle seraient une redirection ouverte (hameçonnage après connexion).
  if (estCheminInterneSur(suite)) {
    redirect(suite);
  }

  // Sinon, routage par type de compte (deux consoles distinctes, ADR-010) :
  // un admin système pur va dans son CMS, un restaurateur dans sa console.
  if (roleSysteme && !membership) {
    redirect("/system");
  }
  // Compte client (ni restaurateur ni administration) : on le mène à SON compte. Sans cette branche, un client
  // était envoyé dans l'espace restaurateur et Edguyé par « Configurons votre établissement ».
  if (!membership && user) {
    await assurerProfilClient(supabase, user);
    redirect("/compte");
  }
  redirect("/restaurant");
}

export async function deconnexionAction(): Promise<void> {
  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  // Le cookie de suivi de commande ne doit pas survivre à la déconnexion : même chemin que celui posé à sa création.
  (await cookies()).delete({ name: NOM_COOKIE_SUIVI, path: optionsCookieSuivi().path });
  redirect("/connexion");
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
  if (message.toLowerCase().includes("banned")) {
    // Inscription suspendue : l'adresse ressemble à celle d'un compte existant, l'équipe l'examine (voir /system/acces/doublons).
    return "Votre inscription est en cours de vérification par l'équipe Speedfood (adresse proche d'un compte existant). Connectez-vous avec votre première adresse, ou attendez la réponse sous 48 h.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Password should be at least")) {
    return "Le mot de passe doit contenir au moins 12 caractères.";
  }
  if (message.includes("weak") || message.includes("pwned") || message.includes("compromised")) {
    return "Ce mot de passe est connu dans des fuites de données. Choisissez-en un autre.";
  }
  return "Une erreur est survenue. Réessayez dans un instant.";
}
