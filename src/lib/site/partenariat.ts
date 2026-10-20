// Pur, sans dépendance serveur : testable seul (npm run test:unit).
import { validerContactAlerte } from "./zone-alerte";

/**
 * Demande de partenariat (page « Devenir partenaire »). Les restaurateurs ne passent PAS par là : leur porte est « Inscrire mon restaurant ».
 * Validation partagée entre le formulaire (retour immédiat) et l'action serveur (qui revérifie toujours).
 */

export const FORMES_PARTENARIAT = ["investir", "soutenir", "moyens", "contribuer"] as const;
export type FormePartenariat = (typeof FORMES_PARTENARIAT)[number];

export const LIBELLES_FORMES: Record<FormePartenariat, string> = {
  investir: "Investir",
  soutenir: "Soutenir la communauté",
  moyens: "Apporter des moyens",
  contribuer: "Contribuer",
};

export const STATUTS_PARTENARIAT = ["nouvelle", "en_cours", "traitee", "classee"] as const;
export type StatutPartenariat = (typeof STATUTS_PARTENARIAT)[number];

export const LIBELLES_STATUTS: Record<StatutPartenariat, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  traitee: "Traitée",
  classee: "Classée",
};

export interface DemandePartenariat {
  forme: FormePartenariat;
  organisation: string;
  nomContact: string;
  contactType: "email" | "telephone";
  contact: string;
  message: string;
}

export type ResultatDemande = { ok: true; demande: DemandePartenariat } | { ok: false; erreur: string };

export function lireForme(brut: unknown): FormePartenariat | null {
  return FORMES_PARTENARIAT.find((f) => f === brut) ?? null;
}

export function lireStatut(brut: unknown): StatutPartenariat | null {
  return STATUTS_PARTENARIAT.find((s) => s === brut) ?? null;
}

function nettoyer(brut: unknown, max: number): string {
  // Espaces multiples et caractères de contrôle retirés ; la longueur est bornée après nettoyage.
  return String(brut ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

export function validerDemandePartenariat(brut: {
  forme: unknown;
  organisation: unknown;
  nomContact: unknown;
  contact: unknown;
  message: unknown;
}): ResultatDemande {
  const forme = lireForme(brut.forme);
  if (!forme) return { ok: false, erreur: "Choisissez la façon dont vous souhaitez nous rejoindre." };
  const organisation = nettoyer(brut.organisation, 120);
  if (organisation.length < 2) return { ok: false, erreur: "Indiquez le nom de votre organisation (ou votre nom si vous agissez seul(e))." };
  const nomContact = nettoyer(brut.nomContact, 120);
  if (nomContact.length < 2) return { ok: false, erreur: "Indiquez le nom de la personne à contacter." };
  const contact = validerContactAlerte(String(brut.contact ?? ""));
  if (!contact.ok) return { ok: false, erreur: contact.erreur };
  const message = nettoyer(brut.message, 1500);
  if (message.length < 20) return { ok: false, erreur: "Décrivez votre proposition en quelques phrases (20 caractères au moins)." };
  return { ok: true, demande: { forme, organisation, nomContact, contactType: contact.type, contact: contact.contact, message } };
}
