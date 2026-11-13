/**
 * Paiements en ligne vus par l'équipe (parité Kotlin, lot 5, ligne E3) : LECTURE SEULE (`GET /api/v1/equipe/paiements`, route du site).
 * Les décisions qui déplacent de l'argent (reprendre un versement, trancher un litige) restent sur le site et ne sont volontairement
 * pas exposées ici. Les numéros de téléphone de versement ne sont jamais reçus ni retenus. Montants GNF entiers.
 * Lecture stricte : un paiement illisible est écarté et COMPTÉ ; réglages ou compteurs invalides refusent toute la lecture.
 */
export interface ReglagesPaiementEquipe { actif: boolean; fournisseur: string; valeursValidees: boolean }
export interface CompteursPaiementsEquipe { enAttente: number; versementsATraiter: number; litigesAHumain: number }
export interface VersementEquipe { beneficiaire: string; etat: string; montantGnf: number; erreurCode: string | null }
export interface LitigeEquipe { situation: string; etat: string; regle: string | null }
export interface PaiementEquipe {
  id: string; commandeReference: string; restaurantNom: string; etat: string; operateur: string; fournisseur: string;
  totalGnf: number; restaurantGnf: number; livreurGnf: number; speedfoodBrutGnf: number; fraisMobileGnf: number; rembourseGnf: number;
  creeLe: string; versements: VersementEquipe[]; litiges: LitigeEquipe[];
}
export interface PaiementsEquipe {
  reglages: ReglagesPaiementEquipe; compteurs: CompteursPaiementsEquipe; paiements: PaiementEquipe[]; illisibles: number;
}

const PAIEMENTS_MAX = 100;

function invalide(): never { throw Error('PAIEMENTS_EQUIPE_ILLISIBLES'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function libre(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length > max) return invalide();
  return v.replace(/[\x00-\x1f\x7f]/g, ' ').split(' ').filter(m => m.length > 0).join(' ');
}
function texteOuNull(v: unknown, max: number): string | null { return v === null || v === undefined ? null : texte(v, max); }
function montant(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return invalide(); return v; }
function booleen(v: unknown): boolean { if (typeof v !== 'boolean') return invalide(); return v; }

function lirePaiement(x: unknown): PaiementEquipe {
  const o = objet(x);
  if (!Array.isArray(o.versements) || o.versements.length > 20 || !Array.isArray(o.litiges) || o.litiges.length > 20) return invalide();
  const creeLe = texte(o.creeLe, 40);
  if (!Number.isFinite(Date.parse(creeLe))) return invalide();
  return {
    id: texte(o.id, 80), commandeReference: libre(o.commandeReference, 40), restaurantNom: libre(o.restaurantNom, 200),
    etat: texte(o.etat, 40), operateur: texte(o.operateur, 40), fournisseur: texte(o.fournisseur, 40),
    totalGnf: montant(o.totalGnf), restaurantGnf: montant(o.restaurantGnf), livreurGnf: montant(o.livreurGnf),
    speedfoodBrutGnf: montant(o.speedfoodBrutGnf), fraisMobileGnf: montant(o.fraisMobileGnf), rembourseGnf: montant(o.rembourseGnf), creeLe,
    versements: o.versements.map(vx => {
      const v = objet(vx);
      return { beneficiaire: texte(v.beneficiaire, 40), etat: texte(v.etat, 40), montantGnf: montant(v.montantGnf), erreurCode: texteOuNull(v.erreurCode, 80) };
    }),
    litiges: o.litiges.map(lx => {
      const l = objet(lx);
      return { situation: texte(l.situation, 80), etat: texte(l.etat, 40), regle: texteOuNull(l.regle, 80) };
    }),
  };
}

/** Lecture stricte des paiements de l'équipe : seuls les champs affichés sont retenus (aucun numéro de téléphone, même masqué). */
export function lirePaiementsEquipe(v: Record<string, unknown>): PaiementsEquipe {
  if (v.ok !== true || !Array.isArray(v.paiements) || v.paiements.length > PAIEMENTS_MAX) return invalide();
  const r = objet(v.reglages);
  const cp = objet(v.compteurs);
  const paiements: PaiementEquipe[] = []; let illisibles = 0;
  for (const x of v.paiements) { try { paiements.push(lirePaiement(x)); } catch { illisibles++; } }
  return {
    reglages: { actif: booleen(r.actif), fournisseur: texte(r.fournisseur, 40), valeursValidees: booleen(r.valeursValidees) },
    compteurs: { enAttente: montant(cp.enAttente), versementsATraiter: montant(cp.versementsATraiter), litigesAHumain: montant(cp.litigesAHumain) },
    paiements, illisibles,
  };
}
