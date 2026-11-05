/**
 * Lecture des commandes demandée alors que la session n'est pas encore restaurée (appli fermée, puis appui sur une notification : « Mon compte » s'ouvre avant la fin de la restauration).
 * La demande est gardée, puis jouée UNE seule fois quand la session devient disponible : aucune boucle, aucune lecture répétée. Une fermeture de l'écran l'annule.
 */
export function creerLectureDifferee(lire: () => void) {
  let enAttente = false;
  return {
    /** À l'ouverture de l'écran : `demande` vrai si l'écran est ouvert pour lire les commandes. Lit tout de suite si la session est prête, sinon attend. */
    ouverture(sessionPrete: boolean, demande: boolean) { if (!demande) { enAttente = false; return; } if (sessionPrete) { enAttente = false; lire(); } else enAttente = true; },
    sessionDisponible(ouvert: boolean) { if (enAttente && ouvert) { enAttente = false; lire(); } },
    fermeture() { enAttente = false; },
  };
}
