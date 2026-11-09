import { ErreurConnexion } from './client.ts';
import {
  ErreurLivreur, MESSAGE_CODE_REMISE_LIVREUR, MESSAGE_RAISON_ECHEC_LIVREUR, lireCodeRemiseLivreur, lireRaisonEchecLivreur,
  type DemandeCourseLivreur, type EtapeCourseLivreur, type EtatLivreur,
} from './livreur.ts';

export interface SessionEtatLivreur {
  readonly generationNotifications: number | null;
  etatLivreur(): Promise<EtatLivreur | null>;
  basculerEnLigneLivreur(enLigne: boolean): Promise<void>;
  repondreOffreLivreur(offreId: string, reponse: 'acceptee' | 'refusee'): Promise<void>;
  avancerCourseLivreur(demande: DemandeCourseLivreur): Promise<void>;
}

export type EtatControleLivreur =
  | { etat: 'chargement' }
  | { etat: 'lu'; etatLivreur: EtatLivreur | null; ecritureEnCours: boolean; lectureEnCours: boolean; incertain: boolean; message: string | null }
  | { etat: 'erreur'; message: string };

/** Saisie transmise par l'écran pour une étape : le code et la raison ne sont lus que pour « livree » et « echec », et ne sont jamais conservés ici. */
export interface SaisieCourse { code?: string; raison?: string; confirme?: boolean }

const MESSAGE_ENVOYE = 'Envoi effectué. Voici votre état relu depuis Speedfood.';
const MESSAGE_RELECTURE_IMPOSSIBLE = 'Votre action a été envoyée, mais l’état n’a pas pu être relu : à vérifier. Actualisez votre état avant toute autre action.';
const MESSAGE_INCERTAIN = 'Résultat inconnu : votre action a peut-être été enregistrée. Actualisez votre état pour vérifier avant de recommencer.';

/**
 * Contrôle de l'écran livreur (G2 et G3) : lecture manuelle de l'état, dernière réponse valable seulement tant que l'écran et sa
 * session sont les mêmes. Toute écriture (bascule, réponse à l'offre, étape de la course) suit la même discipline : un seul envoi à la fois,
 * jamais rejoué ; un résultat incertain (réseau, délai, réponse illisible) verrouille TOUTES les actions jusqu'à une relecture réussie, qui
 * affiche la vérité du serveur ; un refus explicite (message reçu) n'est pas incertain : il est affiché et l'état est relu. Après un succès
 * l'état est relu avant d'être publié ; si cette relecture échoue, l'écran reste verrouillé (jamais une course périmée rejouable).
 * Le code de remise et la raison de l'échec ne sont que des arguments de l'envoi : ni conservés, ni publiés, ni repris dans un message.
 * Les données d'un compte (course, téléphone du client) sont oubliées dès que la session change.
 */
