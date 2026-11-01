import { ErreurConnexion, type ApiAuth, type SessionAuth } from './client.ts';
export interface CoffreSession { lire(): Promise<string | null>; ecrire(v: string): Promise<void>; effacer(): Promise<void> }
export class GestionSession {
  private api: ApiAuth; private coffre: CoffreSession;
  private session: SessionAuth | null = null;
  private generation = 0; private file: Promise<unknown> = Promise.resolve();
  private renouvellement: Promise<void> | null = null;
  constructor(api: ApiAuth, coffre: CoffreSession) { this.api = api; this.coffre = coffre; }
  get connectee() { return this.session !== null; }
  private ordonner(f: () => Promise<void>) { const p = this.file.catch(() => undefined).then(f); this.file = p; return p; }
  private async appliquer(s: SessionAuth, n: number) {
    if (n !== this.generation) throw new ErreurConnexion('Connexion annulée.');
    try { await this.ordonner(async () => { if (n === this.generation) await this.coffre.ecrire(s.refreshToken); }); }
    catch { throw new ErreurConnexion('Impossible de protéger la session sur cet appareil.'); }
    if (n !== this.generation) throw new ErreurConnexion('Connexion annulée.');
    this.session = s;
  }
  async connecter(email: string, motDePasse: string) {
    const n = ++this.generation; this.session = null;
    try { await this.ordonner(() => this.coffre.effacer()); } catch { throw new ErreurConnexion('Impossible de fermer la session précédente sur cet appareil.'); }
    if (n !== this.generation) throw new ErreurConnexion('Connexion annulée.');
    await this.appliquer(await this.api.connecter(email,motDePasse),n);
  }
  async restaurer() {
    const n = ++this.generation; this.session = null;
    let refresh: string | null;
    try { refresh = await this.coffre.lire(); } catch { throw new ErreurConnexion('Impossible de lire la session protégée.'); }
    if (!refresh || n !== this.generation) return;
    try { await this.appliquer(await this.api.renouveler(refresh),n); }
    catch(e) { if (e instanceof ErreurConnexion && e.definitive && n === this.generation) await this.ordonner(() => this.coffre.effacer()); throw e; }
  }
  private async jeton() {
    if (!this.session) throw new ErreurConnexion('Connectez-vous pour ouvrir votre espace.',true);
    if (this.session.expiresAt <= Date.now()/1000+30) {
      if (!this.renouvellement) {
        const n = this.generation; const refresh = this.session.refreshToken; const id = this.session.userId;
        this.renouvellement = this.api.renouveler(refresh).then(s => { if (s.userId !== id) throw new ErreurConnexion('Votre session a changé. Reconnectez-vous.',true); return this.appliquer(s,n); }).catch(async e => {
          if (e instanceof ErreurConnexion && e.definitive && n === this.generation) { this.session = null; await this.ordonner(() => this.coffre.effacer()); }
          throw e;
        }).finally(() => { this.renouvellement = null; });
      }
      await this.renouvellement;
    }
    if (!this.session) throw new ErreurConnexion('Votre session a pris fin.',true);
    return this.session.accessToken;
  }
  async espace() {
    const n = this.generation;
    try { const r = await this.api.espace(await this.jeton()); if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.'); return r; }
    catch(e) { if (e instanceof ErreurConnexion && e.definitive && n === this.generation) { this.session = null; await this.ordonner(() => this.coffre.effacer()); } throw e; }
  }
  async deconnecter() {
    const acces = this.session?.accessToken; ++this.generation; this.session = null;
    const local = this.ordonner(() => this.coffre.effacer());
    const distant = acces ? this.api.deconnecter(acces).then(() => true, () => false) : Promise.resolve(true);
    try { await local; } catch { await distant; throw new ErreurConnexion('Effacement local non confirmé. Réessayez de vous déconnecter.'); }
    return { distanteConfirmee: await distant };
  }
}
