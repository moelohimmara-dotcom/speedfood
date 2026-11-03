/**
 * Moyens de paiement que le restaurant DÉCLARE accepter (lot D). Information affichée aux clients sur la fiche :
 * Speedfood n'encaisse rien, le règlement se fait directement avec le restaurant. La liste est fermée et doit rester
 * identique à la contrainte de la table `restaurants` (migration `moyens_paiement`).
 */
export const MOYENS_PAIEMENT = [
  { valeur: "especes", libelle: "Espèces" },
  { valeur: "orange_money", libelle: "Orange Money" },
  { valeur: "mtn_momo", libelle: "MTN MoMo" },
] as const;

/**
 * Moyens que le restaurateur peut COCHER aujourd'hui : jamais les espèces (décision du 3 novembre 2026). `MOYENS_PAIEMENT` garde la liste complète pour lire,
 * valider et conserver les réglages existants (la contrainte SQL accepte encore « especes »).
 */
export const MOYENS_SAISISSABLES = MOYENS_PAIEMENT.filter((m) => m.valeur !== "especes");

export type MoyenPaiement = (typeof MOYENS_PAIEMENT)[number]["valeur"];

const VALEURS: readonly string[] = MOYENS_PAIEMENT.map((m) => m.valeur);

/** Garde uniquement les valeurs connues, sans doublon, dans l'ordre de la liste fermée. */
export function normaliserMoyensPaiement(brut: readonly unknown[]): MoyenPaiement[] {
  return MOYENS_PAIEMENT.filter((m) => brut.includes(m.valeur)).map((m) => m.valeur);
}

/** `true` si toutes les valeurs reçues sont connues (une valeur inconnue est une requête forgée). */
export function moyensPaiementValides(brut: readonly unknown[]): boolean {
  return brut.every((v) => typeof v === "string" && VALEURS.includes(v));
}

export function libellesMoyensPaiement(valeurs: readonly string[]): string[] {
  // Les espèces ne sont plus affichées au public, même pour un restaurant qui les avait déclarées.
  return MOYENS_SAISISSABLES.filter((m) => valeurs.includes(m.valeur)).map((m) => m.libelle);
}
