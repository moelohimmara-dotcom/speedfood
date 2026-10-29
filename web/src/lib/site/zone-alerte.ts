// Pur, sans dépendance serveur : testable seul (npm run test:unit).
import { normaliserTelephone } from "../commande/telephone";

/**
 * Liste d'attente par zone : le contact laissé par la personne est un e-mail ou un numéro guinéen.
 * Validation partagée entre le formulaire (retour immédiat) et la route serveur (qui revérifie toujours).
 */

export type ContactAlerte = { ok: true; type: "email" | "telephone"; contact: string } | { ok: false; erreur: string };

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@.]{2,}$/;

export function validerContactAlerte(brut: string): ContactAlerte {
  const texte = brut.trim();
  if (!texte) return { ok: false, erreur: "Indiquez une adresse e-mail ou un numéro de téléphone." };
  if (texte.includes("@")) {
    const email = texte.toLowerCase();
    if (email.length > 120 || !EMAIL.test(email)) return { ok: false, erreur: "Cette adresse e-mail ne semble pas valide." };
    return { ok: true, type: "email", contact: email };
  }
  const telephone = normaliserTelephone(texte);
  if (!telephone) return { ok: false, erreur: "Ce numéro ne semble pas valide (numéro guinéen à 9 chiffres, par exemple 622 00 00 00)." };
  return { ok: true, type: "telephone", contact: telephone };
}
