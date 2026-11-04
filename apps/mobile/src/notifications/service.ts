import { apresCommandeEnvoyee, decisionAuDemarrage, type EtatAffiche, type MemoireDemande, type PortAutorisation } from './autorisation.ts';
import type { Appareil } from './enregistrement.ts';
import { demarrerOuverture, type PortOuverture } from './ouverture.ts';

/** Tout ce que le service demande au natif (expo-notifications) : injectable, donc testable sans téléphone. */
export interface PortNatif extends PortAutorisation, PortOuverture {
  /** Canal Android `suivi_commande`, créé avant toute réception (et avant la demande d'autorisation d'Android 13+). */
  creerCanal(): Promise<void>;
  /** Appelé à chaque renouvellement du jeton d'appareil ; retourne le désabonnement. */
  surRenouvellementJeton(rappel: (jeton: string) => void): () => void;
}

export interface DepsService {
  natif: PortNatif;
  appareil: Appareil;
  memoire: MemoireDemande;
  /** Jeton porteur de la session ouverte, ou `null` (déconnecté, session perdue). Ne lève jamais. */
  obtenirAcces(): Promise<string | null>;
  ouvrirSuivi(): void;
}

/**
 * Coordination des notifications de l'appli. Chaque méthode ne lève jamais : une notification qui échoue ne gêne ni la commande, ni la connexion, ni la déconnexion.
 */
export function creerServiceNotifications(d: DepsService) {
  async function enregistrerSiConnecte(jetonConnu?: string) {
    try { const acces = await d.obtenirAcces(); if (acces) await d.appareil.enregistrer(acces, jetonConnu); } catch { /* silencieux */ }
  }
  return {
    /** Au démarrage de l'appli : canal, ouverture sur appui, réenregistrement à chaque renouvellement du jeton. Ne demande JAMAIS l'autorisation. Retourne le désabonnement. */
    demarrer(): () => void {
      void d.natif.creerCanal().catch(() => undefined);
      const arretOuverture = demarrerOuverture({ port: d.natif, ouvrirSuivi: d.ouvrirSuivi });
      const arretJeton = d.natif.surRenouvellementJeton(jeton => { void enregistrerSiConnecte(jeton); });
      return () => { arretOuverture(); arretJeton(); };
    },
    /** À chaque ouverture de l'appli avec une session : réenregistre l'appareil, SEULEMENT si l'autorisation est déjà accordée (aucune demande). */
    async sessionOuverte(): Promise<void> {
      try {
        if (decisionAuDemarrage(await d.natif.etat()) === 'enregistrer') await enregistrerSiConnecte();
      } catch { /* silencieux */ }
    },
    /** Juste APRÈS l'envoi réussi d'une commande réelle : demande l'autorisation une seule fois, puis enregistre l'appareil si elle est accordée. Retourne l'état à montrer. */
    async apresCommande(): Promise<EtatAffiche | null> {
      const r = await apresCommandeEnvoyee({ port: d.natif, memoire: d.memoire });
      if (r.decision === 'enregistrer' || (r.decision === 'demander' && r.affiche === 'actives')) await enregistrerSiConnecte();
      return r.affiche;
    },
    /** À la déconnexion, AVANT l'effacement de la session (le jeton porteur est encore valide). Un seul essai, échec silencieux. */
    async avantDeconnexion(acces: string): Promise<void> {
      try { await d.appareil.retirer(acces); } catch { /* silencieux */ }
    },
  };
}
export type ServiceNotifications = ReturnType<typeof creerServiceNotifications>;
