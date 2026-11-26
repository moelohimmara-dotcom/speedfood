import { ErreurConnexion } from './client.ts';
import {
  DELAI_MIN_MINUTES, ErreurReservation, HORIZON_MAX_JOURS, NB_PERSONNES_MAX, memeDemande, peutAnnulerReservation, preparerCreation,
  type DemandeReservation, type DisponibiliteReservation, type ReservationClient, type StatutReservation,
} from './reservation.ts';

/** Ce dont les contrôles ont besoin de la session (la vraie `GestionSession`, ou une doublure de test ou de banc). */
export interface SessionReservationClient {
  readonly generationNotifications: number | null;
  disponibiliteReservation(restaurantId: string): Promise<DisponibiliteReservation>;
  creerReservation(demande: DemandeReservation): Promise<{ reservation: ReservationClient; idempotent: boolean }>;
  listerReservations(): Promise<ReservationClient[]>;
  annulerReservation(id: string): Promise<ReservationClient>;
}

export interface OptionsControleReservation {
  /** Horloge en millisecondes : injectable pour les tests ; sert seulement à écarter une demande déjà impossible (le serveur reste juge). */
  maintenant?: () => number;
}

const MINUTE = 60_000;
const JOUR = 24 * 3600 * 1000;
const MESSAGE_COMPTE_CHANGE = 'Votre compte a changé. Vérifiez à nouveau.';
const MESSAGE_SESSION_FINIE = 'Votre session a pris fin. Reconnectez-vous.';
const MESSAGE_INCERTAIN = 'Résultat inconnu : votre demande a peut-être été enregistrée. Vérifiez vos réservations avant de recommencer.';

// =====================================================================================================================
// Mes réservations : lecture manuelle, annulation confirmée
// =====================================================================================================================

export type EtatControleListe =
  | { etat: 'chargement' }
  | { etat: 'lu'; reservations: ReservationClient[]; ecritureEnCours: boolean; lectureEnCours: boolean; incertain: boolean; message: string | null }
  | { etat: 'erreur'; message: string };

const MESSAGE_ANNULEE = 'Réservation annulée. Voici vos réservations relues depuis Speedfood.';
const MESSAGE_RELECTURE_IMPOSSIBLE = 'Votre annulation a été envoyée, mais la liste n’a pas pu être relue : à vérifier. Actualisez vos réservations avant toute autre action.';
const MESSAGE_ANNULATION_INCERTAINE = 'Résultat inconnu : l’annulation a peut-être été enregistrée. Actualisez vos réservations pour vérifier avant de recommencer.';

/**
 * Contrôle de « Mes réservations » : lecture MANUELLE de la liste (jamais de minuterie), annulation avec confirmation explicite. Même discipline que l'espace livreur (G3b) : un seul envoi
 * à la fois, jamais rejoué ; un résultat incertain (réseau, délai, réponse illisible) verrouille l'annulation jusqu'à une relecture RÉUSSIE ; un refus explicite du serveur n'est pas incertain :
 * son message est affiché et la liste est relue. LEÇON DE G3b : tous les drapeaux (lecture, écriture, verrou) sont remis à leur valeur finale AVANT toute publication de l'état final, sinon l'écran
 * resterait « en cours » et ses boutons grisés à jamais. Les données d'un compte sont oubliées dès que la session change.
 */
