import { normaliserTelephone } from '../../../../packages/shared/src/commande/telephone.ts';

/**
 * Catalogue vu par l'équipe (parité Kotlin, lot 6, lignes E4 à E7) : établissements et leurs fiches, fraîcheur des menus, demandes de
 * référencement et de partenariat. Routes DU SITE (`/equipe/restaurants`, `/menus`, `/referencements`, `/partenariats`), permission
 * vérifiée par le serveur à chaque appel. La publication, la suspension, la suppression et l'export de contacts restent sur le site :
 * l'application montre l'état et ne fait que les gestes sans risque (profil simple, reconfirmation, disponibilité, statuts de suivi).
 * Aucun e-mail de candidat, aucun chemin de fichier d'image n'est retenu ; le téléphone du responsable d'une demande est celui que
 * le serveur envoie pour rappeler la personne.
 */
export type ModeVenteEquipe = 'autonome' | 'speedfood';
export interface RestaurantEquipe {
  id: string; nom: string; categorie: string; quartier: string; publie: boolean; ouvert: boolean; suspendu: boolean;
  motifCorrection: string | null; modeVente: ModeVenteEquipe; horaires: string; consignes: string;
  telephoneCommandes: string | null; plats: number; platsDisponibles: number;
}
export type EtatPlatEquipe = 'disponible' | 'a_confirmer' | 'epuise';
export interface PlatFicheEquipe { id: string; nom: string; prix: number; disponible: boolean; etat: EtatPlatEquipe }
export interface FicheRestaurantEquipe extends RestaurantEquipe { platsDetail: PlatFicheEquipe[] }
export interface MenuEquipeResume { restaurantId: string; nom: string; plats: number; aReconfirmer: number; epuises: number; derniereConfirmation: string | null }
export interface MenusEquipe { fraicheurHeures: number; menus: MenuEquipeResume[] }
export interface PlatMenuEquipe { id: string; nom: string; prix: number; disponible: boolean; confirmeLe: string | null; etat: EtatPlatEquipe }

export const STATUTS_REFERENCEMENT_EQUIPE: readonly string[] = ['nouvelle', 'rappelee', 'visite_prevue', 'accord', 'refusee', 'creee'];
export interface CandidatureReferencement {
  horaires: string; moyensPaiement: string[]; services: string[]; nombrePlats: number;
  avecLogo: boolean; avecPhoto: boolean; motifRefus: string | null; compteRattachable: boolean; compteRattache: boolean;
}
export interface DemandeReferencement {
  id: string; type: string; organisation: string; commune: string; quartier: string; indications: string; categories: string;
  specialites: string; responsable: string; telephone: string; statut: string; etablissementCree: boolean; creeLe: string;
  candidature: CandidatureReferencement | null;
}
export const STATUTS_PARTENARIAT_EQUIPE: readonly string[] = ['nouvelle', 'en_cours', 'traitee', 'classee'];
export interface DemandePartenariat {
  id: string; forme: string; organisation: string; nomContact: string; contactType: 'telephone' | 'email'; contact: string; message: string; statut: string; creeLe: string;
}

function invalide(): never { throw Error('CATALOGUE_EQUIPE_ILLISIBLE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function texteNonVide(v: unknown, max: number): string { const s = texte(v, max); if (s.length === 0) return invalide(); return s; }
function texteOuNull(v: unknown, max: number): string | null { return v === null || v === undefined ? null : texte(v, max); }
function montant(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return invalide(); return v; }
function booleen(v: unknown): boolean { if (typeof v !== 'boolean') return invalide(); return v; }
function identifiant(v: unknown): string {
  const s = texte(v, 36);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)) return invalide();
  return s;
}
function dateTexte(v: unknown): string { const s = texte(v, 40); if (!Number.isFinite(Date.parse(s))) return invalide(); return s; }
function dateOuNull(v: unknown): string | null { return v === null || v === undefined ? null : dateTexte(v); }
function chaines(v: unknown, max: number): string[] {
  if (!Array.isArray(v) || v.length > 50) return invalide();
  return v.map(x => texte(x, max));
}
function etatPlat(v: unknown): EtatPlatEquipe {
  if (v !== 'disponible' && v !== 'a_confirmer' && v !== 'epuise') return invalide();
  return v;
}

