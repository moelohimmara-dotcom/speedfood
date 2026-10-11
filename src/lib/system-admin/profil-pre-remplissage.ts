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
  { valeur: "Retrait sur place uniquement. Appelez le restaurant à votre arrivée.", libelle: "Retrait sur place" },
  { valeur: "Livraison disponible dans un rayon proche du restaurant. Le restaurant vous confirme les conditions.", libelle: "Livraison locale" },
] as const;

export const PROFILS_PAIEMENT = [
  { valeur: "", libelle: "Sélection manuelle" },
  { valeur: "especes", libelle: "Espèces uniquement" },
  { valeur: "mobile", libelle: "Orange Money + MTN MoMo" },
  { valeur: "tous", libelle: "Tous les moyens" },
] as const;

export function moyensDuProfil(valeur: string): string[] | null {
  if (valeur === "especes") return ["especes"];
  if (valeur === "mobile") return ["orange_money", "mtn_momo"];
  if (valeur === "tous") return ["especes", "orange_money", "mtn_momo"];
  return null;
}
