export const MODELES_HORAIRES = [
  { valeur: "", libelle: "Saisie libre / conserver le texte actuel" },
  { valeur: "Lundi à samedi : 9h00–21h00. Dimanche : fermé.", libelle: "Lundi à samedi, dimanche fermé" },
  { valeur: "Tous les jours : 8h00–22h00.", libelle: "Ouvert tous les jours" },
  { valeur: "Lundi à vendredi : 9h00–18h00. Samedi : 9h00–14h00. Dimanche : fermé.", libelle: "Semaine + samedi matin" },
  { valeur: "Sur réservation : contactez le restaurant pour connaître les disponibilités.", libelle: "Sur réservation" },
] as const;

export const MODELES_CONSIGNES = [
  { valeur: "", libelle: "Saisie libre / conserver le texte actuel" },
  { valeur: "Règlement directement au restaurant. Merci de vérifier votre commande à la réception.", libelle: "Paiement et vérification" },
  { valeur: "À emporter uniquement. Appelez le restaurant à votre arrivée.", libelle: "À emporter" },
  { valeur: "Livraison disponible dans un rayon proche du restaurant. Le restaurant vous confirme les conditions.", libelle: "Livraison locale" },
] as const;

export const PROFILS_PAIEMENT = [
  { valeur: "", libelle: "Sélection manuelle" },
  { valeur: "mobile", libelle: "Orange Money + MTN MoMo" },
  { valeur: "tous", libelle: "Tous les moyens" },
] as const;

/**
 * Moyens qu'un profil pré-remplit : jamais les espèces (règle du 3 novembre 2026), « tous » = mobile money seulement. Un ancien profil enregistré avec
 * « especes » est toléré à la lecture : valeur inconnue, rien n'est imposé (`null`), aucune exception.
 */
export function moyensDuProfil(valeur: string): string[] | null {
  if (valeur === "mobile" || valeur === "tous") return ["orange_money", "mtn_momo"];
  return null;
}