export function creerControleListeReservations(session: SessionReservationClient, publier: (etat: EtatControleListe) => void, options: OptionsControleReservation = {}) {
  const maintenant = options.maintenant ?? Date.now;
  let revision = 0;
  let ferme = false;
  let lectureEnCours: Promise<boolean> | null = null;
  let ecritureEnCours = false;
  let incertain = false;
  let dernier: ReservationClient[] = [];
  let aDernier = false;
  let generationLue: number | null | undefined;
  let messageDiffere: string | null = null;

  const valide = (n: number, generation: number | null) => !ferme && n === revision && generation === session.generationNotifications;
  function oublier() { dernier = []; aDernier = false; incertain = false; messageDiffere = null; generationLue = undefined; }
  function publierLu(message: string | null) {
    publier({ etat: 'lu', reservations: dernier, ecritureEnCours, lectureEnCours: lectureEnCours !== null, incertain, message });
  }
  function publierChangement() {
    oublier();
    publier({ etat: 'erreur', message: session.generationNotifications === null ? MESSAGE_SESSION_FINIE : MESSAGE_COMPTE_CHANGE });
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
    // Le travail rend un « finisseur » : le drapeau de lecture est remis à null AVANT toute publication du résultat, sinon l'état publié dirait « lecture en cours ».
    const travail = (async (): Promise<() => boolean> => {
      try {
        const lu = await session.listerReservations();
        if (valide(n, generation)) { dernier = lu; aDernier = true; generationLue = generation; incertain = false; const message = messageDiffere; messageDiffere = null; return () => { publierLu(message); return true; }; }
        return () => { signalerChangement(n, generation); return false; };
      } catch (e) {
        return () => {
          if (valide(n, generation)) {
            const texte = e instanceof ErreurConnexion ? e.message : 'Lecture impossible. Réessayez dans un instant.';
            const reste = messageDiffere; messageDiffere = null;
            if (aDernier) publierLu(reste === null ? texte : reste + ' ' + texte);
            else publier({ etat: 'erreur', message: e instanceof ErreurConnexion ? e.message : 'Impossible de lire vos réservations. Réessayez dans un instant.' });
          } else signalerChangement(n, generation);
          return false;
        };
      }
    })();
    const p: Promise<boolean> = travail.then(finir => { if (lectureEnCours === p) lectureEnCours = null; return finir(); });
    lectureEnCours = p;
    if (!aDernier) publier({ etat: 'chargement' }); else publierLu(messageDiffere);
    return p;
  }
  async function actualiser(): Promise<void> { await lire(); }

  /** Aucune écriture si l'écran est fermé, si un envoi ou une lecture est en cours, si le résultat d'un envoi précédent est à vérifier, ou si rien n'a encore été lu. */
  const peutEcrire = () => !ferme && !ecritureEnCours && !incertain && lectureEnCours === null && aDernier && generationLue === session.generationNotifications;

  /** UN envoi, jamais rejoué. */
  async function ecrire(envoi: () => Promise<unknown>): Promise<void> {
    const generation = session.generationNotifications;
    ecritureEnCours = true;
    publierLu(null);
    let echec: unknown = null; let reussi = false;
    try { await envoi(); reussi = true; } catch (e) { echec = e; }
    ecritureEnCours = false;
    if (ferme) return;
    if (generation !== session.generationNotifications) { publierChangement(); return; }
    if (reussi) {
      messageDiffere = MESSAGE_ANNULEE;
      const relu = await lire();
      // La relecture est la seule vérité : si elle échoue, l'annulation a été envoyée mais l'écran est périmé → verrouillé, jamais rejouable.
      if (!relu && !ferme && generation === session.generationNotifications) { incertain = true; publierLu(MESSAGE_RELECTURE_IMPOSSIBLE); }
      return;
    }
    if (echec instanceof ErreurConnexion && echec.definitive) { publier({ etat: 'erreur', message: echec.message }); return; }
    if (echec instanceof ErreurReservation && echec.genre === 'refus') {
      // Refus explicite du serveur : rien n'a été appliqué. Message conservé jusqu'à la relecture, aucun verrouillage.
      messageDiffere = echec.message;
      await lire();
      return;
    }
    // Réponse incertaine : l'annulation a pu être appliquée. Verrou jusqu'à une relecture réussie ; jamais de second envoi automatique.
    incertain = true;
    publierLu(echec instanceof ErreurReservation ? echec.message : MESSAGE_ANNULATION_INCERTAINE);
  }

  /**
   * Annule UNE réservation de la liste lue (identifiant pris dans la dernière lecture), seulement si elle est « demandée » ou « confirmée » ET à venir, et seulement avec la confirmation
   * explicite de l'utilisateur (action non annulable). Sans confirmation, rien ne part et rien ne se verrouille.
   */
  async function annuler(id: string, confirme: boolean): Promise<void> {
    if (!peutEcrire()) return;
    if (confirme !== true) { publierLu('Confirmez l’annulation : cette action ne peut pas être annulée.'); return; }
    const reservation = dernier.find(r => r.id === id);
    if (!reservation) { publierLu('Cette réservation n’est plus dans votre liste. Actualisez vos réservations.'); return; }
    if (!peutAnnulerReservation(reservation, maintenant())) { publierLu('Cette réservation ne peut plus être annulée.'); return; }
    await ecrire(() => session.annulerReservation(reservation.id));
  }

  return { actualiser, annuler, fermer() { ferme = true; revision++; } };
}

