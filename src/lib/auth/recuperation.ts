"use server";

import { redirect } from "next/navigation";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientServeur } from "@/lib/db/server";
import { origineDuSite } from "@/lib/partage/origine";
import { limiterRecuperationMotDePasse } from "@/lib/securite/limitation-debit";
import type { EtatFormulaire } from "./actions";

export interface EtatRecuperation extends EtatFormulaire {
  envoye?: boolean;
}

/** Même réponse que le compte existe ou non : on ne révèle jamais quelles adresses ont un compte. */
export async function demanderReinitialisationAction(
  _etatPrecedent: EtatRecuperation,
  formData: FormData
): Promise<EtatRecuperation> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { erreur: "Saisissez une adresse e-mail valide." };
  }

  try {
    await limiterRecuperationMotDePasse(email);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return { erreur: erreur.message };
    }
    throw erreur;
  }

  const supabase = await creerClientServeur();
  const origine = await origineDuSite();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origine}/auth/confirmation?suite=/connexion/nouveau-mot-de-passe`,
  });
  if (error) {
    // Erreur d'envoi (quota, service) : on le dit sans détail ; un compte inexistant, lui, ne produit
    // pas d'erreur côté Supabase.
    console.error("recuperation_mot_de_passe_echec", error.status ?? "inconnu");
    return { erreur: "L'e-mail n'a pas pu être envoyé pour le moment. Réessayez dans quelques minutes." };
  }
  return { envoye: true };
}

export async function nouveauMotDePasseAction(
  _etatPrecedent: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const motDePasse = String(formData.get("mot_de_passe") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (motDePasse.length < 8) {
    return { erreur: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (motDePasse.length > 200) {
    return { erreur: "Le mot de passe est trop long." };
  }
  if (motDePasse !== confirmation) {
    return { erreur: "Les deux mots de passe ne sont pas identiques." };
  }

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erreur: "Ce lien a expiré. Demandez-en un nouveau depuis la page de connexion." };
  }

  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) {
    if (error.message.includes("different from the old password")) {
      return { erreur: "Choisissez un mot de passe différent de l'ancien." };
    }
    if (error.message.includes("Password should be at least")) {
      return { erreur: "Le mot de passe doit contenir au moins 8 caractères." };
    }
    return { erreur: "Impossible de changer le mot de passe pour le moment. Réessayez dans un instant." };
  }

  redirect("/restaurant");
}
