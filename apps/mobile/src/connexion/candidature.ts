import { normaliserTelephone } from '../../../../packages/shared/src/commande/telephone.ts';

/**
 * Candidature « J'ai un restaurant » (parité Kotlin, lot 4, ligne B12) : dépôt d'une demande de référencement depuis l'application,
 * mêmes règles que le serveur (qui revérifie tout). Le brouillon reste sur le téléphone tant que la demande n'est pas envoyée ;
 * le corps envoyé ne porte jamais l'e-mail, la commune ni le nom du quartier — le serveur les retrouve par l'identifiant du quartier.
 * Routes DU SITE, comme l'ancienne appli : `GET/POST /api/v1/candidature`, `POST /candidature/image`, `POST /candidature/menu-photo`.
 */
export const MOYENS_PAIEMENT_CANDIDATURE: ReadonlyArray<{ valeur: string; libelle: string }> = [
  { valeur: 'especes', libelle: 'Espèces' }, { valeur: 'orange_money', libelle: 'Orange Money' }, { valeur: 'mtn_momo', libelle: 'MTN MoMo' },
];
export const SERVICES_CANDIDATURE: ReadonlyArray<{ valeur: string; libelle: string }> = [
  { valeur: 'livraison', libelle: 'Livraison' }, { valeur: 'retrait', libelle: 'Retrait' }, { valeur: 'sur_place', libelle: 'Sur place' },
];
export const PRIX_PLAT_MIN_GNF = 100;
export const PRIX_PLAT_MAX_GNF = 1_000_000;
export const MAX_PLATS_CANDIDATURE = 80;

export interface PlatCandidature { nom: string; prix: number }
export interface BrouillonCandidature {
  nom: string; quartierId: string; indications: string; telephone: string;
  prenom: string; nomResponsable: string; categories: string; horaires: string;
  moyensPaiement: string[]; services: string[]; plats: PlatCandidature[];
}
export function brouillonVide(): BrouillonCandidature {
  return {
    nom: '', quartierId: '', indications: '', telephone: '', prenom: '', nomResponsable: '', categories: '', horaires: '',
    moyensPaiement: [], services: ['livraison', 'retrait'], plats: [],
  };
}

/** Le message d'erreur d'une étape, ou null si elle est complète (étapes 0 et 1 seulement, comme l'ancienne appli ; le serveur revérifie). */
export function erreurEtapeCandidature(etape: number, b: BrouillonCandidature): string | null {
  if (etape === 0) {
    if (b.nom.trim().length < 2) return 'Indiquez le nom de votre restaurant.';
    if (b.quartierId.trim() === '') return 'Choisissez le quartier de votre restaurant.';
    if (b.prenom.trim() === '' || b.nomResponsable.trim() === '') return 'Indiquez votre prénom et votre nom.';
    if (normaliserTelephone(b.telephone) === null) return 'Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (par exemple 622 12 34 56).';
    return null;
  }
  if (etape === 1) {
    if (b.horaires.trim().length < 3) return 'Indiquez vos horaires (par exemple : tous les jours, 9h à 22h).';
    if (b.services.length === 0) return 'Choisissez au moins un service : livraison, retrait ou sur place.';
    return null;
  }
  return null;
}

/** Prix saisi (« 25 000 », « 25000 ») en GNF entier, ou null. Jamais de décimale. */
export function lirePrixPlat(texte: string): number | null {
  if (typeof texte !== 'string') return null;
  const chiffres = texte.replace(/\s/g, '');
  if (chiffres === '' || !/^[0-9]+$/.test(chiffres) || chiffres.length > 9) return null;
  const n = Number(chiffres);
  return Number.isSafeInteger(n) && n >= PRIX_PLAT_MIN_GNF && n <= PRIX_PLAT_MAX_GNF ? n : null;
}

/** Ajoute un plat au brouillon, ou dit pourquoi pas (le brouillon d'origine n'est jamais modifié). */
export function ajouterPlatCandidature(b: BrouillonCandidature, nom: string, prixTexte: string): { brouillon: BrouillonCandidature | null; erreur: string | null } {
  const n = typeof nom === 'string' ? nom.trim() : '';
  const prix = lirePrixPlat(prixTexte);
  if (n.length < 2) return { brouillon: null, erreur: 'Indiquez le nom du plat (2 caractères au moins).' };
  if (prix === null) return { brouillon: null, erreur: 'Indiquez un prix en GNF, entier, entre ' + PRIX_PLAT_MIN_GNF + ' et ' + PRIX_PLAT_MAX_GNF + '.' };
  if (b.plats.length >= MAX_PLATS_CANDIDATURE) return { brouillon: null, erreur: 'Vous pouvez ajouter ' + MAX_PLATS_CANDIDATURE + ' plats ici : l’équipe complétera le reste avec vous.' };
  return { brouillon: { ...b, plats: [...b.plats, { nom: n, prix }] }, erreur: null };
}

/** Corps envoyé au serveur : jamais l'e-mail, la commune ni le nom du quartier. */
export function corpsCandidature(b: BrouillonCandidature): Record<string, unknown> {
  return {
    nom: b.nom.trim(), quartierId: b.quartierId, indications: b.indications.trim(), categories: b.categories.trim(), horaires: b.horaires.trim(),
    telephone: normaliserTelephone(b.telephone) ?? b.telephone,
    responsable: { prenom: b.prenom.trim(), nom: b.nomResponsable.trim() },
    moyensPaiement: [...b.moyensPaiement], services: [...b.services],
    plats: b.plats.map(p => ({ nom: p.nom, prix: p.prix })),
  };
}

