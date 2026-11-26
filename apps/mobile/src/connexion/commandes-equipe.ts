/**
 * Commandes vues et traitées par l'équipe (parité Kotlin, lot 5, ligne E1) : accès du compte (`/equipe/moi`), recherche et détail support
 * (`/equipe/commandes[/id]`), changement de statut et révélation des coordonnées (motif obligatoire, tracés par le serveur), poste de
 * répartition (`/equipe/repartition[/action]`). Routes DU SITE, permissions vérifiées par le serveur à chaque appel.
 * Les coordonnées des listes et détails arrivent DÉJÀ MASQUÉES par la base ; les vraies coordonnées ne sortent que par la réponse dédiée
 * à la révélation (motif + trace d'audit côté serveur), affichées puis oubliées à la fermeture. Aucune coordonnée n'est gardée ailleurs.
 * Écritures sensibles : motif obligatoire, confirmation à l'écran, un seul essai, jamais de relance — l'état relu décide du résultat.
 */
export type StatutCommandeEquipe = 'en_attente' | 'acceptee' | 'en_cours' | 'prete' | 'en_livraison' | 'terminee' | 'refusee' | 'annulee';
const STATUTS: readonly StatutCommandeEquipe[] = ['en_attente', 'acceptee', 'en_cours', 'prete', 'en_livraison', 'terminee', 'refusee', 'annulee'];
export const STATUTS_COMMANDE_EQUIPE = STATUTS;
export type ModeCommandeEquipe = 'retrait' | 'livraison' | 'sur_place';

export interface EntreeAccesEquipe { chemin: string; libelle: string; natif: boolean }
export interface GroupeAccesEquipe { libelle: string; entrees: EntreeAccesEquipe[] }
export interface AccesEquipe { role: string; permissions: string[]; groupes: GroupeAccesEquipe[] }

export interface CommandeEquipe {
  id: string; reference: string; restaurantNom: string; restaurantId: string | null; statut: StatutCommandeEquipe; mode: ModeCommandeEquipe;
  clientNom: string; telephoneAffiche: string; adresseAffichee: string; sousTotal: number; fraisLivraisonEstime: number; totalGnf: number; creeLe: string;
}
export interface EvenementCommandeEquipe { statutPrecedent: StatutCommandeEquipe | null; statutSuivant: StatutCommandeEquipe; acteur: string; horodatage: string }
export interface PropositionCommandeEquipe {
  version: number; sousTotalPrecedent: number; nouveauSousTotal: number; fraisLivraisonPrecedent: number | null; nouveauxFraisLivraison: number;
  conditionsModifiees: string | null; statut: string; expireLe: string | null; creeLe: string; reponduLe: string | null;
}
export interface DetailCommandeEquipe extends CommandeEquipe { historique: EvenementCommandeEquipe[]; propositions: PropositionCommandeEquipe[] }
export interface ReponseDetailEquipe { commande: DetailCommandeEquipe; transitions: StatutCommandeEquipe[]; peutReveler: boolean }
export interface CoordonneesEquipe { telephone: string; adresse: string }

export interface CommandeARepartir {
  id: string; reference: string; statut: StatutCommandeEquipe; mode: ModeCommandeEquipe; sousTotal: number; fraisLivraison: number; totalGnf: number;
  creeLe: string; estTest: boolean; restaurantId: string; restaurantNom: string; telephoneRestaurant: string | null;
  lignes: Array<{ nom: string; quantite: number }>;
}
export const ACTIONS_REPARTITION_EQUIPE: readonly string[] = ['accepter', 'refuser', 'prete', 'terminee', 'annuler'];
export type ActionRepartitionEquipe = 'accepter' | 'refuser' | 'prete' | 'terminee' | 'annuler';

