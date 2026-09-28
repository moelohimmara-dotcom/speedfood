"use server";

import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";

export interface EtatFormulaire {
  erreur?: string;
}

export async function inscriptionAction(
  _etatPrecedent: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");

  if (!email || !motDePasse) {
    return { erreur: "Email et mot de passe sont obligatoires." };
  }
  if (motDePasse.length < 8) {
    return { erreur: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.signUp({ email, password: motDePasse });
  if (error) {
    return { erreur: traduireErreurAuth(error.message) };
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
  // on la respecte telle quelle.
  if (suite.startsWith("/")) {
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

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("fn_creer_restaurant_et_owner", {
    p_nom: nom,
    p_categorie_id: categorieId,
    p_quartier_id: quartierId,
  });

  if (error) {
    return { erreur: error.message };
  }

  redirect("/restaurant");
}

/** Messages Supabase Auth traduits en français, compréhensibles sans jargon (TDR.md §7). */
function traduireErreurAuth(message: string): string {
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Password should be at least")) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  return "Une erreur est survenue. Réessayez dans un instant.";
}
