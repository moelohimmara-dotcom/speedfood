"use server";

import { redirect } from "next/navigation";
import { estUuid } from "@/lib/commande/commun";
import { creerClientServeur } from "@/lib/db/server";
import { origineDuSite } from "@/lib/partage/origine";
import { estCheminInterneSur } from "./redirection";

export interface EtatFormulaire {
  erreur?: string;
}

export interface EtatInscription extends EtatFormulaire {
  /** Compte créé mais pas encore actif : la confirmation par e-mail est exigée. */
  confirmationRequise?: boolean;
  /** Adresse saisie, renvoyée pour l'afficher dans la confirmation (jamais pour dire si un compte existe déjà). */
  email?: string;
}

export async function inscriptionAction(
  _etatPrecedent: EtatInscription,
  formData: FormData
): Promise<EtatInscription> {
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");

  if (!email || !motDePasse) {
    return { erreur: "Email et mot de passe sont obligatoires." };
  }
  if (motDePasse.length < 8) {
    return { erreur: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const supabase = await creerClientServeur();
  const origine = await origineDuSite();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      // Le lien du courriel revient sur notre route d'échange, qui ouvre la session
      // puis renvoie vers l'onboarding — même motif que la réinitialisation du mot de passe.
      emailRedirectTo: `${origine}/auth/confirmation?suite=/restaurant/nouveau`,
    },
  });
  if (error) {
    return { erreur: traduireErreurAuth(error.message) };
  }

  // Confirmation d'e-mail activée : Supabase n'ouvre AUCUNE session tant que le lien
  // n'a pas été suivi. Sans ce test, l'inscrit repartait vers une page protégée et
  // atterrissait sur la connexion, sans jamais comprendre qu'il doit ouvrir sa boîte.
  if (!data.session) {
    return { confirmationRequise: true, email };
  }

  redirect("/restaurant/nouveau");
}

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