function invalide(): never { throw Error('COMMANDES_EQUIPE_ILLISIBLES'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function texteNonVide(v: unknown, max: number): string { const s = texte(v, max); if (s.length === 0) return invalide(); return s; }
function texteOuNull(v: unknown, max: number): string | null { return v === null || v === undefined ? null : texte(v, max); }
function montant(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return invalide(); return v; }
function entier(v: unknown, max: number): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max) return invalide(); return v; }
function identifiant(v: unknown): string {
  const s = texte(v, 36);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)) return invalide();
  return s;
}
function dateTexte(v: unknown): string { const s = texte(v, 40); if (!Number.isFinite(Date.parse(s))) return invalide(); return s; }
function statut(v: unknown): StatutCommandeEquipe {
  if (typeof v !== 'string' || !(STATUTS as readonly string[]).includes(v)) return invalide();
  return v as StatutCommandeEquipe;
}
function mode(v: unknown): ModeCommandeEquipe { return v === 'livraison' || v === 'sur_place' ? v : 'retrait'; }

/** Accès du compte dans l'équipe : rôle, permissions et menu (déjà filtrés par le serveur). */
export function lireAccesEquipe(v: Record<string, unknown>): AccesEquipe {
  if (v.ok !== true || !Array.isArray(v.permissions) || v.permissions.length > 200 || !Array.isArray(v.groupes) || v.groupes.length > 50) return invalide();
  return {
    role: texteNonVide(v.role, 60),
    permissions: v.permissions.map(p => texteNonVide(p, 80)),
    groupes: v.groupes.map(gx => {
      const g = objet(gx);
      if (!Array.isArray(g.entrees) || g.entrees.length > 100) return invalide();
      return {
        libelle: texteNonVide(g.libelle, 120),
        entrees: g.entrees.map(ex => {
          const e = objet(ex);
          if (typeof e.natif !== 'boolean') return invalide();
          return { chemin: texteNonVide(e.chemin, 200), libelle: texteNonVide(e.libelle, 120), natif: e.natif };
        }),
      };
    }),
  };
}

function lireApercu(x: unknown): CommandeEquipe {
  const o = objet(x);
  const sousTotal = montant(o.sousTotal); const frais = montant(o.fraisLivraisonEstime);
  const total = sousTotal + frais;
  if (!Number.isSafeInteger(total)) return invalide();
  const restaurantId = o.restaurantId === null || o.restaurantId === undefined ? null : identifiant(o.restaurantId);
  return {
    id: identifiant(o.id), reference: texteNonVide(o.reference, 40), restaurantNom: texte(o.restaurantNom, 200), restaurantId,
    statut: statut(o.statut), mode: mode(o.mode), clientNom: texte(o.clientNom, 200), telephoneAffiche: texte(o.telephoneAffiche, 60),
    adresseAffichee: texte(o.adresseAffichee, 300), sousTotal, fraisLivraisonEstime: frais, totalGnf: total, creeLe: dateTexte(o.creeLe),
  };
}

/** Recherche support : aperçus aux coordonnées déjà masquées ; une ligne illisible est écartée et comptée. */
export function lireCommandesEquipe(v: Record<string, unknown>): { commandes: CommandeEquipe[]; illisibles: number } {
  if (v.ok !== true || !Array.isArray(v.commandes) || v.commandes.length > 500) return invalide();
  const commandes: CommandeEquipe[] = []; let illisibles = 0;
  for (const x of v.commandes) { try { commandes.push(lireApercu(x)); } catch { illisibles++; } }
  return { commandes, illisibles };
}

