import type { CommandeRestaurateur, ListeRestaurateur } from './restaurateur.ts';

/**
 * Surveillance des commandes du restaurateur (parité Kotlin, lot 2, lignes C11 et C12) : la logique de l'ancienne appli, portée telle quelle
 * et testée sans téléphone. Chaque tour relit la liste du restaurant (lecture déjà faite par l'écran ou, plus tard, par le service natif) et
 * dit s'il faut alerter : une NOUVELLE commande à traiter déclenche une alerte ; tant qu'il en reste, un rappel revient toutes les minutes ;
 * au démarrage, les commandes déjà présentes ne sonnent pas (le restaurateur vient d'ouvrir l'écran), sauf si l'une attend depuis plus
 * d'une minute (surveillance relancée après une coupure). Un restaurant fermé qui n'attend plus rien arrête la surveillance ; une panne
 * réseau la garde en attente. Cette logique ne sonne pas elle-même : l'écran (C11) et le futur service de premier plan (C12) la consomment.
 */
export const RAPPEL_MS = 60_000;
/** Délai entre deux tours du service de premier plan (C12), comme l'ancien service. */
export const DELAI_TOUR_MS = 10_000;

export type TourSurveillance =
  | { genre: 'arret' }
  | { genre: 'attente' }
  | { genre: 'suite'; aTraiter: CommandeRestaurateur[]; nouvelles: number; rappel: boolean; alerter: boolean };

const ARRET: TourSurveillance = { genre: 'arret' };
const ATTENTE: TourSurveillance = { genre: 'attente' };

export class SurveillanceCommandes {
  private connues: Set<string> | null = null;
  private dernierSon = 0;

  /** Un tour réussi, à partir d'une liste déjà lue et vérifiée : la session et l'accès ont été établis par l'appelant. */
  tourListe(liste: ListeRestaurateur, maintenant: number): TourSurveillance {
    const aTraiter = liste.commandes.filter(c => c.statut === 'en_attente');
    const r = liste.restaurant;
    if (r !== null && !r.ouvert && !r.accepteCommandes && aTraiter.length === 0) return ARRET;
    const ids = new Set(aTraiter.map(c => c.id));
    const avant = this.connues;
    this.connues = ids;
    if (avant === null) {
      const tropAncienne = aTraiter.some(c => {
        const t = Date.parse(c.creeLe);
        return Number.isFinite(t) && maintenant - t >= RAPPEL_MS;
      });
      this.dernierSon = tropAncienne ? 0 : maintenant;
      return tropAncienne ? this.sonner(aTraiter, 0, maintenant) : { genre: 'suite', aTraiter, nouvelles: 0, rappel: false, alerter: false };
    }
    const nouvelles = [...ids].filter(id => !avant.has(id)).length;
    if (nouvelles > 0) return this.sonner(aTraiter, nouvelles, maintenant);
    if (ids.size > 0 && maintenant - this.dernierSon >= RAPPEL_MS) return this.sonner(aTraiter, 0, maintenant);
    return { genre: 'suite', aTraiter, nouvelles: 0, rappel: false, alerter: false };
  }

  /** Un tour sans liste : panne (on garde la surveillance) ou fin (accès refusé, plus de session : on arrête). Ne consomme pas le premier tour. */
  tourPanne(genre: 'panne' | 'acces_refuse' | 'session_absente'): TourSurveillance {
    return genre === 'panne' ? ATTENTE : ARRET;
  }

  private sonner(aTraiter: CommandeRestaurateur[], nouvelles: number, maintenant: number): TourSurveillance {
    this.dernierSon = maintenant;
    return { genre: 'suite', aTraiter, nouvelles, rappel: nouvelles === 0, alerter: true };
  }
}
