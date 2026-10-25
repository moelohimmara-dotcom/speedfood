// Règles pures du remboursement fait à la main (lot L12). Testables seules : npm run test:unit.
// Orange Money et MTN MoMo sont les moyens normaux ; les espèces sont le dernier recours et demandent plus de preuves.

export const MOYENS_REMBOURSEMENT = ["orange_money", "mtn_momo", "especes"] as const;
export type MoyenRemboursement = (typeof MOYENS_REMBOURSEMENT)[number];

export const LIBELLE_MOYEN: Record<MoyenRemboursement, string> = {
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  especes: "Espèces (dernier recours)",
};

export interface SaisieRemboursementManuel {
  moyen: string;
  reference: string;
  recuPar: string;
  motif: string;
}

export interface RemboursementManuelValide {
  moyen: MoyenRemboursement;
  reference: string | null;
  recuPar: string | null;
  motif: string;
}

export type ResultatValidation = { ok: true; valeur: RemboursementManuelValide } | { ok: false; erreur: string };

const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._\- ]{2,59}$/;

export function estMoyenRemboursement(valeur: string): valeur is MoyenRemboursement {
  return (MOYENS_REMBOURSEMENT as readonly string[]).includes(valeur);
}

/**
 * Contrôle ce que l'exploitant déclare avoir fait : un remboursement sans trace ne se valide pas.
 * - Mobile money : la référence de la transaction est obligatoire (c'est elle que l'on retrouvera dans le relevé de l'opérateur).
 * - Espèces : nom de la personne qui a reçu l'argent obligatoire, et un motif qui explique pourquoi le mobile money était impossible (15 caractères au moins) ;
 *   le numéro de reçu signé est facultatif mais conseillé.
 */
export function validerRemboursementManuel(s: SaisieRemboursementManuel): ResultatValidation {
  if (!estMoyenRemboursement(s.moyen)) return { ok: false, erreur: "Choisissez le moyen de remboursement : Orange Money, MTN MoMo ou espèces." };
  const motif = s.motif.trim();
  const reference = s.reference.trim();
  const recuPar = s.recuPar.trim();
  if (motif.length < 5) return { ok: false, erreur: "Indiquez le motif de la décision (5 caractères au moins)." };
  if (motif.length > 300) return { ok: false, erreur: "Le motif est trop long (300 caractères au plus)." };
  if (s.moyen === "especes") {
    if (recuPar.length < 3 || recuPar.length > 80) return { ok: false, erreur: "Espèces : indiquez le nom de la personne qui a reçu l'argent (3 à 80 caractères)." };
    if (motif.length < 15) return { ok: false, erreur: "Espèces : expliquez pourquoi un remboursement par mobile money était impossible (15 caractères au moins)." };
    if (reference !== "" && !REFERENCE.test(reference)) return { ok: false, erreur: "Le numéro de reçu contient des caractères non autorisés (lettres, chiffres, tiret, point)." };
    return { ok: true, valeur: { moyen: s.moyen, reference: reference === "" ? null : reference, recuPar, motif } };
  }
  if (!REFERENCE.test(reference)) return { ok: false, erreur: "Indiquez la référence de la transaction reçue de l'opérateur (3 à 60 caractères : lettres, chiffres, tiret, point)." };
  return { ok: true, valeur: { moyen: s.moyen, reference, recuPar: null, motif } };
}
