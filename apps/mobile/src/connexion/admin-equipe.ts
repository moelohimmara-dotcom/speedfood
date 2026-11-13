/**
 * Comptes, audit, liste d'attente et mises à jour (parité Kotlin, lot 8, lignes E11 à E14) : routes DU SITE, LECTURE SEULE
 * sauf le marquage d'une zone comme prévenue. La suppression de comptes ou de contacts, l'attribution des rôles, la bascule
 * d'un interrupteur et l'annonce d'une version restent sur le site (irréversibles ou à effet public immédiat).
 * Aucun contact de la liste d'attente n'est renvoyé par le serveur et aucun n'est retenu ici : seules des zones et des nombres.
 */
export interface AffiliationCompteEquipe { restaurantId: string; nom: string; role: string }
export interface CompteEquipe {
  utilisateurId: string; email: string; creeLe: string; roleSysteme: string | null; restaurants: AffiliationCompteEquipe[]; test: boolean;
}
export interface IndicateurAuditEquipe { cle: string; libelle: string; definition: string; valeur: number }
export interface EntreeJournalEquipe {
  id: string; horodatage: string; action: string; libelle: string; acteurEmail: string | null; auteur: string;
  cibleType: string; cibleId: string; cible: string; cibleUrl: string | null; motif: string | null;
}
export interface AuditEquipe {
  indicateurs: IndicateurAuditEquipe[]; actions: Array<{ code: string; libelle: string }>;
  periodes: Array<{ valeur: number | null; libelle: string }>; journal: EntreeJournalEquipe[]; tronque: boolean;
}
export type NiveauAttente = 'region' | 'prefecture' | 'commune' | 'quartier';
export interface ZoneAttenteEquipe { niveau: NiveauAttente; id: string; nom: string; contexte: string; personnes: number; prevenues: number; derniere: string }
export interface FonctionnaliteEquipe { cle: string; libelle: string; description: string; groupe: string; active: boolean; miseAJourLe: string }
export interface MiseAJourJournalEquipe {
  id: string; date: string; titre: string; resume: string; verification: string; cle: string | null; active: boolean | null;
  raisonSansInterrupteur: string | null; groupe: string;
}
export interface MisesAJourEquipe {
  version: { code: number; nom: string; notes: string }; appareils: number;
  annonce: { versionCode: number; versionNom: string; annonceeLe: string; appareils: number; envoyes: number } | null;
  fonctionnalites: FonctionnaliteEquipe[]; misesAJour: MiseAJourJournalEquipe[];
}

function invalide(): never { throw Error('ADMIN_EQUIPE_ILLISIBLE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function texteNonVide(v: unknown, max: number): string { const s = texte(v, max); if (s.length === 0) return invalide(); return s; }
function texteOuNull(v: unknown, max: number): string | null { return v === null || v === undefined ? null : texte(v, max); }
function entier(v: unknown, max: number): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max) return invalide(); return v; }
function identifiant(v: unknown): string {
  const s = texte(v, 36);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)) return invalide();
  return s;
}
function dateTexte(v: unknown): string { const s = texte(v, 40); if (!Number.isFinite(Date.parse(s))) return invalide(); return s; }
function booleen(v: unknown): boolean { if (typeof v !== 'boolean') return invalide(); return v; }
function booleenOuNull(v: unknown): boolean | null { return v === null || v === undefined ? null : booleen(v); }

export function lireComptesEquipe(v: Record<string, unknown>): { comptes: CompteEquipe[]; tronque: boolean; illisibles: number } {
  if (v.ok !== true || !Array.isArray(v.comptes) || v.comptes.length > 500 || typeof v.tronque !== 'boolean') return invalide();
  const comptes: CompteEquipe[] = []; let illisibles = 0;
  for (const x of v.comptes) {
    try {
      const o = objet(x);
      if (!Array.isArray(o.restaurants) || o.restaurants.length > 200) return invalide();
      comptes.push({
        utilisateurId: identifiant(o.utilisateurId), email: texteNonVide(o.email, 200), creeLe: dateTexte(o.creeLe),
        roleSysteme: texteOuNull(o.roleSysteme, 60), test: booleen(o.test),
        restaurants: o.restaurants.map(rx => {
          const r = objet(rx);
          return { restaurantId: identifiant(r.restaurantId), nom: texteNonVide(r.nom, 200), role: texteNonVide(r.role, 40) };
        }),
      });
    } catch { illisibles++; }
  }
  return { comptes, tronque: v.tronque, illisibles };
}