// =====================================================================================================================
// Réserver une table : disponibilité, envoi unique, relecture de « Mes réservations » après un résultat incertain
// =====================================================================================================================

/** Ce que l'écran montre d'une demande envoyée ou retrouvée : jamais le nom, le téléphone ni la note. */
export interface ResumeDemande { id: string; reference: string; restaurantNom: string; creneau: string; nbPersonnes: number; statut: StatutReservation }

export interface EtatControleDemande {
  restaurantId: string | null;
  /** `oui` : le bouton « Réserver une table » peut s'afficher. Tout le reste le masque, sans bloquer le reste de l'écran. */
  disponibilite: 'inconnue' | 'deconnecte' | 'oui' | 'non' | 'erreur';
  nbPersonnesMax: number;
  lectureEnCours: boolean;
  envoiEnCours: boolean;
  relectureEnCours: boolean;
  /** Le résultat du dernier envoi est inconnu : verrouillé jusqu'à une relecture réussie de « Mes réservations ». */
  incertain: boolean;
  message: string | null;
  confirmee: ResumeDemande | null;
  /** Un compte est connecté (lot M5) : sans compte, le bouton s'affiche quand même mais mène à la connexion ; l'envoi reste impossible. */
  connecte: boolean;
}

const resume = (r: ReservationClient): ResumeDemande => ({ id: r.id, reference: r.reference, restaurantNom: r.restaurantNom, creneau: r.creneau, nbPersonnes: r.nbPersonnes, statut: r.statut });
const idEgaux = (a: string | null, b: string) => a !== null && a.toLowerCase() === b.toLowerCase();

/**
 * Contrôle du formulaire « Réserver une table ». La disponibilité est lue sur demande (ouverture de l'écran ou bouton), jamais par minuterie ; en cas d'échec le bouton reste masqué et le reste
 * de l'écran n'est pas touché. L'envoi est UNIQUE et n'est jamais rejoué par l'appli : une réponse incertaine verrouille l'envoi jusqu'à la relecture réussie de « Mes réservations », qui dit
 * si la demande a été enregistrée (le serveur est idempotent : la renvoyer ensuite, volontairement, ne crée pas de doublon). Même leçon que pour l'espace livreur : les drapeaux sont remis à leur
 * valeur finale AVANT chaque publication. Ni le nom, ni le téléphone, ni la note ne sont conservés ici ni publiés : ils ne sont que des arguments de l'envoi.
 */
