"use server";

import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { MESSAGE_NUMERO_PRIS, numeroEstPris } from "@/lib/identite/numeros";
import { limiterReferencement } from "@/lib/securite/limitation-debit";
import { validerDemandeReferencement } from "./referencement";

export interface EtatReferencement {
  erreur?: string;
  envoye?: boolean;
}

/**
 * Demande de référencement d'un restaurant ou d'une épicerie (remplace l'inscription libre, ADR-020). Enregistrée côté serveur uniquement (table sans
 * accès navigateur), avec le consentement explicite de la personne. Un champ piège invisible (`site_web`) attrape les robots : rempli, on répond
 * comme si tout allait bien sans rien enregistrer.
 */
export async function envoyerDemandeReferencementAction(_etat: EtatReferencement, formData: FormData): Promise<EtatReferencement> {
  if (String(formData.get("site_web") ?? "").trim() !== "") return { envoye: true };
  if (formData.get("consentement") !== "on") return { erreur: "Cochez la case pour accepter d'être contacté(e)." };

  const verifiee = validerDemandeReferencement({
    type: formData.get("type"),
    organisation: formData.get("organisation"),
    commune: formData.get("commune"),
    quartier: formData.get("quartier"),
    indications: formData.get("indications"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    categories: formData.get("categories"),
    specialites: formData.get("specialites"),
    prenom: formData.get("prenom"),
    nom: formData.get("nom"),
    email: formData.get("email"),
    telephone: formData.get("telephone"),
  });
  if (!verifiee.ok) return { erreur: verifiee.erreur };

  try {
    await limiterReferencement();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return { erreur: erreur.message };
    return { erreur: "Réessayez dans un instant." };
  }

  const { demande: d } = verifiee;
  // Un numéro déjà détenu par un compte Speedfood ne sert pas à une demande anonyme : la personne se connecte avec son compte (ou l'équipe le lui attribue après vérification).
  if (await numeroEstPris(d.telephone)) return { erreur: MESSAGE_NUMERO_PRIS };
  const { error } = await creerClientAdmin().from("referencement_demandes").insert({
    type_etablissement: d.type,
    organisation: d.organisation,
    commune: d.commune,
    quartier: d.quartier,
    indications: d.indications,
    latitude: d.latitude,
    longitude: d.longitude,
    categories: d.categories,
    specialites: d.specialites,
    responsable_prenom: d.prenom,
    responsable_nom: d.nom,
    contact_email: d.email,
    contact_telephone: d.telephone,
  });
  if (error) {
    console.error("referencement_echec", error.code);
    return { erreur: "Impossible d'enregistrer pour le moment. Réessayez dans un instant." };
  }
  return { envoye: true };
}
