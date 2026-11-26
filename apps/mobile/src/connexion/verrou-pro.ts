/**
 * Verrou OPTIONNEL des espaces professionnels (parité Kotlin, lot 1, ligne A7) : empreinte, visage ou code du téléphone, pour protéger un espace restaurateur ou livreur laissé sur un téléphone partagé.
 * Désactivé par défaut. Actif, l'espace professionnel demande le déverrouillage à l'ouverture de l'application et après `DELAI_VERROU_MS` passé en arrière-plan.
 * Règle de sûreté : un verrou qui ne peut pas s'exécuter (plus de verrouillage d'écran sur le téléphone, réglage illisible) ne bloque JAMAIS un restaurateur devant une commande à traiter.
 * Logique pure : le stockage et le système d'authentification sont injectés (voir `verrou-natif.ts`).
 */
export const DELAI_VERROU_MS = 2 * 60 * 1000;
export interface StockageVerrou { lire(): Promise<string | null>; ecrire(valeur: string): Promise<void>; effacer(): Promise<void> }
export interface VerrouAppareil { utilisable(): Promise<boolean>; authentifier(titre: string): Promise<boolean> }

export class VerrouEspacesPro {
  private _actif = false; private _deverrouille = false; private _disponible = false; private quitteLe = 0;
  private enCours: Promise<boolean> | null = null;
  private abonnes = new Set<() => void>();
  private stockage: StockageVerrou; private appareil: VerrouAppareil; private maintenantMs: () => number;
  constructor(stockage: StockageVerrou, appareil: VerrouAppareil, maintenantMs: () => number = () => Date.now()) { this.stockage = stockage; this.appareil = appareil; this.maintenantMs = maintenantMs; }
  /** Réglage choisi par la personne (mémorisé). */
  get actif(): boolean { return this._actif; }
  /** Le téléphone a un verrouillage d'écran (sans lui, rien ne peut être demandé : l'espace n'est alors jamais bloqué). */
  get disponible(): boolean { return this._disponible; }
  /** Faux : on affiche l'écran de verrouillage. */
  peutAfficher(): boolean { return !this._actif || this._deverrouille || !this._disponible; }
  abonner(f: () => void): () => void { this.abonnes.add(f); return () => { this.abonnes.delete(f); }; }
  private prevenir() { for (const f of [...this.abonnes]) { try { f(); } catch { /* un abonné défaillant ne casse pas le verrou */ } } }
  private async lireDisponible(): Promise<boolean> { try { return await this.appareil.utilisable(); } catch { return false; } }
  /** Lit le réglage mémorisé et la disponibilité du verrouillage d'écran. Une lecture impossible laisse le verrou INACTIF (jamais bloquant). */
  async charger(): Promise<void> {
    try { this._actif = (await this.stockage.lire()) === '1'; } catch { this._actif = false; }
    this._disponible = await this.lireDisponible();
    this._deverrouille = false;
    this.prevenir();
  }
  private async verifier(titre: string): Promise<boolean> { try { return (await this.appareil.authentifier(titre)) === true; } catch { return false; } }
  /** Active ou désactive. L'activation demande d'abord une vérification (on ne s'enferme pas dehors par erreur) ; elle échoue si rien ne peut être mémorisé. Vrai = le réglage demandé est en vigueur. */
  async regler(actif: boolean): Promise<boolean> {
    if (!actif) {
      try { await this.stockage.effacer(); } catch { return false; }
      this._actif = false; this.prevenir(); return true;
    }
    this._disponible = await this.lireDisponible();
    if (!this._disponible) { this.prevenir(); return false; }
    if (!(await this.verifier('Activer le verrouillage de mes espaces professionnels'))) return false;
    try { await this.stockage.ecrire('1'); } catch { return false; }
    this._actif = true; this._deverrouille = true; this.prevenir(); return true;
  }
  /** Demande la vérification au système. Deux demandes simultanées partagent UNE seule vérification. */
  deverrouiller(): Promise<boolean> {
    if (this.enCours) return this.enCours;
    const p = this.verifier('Déverrouiller votre espace professionnel').then(ok => { if (ok) this._deverrouille = true; this.prevenir(); return ok; }).finally(() => { if (this.enCours === p) this.enCours = null; });
    this.enCours = p; return p;
  }
  /** L'application passe en arrière-plan. */
  quitte(): void { this.quitteLe = this.maintenantMs(); }
  /** L'application revient au premier plan : au-delà du délai (strictement), un nouveau déverrouillage est demandé. */
  reprise(): void {
    if (this.quitteLe !== 0 && this.maintenantMs() - this.quitteLe > DELAI_VERROU_MS) { this._deverrouille = false; this.prevenir(); }
    this.quitteLe = 0;
  }
}
