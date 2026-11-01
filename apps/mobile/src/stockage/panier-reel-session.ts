import { decoder, encoder, type PanierReel } from '../catalogue/panier-reel.ts';
import type { DepotTexte } from './session.ts';
export class SessionPanierReel {
  private charge = false;
  private suite: Promise<void> = Promise.resolve();
  private depot: DepotTexte;
  constructor(depot: DepotTexte) { this.depot = depot; }
  async charger() { const p = decoder(await this.depot.lire()); this.charge = true; return p; }
  sauver(p: PanierReel) {
    if (!this.charge) return Promise.reject(Error('STOCKAGE_NON_CHARGE'));
    const texte = encoder(p);
    const prochaine = this.suite.catch(() => undefined).then(() => this.depot.ecrire(texte));
    this.suite = prochaine; return prochaine;
  }
}
