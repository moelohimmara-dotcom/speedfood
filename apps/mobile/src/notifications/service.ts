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
  /** Identité monotone de la session réelle ; null si fermée. Un refresh ne la change pas. */
  lireGeneration?(): number | null;
  ouvrirSuivi(): void;
  ouvrirRestaurateur(): void;
  /** Rôle restaurateur (choix C à l'ouverture de session). Ne lève jamais : `false` en cas de panne. */
  lireEstRestaurateur(): Promise<boolean>;
}

/**
 * Coordination des notifications de l'appli. Chaque méthode ne lève jamais : une notification qui échoue ne gêne ni la commande, ni la connexion, ni la déconnexion.
 */
export function creerServiceNotifications(d: DepsService) {
  type Cycle = { identite: number | null; actif: boolean; controle: AbortController; postes: Set<string>; postEnCours: boolean; retrait?: (acces: string | null) => Promise<void> };
  let courant: Cycle | null = null;
  let file: Promise<unknown> = Promise.resolve();
  // Seuls les appels appareil sont ordonnés ; aucune attente de mot de passe ou de session dans cette file.
  function ordonner(f: () => Promise<unknown>): Promise<void> {
    const p = file.catch(() => undefined).then(f);
    file = p;
    return p.then(() => undefined, () => undefined);
  }
  function valide(c: Cycle): boolean {
    return c === courant && c.actif && (!d.lireGeneration || d.lireGeneration() === c.identite);
  }
  function cycle(): Cycle | null {
    const identite = d.lireGeneration?.() ?? null;
    if (d.lireGeneration && identite === null) return null;
    // Un ancien signal d'ouverture ne peut pas rouvrir la génération déjà fermée.
    if (d.lireGeneration && courant && !courant.actif && courant.identite === identite) return null;
    if (!courant || !courant.actif || courant.identite !== identite) {
      if (courant) { courant.actif = false; courant.controle.abort(); }
      courant = { identite, actif: true, controle: new AbortController(), postes: new Set(), postEnCours: false };
    }
    return courant;
  }
  async function enregistrer(c: Cycle, jetonConnu?: string): Promise<void> {
    if (!valide(c)) return;
    try {
      const acces = await d.obtenirAcces();
      if (!acces || !valide(c)) return;
      await ordonner(async () => {
        if (!valide(c)) return;
        try {
          await d.appareil.enregistrer(acces, jetonConnu, {
            signal: c.controle.signal,
            peutPartir: () => valide(c),
            reserver: j => { if (c.postes.has(j)) return false; c.postes.add(j); return true; },
            surDepart: () => { c.postEnCours = true; },
          });
        } finally { c.postEnCours = false; }
      });
    } catch { /* Une notification ne bloque jamais la connexion. */ }
  }
  // Le dialogue est commun à l'installation, mais chaque continuation appartient à son cycle.
  type ResultatPermission = Awaited<ReturnType<typeof apresCommandeEnvoyee>>;
  let permission: Promise<ResultatPermission> | null = null;
  const participants = new Set<Cycle>();
  async function autoriser(c: Cycle, f: (peutDemander: () => boolean) => Promise<ResultatPermission>): Promise<EtatAffiche | null> {
    if (!valide(c)) return null;
    participants.add(c);
    const p = permission ??= f(() => [...participants].some(valide)).finally(() => { if (permission === p) { permission = null; participants.clear(); } });
    const r = await p;
    if (!valide(c)) return null;
    if (r.decision === 'enregistrer' || (r.decision === 'demander' && r.affiche === 'actives')) await enregistrer(c);
    return valide(c) ? r.affiche : null;
  }
  function contexte(c: Cycle, estRestaurateur: boolean): Promise<EtatAffiche | null> {
    if (!estRestaurateur) return Promise.resolve(null);
    return autoriser(c, peutDemander => apresContexteRestaurateur({ port: d.natif, memoire: d.memoire, estRestaurateur, peutDemander }));
  }
  /** Ferme immédiatement les départs, réserve le retrait dans la file et démarre son budget de 6 s, avant toute lecture d'accès. */
  function preparerDeconnexion(): (acces: string | null) => Promise<void> {
    const c = courant ??= { identite: d.lireGeneration?.() ?? null, actif: false, controle: new AbortController(), postes: new Set(), postEnCours: false };
    if (c.retrait) return c.retrait;
    c.actif = false;
    if (!c.postEnCours) c.controle.abort(); // une lecture native annulée ne doit pas retenir le retrait
    const controle = new AbortController();
    let fournir!: (acces: string | null) => void;
    let fourni = false;
    const accesPret = new Promise<string | null>(r => { fournir = r; });
    const minuterie = setTimeout(() => {
      controle.abort(); c.controle.abort();
      if (!fourni) { fourni = true; fournir(null); }
    }, 6000);
    const fin = ordonner(async () => {
      const acces = await accesPret;
      if (!acces || controle.signal.aborted) return;
      try { await d.appareil.retirer(acces, { signal: controle.signal, peutPartir: () => !controle.signal.aborted }); } catch { /* un seul essai */ }
    }).finally(() => { clearTimeout(minuterie); });
    c.retrait = acces => {
      if (acces === null) { controle.abort(); c.controle.abort(); }
      if (!fourni) { fourni = true; fournir(acces); }
      return fin;
    };
    return c.retrait;
  }
  return {
    demarrer(): () => void {
      void d.natif.creerCanal().catch(() => undefined);
      const arretOuverture = demarrerOuverture({ port: d.natif, ouvrirSuivi: d.ouvrirSuivi, ouvrirRestaurateur: d.ouvrirRestaurateur });
      const arretJeton = d.natif.surRenouvellementJeton(jeton => {
        const c = courant ?? cycle();
        // Le même jeton émis par sa lecture est ignoré ; un vrai renouvellement en vol reste dans la file.
        if (c && valide(c) && !d.appareil.dejaConnu(jeton)) void enregistrer(c, jeton);
      });
      return () => { arretOuverture(); arretJeton(); };
    },
    async sessionOuverte(): Promise<EtatAffiche | null> {
      const c = cycle(); if (!c) return null;
      try { if (decisionAuDemarrage(await d.natif.etat()) === 'enregistrer' && valide(c)) await enregistrer(c); } catch { /* silencieux */ }
      if (!valide(c)) return null;
      try { const estResto = await d.lireEstRestaurateur(); return valide(c) ? await contexte(c, estResto) : null; } catch { return null; }
    },
    async apresCommande(): Promise<EtatAffiche | null> {
      const c = courant ?? cycle();
      return c && valide(c) ? autoriser(c, peutDemander => apresCommandeEnvoyee({ port: d.natif, memoire: d.memoire, peutDemander })) : null;
    },
    async apresContexteRestaurateur(estRestaurateur = true): Promise<EtatAffiche | null> {
      const c = courant ?? cycle();
      return c && valide(c) ? contexte(c, estRestaurateur) : null;
    },
    preparerDeconnexion,
    async avantDeconnexion(acces: string): Promise<void> { await preparerDeconnexion()(acces); },
  };
}
export type ServiceNotifications = ReturnType<typeof creerServiceNotifications>;