/** Détail support : aperçu + historique + propositions + transitions permises par le serveur. */
export function lireDetailCommandeEquipe(v: Record<string, unknown>): ReponseDetailEquipe {
  if (v.ok !== true || typeof v.peutReveler !== 'boolean' || !Array.isArray(v.transitions) || v.transitions.length > STATUTS.length) return invalide();
  const o = objet(v.commande);
  if (!Array.isArray(o.historique) || o.historique.length > 200 || !Array.isArray(o.propositions) || o.propositions.length > 50) return invalide();
  const base = lireApercu(o);
  return {
    commande: {
      ...base,
      historique: o.historique.map(ex => {
        const e = objet(ex);
        return {
          statutPrecedent: e.statutPrecedent === null || e.statutPrecedent === undefined ? null : statut(e.statutPrecedent),
          statutSuivant: statut(e.statutSuivant), acteur: texteNonVide(e.acteur, 80), horodatage: dateTexte(e.horodatage),
        };
      }),
      propositions: o.propositions.map(px => {
        const p = objet(px);
        return {
          version: entier(p.version, 10000), sousTotalPrecedent: montant(p.sousTotalPrecedent), nouveauSousTotal: montant(p.nouveauSousTotal),
          fraisLivraisonPrecedent: p.fraisLivraisonPrecedent === null || p.fraisLivraisonPrecedent === undefined ? null : montant(p.fraisLivraisonPrecedent),
          nouveauxFraisLivraison: montant(p.nouveauxFraisLivraison), conditionsModifiees: texteOuNull(p.conditionsModifiees, 500),
          statut: texteNonVide(p.statut, 40), expireLe: texteOuNull(p.expireLe, 40), creeLe: dateTexte(p.creeLe), reponduLe: texteOuNull(p.reponduLe, 40),
        };
      }),
    },
    transitions: v.transitions.map(statut),
    peutReveler: v.peutReveler,
  };
}

/** Coordonnées révélées (réponse dédiée seulement, `devoilees` doit être vrai) : à afficher puis oublier, jamais à conserver. */
export function lireCoordonneesEquipe(v: Record<string, unknown>): CoordonneesEquipe {
  if (v.ok !== true) return invalide();
  const co = objet(v.coordonnees);
  if (co.devoilees !== true) return invalide();
  return { telephone: texteNonVide(co.telephone, 60), adresse: texte(co.adresse, 500) };
}

/** Motif d'une action sensible : obligatoire, borné à 500 caractères comme le serveur. `null` = à compléter avant l'envoi. */
export function preparerMotifEquipe(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  const m = brut.trim();
  return m.length >= 1 && m.length <= 500 ? m : null;
}

/** Commandes actives des établissements tenus par l'équipe (poste de répartition). */
export function lireCommandesARepartir(v: Record<string, unknown>): { commandes: CommandeARepartir[]; illisibles: number } {
  if (v.ok !== true || !Array.isArray(v.commandes) || v.commandes.length > 100) return invalide();
  const commandes: CommandeARepartir[] = []; let illisibles = 0;
  for (const x of v.commandes) {
    try {
      const o = objet(x);
      if (typeof o.estTest !== 'boolean' || !Array.isArray(o.lignes) || o.lignes.length > 200) return invalide();
      const sousTotal = montant(o.sousTotal); const fraisLivraison = montant(o.fraisLivraison);
      const total = sousTotal + fraisLivraison;
      if (!Number.isSafeInteger(total)) return invalide();
      commandes.push({
        id: identifiant(o.id), reference: texteNonVide(o.reference, 40), statut: statut(o.statut), mode: mode(o.mode),
        sousTotal, fraisLivraison, totalGnf: total, creeLe: dateTexte(o.creeLe), estTest: o.estTest,
        restaurantId: identifiant(o.restaurantId), restaurantNom: texte(o.restaurantNom, 200), telephoneRestaurant: texteOuNull(o.telephoneRestaurant, 40),
        lignes: o.lignes.map(lx => {
          const l = objet(lx);
          return { nom: texteNonVide(l.nom, 200), quantite: entier(l.quantite, 999) };
        }),
      });
    } catch { illisibles++; }
  }
  return { commandes, illisibles };
}

/** Action de répartition valide (liste blanche, vérifiée avant le réseau). */
export function estActionRepartitionEquipe(v: unknown): v is ActionRepartitionEquipe {
  return typeof v === 'string' && (ACTIONS_REPARTITION_EQUIPE as readonly string[]).includes(v);
}
