import { ErreurConnexion } from './client.ts';
import {
  ErreurReservation, actionExigeMotif, lireJourReservation, preparerDecision, preparerReglage,
  type ActionReservationRestaurant, type DecisionReservation, type ReglageReservation, type ReservationRestaurant, type ValeursReglageReservation,
} from './reservation.ts';

/** Ce dont le contrôle a besoin de la session (la vraie `GestionSession`, ou une doublure de test ou de banc). */
export interface SessionReservationRestaurateur {
  readonly generationNotifications: number | null;
  reservationsRestaurateur(jour: string | null): Promise<{ jour: string; reservations: ReservationRestaurant[] }>;
  deciderReservation(id: string, decision: DecisionReservation): Promise<ReservationRestaurant>;
  reglageReservation(): Promise<ReglageReservation>;
  ecrireReglageReservation(valeurs: ValeursReglageReservation): Promise<ReglageReservation>;
}

export type EtatControleRestaurateur =
  | { etat: 'chargement' }
  | { etat: 'lu'; jour: string; reservations: ReservationRestaurant[]; reglage: ReglageReservation; ecritureEnCours: boolean; lectureEnCours: boolean; incertain: boolean; message: string | null }
  | { etat: 'erreur'; message: string };

const MESSAGE_COMPTE_CHANGE = 'Votre compte a changé. Vérifiez à nouveau.';
const MESSAGE_SESSION_FINIE = 'Votre session a pris fin. Reconnectez-vous.';
const MESSAGE_LECTURE = 'Lecture impossible. Réessayez dans un instant.';
const MESSAGE_ILLISIBLE = 'La réponse reçue ne correspond pas au jour demandé. Réessayez.';
const MESSAGE_INCERTAIN_DECISION = 'Résultat inconnu : votre réponse a peut-être été enregistrée. Actualisez la liste pour vérifier avant de recommencer.';
const MESSAGE_INCERTAIN_REGLAGE = 'Résultat inconnu : votre réglage a peut-être été enregistré. Actualisez pour vérifier avant de recommencer.';
const MESSAGE_RELECTURE_IMPOSSIBLE = 'Votre envoi est parti, mais la liste n’a pas pu être relue : à vérifier. Actualisez avant toute autre action.';
const MESSAGE_VERROU = 'Un résultat est à vérifier : actualisez d’abord la liste.';

const CONFIRMATION: Record<ActionReservationRestaurant, string> = {
  confirmer: 'Réservation confirmée.', refuser: 'Réservation refusée.', annuler: 'Réservation annulée.', honoree: 'Réservation marquée comme honorée.', non_honoree: 'Réservation marquée comme non honorée.',
};

/**
 * Contrôle de la section « Réservations » du restaurateur. Lecture MANUELLE (jamais de minuterie). Les actions proposées sont EXACTEMENT celles que le serveur a renvoyées (`actionsPossibles`),
 * jamais déduites ici. Refuser et annuler exigent un motif (3 à 200 caractères) et une confirmation explicite. Un seul envoi à la fois, jamais rejoué ; un résultat incertain verrouille
 * toute écriture jusqu'à une relecture RÉUSSIE. Après toute écriture, la liste et le réglage sont relus. LEÇON DE G3b : tous les drapeaux sont remis à leur valeur finale AVANT toute publication
 * de l'état final. Les coordonnées des clients ne sont jamais copiées dans un message ni conservées après un changement de compte.
 */