export function creerControleDemandeReservation(session: SessionReservationClient, publier: (etat: EtatControleDemande) => void, options: OptionsControleReservation = {}) {
  const maintenant = options.maintenant ?? Date.now;
  let ferme = false;
  let revisionLecture = 0;
  let restaurantId: string | null = null;
  let disponibilite: EtatControleDemande['disponibilite'] = 'inconnue';
  let nbPersonnesMax = NB_PERSONNES_MAX;
  let lectureEnCours = false;
  let envoiEnCours = false;
  let relectureEnCours = false;
  let incertain = false;
  let message: string | null = null;
  let confirmee: ResumeDemande | null = null;
  /** De quoi reconnaître la demande envoyée dans « Mes réservations » (restaurant, créneau, personnes) : pas de coordonnées. */
  let empreinte: Pick<DemandeReservation, 'restaurantId' | 'creneau' | 'nbPersonnes'> | null = null;
  let generationDisponibilite: number | null = null;

  const etat = (): EtatControleDemande => ({ restaurantId, disponibilite, nbPersonnesMax, lectureEnCours, envoiEnCours, relectureEnCours, incertain, message, confirmee, connecte: session.generationNotifications !== null });
  const publierEtat = () => publier(etat());
  /** Compte changé ou session terminée : rien de ce qui a été lu ou envoyé ne reste. */
  function oublier() { restaurantId = null; disponibilite = 'inconnue'; nbPersonnesMax = NB_PERSONNES_MAX; incertain = false; confirmee = null; empreinte = null; generationDisponibilite = null; }
  const texteChangement = () => (session.generationNotifications === null ? MESSAGE_SESSION_FINIE : MESSAGE_COMPTE_CHANGE);

  /** Lit « ce restaurant accepte-t-il les réservations ? ». Une lecture plus récente (autre restaurant, nouvel appui) remplace celle en cours : la réponse tardive est ignorée. */
  async function lireDisponibilite(id: string): Promise<void> {
    if (ferme || envoiEnCours || relectureEnCours) return;
    const n = ++revisionLecture;
    const generation = session.generationNotifications;
    if (!idEgaux(restaurantId, id)) { disponibilite = 'inconnue'; nbPersonnesMax = NB_PERSONNES_MAX; generationDisponibilite = null; if (!incertain) { confirmee = null; message = null; } }
    restaurantId = id;
    lectureEnCours = true;
    publierEtat();
    let lu: DisponibiliteReservation | null = null; let echec: unknown = null;
    try { lu = await session.disponibiliteReservation(id); } catch (e) { echec = e; }
    if (ferme || n !== revisionLecture) return;
    // Drapeau remis à faux AVANT la publication du résultat (leçon de G3b).
    lectureEnCours = false;
    if (generation !== session.generationNotifications) { oublier(); message = texteChangement(); publierEtat(); return; }
    if (lu !== null && idEgaux(lu.restaurantId, id)) {
      disponibilite = lu.accepteReservation ? 'oui' : 'non'; nbPersonnesMax = lu.nbPersonnesMax; generationDisponibilite = generation;
      if (!incertain) message = null;
    } else {
      generationDisponibilite = null;
      if (echec instanceof ErreurConnexion && echec.definitive) { disponibilite = 'deconnecte'; message = echec.message; }
      else { disponibilite = 'erreur'; message = echec instanceof ErreurConnexion ? echec.message : 'Impossible de vérifier les réservations de table. Réessayez dans un instant.'; }
    }
    publierEtat();
  }

  const peutEnvoyer = (id: unknown) => !ferme && !envoiEnCours && !relectureEnCours && !lectureEnCours && !incertain && disponibilite === 'oui'
    && typeof id === 'string' && idEgaux(restaurantId, id) && generationDisponibilite !== null && generationDisponibilite === session.generationNotifications;

  /** UN envoi, jamais rejoué. `brute` = ce que l'utilisateur a saisi ; il est validé par le contrôle strict partagé avec le serveur avant tout réseau. */
  async function envoyer(brute: unknown): Promise<void> {
    if (!peutEnvoyer((brute as { restaurantId?: unknown } | null)?.restaurantId)) return;
    const p = preparerCreation(brute);
    if (!p.ok) { message = p.message; publierEtat(); return; }
    const d = p.corps;
    if (d.nbPersonnes > nbPersonnesMax) { message = 'Le nombre de personnes ne peut pas dépasser ' + nbPersonnesMax + '.'; publierEtat(); return; }
    const creneauMs = Date.parse(d.creneau); const maintenantMs = maintenant();
    if (creneauMs < maintenantMs + DELAI_MIN_MINUTES * MINUTE) { message = 'Ce créneau est trop proche. Choisissez un horaire à plus de ' + DELAI_MIN_MINUTES + ' minutes d’ici.'; publierEtat(); return; }
    if (creneauMs > maintenantMs + HORIZON_MAX_JOURS * JOUR) { message = 'On ne peut pas réserver plus de ' + HORIZON_MAX_JOURS + ' jours à l’avance.'; publierEtat(); return; }
    const generation = session.generationNotifications;
    envoiEnCours = true; message = null; confirmee = null;
    empreinte = { restaurantId: d.restaurantId, creneau: d.creneau, nbPersonnes: d.nbPersonnes };
    publierEtat();
    let reponse: { reservation: ReservationClient; idempotent: boolean } | null = null; let echec: unknown = null;
    try { reponse = await session.creerReservation(d); } catch (e) { echec = e; }
    // Drapeau remis à faux AVANT la publication du résultat (leçon de G3b).
    envoiEnCours = false;
    if (ferme) return;
    if (generation !== session.generationNotifications) { oublier(); message = texteChangement(); publierEtat(); return; }
    if (reponse !== null) {
      confirmee = resume(reponse.reservation); incertain = false; empreinte = null;
      message = reponse.idempotent ? 'Cette demande existait déjà : la voici. Le restaurant doit la confirmer.' : 'Demande envoyée. Le restaurant doit la confirmer. Aucun paiement.';
      publierEtat(); return;
    }
    if (echec instanceof ErreurConnexion && echec.definitive) { disponibilite = 'deconnecte'; generationDisponibilite = null; empreinte = null; message = echec.message; publierEtat(); return; }
    if (echec instanceof ErreurReservation && echec.genre === 'refus') {
      // Refus explicite du serveur : rien n'a été enregistré. Son message est affiché tel quel ; l'utilisateur peut corriger et renvoyer volontairement.
      empreinte = null; message = echec.message; publierEtat(); return;
    }
    // Réponse incertaine : la demande a pu être enregistrée. Verrou jusqu'à la relecture réussie de « Mes réservations » ; jamais de second envoi automatique.
    incertain = true;
    message = echec instanceof ErreurReservation ? echec.message : MESSAGE_INCERTAIN;
    publierEtat();
  }

  /** Relit « Mes réservations » (lecture manuelle) : seule une relecture RÉUSSIE lève le verrou « à vérifier », et elle dit si la demande a été enregistrée. */
  async function relire(): Promise<void> {
    if (ferme || envoiEnCours || relectureEnCours) return;
    const generation = session.generationNotifications;
    if (generation === null) { oublier(); message = MESSAGE_SESSION_FINIE; publierEtat(); return; }
    relectureEnCours = true;
    publierEtat();
    let liste: ReservationClient[] | null = null; let echec: unknown = null;
    try { liste = await session.listerReservations(); } catch (e) { echec = e; }
    // Drapeau remis à faux AVANT la publication du résultat (leçon de G3b).
    relectureEnCours = false;
    if (ferme) return;
    if (generation !== session.generationNotifications) { oublier(); message = texteChangement(); publierEtat(); return; }
    if (liste === null) {
      if (echec instanceof ErreurConnexion && echec.definitive) { disponibilite = 'deconnecte'; generationDisponibilite = null; message = echec.message; publierEtat(); return; }
      const raison = echec instanceof ErreurConnexion ? echec.message : 'Lecture impossible.';
      message = incertain ? raison + ' Votre demande reste à vérifier : relisez vos réservations avant de la renvoyer.' : raison;
      publierEtat(); return;
    }
    incertain = false;
    if (empreinte !== null) {
      const cherchee = empreinte; empreinte = null;
      const trouvee = liste.find(r => (r.statut === 'demandee' || r.statut === 'confirmee') && memeDemande(r, cherchee));
      if (trouvee) { confirmee = resume(trouvee); message = trouvee.statut === 'confirmee' ? 'Votre réservation est déjà confirmée par le restaurant.' : 'Votre demande est bien enregistrée. Le restaurant doit la confirmer.'; }
      else { confirmee = null; message = 'Aucune demande trouvée pour ce créneau. Vous pouvez la renvoyer.'; }
    } else message = 'Vos réservations ont été relues.';
    publierEtat();
  }

  /** Efface le résultat affiché (pour une autre demande) ; ne touche jamais le verrou « à vérifier ». */
  function nouvelleDemande() {
    if (ferme || envoiEnCours || relectureEnCours) return;
    confirmee = null; if (!incertain) message = null;
    publierEtat();
  }

  return { lireDisponibilite, envoyer, relire, nouvelleDemande, fermer() { ferme = true; revisionLecture++; } };
}