/** Mode de vente : tout ce qui n'est pas « speedfood » est tenu par le restaurateur (même règle que le serveur). */
export function modeVenteEquipe(v: unknown): ModeVenteEquipe { return v === 'speedfood' ? 'speedfood' : 'autonome'; }

function lireRestaurant(x: unknown): RestaurantEquipe {
  const o = objet(x);
  return {
    id: identifiant(o.id), nom: texteNonVide(o.nom, 200), categorie: texte(o.categorie, 200), quartier: texte(o.quartier, 200),
    publie: booleen(o.publie), ouvert: booleen(o.ouvert), suspendu: booleen(o.suspendu), motifCorrection: texteOuNull(o.motifCorrection, 500),
    modeVente: modeVenteEquipe(o.modeVente), horaires: texte(o.horaires, 500), consignes: texte(o.consignes, 1000),
    telephoneCommandes: texteOuNull(o.telephoneCommandes, 40), plats: montant(o.plats), platsDisponibles: montant(o.platsDisponibles),
  };
}
export function lireRestaurantsEquipe(v: Record<string, unknown>): { restaurants: RestaurantEquipe[]; illisibles: number } {
  if (v.ok !== true || !Array.isArray(v.restaurants) || v.restaurants.length > 500) return invalide();
  const restaurants: RestaurantEquipe[] = []; let illisibles = 0;
  for (const x of v.restaurants) { try { restaurants.push(lireRestaurant(x)); } catch { illisibles++; } }
  return { restaurants, illisibles };
}
export function lireFicheRestaurantEquipe(v: Record<string, unknown>): FicheRestaurantEquipe {
  if (v.ok !== true) return invalide();
  const o = objet(v.restaurant);
  if (!Array.isArray(o.platsDetail) || o.platsDetail.length > 500) return invalide();
  return {
    ...lireRestaurant(o),
    platsDetail: o.platsDetail.map(x => {
      const p = objet(x);
      return { id: identifiant(p.id), nom: texteNonVide(p.nom, 200), prix: montant(p.prix), disponible: booleen(p.disponible), etat: etatPlat(p.etat) };
    }),
  };
}

/** Validation de la modification simple (horaires + numéro interne), mêmes règles que le serveur. Numéro vide = retrait du contact. */
export function validerProfilSimpleEquipe(horairesBrut: string, telephoneBrut: string): { ok: true; horaires: string; telephone: string | null } | { ok: false; message: string } {
  const horaires = typeof horairesBrut === 'string' ? horairesBrut.trim() : '';
  if (!horaires) return { ok: false, message: "Renseignez les horaires avant d'enregistrer." };
  if (horaires.length > 500) return { ok: false, message: 'Les horaires ne peuvent pas dépasser 500 caractères.' };
  const brut = typeof telephoneBrut === 'string' ? telephoneBrut.trim() : '';
  if (brut === '') return { ok: true, horaires, telephone: null };
  const telephone = normaliserTelephone(brut);
  if (telephone === null) return { ok: false, message: "Ce numéro n'est pas un numéro guinéen valide." };
  return { ok: true, horaires, telephone };
}

export function lireMenusEquipe(v: Record<string, unknown>): MenusEquipe {
  if (v.ok !== true || !Array.isArray(v.menus) || v.menus.length > 500) return invalide();
  if (typeof v.fraicheurHeures !== 'number' || !Number.isSafeInteger(v.fraicheurHeures) || v.fraicheurHeures < 0) return invalide();
  return {
    fraicheurHeures: v.fraicheurHeures,
    menus: v.menus.map(x => {
      const o = objet(x);
      return {
        restaurantId: identifiant(o.restaurantId), nom: texteNonVide(o.nom, 200), plats: montant(o.plats),
        aReconfirmer: montant(o.aReconfirmer), epuises: montant(o.epuises), derniereConfirmation: dateOuNull(o.derniereConfirmation),
      };
    }),
  };
}
export function lirePlatsMenuEquipe(v: Record<string, unknown>): { nom: string; plats: PlatMenuEquipe[] } {
  if (v.ok !== true || !Array.isArray(v.plats) || v.plats.length > 500) return invalide();
  return {
    nom: texte(v.nom, 200),
    plats: v.plats.map(x => {
      const o = objet(x);
      return { id: identifiant(o.id), nom: texteNonVide(o.nom, 200), prix: montant(o.prix), disponible: booleen(o.disponible), confirmeLe: dateOuNull(o.confirmeLe), etat: etatPlat(o.etat) };
    }),
  };
}

