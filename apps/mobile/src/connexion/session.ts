import { ErreurConnexion, type ApiAuth, type SessionAuth } from './client.ts';
import type {CommandeCompte} from './commandes.ts';
import type {ActionAdresse, ChampsProfil, EspaceComplet} from './espace-client.ts';
import {ErreurCommande, type ResultatEstimation} from '../catalogue/commande-reelle.ts';
import type {ActionLivraisonApp} from '../../../../packages/shared/src/contracts/restaurant-livraison.ts';
import type {ActionRestaurateur, ListeRestaurateur, RolesCompte, TypeDocument, ValeursPropositionRestaurateur} from './restaurateur.ts';
import type {ActionService, MenuRestaurateur, ReglagesRestaurateur} from './serviceRestaurateur.ts';
import type {CreationCommandePayload} from '../../../../packages/shared/src/contracts/commande.ts';
import type { DemandeCourseLivreur, EtatLivreur, FicheLivreur } from './livreur.ts';
import type { PageHistorique } from './historique-restaurateur.ts';
import type { ActiviteRestaurateur } from './activite-restaurateur.ts';
import type { GainsLivreur, PageCoursesLivreur } from './gains-livreur.ts';
export interface CoffreSession { lire(): Promise<string | null>; ecrire(v: string): Promise<void>; effacer(): Promise<void> }
/** `creerCommande` et `estimerLivraison` sont facultatifs ici : les doublures de test de la connexion n'en ont pas besoin. */
export type ApiSession = Omit<ApiAuth,'ficheLivreur'|'etatLivreur'|'gainsLivreur'|'historiqueLivreur'|'basculerEnLigneLivreur'|'repondreOffreLivreur'|'avancerCourseLivreur'|'creerCommande'|'estimerLivraison'|'declarerPaiement'|'repondreProposition'|'supprimerCompte'|'inscrire'|'demanderReinitialisation'|'espaceComplet'|'basculerFavori'|'enregistrerProfil'|'actionAdresse'|'moi'|'commandesRestaurant'|'historiqueRestaurant'|'activiteRestaurant'|'emettreDocumentRestaurateur'|'actionRestaurateur'|'proposerRestaurateur'|'actionLivraisonRestaurateur'|'reglagesRestaurateur'|'menuRestaurateur'|'ecrireService'> & Partial<Pick<ApiAuth,'ficheLivreur'|'etatLivreur'|'gainsLivreur'|'historiqueLivreur'|'basculerEnLigneLivreur'|'repondreOffreLivreur'|'avancerCourseLivreur'|'creerCommande'|'estimerLivraison'|'declarerPaiement'|'repondreProposition'|'supprimerCompte'|'inscrire'|'demanderReinitialisation'|'espaceComplet'|'basculerFavori'|'enregistrerProfil'|'actionAdresse'|'moi'|'commandesRestaurant'|'historiqueRestaurant'|'activiteRestaurant'|'emettreDocumentRestaurateur'|'actionRestaurateur'|'proposerRestaurateur'|'actionLivraisonRestaurateur'|'reglagesRestaurateur'|'menuRestaurateur'|'ecrireService'>>;
export class GestionSession {
  private api: ApiSession; private coffre: CoffreSession;
  private session: SessionAuth | null = null;
  private generation = 0; private file: Promise<unknown> = Promise.resolve();
  private renouvellement: Promise<void> | null = null;
  private clesSuivi = new Map<string,{jeton:string;reference:string}>();
  /** Notifications (lot E2) : retrait de l'appareil à la déconnexion, appelé AVANT l'effacement de la session (jeton porteur encore valide). Un seul essai ; échec ou lenteur : la déconnexion continue. */
  avantDeconnexion?: (acces: string) => Promise<void>;
  /** Ferme les départs notifications de façon synchrone, avant tout await de la déconnexion. */
  preparerDeconnexion?: () => (acces: string | null) => Promise<void>;
  private deconnexionEnCours: Promise<{ distanteConfirmee: boolean }> | null = null;
  /** Appelé (sans attendre) quand une session vient d'être ouverte ou restaurée : l'appli réenregistre alors l'appareil pour les notifications. Ne bloque ni ne fait échouer la connexion. */
  apresOuverture?: () => void;
  constructor(api: ApiSession, coffre: CoffreSession) { this.api = api; this.coffre = coffre; }
  /** Jeton porteur de la session ouverte (renouvelé si besoin), ou `null` : jamais d'exception. Sert aux appels de l'appareil, qui ne doivent rien afficher. */
  async acces(): Promise<string | null> { try { return this.session ? await this.jeton() : null; } catch { return null; } }
  private signaler() { try { this.apresOuverture?.(); } catch { /* sans effet sur la session */ } }
  get connectee() { return this.session !== null; }
  /** Identité locale monotone : stable au renouvellement du porteur, différente à chaque ouverture. */
  get generationNotifications(): number | null { return this.session ? this.generation : null; }
  /** Nombre de déconnexions VOLONTAIRES : distingue « Me déconnecter » d'une session expirée (la machine d'envoi n'efface rien à l'expiration). */
  get deconnexions() { return this.nbDeconnexions; }
  private nbDeconnexions = 0;
  /** Identifiant du compte connecté (null si déconnecté) : sert à isoler formulaire et clé d'idempotence par compte. */
  get identifiant(): string | null { return this.session?.userId ?? null; }
  private ordonner(f: () => Promise<void>) { const p = this.file.catch(() => undefined).then(f); this.file = p; return p; }
  private async appliquer(s: SessionAuth, n: number) {
    if (n !== this.generation) throw new ErreurConnexion('Connexion annulée.');
    try { await this.ordonner(async () => { if (n === this.generation) await this.coffre.ecrire(s.refreshToken); }); }
    catch { throw new ErreurConnexion('Impossible de protéger la session sur cet appareil.'); }
    if (n !== this.generation) throw new ErreurConnexion('Connexion annulée.');
    this.session = s;
  }
  async connecter(email: string, motDePasse: string) {
    this.clesSuivi.clear();
    const n = ++this.generation; this.session = null;
    try { await this.ordonner(() => this.coffre.effacer()); } catch { throw new ErreurConnexion('Impossible de fermer la session précédente sur cet appareil.'); }
    if (n !== this.generation) throw new ErreurConnexion('Connexion annulée.');
    await this.appliquer(await this.api.connecter(email,motDePasse),n);
    this.signaler();
  }
  /**
   * Inscription (A2). Sans session rendue (e-mail de confirmation envoyé), rien n'est ouvert ni écrit. Avec une session rendue, elle est ouverte et protégée exactement comme une connexion.
   * Le mot de passe n'est conservé nulle part.
   */
  async inscrire(nom: string, telephone: string, email: string, motDePasse: string): Promise<{ sessionOuverte: boolean }> {
    if (!this.api.inscrire) throw new ErreurConnexion('Inscription indisponible.');
    const s = await this.api.inscrire(nom, telephone, email, motDePasse);
    if (s === null) return { sessionOuverte: false };
    this.clesSuivi.clear();
    const n = ++this.generation; this.session = null;
    try { await this.ordonner(() => this.coffre.effacer()); } catch { throw new ErreurConnexion('Impossible de fermer la session précédente sur cet appareil.'); }
    if (n !== this.generation) throw new ErreurConnexion('Connexion annulée.');
    await this.appliquer(s, n);
    this.signaler();
    return { sessionOuverte: true };
  }
  /** Mot de passe oublié (A3) : sans effet sur la session. */
  async demanderReinitialisation(email: string): Promise<void> {
    if (!this.api.demanderReinitialisation) throw new ErreurConnexion('Réinitialisation indisponible.');
    await this.api.demanderReinitialisation(email);
  }
  async restaurer() {
    this.clesSuivi.clear();
    const n = ++this.generation; this.session = null;
    let refresh: string | null;
    try { refresh = await this.coffre.lire(); } catch { throw new ErreurConnexion('Impossible de lire la session protégée.'); }
    if (!refresh || n !== this.generation) return;
    try { await this.appliquer(await this.api.renouveler(refresh),n); this.signaler(); }
    catch(e) { if (e instanceof ErreurConnexion && e.definitive && n === this.generation) await this.ordonner(() => this.coffre.effacer()); throw e; }
  }
  private async jeton() {
    if (!this.session) throw new ErreurConnexion('Connectez-vous pour ouvrir votre espace.',true);
    if (this.session.expiresAt <= Date.now()/1000+30) {
      if (!this.renouvellement) {
        const n = this.generation; const refresh = this.session.refreshToken; const id = this.session.userId;
        this.renouvellement = this.api.renouveler(refresh).then(s => { if (s.userId !== id) throw new ErreurConnexion('Votre session a changé. Reconnectez-vous.',true); return this.appliquer(s,n); }).catch(async e => {
          if (e instanceof ErreurConnexion && e.definitive && n === this.generation) { this.session = null; this.clesSuivi.clear(); await this.ordonner(() => this.coffre.effacer()); }
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
    catch(e) { if (e instanceof ErreurConnexion && e.definitive && n === this.generation) { this.session = null; this.clesSuivi.clear(); await this.ordonner(() => this.coffre.effacer()); } throw e; }
  }
  async commandes():Promise<CommandeCompte[]> {
    const n=this.generation;
    try {
      const lignes=await this.api.commandes(await this.jeton());
      if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
      this.clesSuivi.clear();
      return lignes.map(({jeton,...commande})=>{if(jeton)this.clesSuivi.set(commande.id,{jeton,reference:commande.reference});return commande;});
    }catch(e){if(e instanceof ErreurConnexion&&e.definitive&&n===this.generation){this.session=null;this.clesSuivi.clear();await this.ordonner(()=>this.coffre.effacer());}throw e;}
  }
  async suivi(id:string) {
    const n=this.generation;
    await this.jeton();
    if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
    const cle=this.clesSuivi.get(id);if(!cle)throw new ErreurConnexion('Actualisez vos commandes pour ouvrir ce suivi.');
    const r=await this.api.suivi(cle.jeton);
    if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
    if(r.reference!==cle.reference)throw new ErreurConnexion('Le suivi reçu ne correspond pas à cette commande.');
    return r;
  }
  async annuler(id:string) {
    const n=this.generation;
    await this.jeton();
    if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
    const cle=this.clesSuivi.get(id);if(!cle)throw new ErreurConnexion('Actualisez vos commandes pour annuler cette commande.');
    const r=await this.api.annuler(cle.jeton);
    if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
    if(r.reference!==cle.reference)throw new ErreurConnexion('La réponse reçue ne correspond pas à cette commande.');
    return r.reference;
  }
  /** Répond à la proposition révisée de CETTE commande (un seul essai). Le jeton de suivi reste ici ; seule une session ouverte peut répondre. */
  async repondreProposition(id:string,propositionId:string,accepter:boolean):Promise<void> {
    const n=this.generation;
    await this.jeton();
    if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
    const cle=this.clesSuivi.get(id);if(!cle)throw new ErreurConnexion('Actualisez vos commandes pour répondre à cette proposition.');
    if(!this.api.repondreProposition)throw new ErreurConnexion('Réponse à la proposition indisponible.');
    await this.api.repondreProposition(cle.jeton,propositionId,accepter);
    if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
  }
  /** Appel de l'espace client avec le porteur de la session ouverte : une réponse arrivée après une déconnexion est refusée ; un 401 termine la session. Aucune relance. */
  private async espaceClient<T>(appel: (acces: string) => Promise<T>, annule: string): Promise<T> {
    const n = this.generation;
    const acces = await this.jeton();
    if (n !== this.generation) throw new ErreurConnexion(annule);
    try { const r = await appel(acces); if (n !== this.generation) throw new ErreurConnexion(annule); return r; }
    catch (e) { await this.sessionTerminee(e, n); throw e; }
  }
  /** Profil, adresses et favoris complets (B9 à B11). */
  espaceComplet(): Promise<EspaceComplet> {
    return this.espaceClient(a => this.api.espaceComplet ? this.api.espaceComplet(a) : Promise.reject(new ErreurConnexion('Espace client indisponible.')), 'Lecture annulée.');
  }
  basculerFavori(restaurantId: string): Promise<{ message: string; favori: boolean }> {
    return this.espaceClient(a => this.api.basculerFavori ? this.api.basculerFavori(a, restaurantId) : Promise.reject(new ErreurConnexion('Favoris indisponibles.')), 'Envoi annulé.');
  }
  enregistrerProfil(champs: ChampsProfil): Promise<{ message: string }> {
    return this.espaceClient(a => this.api.enregistrerProfil ? this.api.enregistrerProfil(a, champs) : Promise.reject(new ErreurConnexion('Profil indisponible.')), 'Envoi annulé.');
  }
  actionAdresse(action: ActionAdresse): Promise<{ message: string }> {
    return this.espaceClient(a => this.api.actionAdresse ? this.api.actionAdresse(a, action) : Promise.reject(new ErreurConnexion('Adresses indisponibles.')), 'Envoi annulé.');
  }
  /**
   * Supprime le compte connecté (un seul essai). Succès : plus rien du compte ne reste sur l'appareil (session, coffre, clés de suivi) et les départs de notification sont fermés SANS jeton
   * (le compte n'existe plus : aucun appel de révocation distante). Refus, incertitude : la session reste intacte. 401 : session terminée. Le panier n'est pas touché.
   */
  async supprimerCompte(confirmation:string):Promise<void> {
    const n=this.generation;
    const acces=await this.jeton();
    if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
    if(!this.api.supprimerCompte)throw new ErreurConnexion('Suppression du compte indisponible.');
    try{await this.api.supprimerCompte(acces,confirmation);}
    catch(e){await this.sessionTerminee(e,n);throw e;}
    // Succès : le compte n'existe plus. Si une déconnexion a eu lieu entre-temps, tout est déjà effacé.
    if(n!==this.generation)return;
    const preparation=this.preparerDeconnexion?.();
    this.nbDeconnexions++;this.clesSuivi.clear();++this.generation;this.session=null;
    try{if(preparation)await preparation(null);}catch{/* sans effet sur l'effacement local */}
    try{await this.ordonner(()=>this.coffre.effacer());}catch{throw new ErreurConnexion('Compte supprimé, mais l’effacement local n’est pas confirmé. Utilisez « Me déconnecter de cet appareil ».');}
  }
  /** Déclare le règlement de CETTE commande (un seul essai). Le jeton de suivi reste ici ; seule une session ouverte peut déclarer, comme pour l'annulation. */
  async declarerPaiement(id:string,mode:string,reference:string|null):Promise<void> {
    const n=this.generation;
    await this.jeton();
    if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
    const cle=this.clesSuivi.get(id);if(!cle)throw new ErreurConnexion('Actualisez vos commandes pour déclarer ce règlement.');
    if(!this.api.declarerPaiement)throw new ErreurConnexion('Déclaration du règlement indisponible.');
    await this.api.declarerPaiement(cle.jeton,mode,reference);
  }
  /** Envoie une commande (un seul essai). Le jeton de suivi reçu est jeté ici : il ne remonte jamais jusqu'à l'écran, le suivi le relit via `commandes()`. */
  async creerCommande(payload:CreationCommandePayload):Promise<{reference:string;idempotent:boolean}> {
    const n=this.generation;
    const acces=await this.jeton();
    if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
    try{if(!this.api.creerCommande)throw new ErreurConnexion('Envoi de commande indisponible.');const r=await this.api.creerCommande(acces,payload);return {reference:r.reference,idempotent:r.idempotent};}
    catch(e){if(e instanceof ErreurCommande&&e.genre==='session'&&n===this.generation){this.session=null;this.clesSuivi.clear();await this.ordonner(()=>this.coffre.effacer());}throw e;}
  }
  /** Frais et durée de livraison calculés par le serveur pour ce quartier et ce sous-total (lecture, jeton porteur du compte connecté). Une session terminée le dit, sans rien effacer d'autre. */
  async estimerLivraison(restaurantId:string,quartierId:string,sousTotal:number):Promise<ResultatEstimation> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(n!==this.generation)throw new ErreurConnexion('Calcul annulé.');
      if(!this.api.estimerLivraison)throw new ErreurConnexion('Calcul de livraison indisponible.');
      const r=await this.api.estimerLivraison(acces,restaurantId,quartierId,sousTotal);
      if(n!==this.generation)throw new ErreurConnexion('Calcul annulé.');
      return r;
    }catch(e){if(e instanceof ErreurConnexion&&e.definitive&&n===this.generation){this.session=null;this.clesSuivi.clear();await this.ordonner(()=>this.coffre.effacer());}throw e;}
  }
  /** Efface la session si le serveur la dit terminée (401) ; sinon laisse l'erreur remonter telle quelle. */
  private async sessionTerminee(e: unknown, n: number) {
    if (e instanceof ErreurConnexion && e.definitive && n === this.generation) { this.session = null; this.clesSuivi.clear(); await this.ordonner(() => this.coffre.effacer()); }
  }
  /** Quels espaces ce compte peut-il ouvrir ? Affichage seulement (l'API revérifie chaque route). Une panne ne déconnecte pas : l'appelant masque simplement l'entrée. */
  async moi():Promise<RolesCompte> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(!this.api.moi)throw new ErreurConnexion('Lecture des espaces indisponible.');
      const r=await this.api.moi(acces);
      if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
      return r;
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Fiche de ce compte seulement : lecture stricte, annulée si la session change. */
  async ficheLivreur(): Promise<FicheLivreur | null> {
    const n = this.generation;
    try {
      const acces = await this.jeton();
      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');
      if (!this.api.ficheLivreur) throw new ErreurConnexion('Espace livreur indisponible.');
      const fiche = await this.api.ficheLivreur(acces);
      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');
      return fiche;
    } catch (e) { await this.sessionTerminee(e, n); throw e; }
  }
  /** Gains de ce livreur (lecture, jeton porteur) : frais de course du jour et des 7 jours, jamais une paie. */
  async gainsLivreur(): Promise<GainsLivreur | null> {
    const n = this.generation;
    try {
      const acces = await this.jeton();
      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');
      if (!this.api.gainsLivreur) throw new ErreurConnexion('Gains indisponibles.');
      const g = await this.api.gainsLivreur(acces);
      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');
      return g;
    } catch (e) { await this.sessionTerminee(e, n); throw e; }
  }
  /** Une page de l'historique des courses livrées de ce livreur (lecture paginée, jeton porteur). */
  async historiqueLivreur(page: number): Promise<PageCoursesLivreur | null> {
    const n = this.generation;
    try {
      const acces = await this.jeton();
      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');
      if (!this.api.historiqueLivreur) throw new ErreurConnexion('Historique indisponible.');
      const p = await this.api.historiqueLivreur(acces, page);
      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');
      return p;
    } catch (e) { await this.sessionTerminee(e, n); throw e; }
  }
  /** État G2 de ce compte (fiche + offre) : lecture pure, annulée si la session change. */
  async etatLivreur(): Promise<EtatLivreur | null> {
    const n = this.generation;
    try {
      const acces = await this.jeton();
      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');
      if (!this.api.etatLivreur) throw new ErreurConnexion('Espace livreur indisponible.');
      const etat = await this.api.etatLivreur(acces);
      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');
      return etat;
    } catch (e) { await this.sessionTerminee(e, n); throw e; }
  }
  /** Bascule de disponibilité G2 : un seul essai, jamais de relance ; le compte vient du jeton, jamais d'un paramètre. */
  async basculerEnLigneLivreur(enLigne: boolean): Promise<void> {
    const n = this.generation;
    try {
      const acces = await this.jeton();
      if (n !== this.generation) throw new ErreurConnexion('Envoi annulé.');
      if (!this.api.basculerEnLigneLivreur) throw new ErreurConnexion('Disponibilité indisponible.');
      await this.api.basculerEnLigneLivreur(acces, enLigne);
    } catch (e) { await this.sessionTerminee(e, n); throw e; }
  }
  /** Réponse à l'offre affichée (G3) : un seul essai, jamais de relance ; le compte vient du jeton, jamais d'un paramètre. */
  async repondreOffreLivreur(offreId: string, reponse: 'acceptee' | 'refusee'): Promise<void> {
    const n = this.generation;
    try {
      const acces = await this.jeton();
      if (n !== this.generation) throw new ErreurConnexion('Envoi annulé.');
      if (!this.api.repondreOffreLivreur) throw new ErreurConnexion('Espace livreur indisponible.');
      await this.api.repondreOffreLivreur(acces, offreId, reponse);
    } catch (e) { await this.sessionTerminee(e, n); throw e; }
  }
  /** Avancement de la course affichée (G3) : un seul essai, jamais de relance ; le compte vient du jeton, la course est celle que l'écran montre (`livraisonId`). */
  async avancerCourseLivreur(demande: DemandeCourseLivreur): Promise<void> {
    const n = this.generation;
    try {
      const acces = await this.jeton();
      if (n !== this.generation) throw new ErreurConnexion('Envoi annulé.');
      if (!this.api.avancerCourseLivreur) throw new ErreurConnexion('Espace livreur indisponible.');
      await this.api.avancerCourseLivreur(acces, demande);
    } catch (e) { await this.sessionTerminee(e, n); throw e; }
  }
  /** Commandes du restaurant de ce compte (lecture, jeton porteur). Aucune clé de suivi ni jeton de reçu : la liste n'en porte pas. */
  async commandesRestaurant():Promise<ListeRestaurateur> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(!this.api.commandesRestaurant)throw new ErreurConnexion('Espace restaurateur indisponible.');
      const r=await this.api.commandesRestaurant(acces);
      if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
      return r;
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Historique des commandes finies de CE restaurant (lecture paginée, jeton porteur) : aucun jeton de suivi, aucune coordonnée client. */
  async historiqueRestaurant(page:number,taille:number):Promise<PageHistorique> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(!this.api.historiqueRestaurant)throw new ErreurConnexion('Historique indisponible.');
      const r=await this.api.historiqueRestaurant(acces,page,taille);
      if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
      return r;
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Activité de CE restaurant (lecture, jeton porteur) : bilans et dernières commandes terminées, aucune coordonnée client. */
  async activiteRestaurant():Promise<ActiviteRestaurateur> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(!this.api.activiteRestaurant)throw new ErreurConnexion('Activité indisponible.');
      const r=await this.api.activiteRestaurant(acces);
      if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
      return r;
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Établit le reçu ou la facture d'UNE commande (un seul essai, jamais de relance : un numéro est attribué). Le restaurant n'est pas envoyé. */
  async emettreDocumentRestaurateur(commandeId:string,type:TypeDocument):Promise<void> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
      if(!this.api.emettreDocumentRestaurateur)throw new ErreurConnexion('Documents indisponibles.');
      await this.api.emettreDocumentRestaurateur(acces,commandeId,type);
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Accepte ou refuse UNE commande (un seul essai, jamais de relance). Le restaurant n'est pas envoyé : le serveur le tire du compte. */
  async actionRestaurateur(commandeId:string,action:ActionRestaurateur):Promise<void> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
      if(!this.api.actionRestaurateur)throw new ErreurConnexion('Espace restaurateur indisponible.');
      await this.api.actionRestaurateur(acces,commandeId,action);
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Fait avancer UNE livraison du restaurant (partir, livree avec le code, annuler) : un seul essai, jamais de relance. Le restaurant n'est pas envoyé : le serveur le tire du compte. */
  async actionLivraisonRestaurateur(livraisonId:string,action:ActionLivraisonApp,code?:string):Promise<void> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
      if(!this.api.actionLivraisonRestaurateur)throw new ErreurConnexion('Espace restaurateur indisponible.');
      await this.api.actionLivraisonRestaurateur(acces,livraisonId,action,code);
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Propose un autre prix pour UNE commande (un seul essai, jamais de relance). Le restaurant n'est pas envoyé : le serveur le tire du compte. */
  async proposerRestaurateur(commandeId:string,valeurs:ValeursPropositionRestaurateur):Promise<void> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
      if(!this.api.proposerRestaurateur)throw new ErreurConnexion('Espace restaurateur indisponible.');
      await this.api.proposerRestaurateur(acces,commandeId,valeurs);
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Réglages du service de CE restaurant (lecture, jeton porteur) : état du service, horaires, délai, plats à reconfirmer. */
  async reglagesRestaurateur():Promise<ReglagesRestaurateur> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(!this.api.reglagesRestaurateur)throw new ErreurConnexion('Espace restaurateur indisponible.');
      const r=await this.api.reglagesRestaurateur(acces);
      if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
      return r;
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Menu de CE restaurant (lecture, jeton porteur) : plats non archivés et leur disponibilité. */
  async menuRestaurateur():Promise<MenuRestaurateur> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(!this.api.menuRestaurateur)throw new ErreurConnexion('Espace restaurateur indisponible.');
      const r=await this.api.menuRestaurateur(acces);
      if(n!==this.generation)throw new ErreurConnexion('Lecture annulée.');
      return r;
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  /** Écrit UNE action du service ou du menu (un seul essai, jamais de relance). Le restaurant n'est pas envoyé : le serveur le tire du compte. */
  async ecrireService(action:ActionService):Promise<void> {
    const n=this.generation;
    try{
      const acces=await this.jeton();
      if(n!==this.generation)throw new ErreurConnexion('Envoi annulé.');
      if(!this.api.ecrireService)throw new ErreurConnexion('Espace restaurateur indisponible.');
      await this.api.ecrireService(acces,action);
    }catch(e){await this.sessionTerminee(e,n);throw e;}
  }
  deconnecter(): Promise<{ distanteConfirmee: boolean }> {
    if (this.deconnexionEnCours) return this.deconnexionEnCours;
    const p = this.deconnecterUneFois().finally(() => { if (this.deconnexionEnCours === p) this.deconnexionEnCours = null; });
    this.deconnexionEnCours = p;
    return p;
  }
  private async deconnecterUneFois() {
    const n = this.generation;
    const preparation = this.preparerDeconnexion?.();
    const retrait = preparation ?? this.avantDeconnexion;
    if (retrait && this.session) {
      // Retrait de l'appareil D'ABORD (le jeton porteur est encore valide), un seul essai, au plus 6 s ; rien de ce qui se passe ici n'empêche la déconnexion.
      let minuterie: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([this.acces().then(a => a ? retrait(a) : preparation?.(null)), new Promise<void>(r => { minuterie = setTimeout(r, 6000); })]); } catch { /* silencieux */ }
      finally { if (minuterie) clearTimeout(minuterie); }
    } else if (preparation) { await preparation(null); }
    // Une connexion plus récente ne doit jamais être effacée par cette ancienne déconnexion.
    if (n !== this.generation) return { distanteConfirmee: false };
    this.nbDeconnexions++;
    this.clesSuivi.clear();
    const acces = this.session?.accessToken; ++this.generation; this.session = null;
    const local = this.ordonner(() => this.coffre.effacer());
    const distant = acces ? this.api.deconnecter(acces).then(() => true, () => false) : Promise.resolve(true);
    try { await local; } catch { await distant; throw new ErreurConnexion('Effacement local non confirmé. Réessayez de vous déconnecter.'); }
    return { distanteConfirmee: await distant };
  }
}
