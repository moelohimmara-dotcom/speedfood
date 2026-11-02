import type { CreationCommandePayload } from '../../../../packages/shared/src/contracts/commande.ts';
import type { PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { ErreurConnexion } from '../connexion/client.ts';
import { ErreurCommande, creerTentative, preparerEnvoi, validerSaisie, type GenerateurCle, type Tentative } from './commande-reelle.ts';
import type { PanierReel } from './panier-reel.ts';

/**
 * Machine d'états de l'écran de commande, sans React : saisie, envoi, incertain, refus, succès.
 * Elle porte tout ce qui protège contre le doublon : mémorisation du corps EXACT envoyé (rejeu à l'identique, même clé),
 * verrous de navigation, abandon d'un envoi incertain seulement après confirmation, remise à zéro à chaque changement de compte.
 */
export type Phase = 'saisie' | 'envoi' | 'incertain' | 'refuse' | 'succes';
export type ResultatEnvoi =
  | { type: 'ignore' }
  | { type: 'refus' }
  | { type: 'succes'; reference: string; panierVide: boolean }
  | { type: 'session_changee'; reference: string }
  | { type: 'echec'; incertain: boolean };
export interface DependancesEnvoi { envoyer(payload: CreationCommandePayload): Promise<{ reference: string; idempotent: boolean }>; generer?: GenerateurCle }

const MESSAGE_SESSION = 'Votre session a pris fin. Reconnectez-vous puis réessayez : votre commande n’est pas perdue.';
const MESSAGE_INCERTAIN = 'Envoi incertain. Votre commande a peut-être été enregistrée : vérifiez vos commandes ou réessayez.';
const memePanier = (p: PanierReel, c: CreationCommandePayload) => p.restaurantId === c.restaurantId && p.lignes.length === c.lignes.length && p.lignes.every((l, i) => l.platId === c.lignes[i].menuItemId && l.quantite === c.lignes[i].quantite);

export class EnvoiCommande {
  phase: Phase = 'saisie'; message: string | null = null;
  nom = ''; telephone = ''; consentement = false; abandonDemande = false;
  surChangement: () => void = () => {};
  private memo: CreationCommandePayload | null = null;
  private tentative: Tentative; private compte: string | null = null; private epoque = 0; private enCours = false;
  private deps: DependancesEnvoi;
  constructor(deps: DependancesEnvoi) { this.deps = deps; this.tentative = creerTentative(deps.generer); }

  get verrouille() { return this.phase === 'envoi' || this.phase === 'incertain'; }
  /** Fermer l'écran (bouton ou retour matériel) : interdit pendant l'envoi et tant qu'un envoi incertain n'est pas levé. */
  peutFermer() { return !this.verrouille; }
  peutEnvoyer(panier: PanierReel, plats: readonly PlatCataloguePublic[], connecte: boolean, panierPret: boolean) {
    if (!connecte || this.enCours || this.phase === 'envoi') return false;
    if (this.phase === 'incertain') return this.memo !== null;
    const { erreurs } = validerSaisie({ nom: this.nom, telephone: this.telephone, consentement: this.consentement });
    return panierPret && !erreurs.nom && !erreurs.telephone && !erreurs.consentement && panier.lignes.length > 0 && plats.length > 0;
  }
  private notifier() { this.surChangement(); }
  saisir(champ: 'nom' | 'telephone' | 'consentement', valeur: string | boolean) {
    if (this.verrouille) return;
    if (this.phase === 'succes') this.phase = 'saisie';
    if (champ === 'consentement') this.consentement = valeur === true; else this[champ] = String(valeur);
    this.notifier();
  }
  private remettreAZero() { this.epoque++; this.phase = 'saisie'; this.message = null; this.nom = ''; this.telephone = ''; this.consentement = false; this.abandonDemande = false; this.memo = null; this.enCours = false; this.tentative.oublier(); }
  private deconnexions: number | null = null;
  /**
   * À appeler avec l'identifiant du compte courant et le nombre de déconnexions volontaires.
   * Efface formulaire, clé et envoi incertain si le compte change (A→B) ou après « Me déconnecter » (volontaire).
   * Session simplement expirée (identifiant null, aucune déconnexion volontaire) : RIEN n'est effacé ; le même compte pourra rejouer le même corps avec la même clé.
   */
  lierCompte(id: string | null, deconnexions = 0) {
    if (this.deconnexions === null) this.deconnexions = deconnexions;
    if (deconnexions !== this.deconnexions) {
      this.deconnexions = deconnexions;
      const avait = this.compte !== null; this.compte = null;
      if (avait || this.phase !== 'saisie') { this.remettreAZero(); this.notifier(); }
    }
    if (id === null) {
      if (this.compte !== null && this.phase === 'incertain' && !this.enCours && this.message !== MESSAGE_SESSION) { this.message = MESSAGE_SESSION; this.notifier(); }
      return;
    }
    if (this.compte !== null && id !== this.compte) { this.compte = id; this.remettreAZero(); this.notifier(); return; }
    this.compte = id;
  }
  demanderAbandon() { if (this.phase === 'incertain' && !this.enCours) { this.abandonDemande = true; this.notifier(); } }
  annulerAbandon() { this.abandonDemande = false; this.notifier(); }
  /** Renoncer à rejouer : seulement après confirmation explicite que la commande précédente n'existe pas. La clé suivante sera nouvelle si le contenu change. */
  confirmerAbandon() {
    if (this.phase !== 'incertain' || !this.abandonDemande || this.enCours) return;
    this.memo = null; this.abandonDemande = false; this.phase = 'refuse';
    this.message = 'Vous pouvez modifier votre commande. Assurez-vous qu’elle ne figure pas dans vos commandes.'; this.notifier();
  }

  async envoyer(panier: PanierReel, plats: readonly PlatCataloguePublic[], vider: () => void, connecte: boolean, panierPret: boolean): Promise<ResultatEnvoi> {
    if (!this.peutEnvoyer(panier, plats, connecte, panierPret)) return { type: 'ignore' };
    let payload: CreationCommandePayload;
    if (this.phase === 'incertain' && this.memo) payload = this.memo; // rejeu à l'identique : même corps, même clé, quel que soit le panier courant
    else {
      try {
        const prep = preparerEnvoi(panier, plats, { nom: this.nom, telephone: this.telephone, consentement: this.consentement }, this.tentative, this.compte ?? '');
        if (!prep.ok) { this.message = prep.erreurs.panier ?? 'Vérifiez les champs du formulaire.'; this.phase = 'refuse'; this.notifier(); return { type: 'refus' }; }
        payload = prep.payload;
      } catch (e) { this.message = e instanceof Error ? e.message : 'Envoi impossible.'; this.phase = 'refuse'; this.notifier(); return { type: 'refus' }; }
    }
    const rejeu = this.memo !== null; const epoque = this.epoque;
    this.enCours = true; this.phase = 'envoi'; this.message = null; this.abandonDemande = false; this.notifier();
    try {
      const r = await this.deps.envoyer(payload);
      if (epoque !== this.epoque) return { type: 'session_changee', reference: r.reference }; // compte changé pendant l'envoi : on n'y touche plus
      this.memo = null;
      let panierVide = false;
      if (memePanier(panier, payload)) { try { vider(); panierVide = true; } catch { panierVide = false; } }
      // Panier non vidé (échec de stockage ou contenu modifié depuis) : on GARDE la clé, un renvoi à l'identique redonne la même commande (200).
      if (panierVide) this.tentative.oublier();
      this.nom = ''; this.telephone = ''; this.consentement = false; this.phase = 'succes'; this.message = panierVide ? null : 'Commande envoyée. Votre panier n’a pas pu être vidé : videz-le avant de recommander.';
      this.notifier();
      return { type: 'succes', reference: r.reference, panierVide };
    } catch (e) {
      if (epoque !== this.epoque) return { type: 'echec', incertain: false };
      let incertain: boolean;
      // Au rejeu, seuls 400 et 409 prouvent qu'aucune commande n'existe ; tout autre refus (429, 401/403, 404…) laisse l'incertitude entière.
      if (e instanceof ErreurCommande) { this.message = rejeu && e.genre === 'session' ? MESSAGE_SESSION : e.message; incertain = e.incertain || (rejeu && !e.absenceProuvee); }
      else if (e instanceof ErreurConnexion) { this.message = e.message; incertain = rejeu; } // rien n'est parti : l'incertitude précédente reste entière
      else { this.message = MESSAGE_INCERTAIN; incertain = true; }
      if (incertain) { this.memo = payload; this.phase = 'incertain'; } else { this.memo = null; this.phase = 'refuse'; }
      this.notifier();
      return { type: 'echec', incertain };
    } finally { this.enCours = false; }
  }
}