export function creerControleEtatLivreur(session: SessionEtatLivreur, publier: (etat: EtatControleLivreur) => void) {
  let revision = 0;
  let ferme = false;
  let lectureEnCours: Promise<boolean> | null = null;
  let ecritureEnCours = false;
  let incertain = false;
  let dernier: EtatLivreur | null = null;
  let aDernier = false;
  let generationLue: number | null | undefined;
  let messageDiffere: string | null = null;

  const valide = (n: number, generation: number | null) => !ferme && n === revision && generation === session.generationNotifications;
  /** Compte changé ou session terminée : rien de ce qui a été lu ne reste (course, client), ni verrou ni message. */
  function oublier() { dernier = null; aDernier = false; incertain = false; messageDiffere = null; generationLue = undefined; }
  function publierLu(message: string | null) {
    publier({ etat: 'lu', etatLivreur: dernier, ecritureEnCours, lectureEnCours: lectureEnCours !== null, incertain, message });
  }
  function publierChangement() {
    oublier();
    publier({ etat: 'erreur', message: session.generationNotifications === null ? 'Votre session a pris fin. Retournez au compte pour vous connecter.' : 'Votre compte a changé. Actualisez votre état.' });
  }
  function signalerChangement(n: number, generation: number | null) {
    if (!ferme && n === revision && generation !== session.generationNotifications) publierChangement();
  }

  function lire(): Promise<boolean> {
    if (ferme || ecritureEnCours) return Promise.resolve(false);
    if (lectureEnCours) return lectureEnCours;
    const n = ++revision;
    const generation = session.generationNotifications;
    if (aDernier && generationLue !== generation) oublier();
    const p = (async () => {
      try {
        const lu = await session.etatLivreur();
        if (valide(n, generation)) { dernier = lu; aDernier = true; generationLue = generation; incertain = false; const message = messageDiffere; messageDiffere = null; publierLu(message); return true; }
        signalerChangement(n, generation);
        return false;
      } catch (e) {
        if (valide(n, generation)) {
          const texte = e instanceof ErreurConnexion ? e.message : 'Lecture impossible. Réessayez dans un instant.';
          const reste = messageDiffere; messageDiffere = null;
          if (aDernier) publierLu(reste === null ? texte : reste + ' ' + texte);
          else publier({ etat: 'erreur', message: e instanceof ErreurConnexion ? e.message : 'Impossible de lire votre état. Réessayez dans un instant.' });
        } else signalerChangement(n, generation);
        return false;
      }
    })().finally(() => { if (lectureEnCours === p) lectureEnCours = null; });
    lectureEnCours = p;
    if (!aDernier) publier({ etat: 'chargement' }); else publierLu(messageDiffere);
    return p;
  }
  async function actualiser(): Promise<void> { await lire(); }

  /** Aucune écriture si l'écran est fermé, si un envoi ou une lecture est en cours, si le résultat d'un envoi précédent est à vérifier, ou si rien n'a encore été lu. */
  const peutEcrire = () => !ferme && !ecritureEnCours && !incertain && lectureEnCours === null && aDernier && generationLue === session.generationNotifications;
  /** Texte d'erreur sans le secret saisi (code de remise) : un message qui le reprendrait est remplacé. */
  const sansSecret = (message: string, secret: string | null, remplacement: string) => (secret !== null && message.includes(secret) ? remplacement : message);

  /** UN envoi, jamais rejoué. `secret` = valeur saisie à ne jamais afficher. */
  async function ecrire(envoi: () => Promise<void>, secret: string | null): Promise<void> {
    const generation = session.generationNotifications;
    ecritureEnCours = true;
    publierLu(null);
    let echec: unknown = null; let reussi = false;
    try { await envoi(); reussi = true; } catch (e) { echec = e; }
    ecritureEnCours = false;
    if (ferme) return;
    if (generation !== session.generationNotifications) { publierChangement(); return; }
    if (reussi) {
      messageDiffere = MESSAGE_ENVOYE;
      const relu = await lire();
      // La relecture est la seule vérité : si elle échoue, l'action a été envoyée mais l'écran est périmé → verrouillé, jamais rejouable.
      if (!relu && !ferme && generation === session.generationNotifications) { incertain = true; publierLu(MESSAGE_RELECTURE_IMPOSSIBLE); }
      return;
    }
    if (echec instanceof ErreurConnexion && echec.definitive) { publier({ etat: 'erreur', message: echec.message }); return; }
    if (echec instanceof ErreurLivreur && echec.genre === 'refus') {
      // Refus explicite du serveur : rien n'a été appliqué. Message conservé jusqu'à la relecture, aucun verrouillage.
      messageDiffere = sansSecret(echec.message, secret, 'Code de remise incorrect.');
      await lire();
      return;
    }
    // Réponse incertaine : l'action a pu être appliquée. Verrou jusqu'à une relecture réussie ; jamais de second envoi automatique.
    incertain = true;
    publierLu(echec instanceof ErreurLivreur ? sansSecret(echec.message, secret, MESSAGE_INCERTAIN) : MESSAGE_INCERTAIN);
  }

  async function basculer(enLigne: boolean): Promise<void> {
    if (!peutEcrire()) return;
    await ecrire(() => session.basculerEnLigneLivreur(enLigne), null);
  }

  /** Répond à l'offre AFFICHÉE (identifiant pris dans la dernière lecture, jamais fourni par l'écran). */
  async function repondreOffre(reponse: 'acceptee' | 'refusee'): Promise<void> {
    if (!peutEcrire()) return;
    const offre = dernier?.offre;
    if (!offre) return;
    await ecrire(() => session.repondreOffreLivreur(offre.offreId, reponse), null);
  }

  /**
   * Fait avancer la course AFFICHÉE (identifiant pris dans la dernière lecture) vers une étape que le serveur autorise (`etapesPossibles`). « livree » exige un code de
   * 4 chiffres valide (sinon rien ne part) ; « echec » exige une raison non vide ET une confirmation explicite (action non annulable). Code et raison ne sont envoyés
   * qu'avec leur étape.
   */
  async function avancerCourse(vers: EtapeCourseLivreur, saisie: SaisieCourse = {}): Promise<void> {
    if (!peutEcrire()) return;
    const course = dernier?.course;
    if (!course) return;
    if (!course.etapesPossibles.includes(vers)) { publierLu('Cette étape n’est pas disponible pour votre course. Actualisez votre état.'); return; }
    const demande: DemandeCourseLivreur = { livraisonId: course.livraisonId, vers };
    let secret: string | null = null;
    if (vers === 'livree') {
      const code = lireCodeRemiseLivreur(saisie.code);
      if (code === null) { publierLu(MESSAGE_CODE_REMISE_LIVREUR); return; }
      demande.code = code; secret = code;
    } else if (vers === 'echec') {
      if (saisie.confirme !== true) { publierLu('Confirmez l’échec de la livraison : cette action ne peut pas être annulée.'); return; }
      const raison = lireRaisonEchecLivreur(saisie.raison);
      if (raison === null) { publierLu(MESSAGE_RAISON_ECHEC_LIVREUR); return; }
      demande.raison = raison;
    }
    await ecrire(() => session.avancerCourseLivreur(demande), secret);
  }

  return { actualiser, basculer, repondreOffre, avancerCourse, fermer() { ferme = true; revision++; } };
}
