"use server";

import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { limiterPartenariat } from "@/lib/securite/limitation-debit";
import { validerDemandePartenariat } from "./partenariat";

export interface EtatPartenariat {
  erreur?: string;
  envoye?: boolean;
}

/**
 * Demande de partenariat. Enregistrée côté serveur uniquement (table sans accès navigateur), avec le consentement explicite de la personne.
 * Un champ « piège » invisible (`site_web`) attrape les robots : rempli, on répond comme si tout allait bien sans rien enregistrer.
 */
export async function envoyerDemandePartenariatAction(_etat: EtatPartenariat, formData: FormData): Promise<EtatPartenariat> {
  if (String(formData.get("site_web") ?? "").trim() !== "") return { envoye: true };
  if (formData.get("consentement") !== "on") return { erreur: "Cochez la case pour accepter d'être contacté(e)." };

  const verifiee = validerDemandePartenariat({
    forme: formData.get("forme"),
    organisation: formData.get("organisation"),
    nomContact: formData.get("nom_contact"),
    contact: formData.get("contact"),
    message: formData.get("message"),
  });
  if (!verifiee.ok) return { erreur: verifiee.erreur };

  try {
    await limiterPartenariat();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return { erreur: erreur.message };
    return { erreur: "Réessayez dans un instant." };
  }

  const { demande } = verifiee;
  const { error } = await creerClientAdmin().from("partenariat_demandes").insert({
    forme: demande.forme,
    organisation: demande.organisation,
    nom_contact: demande.nomContact,
    contact_type: demande.contactType,
    contact: demande.contact,
    message: demande.message,
  });
  if (error) {
    console.error("partenariat_echec", error.code);
    return { erreur: "Impossible d'enregistrer pour le moment. Réessayez dans un instant." };
  }
  return { envoye: true };
}
