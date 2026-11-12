/**
 * Assistance conducteur (parité Kotlin, lot 3, ligne D8) : une aide courte et utile, lisible même hors connexion — les règles de la plateforme,
 * le numéro de l'assistance (lu comme l'aide générale, jamais affiché s'il n'est pas renseigné) et quoi faire d'un incident.
 * Ce n'est pas un centre d'aide : trois règles, un appel, un incident. Aucune pièce d'identité, aucun code client ne se signale dans un message.
 */
export const REGLES_LIVREUR: readonly string[] = [
  'Une course commence au restaurant et se termine au client. Le code du client est demandé à la remise.',
  "Les frais affichés sont les frais de la course. Speedfood n'encaisse rien dans l'application.",
  "Une course que vous ne pouvez pas livrer doit être déclarée : l'équipe Speedfood reprend le client.",
];

export const TEXTE_SANS_COURSE = "Aucune course n'est en cours. Pour un incident (véhicule, panne, retard), appelez l'assistance : c'est traité tout de suite.";

/** Texte d'incident : avec une course en cours, on la déclare dans l'espace livreur ; sinon on appelle l'assistance. */
export function texteIncidentLivreur(referenceCourse: string | null): string {
  return referenceCourse !== null
    ? 'La course ' + referenceCourse + " est en cours. Si la livraison est impossible, déclarez-la dans l'espace livreur : l'équipe Speedfood est prévenue et reprend le client."
    : TEXTE_SANS_COURSE;
}

/** Ce que l'équipe Speedfood ne demande jamais dans un message. */
export function avertissementIdentite(): string {
  return "Ne signalez jamais une pièce d'identité, un numéro de carte ni un code client dans un message : l'équipe Speedfood ne les demande jamais.";
}
