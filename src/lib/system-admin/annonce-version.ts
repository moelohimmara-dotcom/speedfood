"use server";

import { revalidatePath } from "next/cache";
import { VERSION_APPLICATION } from "@/lib/application/version";
import { annoncerVersion } from "@/lib/push/annonce-version";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Annonce de la version courante de l'application aux appareils installés, depuis `/system/mises-a-jour` — réservé à `super_admin` (permission `parametres.editer`). Une version
 * ne s'annonce qu'une fois ; l'envoi est tracé dans le journal d'audit. Aucune donnée n'est saisie : la version vient du code publié (`src/lib/application/version.ts`).
 */
export interface EtatAnnonceVersion {
  erreur?: string;
  succes?: string;
}

export async function annoncerMiseAJourAction(_etat: EtatAnnonceVersion, _formData: FormData): Promise<EtatAnnonceVersion> {
  const contexte = await verifierPermission("parametres.editer");
  try {
    const resultat = await annoncerVersion(VERSION_APPLICATION.code, VERSION_APPLICATION.nom, contexte.utilisateurId);
    if (resultat.statut === "non_configuree") return { erreur: "Les notifications poussées ne sont pas configurées sur le serveur (secret Firebase absent)." };
    if (resultat.statut === "deja_annoncee") {
      return { erreur: `La version ${VERSION_APPLICATION.nom} a déjà été annoncée le ${new Date(resultat.annonceeLe).toLocaleString("fr-FR", { timeZone: "Africa/Conakry" })}.` };
    }
    await journaliserActionSysteme(contexte, {
      action: "application.annonce_version",
      cibleType: "application",
      cibleId: String(VERSION_APPLICATION.code),
      motif: `Version ${VERSION_APPLICATION.nom} annoncée : ${resultat.envoyes} envoyée(s) sur ${resultat.appareils} appareil(s)`,
    });
    revalidatePath("/system/mises-a-jour");
    return { succes: `Annonce envoyée : ${resultat.envoyes} appareil(s) notifié(s) sur ${resultat.appareils} enregistré(s).` };
  } catch {
    return { erreur: "L'annonce n'a pas pu être envoyée. Réessayez dans un instant." };
  }
}