/** Erreur d'un appel candidature : `refus` = rien n'a été enregistré ; `incertain` = l'envoi a pu être enregistré (jamais de relance automatique). */
export class ErreurCandidature extends Error {
  readonly genre: 'refus' | 'incertain';
  constructor(genre: 'refus' | 'incertain', message: string) { super(message); this.name = 'ErreurCandidature'; this.genre = genre; }
}

// ---------- demande lue ----------
export type EtatCandidature = 'recue' | 'en_cours' | 'acceptee' | 'creee' | 'refusee';
const ETATS: readonly EtatCandidature[] = ['recue', 'en_cours', 'acceptee', 'creee', 'refusee'];
export interface VueCandidature {
  id: string; etat: EtatCandidature; libelleEtat: string; nom: string; deposeeLe: string;
  delaiHeures: number; reponseAttendueLe: string | null; motifRefus: string | null;
  aLogo: boolean; aPhoto: boolean; nombrePlats: number;
}
function invalide(): never { throw Error('CANDIDATURE_ILLISIBLE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || v.length > max) return invalide(); return v; }
function texteOuNull(v: unknown, max: number): string | null { return v === null || v === undefined ? null : texte(v, max); }
function entier(v: unknown, max: number): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max) return invalide(); return v; }

/** La demande du compte, relue strictement ; `null` = pas de demande. */
export function lireVueCandidature(v: Record<string, unknown>): VueCandidature | null {
  if (v.ok !== true) return invalide();
  if (v.candidature === null) return null;
  const c = objet(v.candidature);
  if (typeof c.etat !== 'string' || !(ETATS as readonly string[]).includes(c.etat)) return invalide();
  if (typeof c.aLogo !== 'boolean' || typeof c.aPhoto !== 'boolean') return invalide();
  const deposeeLe = texte(c.deposeeLe, 40);
  if (!Number.isFinite(Date.parse(deposeeLe))) return invalide();
  return {
    id: texte(c.id, 80), etat: c.etat as EtatCandidature, libelleEtat: texte(c.libelleEtat, 120), nom: texte(c.nom, 200), deposeeLe,
    delaiHeures: entier(c.delaiHeures, 24 * 30), reponseAttendueLe: texteOuNull(c.reponseAttendueLe, 40), motifRefus: texteOuNull(c.motifRefus, 500),
    aLogo: c.aLogo, aPhoto: c.aPhoto, nombrePlats: entier(c.nombrePlats, MAX_PLATS_CANDIDATURE),
  };
}

// ---------- lecture d'une photo de menu ----------
export interface PlatRefuseLu { brut: string; raison: string }
export interface LectureMenu { plats: PlatCandidature[]; refuses: PlatRefuseLu[]; etat: string }
const ETATS_LECTURE: readonly string[] = ['plats', 'vide', 'indetermine'];

/**
 * Lecture renvoyée par le serveur pour une photo de menu, relue comme lui : un plat au prix hors limites part dans les refusés
 * (même raison que le site), pour que la personne le corrige avant de l'ajouter. Rien n'est conservé côté serveur.
 */
export function lireLectureMenu(v: Record<string, unknown>): LectureMenu {
  if (v.ok !== true) return invalide();
  const l = objet(v.lecture);
  if (typeof l.etat !== 'string' || !ETATS_LECTURE.includes(l.etat)) return invalide();
  if (!Array.isArray(l.plats) || l.plats.length > MAX_PLATS_CANDIDATURE || !Array.isArray(l.refuses) || l.refuses.length > MAX_PLATS_CANDIDATURE) return invalide();
  const plats: PlatCandidature[] = [];
  const refuses: PlatRefuseLu[] = l.refuses.map(x => {
    const o = objet(x);
    return { brut: texte(o.brut, 300), raison: texte(o.raison, 300) };
  });
  for (const x of l.plats) {
    const o = objet(x);
    const nom = texte(o.nom, 120).trim();
    const prix = o.prix;
    if (typeof prix !== 'number' || !Number.isSafeInteger(prix) || prix < PRIX_PLAT_MIN_GNF || prix > PRIX_PLAT_MAX_GNF) {
      refuses.push({ brut: nom + ' (' + String(prix) + ' GNF)', raison: 'prix hors limites (' + PRIX_PLAT_MIN_GNF + ' à ' + PRIX_PLAT_MAX_GNF + ' GNF)' });
      continue;
    }
    if (nom.length < 2) { refuses.push({ brut: nom, raison: 'nom trop court' }); continue; }
    plats.push({ nom, prix });
  }
  return { plats, refuses, etat: l.etat };
}

export interface LigneProposee { nom: string; prix: string; coche: boolean }
/** Les lignes proposées après la lecture d'une photo : cochées par défaut, prix encore en texte pour pouvoir corriger. */
export function lignesProposees(lecture: LectureMenu): LigneProposee[] {
  return lecture.plats.map(p => ({ nom: p.nom, prix: String(p.prix), coche: true }));
}

/** Ajoute au brouillon les lignes cochées, après les mêmes contrôles qu'une saisie à la main. Une seule ligne invalide : rien n'est ajouté et la ligne est nommée. */
export function ajouterLignesCochees(b: BrouillonCandidature, lignes: LigneProposee[]): { brouillon: BrouillonCandidature | null; erreur: string | null } {
  let courant = b;
  const cochees = lignes.filter(l => l.coche);
  for (let i = 0; i < cochees.length; i++) {
    const l = cochees[i];
    const r = ajouterPlatCandidature(courant, l.nom, l.prix);
    if (r.brouillon === null) return { brouillon: null, erreur: 'Ligne ' + (lignes.indexOf(l) + 1) + ' (' + (l.nom.trim() || 'sans nom') + ') : ' + r.erreur };
    courant = r.brouillon;
  }
  return { brouillon: courant, erreur: null };
}
