import { ErreurConnexion } from './client.ts';
import { ErreurLivreur, type EtatLivreur } from './livreur.ts';

export interface SessionEtatLivreur {
  readonly generationNotifications: number | null;
  etatLivreur(): Promise<EtatLivreur | null>;
  basculerEnLigneLivreur(enLigne: boolean): Promise<void>;
}

export type EtatControleLivreur =
  | { etat: 'chargement' }
  | { etat: 'lu'; etatLivreur: EtatLivreur | null; basculeEnCours: boolean; incertain: boolean; message: string | null }
  | { etat: 'erreur'; message: string };

/**
 * Contrôle de l'écran livreur G2 : lecture manuelle de l'état, dernière réponse valable seulement tant que l'écran et sa
 * session sont les mêmes. La bascule est une écriture unique, jamais rejouée : un résultat incertain (réseau, délai,
 * réponse illisible) verrouille le bouton jusqu'à une relecture réussie, qui affiche la vérité du serveur. Un refus
 * explicite du serveur (message reçu) ne verrouille pas : il est affiché et l'état est relu.
 */
export function creerControleEtatLivreur(session: SessionEtatLivreur, publier: (etat: EtatControleLivreur) => void) {
  let revision = 0;
  let ferme = false;
  let lectureEnCours: Promise<void> | null = null;
  let basculeEnCours = false;
  let incertain = false;
  let dernier: EtatLivreur | null = null;
  let aDernier = false;
  let messageDiffere: string | null = null;

  const valide = (n: number, generation: number | null) => !ferme && n === revision && generation === session.generationNotifications;
  function publierLu(message: string | null) {
    publier({ etat: 'lu', etatLivreur: dernier, basculeEnCours, incertain, message });
  }
  function signalerChangement(n: number, generation: number | null) {
    if (!ferme && n === revision && generation !== session.generationNotifications) {
      publier({ etat: 'erreur', message: session.generationNotifications === null ? 'Votre session a pris fin. Retournez au compte pour vous connecter.' : 'Votre compte a changé. Actualisez votre état.' });
    }
  }

  function actualiser(): Promise<void> {
    if (ferme) return Promise.resolve();
    if (lectureEnCours) return lectureEnCours;
    const n = ++revision;
    const generation = session.generationNotifications;
    if (!aDernier) publier({ etat: 'chargement' });
    const p = (async () => {
      try {
        const lu = await session.etatLivreur();
        if (valide(n, generation)) { dernier = lu; aDernier = true; incertain = false; const message = messageDiffere; messageDiffere = null; publierLu(message); }
        else signalerChangement(n, generation);
      } catch (e) {
        if (valide(n, generation)) {
          if (aDernier) publierLu(e instanceof ErreurConnexion ? e.message : 'Lecture impossible. Réessayez dans un instant.');
          else publier({ etat: 'erreur', message: e instanceof ErreurConnexion ? e.message : 'Impossible de lire votre état. Réessayez dans un instant.' });
        } else signalerChangement(n, generation);
      }
    })().finally(() => { if (lectureEnCours === p) lectureEnCours = null; });
    lectureEnCours = p;
    return p;
  }

  async function basculer(enLigne: boolean): Promise<void> {
    if (ferme || basculeEnCours || incertain || !aDernier) return;
    const n = ++revision;
    const generation = session.generationNotifications;
    basculeEnCours = true;
    publierLu(null);
    try {
      await session.basculerEnLigneLivreur(enLigne);
      basculeEnCours = false;
      if (valide(n, generation)) await actualiser();
      else signalerChangement(n, generation);
    } catch (e) {
      basculeEnCours = false;
      if (!valide(n, generation)) { signalerChangement(n, generation); return; }
      if (e instanceof ErreurConnexion && e.definitive) {
        publier({ etat: 'erreur', message: e.message });
      } else if (e instanceof ErreurLivreur && e.genre === 'refus') {
        // Refus explicite du serveur : rien n'a été appliqué. Vérité relue, message du refus conservé, aucun verrouillage.
        messageDiffere = e.message;
        await actualiser();
      } else {
        // Réponse incertaine (ErreurLivreur incertain, réseau, délai, réponse illisible) : l'écriture a pu être
        // appliquée. Bouton verrouillé jusqu'à une relecture réussie ; jamais de second envoi automatique.
        incertain = true;
        publierLu(e instanceof Error ? e.message : 'Résultat inconnu : votre disponibilité a peut-être changé. Actualisez pour vérifier votre état.');
      }
    }
  }

  return { actualiser, basculer, fermer() { ferme = true; revision++; } };
}
