/**
 * Espace équipe (parité Kotlin, lots 5 à 8) : fondation commune. Les droits sont décidés par le SERVEUR à chaque route
 * (permission nommée par module) : l'application ne tranche jamais un droit, elle affiche le refus du serveur tel qu'elle le reçoit.
 * Aucune écriture d'équipe ne se rejoue toute seule ; les montants restent des GNF entiers.
 */
export class ErreurEquipe extends Error {
  readonly genre: 'refus' | 'incertain';
  constructor(genre: 'refus' | 'incertain', message: string) { super(message); this.name = 'ErreurEquipe'; this.genre = genre; }
}
