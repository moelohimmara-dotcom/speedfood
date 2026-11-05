/**
 * Autorisation des notifications (lot E2) : logique PURE, sans import natif, testée sous Node.
 *
 * Règles (cahier des charges) : l'autorisation est demandée UNE seule fois, juste APRÈS l'envoi réussi d'une première commande réelle ; jamais à l'ouverture,
 * jamais en boucle ; un refus (ou « ne plus demander ») est respecté sans insister : l'appli continue, le suivi manuel (« Actualiser ») reste.
 */

/** Statut du système, réduit à ce que la décision utilise. */
export type StatutSysteme = 'accordee' | 'refusee' | 'non_demandee';
export interface EtatSysteme { statut: StatutSysteme; peutRedemander: boolean }
/** Ce que l'appli doit faire : demander la permission au système, seulement enregistrer l'appareil (déjà autorisée), ou ne rien faire. */
export type Decision = 'demander' | 'enregistrer' | 'rien';

/**
 * - déjà accordée : on enregistre l'appareil, sans rien demander ;
 * - sinon, jamais avant une commande réellement envoyée ;
 * - jamais deux fois (le drapeau `dejaDemandee` est conservé sur l'appareil) ;
 * - refus définitif du système (`peutRedemander` faux) : rien.
 */
export function decider(entree: { commandeEnvoyee: boolean; dejaDemandee: boolean; systeme: EtatSysteme }): Decision {
  if (entree.systeme.statut === 'accordee') return 'enregistrer';
  if (!entree.commandeEnvoyee) return 'rien';
  if (entree.dejaDemandee) return 'rien';
  if (entree.systeme.statut === 'refusee' && !entree.systeme.peutRedemander) return 'rien';
  return 'demander';
}

/** Au démarrage de l'appli : on ne demande JAMAIS ; on enregistre seulement si l'autorisation est déjà accordée. */
export function decisionAuDemarrage(systeme: EtatSysteme): Decision {
  return systeme.statut === 'accordee' ? 'enregistrer' : 'rien';
}

/** État montré au client (jeu fermé de messages courts), ou `null` quand il n'y a rien à dire. */
export type EtatAffiche = 'actives' | 'desactivees';
export function etatAffiche(systeme: EtatSysteme, dejaDemandee: boolean): EtatAffiche | null {
  if (systeme.statut === 'accordee') return 'actives';
  if (systeme.statut === 'refusee' || dejaDemandee) return 'desactivees';
  return null;
}
export const MESSAGES_ETAT: Record<EtatAffiche, string> = {
  actives: 'Vous serez prévenu quand votre commande avance.',
  desactivees: 'Notifications désactivées : ouvrez « Mon compte » puis actualisez pour suivre votre commande.',
};

export interface PortAutorisation {
  etat(): Promise<EtatSysteme>;
  demander(): Promise<EtatSysteme>;
}
export interface MemoireDemande { lire(): Promise<boolean>; marquer(): Promise<void> }

/**
 * À appeler UNE fois après un envoi réussi. Le drapeau « déjà demandée » est écrit AVANT la demande au système : si l'appli est tuée pendant la boîte de dialogue,
 * on ne redemande pas. Retourne la décision prise et l'état à afficher ; ne lève jamais.
 */
export async function apresCommandeEnvoyee(d: { port: PortAutorisation; memoire: MemoireDemande }): Promise<{ decision: Decision; affiche: EtatAffiche | null }> {
  try {
    const systeme = await d.port.etat();
    const dejaDemandee = await d.memoire.lire();
    const decision = decider({ commandeEnvoyee: true, dejaDemandee, systeme });
    if (decision !== 'demander') return { decision, affiche: etatAffiche(systeme, dejaDemandee) };
    await d.memoire.marquer();
    const apres = await d.port.demander();
    return { decision, affiche: etatAffiche(apres, true) };
  } catch {
    return { decision: 'rien', affiche: null };
  }
}

/** Réponse du système (forme d'expo-notifications) réduite à l'état utilisé ici. `canAskAgain` faux = refus définitif. */
export function etatSystemeDe(p: { granted: boolean; status?: string; canAskAgain: boolean }): EtatSysteme {
  return { statut: p.granted ? 'accordee' : p.status === 'denied' ? 'refusee' : 'non_demandee', peutRedemander: p.canAskAgain };
}
