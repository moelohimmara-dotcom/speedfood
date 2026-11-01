import { decoderEtat, encoderEtat, type EtatLocal } from './codec.ts';
export interface DepotTexte { lire(): Promise<string | null>; ecrire(texte: string): Promise<void> }
/** File de sauvegardes LOCALES, sans commandes ni relance automatique d'une écriture échouée. */
export class SessionLocale {
  private chargee = false;
  private suite: Promise<void> = Promise.resolve();
  private depot: DepotTexte;
  constructor(depot: DepotTexte) { this.depot = depot; }
  async charger(): Promise<EtatLocal> {
    const etat = decoderEtat(await this.depot.lire());
    this.chargee = true;
    return etat;
  }
  sauver(etat: EtatLocal): Promise<void> {
    if (!this.chargee) return Promise.reject(new Error('STOCKAGE_NON_CHARGE'));
    const texte = encoderEtat(etat);
    const ecriture = this.suite.catch(() => undefined).then(() => this.depot.ecrire(texte));
    this.suite = ecriture;
    return ecriture;
  }
}