export function creerControleReservationRestaurateur(session: SessionReservationRestaurateur, publier: (etat: EtatControleRestaurateur) => void) {
  let revision = 0;
  let ferme = false;
  let lectureEnCours: Promise<boolean> | null = null;
  let ecritureEnCours = false;
  let incertain = false;
  let dernier: { jour: string; reservations: ReservationRestaurant[]; reglage: ReglageReservation } | null = null;
  let generationLue: number | null | undefined;
  let jourDemande: string | null = null;
  let messageDiffere: string | null = null;

  const valide = (n: number, generation: number | null) => !ferme && n === revision && generation === session.generationNotifications;
  function oublier() { dernier = null; incertain = false; messageDiffere = null; generationLue = undefined; jourDemande = null; }
  function publierLu(message: string | null) {
    if (dernier === null) return;
    publier({ etat: 'lu', jour: dernier.jour, reservations: dernier.reservations, reglage: dernier.reglage, ecritureEnCours, lectureEnCours: lectureEnCours !== null, incertain, message });
  }
  function publierChangement() {
    oublier();
    publier({ etat: 'erreur', message: session.generationNotifications === null ? MESSAGE_SESSION_FINIE : MESSAGE_COMPTE_CHANGE });
  }
  function signalerChangement(n: number, generation: number | null) {
    if (!ferme && n === revision && generation !== session.generationNotifications) publierChangement();
  }

  /** Lit la liste du jour ET le réglage. `jour` = jour voulu (null : aujourd'hui, choisi par le serveur). Le jour choisi n'est retenu qu'après une lecture réussie. */
  function lire(jour: string | null): Promise<boolean> {
    if (ferme || ecritureEnCours) return Promise.resolve(false);
    if (lectureEnCours) return lectureEnCours;
    const n = ++revision;
    const generation = session.generationNotifications;
    if (dernier !== null && generationLue !== generation) oublier();
    const travail = (async (): Promise<() => boolean> => {
      try {
        const [liste, reglage] = await Promise.all([session.reservationsRestaurateur(jour), session.reglageReservation()]);
        if (!valide(n, generation)) return () => { signalerChangement(n, generation); return false; };
        const jourRecu = lireJourReservation(liste.jour);
        if (jourRecu === null || (jour !== null && jourRecu !== jour)) {
          return () => { if (valide(n, generation)) { if (dernier) publierLu(MESSAGE_ILLISIBLE); else publier({ etat: 'erreur', message: MESSAGE_ILLISIBLE }); } else signalerChangement(n, generation); return false; };
        }
        dernier = { jour: jourRecu, reservations: liste.reservations, reglage }; generationLue = generation; jourDemande = jour; incertain = false;
        const message = messageDiffere; messageDiffere = null;
        return () => { publierLu(message); return true; };
      } catch (e) {
        return () => {
          if (valide(n, generation)) {
            const texte = e instanceof ErreurConnexion ? e.message : MESSAGE_LECTURE;
            const reste = messageDiffere; messageDiffere = null;
            if (dernier) publierLu(reste === null ? texte : reste + ' ' + texte);
            else publier({ etat: 'erreur', message: texte });
          } else signalerChangement(n, generation);
          return false;
        };
      }
    })();
    // Le drapeau de lecture est remis à null AVANT la publication du résultat.
    const p: Promise<boolean> = travail.then(finir => { if (lectureEnCours === p) lectureEnCours = null; return finir(); });
    lectureEnCours = p;
    if (dernier === null) publier({ etat: 'chargement' }); else publierLu(messageDiffere);
    return p;
  }
  async function actualiser(): Promise<void> { await lire(jourDemande); }

  /** Changer de jour : jour réel exigé ; refusé tant qu'un résultat est à vérifier (on relit d'abord le jour affiché). */
  async function choisirJour(jour: unknown): Promise<void> {
    if (ferme || ecritureEnCours || lectureEnCours) return;
    if (dernier === null) return;
    if (incertain) { publierLu(MESSAGE_VERROU); return; }
    const valable = lireJourReservation(jour);
    if (valable === null) { publierLu('Jour invalide. Choisissez un jour dans le calendrier.'); return; }
    await lire(valable);
  }

  const peutEcrire = () => !ferme && !ecritureEnCours && !incertain && lectureEnCours === null && dernier !== null && generationLue === session.generationNotifications;

  /** UN envoi, jamais rejoué. */
  async function ecrire(envoi: () => Promise<unknown>, succes: string, messageIncertain: string): Promise<void> {
    const generation = session.generationNotifications;
    ecritureEnCours = true;
    publierLu(null);
    let echec: unknown = null; let reussi = false;
    try { await envoi(); reussi = true; } catch (e) { echec = e; }
    ecritureEnCours = false;
    if (ferme) return;
    if (generation !== session.generationNotifications) { publierChangement(); return; }
    if (reussi) {
      messageDiffere = succes;
      const relu = await lire(jourDemande);
      // La relecture est la seule vérité : si elle échoue, l'envoi est parti mais l'écran est périmé : verrouillé, jamais rejouable.
      if (!relu && !ferme && generation === session.generationNotifications) { incertain = true; publierLu(MESSAGE_RELECTURE_IMPOSSIBLE); }
      return;
    }
    if (echec instanceof ErreurConnexion && echec.definitive) { publier({ etat: 'erreur', message: echec.message }); return; }
    if (echec instanceof ErreurReservation && echec.genre === 'refus') {
      messageDiffere = echec.message;
      await lire(jourDemande);
      return;
    }
    incertain = true;
    publierLu(echec instanceof ErreurReservation ? echec.message : messageIncertain);
  }

  /**
   * Décide d'une réservation de la liste lue. L'action doit figurer dans `actionsPossibles` de CETTE réservation (donnée du serveur) ; refuser et annuler exigent un motif et la confirmation
   * explicite. Sinon rien ne part et rien ne se verrouille.
   */
  async function decider(id: string, action: ActionReservationRestaurant, options: { motif?: string | null; confirme?: boolean } = {}): Promise<void> {
    if (!peutEcrire() || dernier === null) return;
    const reservation = dernier.reservations.find(r => r.id === id);
    if (!reservation) { publierLu('Cette réservation n’est plus dans la liste. Actualisez.'); return; }
    if (!reservation.actionsPossibles.includes(action)) { publierLu('Cette action n’est pas disponible pour cette réservation.'); return; }
    const exigeMotif = actionExigeMotif(action);
    const p = preparerDecision(exigeMotif ? { action, motif: options.motif } : { action });
    if (!p.ok) { publierLu(p.message); return; }
    if (exigeMotif && options.confirme !== true) { publierLu('Confirmez cette action : elle ne peut pas être annulée.'); return; }
    const decision: DecisionReservation = { action: p.corps.action, motif: p.corps.motif ?? null };
    await ecrire(() => session.deciderReservation(reservation.id, decision), CONFIRMATION[action], MESSAGE_INCERTAIN_DECISION);
  }

  /** Écrit le réglage (interrupteur et/ou capacité par créneau, vide = sans plafond) puis relit tout. Valeur validée par le contrôle partagé avant tout réseau. */
  async function ecrireReglage(valeurs: unknown): Promise<void> {
    if (!peutEcrire()) return;
    const p = preparerReglage(valeurs);
    if (!p.ok) { publierLu(p.message); return; }
    const corps = p.corps;
    await ecrire(() => session.ecrireReglageReservation(corps), 'Réglage enregistré.', MESSAGE_INCERTAIN_REGLAGE);
  }

  return { actualiser, choisirJour, decider, ecrireReglage, fermer() { ferme = true; revision++; } };
}