export function lireReferencementsEquipe(v: Record<string, unknown>): { demandes: DemandeReferencement[]; illisibles: number } {
  if (v.ok !== true || !Array.isArray(v.demandes) || v.demandes.length > 500) return invalide();
  const demandes: DemandeReferencement[] = []; let illisibles = 0;
  for (const x of v.demandes) {
    try {
      const o = objet(x);
      if (typeof o.etablissementCree !== 'boolean') return invalide();
      let candidature: CandidatureReferencement | null = null;
      if (o.candidature !== null && o.candidature !== undefined) {
        const cd = objet(o.candidature);
        if (typeof cd.avecLogo !== 'boolean' || typeof cd.avecPhoto !== 'boolean' || typeof cd.compteRattachable !== 'boolean' || typeof cd.compteRattache !== 'boolean') return invalide();
        candidature = {
          horaires: texte(cd.horaires, 500), moyensPaiement: chaines(cd.moyensPaiement, 40), services: chaines(cd.services, 40),
          nombrePlats: montant(cd.nombrePlats), avecLogo: cd.avecLogo, avecPhoto: cd.avecPhoto,
          motifRefus: texteOuNull(cd.motifRefus, 500), compteRattachable: cd.compteRattachable, compteRattache: cd.compteRattache,
        };
      }
      demandes.push({
        id: identifiant(o.id), type: texteNonVide(o.type, 40), organisation: texte(o.organisation, 200), commune: texte(o.commune, 120),
        quartier: texte(o.quartier, 120), indications: texte(o.indications, 500), categories: texte(o.categories, 300), specialites: texte(o.specialites, 300),
        responsable: texte(o.responsable, 200), telephone: texte(o.telephone, 60), statut: texteNonVide(o.statut, 40),
        etablissementCree: o.etablissementCree, creeLe: dateTexte(o.creeLe), candidature,
      });
    } catch { illisibles++; }
  }
  return { demandes, illisibles };
}

/** Options officielles pour créer l'établissement d'une demande (catégories et quartiers proposés). */
export function lireOptionsReferencement(v: Record<string, unknown>): { categories: Array<{ id: string; nom: string }>; quartiers: Array<{ id: string; nom: string }> } {
  if (v.ok !== true || !Array.isArray(v.categories) || v.categories.length > 500 || !Array.isArray(v.quartiers) || v.quartiers.length > 5000) return invalide();
  const lire = (x: unknown) => { const o = objet(x); return { id: identifiant(o.id), nom: texteNonVide(o.nom, 200) }; };
  return { categories: v.categories.map(lire), quartiers: v.quartiers.map(lire) };
}

const FORMES_PARTENARIAT: readonly string[] = ['investir', 'soutenir', 'moyens', 'contribuer'];
export function lirePartenariatsEquipe(v: Record<string, unknown>): { partenariats: DemandePartenariat[]; illisibles: number } {
  if (v.ok !== true || !Array.isArray(v.partenariats) || v.partenariats.length > 500) return invalide();
  const partenariats: DemandePartenariat[] = []; let illisibles = 0;
  for (const x of v.partenariats) {
    try {
      const o = objet(x);
      if (typeof o.forme !== 'string' || !FORMES_PARTENARIAT.includes(o.forme)) return invalide();
      if (typeof o.statut !== 'string' || !STATUTS_PARTENARIAT_EQUIPE.includes(o.statut)) return invalide();
      partenariats.push({
        id: identifiant(o.id), forme: o.forme, organisation: texte(o.organisation, 200), nomContact: texte(o.nomContact, 200),
        contactType: o.contactType === 'email' ? 'email' : 'telephone', contact: texte(o.contact, 200), message: texte(o.message, 2000),
        statut: o.statut, creeLe: dateTexte(o.creeLe),
      });
    } catch { illisibles++; }
  }
  return { partenariats, illisibles };
}
