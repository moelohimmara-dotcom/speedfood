import { ErreurConnexion } from './client.ts';
import type { FicheLivreur } from './livreur.ts';

export interface SessionFicheLivreur {
  readonly generationNotifications: number | null;
  ficheLivreur(): Promise<FicheLivreur | null>;
}
export type EtatLectureFicheLivreur = { etat: 'chargement' } | { etat: 'lu'; fiche: FicheLivreur | null } | { etat: 'erreur'; message: string };
/** Lecture manuelle, dernière réponse valable seulement tant que l'écran et sa session sont les mêmes. */
export function creerLectureFicheLivreur(session: SessionFicheLivreur, publier: (etat: EtatLectureFicheLivreur) => void) {
  let revision = 0; let ferme = false; let enCours: Promise<void> | null = null;
  function actualiser(): Promise<void> {
    if (ferme) return Promise.resolve();
    if (enCours) return enCours;
    const n = ++revision; const generation = session.generationNotifications;
    publier({ etat: 'chargement' });
    const valide = () => !ferme && n === revision && generation === session.generationNotifications;
    const signalerChangement = () => {
      if (!ferme && n === revision && generation !== session.generationNotifications) publier({ etat: 'erreur', message: session.generationNotifications === null ? 'Votre session a pris fin. Retournez au compte pour vous connecter.' : 'Votre compte a changé. Actualisez votre fiche.' });
    };
    const p = (async () => {
      try { const fiche = await session.ficheLivreur(); if (valide()) publier({ etat: 'lu', fiche }); else signalerChangement(); }
      catch (e) {
        if (valide()) publier({ etat: 'erreur', message: e instanceof ErreurConnexion ? e.message : 'Impossible de lire votre fiche. Réessayez dans un instant.' });
        else signalerChangement();
      }
    })().finally(() => { if (enCours === p) enCours = null; });
    enCours = p;
    return p;
  }
  return { actualiser, fermer() { ferme = true; revision++; } };
}
