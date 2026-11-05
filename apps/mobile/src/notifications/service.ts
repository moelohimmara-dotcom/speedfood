import { apresCommandeEnvoyee, apresContexteRestaurateur, decisionAuDemarrage, type EtatAffiche, type MemoireDemande, type PortAutorisation } from './autorisation.ts';
import type { Appareil } from './enregistrement.ts';
import { demarrerOuverture, type PortOuverture } from './ouverture.ts';

/** Tout ce que le service demande au natif (expo-notifications) : injectable, donc testable sans téléphone. */
export interface PortNatif extends PortAutorisation, PortOuverture {
  /** Canaux Android (`suivi_commande`, `alerte_commande`, `offre_course`), créés avant toute réception (et avant la demande d'autorisation d'Android 13+). */
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
  ouvrirRestaurateur(): void;
  /** Rôle restaurateur (choix C à l'ouverture de session). Ne lève jamais : `false` en cas de panne. */
  lireEstRestaurateur(): Promise<boolean>;
}

/**
 * Coordination des notifications de l'appli. Chaque méthode ne lève jamais : une notification qui échoue ne gêne ni la commande, ni la connexion, ni la déconnexion.
 */
export function creerServiceNotifications(d: DepsService) {
  // Levé par la déconnexion, baissé seulement par la prochaine ouverture de session : tant qu'il est levé, plus rien n'enregistre l'appareil (le retrait ne doit pas être annulé par un envoi concurrent).
  let retraitEnCours = false;
  async function enregistrerSiConnecte(jetonConnu?: string) {
    if (retraitEnCours) return;
    try { const acces = await d.obtenirAcces(); if (acces && !retraitEnCours) await d.appareil.enregistrer(acces, jetonConnu); } catch { /* silencieux */ }
  }
  async function apresContexte(estRestaurateur: boolean): Promise<EtatAffiche | null> {
    const r = await apresContexteRestaurateur({ port: d.natif, memoire: d.memoire, estRestaurateur });
    if (r.decision === 'enregistrer' || (r.decision === 'demander' && r.affiche === 'actives')) await enregistrerSiConnecte();
    return r.affiche;
  }
  return {
    /** Au démarrage de l'appli : canal, ouverture sur appui, réenregistrement à chaque renouvellement du jeton. Ne demande JAMAIS l'autorisation. Retourne le désabonnement. */
    demarrer(): () => void {
      void d.natif.creerCanal().catch(() => undefined);
      const arretOuverture = demarrerOuverture({ port: d.natif, ouvrirSuivi: d.ouvrirSuivi, ouvrirRestaurateur: d.ouvrirRestaurateur });
      const arretJeton = d.natif.surRenouvellementJeton(jeton => { if (!retraitEnCours && !d.appareil.dejaConnu(jeton)) void enregistrerSiConnecte(jeton); });
      return () => { arretOuverture(); arretJeton(); };
    },
    /**
     * À chaque ouverture de l'appli avec une session : réenregistre si déjà accordée (aucune demande),
     * puis déclencheur C si le compte est membre restaurant (une seule demande système grâce au drapeau).
     */
    async sessionOuverte(): Promise<EtatAffiche | null> {
      retraitEnCours = false;
      try {
        if (decisionAuDemarrage(await d.natif.etat()) === 'enregistrer') await enregistrerSiConnecte();
      } catch { /* silencieux */ }
      try {
        const estResto = await d.lireEstRestaurateur();
        return await apresContexte(estResto);
      } catch {
        return null;
      }
    },
    /** Juste APRÈS l'envoi réussi d'une commande réelle : demande l'autorisation une seule fois, puis enregistre l'appareil si elle est accordée. Retourne l'état à montrer. */
    async apresCommande(): Promise<EtatAffiche | null> {
      const r = await apresCommandeEnvoyee({ port: d.natif, memoire: d.memoire });
      if (r.decision === 'enregistrer' || (r.decision === 'demander' && r.affiche === 'actives')) await enregistrerSiConnecte();
      return r.affiche;
    },
    /** Choix C : à l'ouverture de l'Espace restaurateur (ou quand le rôle est connu hors sessionOuverte). */
    async apresContexteRestaurateur(estRestaurateur = true): Promise<EtatAffiche | null> {
      return apresContexte(estRestaurateur);
    },
    /** À la déconnexion, AVANT l'effacement de la session (le jeton porteur est encore valide). Un seul essai, échec silencieux. */
    async avantDeconnexion(acces: string): Promise<void> {
      retraitEnCours = true;
      try { await d.appareil.retirer(acces); } catch { /* silencieux */ }
    },
  };
}
export type ServiceNotifications = ReturnType<typeof creerServiceNotifications>;