export function lireAuditEquipe(v: Record<string, unknown>): AuditEquipe {
  if (v.ok !== true || typeof v.tronque !== 'boolean') return invalide();
  if (!Array.isArray(v.indicateurs) || v.indicateurs.length > 100 || !Array.isArray(v.actions) || v.actions.length > 200
    || !Array.isArray(v.periodes) || v.periodes.length > 10 || !Array.isArray(v.journal) || v.journal.length > 500) return invalide();
  return {
    tronque: v.tronque,
    indicateurs: v.indicateurs.map(x => {
      const o = objet(x);
      return { cle: texteNonVide(o.cle, 80), libelle: texteNonVide(o.libelle, 200), definition: texte(o.definition, 500), valeur: entier(o.valeur, 1_000_000_000) };
    }),
    actions: v.actions.map(x => {
      const o = objet(x);
      return { code: texteNonVide(o.code, 80), libelle: texteNonVide(o.libelle, 200) };
    }),
    periodes: v.periodes.map(x => {
      const o = objet(x);
      return { valeur: o.valeur === null ? null : entier(o.valeur, 3650), libelle: texteNonVide(o.libelle, 120) };
    }),
    journal: v.journal.map(x => {
      const o = objet(x);
      return {
        id: texteNonVide(o.id, 80), horodatage: dateTexte(o.horodatage), action: texteNonVide(o.action, 80), libelle: texteNonVide(o.libelle, 200),
        acteurEmail: texteOuNull(o.acteurEmail, 200), auteur: texteNonVide(o.auteur, 200), cibleType: texteNonVide(o.cibleType, 60),
        cibleId: texte(o.cibleId, 80), cible: texteNonVide(o.cible, 300), cibleUrl: texteOuNull(o.cibleUrl, 500), motif: texteOuNull(o.motif, 300),
      };
    }),
  };
}

const NIVEAUX: readonly NiveauAttente[] = ['region', 'prefecture', 'commune', 'quartier'];
export function lireZonesAttente(v: Record<string, unknown>): { zones: ZoneAttenteEquipe[]; illisibles: number } {
  if (v.ok !== true || !Array.isArray(v.zones) || v.zones.length > 1000) return invalide();
  const zones: ZoneAttenteEquipe[] = []; let illisibles = 0;
  for (const x of v.zones) {
    try {
      const o = objet(x);
      if (typeof o.niveau !== 'string' || !(NIVEAUX as readonly string[]).includes(o.niveau)) return invalide();
      zones.push({
        niveau: o.niveau as NiveauAttente, id: identifiant(o.id), nom: texteNonVide(o.nom, 200), contexte: texte(o.contexte, 300),
        personnes: entier(o.personnes, 1_000_000), prevenues: entier(o.prevenues, 1_000_000), derniere: dateTexte(o.derniere),
      });
    } catch { illisibles++; }
  }
  return { zones, illisibles };
}
/** Personnes d'une zone pas encore prévenues (jamais négatif). */
export function nonPrevenues(personnes: number, prevenues: number): number { return Math.max(0, personnes - prevenues); }
/** La zone peut-elle encore être marquée comme prévenue ? */
export function zoneAMarquerPrevenue(personnes: number, prevenues: number): boolean { return nonPrevenues(personnes, prevenues) > 0; }

export function lireMisesAJourEquipe(v: Record<string, unknown>): MisesAJourEquipe {
  if (v.ok !== true) return invalide();
  const ver = objet(v.version);
  if (!Array.isArray(v.fonctionnalites) || v.fonctionnalites.length > 200 || !Array.isArray(v.misesAJour) || v.misesAJour.length > 500) return invalide();
  let annonce: MisesAJourEquipe['annonce'] = null;
  if (v.annonce !== null && v.annonce !== undefined) {
    const a = objet(v.annonce);
    annonce = {
      versionCode: entier(a.versionCode, 1_000_000_000), versionNom: texteNonVide(a.versionNom, 40), annonceeLe: dateTexte(a.annonceeLe),
      appareils: entier(a.appareils, 1_000_000_000), envoyes: entier(a.envoyes, 1_000_000_000),
    };
  }
  return {
    version: { code: entier(ver.code, 1_000_000_000), nom: texteNonVide(ver.nom, 40), notes: texte(ver.notes, 2000) },
    appareils: entier(v.appareils, 1_000_000_000),
    annonce,
    fonctionnalites: v.fonctionnalites.map(x => {
      const o = objet(x);
      return {
        cle: texteNonVide(o.cle, 80), libelle: texteNonVide(o.libelle, 200), description: texte(o.description, 1000),
        groupe: texte(o.groupe, 120), active: booleen(o.active), miseAJourLe: dateTexte(o.miseAJourLe),
      };
    }),
    misesAJour: v.misesAJour.map(x => {
      const o = objet(x);
      return {
        id: texteNonVide(o.id, 80), date: texteNonVide(o.date, 40), titre: texteNonVide(o.titre, 200), resume: texte(o.resume, 2000),
        verification: texte(o.verification, 2000), cle: texteOuNull(o.cle, 80), active: booleenOuNull(o.active),
        raisonSansInterrupteur: texteOuNull(o.raisonSansInterrupteur, 500), groupe: texte(o.groupe, 120),
      };
    }),
  };
}
