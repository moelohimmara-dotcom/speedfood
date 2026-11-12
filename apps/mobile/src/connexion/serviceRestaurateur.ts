import { HORAIRES_MAX, lireActionMenuApp, lireReglagesApp, lireStatutApp, type ChampStatutApp, type OptionAEcrire, type PlatAEcrire, type ReglagesAEcrire } from '../../../../packages/shared/src/contracts/restaurant-service.ts';
import { DESCRIPTION_PLAT_MAX, NOM_OPTION_MAX, NOM_PLAT_MAX, PRIX_PLAT_PLAFOND_GNF, REGLES_MENU_PLAFONNEES } from '../../../../packages/shared/src/menu/regles-plat.ts';
import { CHEMIN_PHOTO_APP, PHOTO_TAILLE_MAX_OCTETS, lireDemandePhotoApp } from '../../../../packages/shared/src/contracts/restaurant-photo.ts';
import { lireDelaiPreparation } from '../../../../packages/shared/src/commande/estimation.ts';
import { ancienneteLisible } from '../../../../packages/shared/src/disponibilite/etat.ts';
import type { RaisonSecuriteCompte } from '../../../../packages/shared/src/contracts/restaurant-commandes.ts';
import { ErreurRestaurateur, MESSAGE_SECURITE } from './restaurateur.ts';

export { HORAIRES_MAX };

/**
 * Domaine pur des lots D4a et D4b : le SERVICE du restaurateur (ouvert, prend des commandes, horaires, délai de préparation), la DISPONIBILITÉ de ses plats (marquer disponible ou indisponible,
 * confirmer, tout confirmer), depuis D4b la création, la modification et l'archivage d'un plat, l'ajout et le retrait d'un supplément et, depuis D4c, la PHOTO d'un plat (envoyer, remplacer, retirer). Pas de documents.
 *
 * Même discipline que `restaurateur.ts` : UN SEUL essai par action, jamais de relance automatique ; après une réponse incertaine, les boutons restent verrouillés tant que l'état du serveur n'a pas
 * été relu avec succès ; les messages sont fixes (aucun texte du serveur n'est affiché) ; aucun jeton n'est conservé ; l'écran affiche ce que le SERVEUR a (jamais une valeur supposée).
 */

// ---------- sections de l'espace restaurateur ----------
export type SectionRestaurateur = 'commandes' | 'service' | 'menu' | 'historique';
export const SECTIONS_RESTAURATEUR: readonly SectionRestaurateur[] = ['commandes', 'service', 'menu', 'historique'];
export const LIBELLES_SECTIONS: Record<SectionRestaurateur, string> = { commandes: 'Commandes', service: 'Service', menu: 'Menu', historique: 'Historique' };
/** On ne change pas de section pendant un envoi ou une relecture (commandes OU service), pour que le verdict reste devant les yeux. */
export function peutChangerDeSection(occupeCommandes: boolean, occupeService: boolean): boolean { return !occupeCommandes && !occupeService; }

// ---------- lecture stricte ----------
function invalide(): never { throw Error('LECTURE_SERVICE_INVALIDE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function booleen(v: unknown): boolean { if (typeof v !== 'boolean') return invalide(); return v; }
const REGEX_UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const estUuid = (v: unknown): v is string => typeof v === 'string' && REGEX_UUID.test(v);
/** Nom d'un plat : tolérant (sauts de ligne et tabulations deviennent des espaces ; contrôles et marques de direction retirés) ; vide ou absent = pas de nom lisible. */
function nomLisible(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || v.length > max) return null;
  let s = '';
  for (const ch of v) {
    const k = ch.codePointAt(0) ?? 0;
    if (k === 9 || k === 10 || k === 13) s += ' ';
    else if (k < 32 || (k >= 127 && k <= 159) || k === 0x200e || k === 0x200f || (k >= 0x202a && k <= 0x202e) || (k >= 0x2066 && k <= 0x2069)) continue;
    else s += ch;
  }
  s = s.split(' ').filter(m => m.length > 0).join(' ');
  return s.length > 0 ? s : null;
}
/** Horaires : texte libre sur plusieurs lignes (les sauts de ligne sont conservés), sans caractère de contrôle ni marque de direction. */
function horairesLisibles(v: unknown): string {
  if (typeof v !== 'string' || v.length > 5000) return invalide();
  let s = '';
  for (const ch of v) {
    const k = ch.codePointAt(0) ?? 0;
    if (k === 13) continue;
    if (k === 10 || k === 9) s += k === 10 ? '\n' : ' ';
    else if (k < 32 || (k >= 127 && k <= 159) || k === 0x200e || k === 0x200f || (k >= 0x202a && k <= 0x202e) || (k >= 0x2066 && k <= 0x2069)) continue;
    else s += ch;
  }
  return s;
}
function dateOuNull(v: unknown): string | null { return typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : null; }

export interface PlatAReconfirmerRestaurateur { id: string; nom: string; confirmeLe: string | null }
export interface ReglagesRestaurateur {
  horaires: string; ouvert: boolean; accepteCommandes: boolean; delaiPreparationMinutes: number | null;
  /** Plats à reconfirmer : la liste du SERVEUR (règle du serveur), jamais recalculée ici. */
  platsAReconfirmer: PlatAReconfirmerRestaurateur[];
  /** Entrées de la liste « à reconfirmer » reçues mais illisibles (écartées une à une, comptées). */
  illisibles: number;
}

/**
 * Lecture STRICTE de `GET /api/v1/restaurant/reglages` : une structure d'ensemble invalide (statut non booléen, horaires non texte, délai hors 5 à 240) refuse tout ; une entrée atypique de
 * la liste « à reconfirmer » n'écarte QUE cette entrée (comptée dans `illisibles`).
 */
export function lireReglagesRestaurateur(v: Record<string, unknown>): ReglagesRestaurateur {
  if (v.ok !== true || !Array.isArray(v.platsAReconfirmer) || v.platsAReconfirmer.length > 600) return invalide();
  const d = v.delaiPreparationMinutes;
  if (d !== null && (typeof d !== 'number' || !Number.isSafeInteger(d) || d < 5 || d > 240)) return invalide();
  const ids = new Set<string>(); const plats: PlatAReconfirmerRestaurateur[] = []; let illisibles = 0;
  for (const x of v.platsAReconfirmer) {
    try {
      const o = objet(x); const nom = nomLisible(o.nom, 200);
      if (!estUuid(o.id) || ids.has(o.id) || nom === null) return invalide();
      ids.add(o.id); plats.push({ id: o.id, nom, confirmeLe: dateOuNull(o.confirmeLe) });
    } catch { illisibles++; }
  }
  return { horaires: horairesLisibles(v.horaires), ouvert: booleen(v.ouvert), accepteCommandes: booleen(v.accepteCommandes), delaiPreparationMinutes: d as number | null, platsAReconfirmer: plats, illisibles };
}

export interface OptionRestaurateur { id: string; nom: string; prixGnf: number }
/** Ce qu'il faut renvoyer tel quel à la modification d'un plat (le serveur remplace les cinq champs ; une valeur absente effacerait l'ancienne). */
export interface EditionPlat { description: string; prixPromoGnf: number | null; sectionId: string | null }
export interface PlatRestaurateur {
  id: string; nom: string;
  /** Prix en GNF (entier) ; null si le serveur ne l'a pas donné lisiblement (la ligne reste lisible). */
  prixGnf: number | null; disponible: boolean;
  /** Dernière confirmation de disponibilité ; null = jamais confirmée (ou date illisible : un état inconnu ne devient jamais « disponible confirmé »). */
  confirmeLe: string | null;
  /** Suppléments lisibles du plat ; un supplément atypique est écarté ET compté (`optionsIllisibles`), jamais tout le plat. */
  options: OptionRestaurateur[]; optionsIllisibles: number;
  /** Description, prix promo et section tels que le serveur les a ; `null` = un de ces champs est illisible ou le prix l'est : le plat reste visible mais ne se modifie pas ici (rien n'est écrasé à l'aveugle). */
  edition: EditionPlat | null;
  /** Lot D4c. `photoRef` = ce que le serveur a (une adresse, ou null = pas de photo) : sert à COMPARER avant/après, jamais affichée. `photoUrl` = l'adresse à afficher (https seulement) ; null si absente ou illisible. */
  photoRef: string | null; photoUrl: string | null;
}
export interface MenuRestaurateur {
  plats: PlatRestaurateur[];
  /** Plats reçus mais atypiques (sans nom lisible, sans état de disponibilité, identifiant invalide ou répété) : écartés un à un, comptés, jamais en silence. */
  illisibles: number;
}

/** Lecture STRICTE de `GET /api/v1/restaurant/menu`. Seuls les champs affichés sont retenus ; un plat atypique n'écarte QUE lui-même (comptée). */
export function lireMenuRestaurateur(v: Record<string, unknown>): MenuRestaurateur {
  if (v.ok !== true || !Array.isArray(v.plats) || v.plats.length > 700) return invalide();
  const ids = new Set<string>(); const plats: PlatRestaurateur[] = []; let illisibles = 0;
  for (const x of v.plats) {
    try {
      const o = objet(x); const nom = nomLisible(o.nom, 200);
      if (!estUuid(o.id) || ids.has(o.id) || nom === null || typeof o.disponible !== 'boolean') { illisibles++; continue; }
      ids.add(o.id);
      const prixGnf = entierGnf(o.prix);
      const { options, illisibles: optionsIllisibles } = lireOptions(o.options);
      plats.push({ id: o.id, nom, prixGnf, disponible: o.disponible, confirmeLe: dateOuNull(o.confirmeLe), options, optionsIllisibles, edition: lireEdition(o, prixGnf), ...lirePhoto(o.photoUrl) });
    } catch { illisibles++; }
  }
  return { plats, illisibles };
}
/** Photo d'un plat : une valeur absente, non textuelle ou illisible n'invalide JAMAIS le plat (pas de photo affichée). Seule une adresse https sans espace ni contrôle est affichée. */
function lirePhoto(v: unknown): { photoRef: string | null; photoUrl: string | null } {
  if (typeof v !== 'string' || v.length === 0 || v.length > 2048) return { photoRef: null, photoUrl: null };
  return { photoRef: v, photoUrl: /^https:\/\/[^\s\x00-\x1f\x7f]+$/.test(v) ? v : null };
}
function entierGnf(v: unknown): number | null { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null; }
/** Suppléments d'un plat : un supplément atypique (identifiant invalide ou répété, nom illisible, prix illisible) est écarté et compté. */
function lireOptions(v: unknown): { options: OptionRestaurateur[]; illisibles: number } {
  if (!Array.isArray(v)) return { options: [], illisibles: 0 };
  const ids = new Set<string>(); const options: OptionRestaurateur[] = []; let illisibles = 0;
  for (const x of v.slice(0, 100)) {
    const o = x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null;
    const nom = o ? nomLisible(o.nom, 200) : null; const prix = o ? entierGnf(o.prix) : null;
    if (!o || !estUuid(o.id) || ids.has(o.id) || nom === null || prix === null) { illisibles++; continue; }
    ids.add(o.id); options.push({ id: o.id, nom, prixGnf: prix });
  }
  if (v.length > 100) illisibles += v.length - 100;
  return { options, illisibles };
}
function lireEdition(o: Record<string, unknown>, prixGnf: number | null): EditionPlat | null {
  const description = o.description === null || o.description === undefined ? '' : typeof o.description === 'string' && o.description.length <= DESCRIPTION_PLAT_MAX ? o.description : null;
  const promo = o.prixPromo === null || o.prixPromo === undefined ? null : entierGnf(o.prixPromo);
  const section = o.sectionId === null || o.sectionId === undefined ? null : estUuid(o.sectionId) ? o.sectionId : undefined;
  if (prixGnf === null || description === null || (o.prixPromo !== null && o.prixPromo !== undefined && promo === null) || section === undefined) return null;
  return { description: description.trim(), prixPromoGnf: promo, sectionId: section };
}

/** Lignes d'un plat à afficher. La fraîcheur affichée n'est qu'une ancienneté : « à reconfirmer » vient de la liste du serveur (`ids`), jamais d'un calcul d'ici. */
export function libelleDisponibilitePlat(p: PlatRestaurateur, aReconfirmer: ReadonlySet<string>, maintenant: Date): { etat: string; confirmation: string | null } {
  if (!p.disponible) return { etat: 'Indisponible', confirmation: null };
  const confirmation = p.confirmeLe ? 'Confirmée ' + ancienneteLisible(new Date(p.confirmeLe), maintenant) : 'Jamais confirmée';
  return { etat: aReconfirmer.has(p.id) ? 'Disponible · à reconfirmer' : 'Disponible', confirmation };
}
export function formaterPrix(n: number | null): string | null { return n === null ? null : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' GNF'; }

// ---------- réglages : saisie ----------
export interface BrouillonReglages { horaires: string; delai: string }
export interface ErreursReglages { horaires?: string; delai?: string; general?: string }
export function brouillonDe(r: Pick<ReglagesRestaurateur, 'horaires' | 'delaiPreparationMinutes'>): BrouillonReglages { return { horaires: r.horaires, delai: r.delaiPreparationMinutes === null ? '' : String(r.delaiPreparationMinutes) }; }
/** La saisie du délai : chiffres seulement (tout le reste est retiré), 3 chiffres au plus. */
export function chiffresSeulement(saisie: unknown): string { return typeof saisie === 'string' ? saisie.replace(/[^0-9]/g, '').slice(0, 3) : ''; }
export function brouillonModifie(r: Pick<ReglagesRestaurateur, 'horaires' | 'delaiPreparationMinutes'>, b: BrouillonReglages): boolean {
  const ref = brouillonDe(r); return ref.horaires !== b.horaires || ref.delai !== b.delai;
}
export const MESSAGE_HORAIRES_TROP_LONGS = HORAIRES_MAX + ' caractères au maximum.';
/**
 * Valide la saisie AVANT tout envoi. Mêmes règles que le serveur : horaires de 500 caractères au plus, délai vide (rien n'est annoncé au client) ou entier de 5 à 240 minutes
 * (`lireDelaiPreparation`, la fonction du serveur). Seuls les champs CHANGÉS sont envoyés (on n'écrase pas ce qu'un autre membre a modifié depuis le site). Une saisie invalide ne produit JAMAIS de valeurs.
 */
export function preparerReglages(actuel: Pick<ReglagesRestaurateur, 'horaires' | 'delaiPreparationMinutes'>, b: BrouillonReglages): { ok: true; valeurs: ReglagesAEcrire } | { ok: false; erreurs: ErreursReglages } {
  const erreurs: ErreursReglages = {};
  if (typeof b.horaires !== 'string' || b.horaires.length > HORAIRES_MAX) erreurs.horaires = MESSAGE_HORAIRES_TROP_LONGS;
  const delai = lireDelaiPreparation(typeof b.delai === 'string' ? b.delai : null);
  if (!delai.ok || typeof b.delai !== 'string') erreurs.delai = 'Indiquez le délai en minutes, de 5 à 240, en chiffres seulement (ou laissez vide).';
  if (erreurs.horaires || erreurs.delai || !delai.ok) return { ok: false, erreurs };
  const valeurs: ReglagesAEcrire = {};
  // Le texte envoyé est celui que le serveur renverra (même nettoyage que la lecture : tabulations, retours chariot, marques de direction) : sinon un horaire enregistré paraîtrait « différent » à la relecture.
  const horaires = typeof b.horaires === 'string' && b.horaires.length <= HORAIRES_MAX ? horairesLisibles(b.horaires) : '';
  if (horaires !== actuel.horaires) valeurs.horaires = horaires;
  if (delai.valeur !== actuel.delaiPreparationMinutes) valeurs.delaiPreparationMinutes = delai.valeur;
  if (Object.keys(valeurs).length === 0) return { ok: false, erreurs: { general: 'Rien n’a changé : modifiez les horaires ou le délai avant d’enregistrer.' } };
  // Dernier garde-fou : le contrôle partagé avec le serveur, pour que ce qui part soit exactement ce que le serveur accepte.
  const lu = lireReglagesApp(valeurs, lireDelaiPreparation);
  if (!lu.ok) return { ok: false, erreurs: { general: lu.message } };
  return { ok: true, valeurs: lu.valeurs };
}

// ---------- actions ----------
export type ActionService =
  | { type: 'statut'; champ: ChampStatutApp; valeur: boolean }
  | { type: 'reglages'; valeurs: ReglagesAEcrire }
  | { type: 'disponibilite'; platId: string; disponible: boolean }
  | { type: 'confirmer'; platId: string; avant: string | null }
  | { type: 'confirmer_tout'; avant: Array<[string, string | null]> }
  /** Lot D4b. `avant` = les identifiants déjà présents : pour reconnaître le NOUVEAU plat (ou supplément) à la relecture, sans jamais en recréer un second sur une supposition. */
  | { type: 'creer'; plat: PlatAEcrire; avant: string[] }
  | { type: 'modifier'; platId: string; plat: PlatAEcrire }
  | { type: 'archiver'; platId: string; nom: string }
  | { type: 'option_ajouter'; platId: string; option: OptionAEcrire; avant: string[] }
  | { type: 'option_retirer'; optionId: string; platId: string; nom: string }
  /** Lot D4c. `avant` = la photo que le serveur avait (`photoRef`) : l'envoi est confirmé quand la relecture montre une photo DIFFÉRENTE ; le retrait, quand elle montre « aucune ». */
  | { type: 'photo_definir'; platId: string; avant: string | null; fichier: FichierPhotoPrete }
  | { type: 'photo_retirer'; platId: string; nom: string };

/** Les actions qui demandent une confirmation avant l'envoi : les deux interrupteurs (dans les deux sens), « Tout confirmer », l'archivage d'un plat, le retrait d'un supplément et le retrait d'une photo. */
export function actionAConfirmer(a: ActionService): boolean { return a.type === 'statut' || a.type === 'confirmer_tout' || a.type === 'archiver' || a.type === 'option_retirer' || a.type === 'photo_retirer'; }

/**
 * La photo PRÉPARÉE par l'application (réduite, en JPEG) : la seule forme qui part au réseau. `size` en octets (5 Mo au plus), `type` toujours JPEG, `nom` fixe : le nom du fichier du téléphone n'est jamais envoyé.
 */
export interface FichierPhotoPrete { uri: string; size: number; type: 'image/jpeg'; nom: 'photo.jpg' }
export function fichierPhotoPret(f: unknown): f is FichierPhotoPrete {
  if (!f || typeof f !== 'object') return false;
  const x = f as Record<string, unknown>;
  return typeof x.uri === 'string' && x.uri.length > 0 && x.uri.length <= 2048 && !/[\x00-\x1f\x7f]/.test(x.uri) && x.type === 'image/jpeg' && x.nom === 'photo.jpg'
    && typeof x.size === 'number' && Number.isSafeInteger(x.size) && x.size > 0 && x.size <= PHOTO_TAILLE_MAX_OCTETS;
}
export function actionPhotoDefinir(p: Pick<PlatRestaurateur, 'id' | 'photoRef'>, fichier: FichierPhotoPrete): ActionService { return { type: 'photo_definir', platId: p.id, avant: p.photoRef, fichier }; }
export function actionPhotoRetirer(p: Pick<PlatRestaurateur, 'id' | 'nom'>): ActionService { return { type: 'photo_retirer', platId: p.id, nom: p.nom }; }

/** Quel état du serveur une action change : les réglages (interrupteurs, horaires, délai) ou le menu (plats, suppléments). Sert à verrouiller sur la relecture de CET état-là. */
export function etatConcerne(a: ActionService): 'reglages' | 'menu' { return a.type === 'statut' || a.type === 'reglages' ? 'reglages' : 'menu'; }
/** Compteurs de lectures RÉUSSIES, un par état : la relecture du menu ne déverrouille jamais une action sur les réglages, et inversement (correctif D4a m-1). */
export interface Lectures { reglages: number; menu: number }
/** Le compteur à comparer pour l'état courant de la machine : celui de l'action en cours ou du verdict (le menu au repos). */
export function lecturePourEtat(etat: EtatService, l: Lectures): number { return etat.phase === 'repos' ? l.menu : l[etatConcerne(etat.action)]; }
export function lecturePourAction(a: ActionService, l: Lectures): number { return l[etatConcerne(a)]; }
/** Lot D4c : une photo peut PARTIR seulement si aucun envoi ni aucune lecture n'est en cours et si l'écran n'est pas verrouillé (réponse incertaine sans relecture réussie). Contrôlé avant d'ouvrir le sélecteur ET après le choix (un autre changement a pu démarrer entre-temps). */
export function photoPeutPartir(envoiEnCours: boolean, lectureEnCours: boolean, etat: EtatService, lectures: Lectures): boolean { return !envoiEnCours && !lectureEnCours && !serviceVerrouille(etat, lecturePourEtat(etat, lectures)); }

/** Les deux interrupteurs ne se confondent jamais : chaque champ a son texte, son sens et sa colonne. */
export function actionStatut(champ: ChampStatutApp, valeur: boolean): ActionService { return { type: 'statut', champ, valeur }; }
export function actionConfirmerTout(menu: Pick<MenuRestaurateur, 'plats'>): ActionService { return { type: 'confirmer_tout', avant: menu.plats.filter(p => p.disponible).map(p => [p.id, p.confirmeLe] as [string, string | null]) }; }

// ---------- plats et suppléments : saisie (lot D4b) ----------
export interface BrouillonPlat { nom: string; prix: string; description: string }
export interface ErreursPlat { nom?: string; prix?: string; description?: string; general?: string }
export const BROUILLON_PLAT_VIDE: BrouillonPlat = { nom: '', prix: '', description: '' };
export interface BrouillonOption { nom: string; prix: string }
export interface ErreursOption { nom?: string; prix?: string; general?: string }
export const BROUILLON_OPTION_VIDE: BrouillonOption = { nom: '', prix: '' };
export const MESSAGE_PRIX_INVALIDE = 'Indiquez le prix en francs guinéens, en chiffres entiers (par exemple 25 000). Pas de virgule ni de lettres.';

/**
 * Lit un prix saisi : des chiffres, éventuellement séparés par des espaces (milliers). Virgule, point, signe, lettres, vide : refusés (`null`). Jamais de décimal, jamais NaN ni Infinity.
 * Plafond : celui que la base impose au réglage du prix maximum (10 000 000) ; le serveur applique le réglage en vigueur, qui peut être plus bas.
 */
export function prixDepuisSaisie(saisie: unknown): number | null {
  if (typeof saisie !== 'string' || saisie.length > 24) return null;
  const compact = saisie.replace(/[   ]/g, '');
  if (!/^\d{1,9}$/.test(compact)) return null;
  const n = Number(compact);
  return Number.isSafeInteger(n) && n <= PRIX_PLAT_PLAFOND_GNF ? n : null;
}
/** Texte de saisie d'un prix pour l'affichage dans un champ : chiffres seulement (le groupement par espaces est accepté en saisie, jamais imposé). */
export function saisiePrix(n: number | null): string { return n === null ? '' : String(n); }

/** Le formulaire de modification démarre avec ce que le SERVEUR a pour ce plat ; `null` si le plat n'est pas modifiable ici (champs illisibles ou prix inconnu). */
export function brouillonPlatDe(p: PlatRestaurateur): BrouillonPlat | null {
  return p.edition === null || p.prixGnf === null ? null : { nom: p.nom, prix: saisiePrix(p.prixGnf), description: p.edition.description };
}
export function brouillonPlatModifie(p: PlatRestaurateur, b: BrouillonPlat): boolean { const ref = brouillonPlatDe(p); return ref === null || ref.nom !== b.nom || ref.prix !== b.prix || ref.description !== b.description; }

/**
 * Valide la saisie d'un plat AVANT tout envoi, avec les règles du serveur (`regles-plat.ts`, partagées) : nom obligatoire, prix entier en GNF, description facultative. En création, le plat n'a ni promo
 * ni section ; en modification, le prix promo et la section ACTUELS du serveur sont renvoyés tels quels (sinon le serveur les effacerait). Une saisie invalide ne produit JAMAIS d'action.
 */
export function preparerPlat(b: BrouillonPlat, cible: { mode: 'creer'; menu: Pick<MenuRestaurateur, 'plats'> } | { mode: 'modifier'; plat: PlatRestaurateur }): { ok: true; action: ActionService } | { ok: false; erreurs: ErreursPlat } {
  if (b === null || typeof b !== 'object') return { ok: false, erreurs: { general: 'Cette saisie n’est pas valide. Corrigez-la puis recommencez.' } };
  const erreurs: ErreursPlat = {};
  // Le texte envoyé est celui que le serveur renverra à la relecture (même nettoyage que la lecture) : sinon un plat bien enregistré paraîtrait « différent ».
  const nom = typeof b.nom === 'string' ? nomLisible(b.nom, 1000) ?? '' : '';
  if (nom.length === 0 || nom.length > NOM_PLAT_MAX) erreurs.nom = nom.length === 0 ? 'Le nom du plat est obligatoire.' : 'Le nom du plat est limité à ' + NOM_PLAT_MAX + ' caractères.';
  let description = ''; try { description = typeof b.description === 'string' ? horairesLisibles(b.description).trim() : invalide(); } catch { description = 'x'.repeat(DESCRIPTION_PLAT_MAX + 1); }
  if (description.length > DESCRIPTION_PLAT_MAX) erreurs.description = 'La description est limitée à ' + DESCRIPTION_PLAT_MAX + ' caractères.';
  const prix = prixDepuisSaisie(b.prix);
  if (prix === null) erreurs.prix = MESSAGE_PRIX_INVALIDE;
  let promo: number | null = null; let section: string | null = null;
  if (cible.mode === 'modifier') {
    if (cible.plat.edition === null) return { ok: false, erreurs: { general: 'Ce plat ne peut pas être modifié ici (certaines informations sont illisibles). Ouvrez Speedfood sur le site.' } };
    promo = cible.plat.edition.prixPromoGnf; section = cible.plat.edition.sectionId;
    if (prix !== null && promo !== null && prix < promo) erreurs.prix = 'Le prix ne peut pas être inférieur au prix promo actuel (' + formaterPrix(promo) + '). Modifiez d’abord le prix promo sur le site.';
  }
  if (erreurs.nom || erreurs.description || erreurs.prix || prix === null) return { ok: false, erreurs };
  const plat: PlatAEcrire = { nom, description, prix, prixPromo: promo, sectionId: section };
  if (cible.mode === 'modifier') {
    const p = cible.plat;
    if (p.nom === nom && p.prixGnf === prix && p.edition!.description === description) return { ok: false, erreurs: { general: 'Rien n’a changé : modifiez le nom, le prix ou la description avant d’enregistrer.' } };
  }
  const action: ActionService = cible.mode === 'creer' ? { type: 'creer', plat, avant: cible.menu.plats.map(p => p.id) } : { type: 'modifier', platId: cible.plat.id, plat };
  // Dernier garde-fou : le contrôle partagé avec le serveur, pour que ce qui part soit exactement ce que le serveur accepte.
  if (corpsDeAction(action) === null) return { ok: false, erreurs: { general: 'Cette saisie n’est pas valide. Corrigez-la puis recommencez.' } };
  return { ok: true, action };
}
/** Valide la saisie d'un supplément (nom 80 caractères au plus, prix entier en GNF) AVANT tout envoi. */
export function preparerOption(b: BrouillonOption, plat: PlatRestaurateur): { ok: true; action: ActionService } | { ok: false; erreurs: ErreursOption } {
  if (b === null || typeof b !== 'object') return { ok: false, erreurs: { general: 'Cette saisie n’est pas valide. Corrigez-la puis recommencez.' } };
  const erreurs: ErreursOption = {};
  const nom = typeof b.nom === 'string' ? nomLisible(b.nom, 1000) ?? '' : '';
  if (nom.length === 0 || nom.length > NOM_OPTION_MAX) erreurs.nom = nom.length === 0 ? 'Le nom du supplément est obligatoire.' : 'Le nom du supplément est limité à ' + NOM_OPTION_MAX + ' caractères.';
  const prix = prixDepuisSaisie(b.prix);
  if (prix === null) erreurs.prix = MESSAGE_PRIX_INVALIDE;
  if (erreurs.nom || erreurs.prix || prix === null) return { ok: false, erreurs };
  const action: ActionService = { type: 'option_ajouter', platId: plat.id, option: { nom, prix }, avant: plat.options.map(o => o.id) };
  if (corpsDeAction(action) === null) return { ok: false, erreurs: { general: 'Cette saisie n’est pas valide. Corrigez-la puis recommencez.' } };
  return { ok: true, action };
}
export function actionArchiver(p: Pick<PlatRestaurateur, 'id' | 'nom'>): ActionService { return { type: 'archiver', platId: p.id, nom: p.nom }; }
export function actionRetirerOption(p: Pick<PlatRestaurateur, 'id'>, o: Pick<OptionRestaurateur, 'id' | 'nom'>): ActionService { return { type: 'option_retirer', optionId: o.id, platId: p.id, nom: o.nom }; }

/** Textes fixes des confirmations, d'après ce que fait RÉELLEMENT le serveur (verifierRestaurantCommandable : fermé ou en pause = refus de toute nouvelle commande ; les commandes déjà reçues ne changent pas). */
export const CONFIRMATIONS_STATUT: Record<ChampStatutApp, Record<'true' | 'false', { question: string; oui: string; non: string }>> = {
  ouvert: {
    false: { question: 'Fermer le restaurant ? Il apparaîtra fermé et les clients ne pourront plus passer commande tant que vous ne l’aurez pas rouvert. Les commandes déjà reçues restent à traiter.', oui: 'Oui, fermer le restaurant', non: 'Non, rester ouvert' },
    true: { question: 'Rouvrir le restaurant ? Il apparaîtra ouvert. Les clients ne pourront commander que s’il prend aussi des commandes.', oui: 'Oui, rouvrir le restaurant', non: 'Non, annuler' },
  },
  accepte_commandes: {
    false: { question: 'Mettre les commandes en pause ? Les clients verront toujours votre menu mais ne pourront plus commander. Le restaurant reste ouvert et les commandes déjà reçues restent à traiter.', oui: 'Oui, mettre en pause', non: 'Non, continuer à prendre des commandes' },
    true: { question: 'Reprendre les commandes ? Les clients pourront de nouveau commander si le restaurant est ouvert.', oui: 'Oui, reprendre les commandes', non: 'Non, annuler' },
  },
};
export const CONFIRMATION_TOUT_CONFIRMER = {
  question: 'Confirmer que tous vos plats actuellement disponibles le sont toujours ? Les clients verront leur disponibilité comme confirmée à l’instant. Ne confirmez que si c’est vrai.',
  oui: 'Oui, tout confirmer', non: 'Non, annuler',
};
/** Archiver : honnête sur ce que fait le serveur (le plat est marqué archivé, jamais supprimé ; il disparaît de la carte et ne peut plus être commandé ; les commandes passées le gardent) et sur ce que l'application ne sait pas faire (le rétablir). */
export function confirmationArchiver(nom: string): { question: string; oui: string; non: string } {
  return { question: 'Archiver « ' + nom + ' » ? Il disparaîtra de la carte : les clients ne pourront plus le voir ni le commander. Les commandes déjà passées le gardent. Il ne pourra pas être rétabli depuis l’application.', oui: 'Oui, archiver ce plat', non: 'Non, le garder' };
}
export function confirmationRetirerOption(nom: string): { question: string; oui: string; non: string } {
  return { question: 'Retirer le supplément « ' + nom + ' » ? Les clients ne pourront plus le choisir pour ce plat. Les commandes déjà passées le gardent.', oui: 'Oui, retirer ce supplément', non: 'Non, le garder' };
}
/** Retirer une photo : honnête sur ce que fait le serveur (le plat reste en vente, sans image ; la photo n'est pas récupérable depuis l'application, il faudra en envoyer une autre). */
export function confirmationRetirerPhoto(nom: string): { question: string; oui: string; non: string } {
  return { question: 'Retirer la photo de « ' + nom + ' » ? Le plat reste en vente, sans image. Vous pourrez envoyer une autre photo plus tard.', oui: 'Oui, retirer la photo', non: 'Non, la garder' };
}
export function confirmationDe(a: ActionService): { question: string; oui: string; non: string } | null {
  if (a.type === 'statut') return CONFIRMATIONS_STATUT[a.champ][a.valeur ? 'true' : 'false'];
  if (a.type === 'confirmer_tout') return CONFIRMATION_TOUT_CONFIRMER;
  if (a.type === 'archiver') return confirmationArchiver(a.nom);
  if (a.type === 'option_retirer') return confirmationRetirerOption(a.nom);
  if (a.type === 'photo_retirer') return confirmationRetirerPhoto(a.nom);
  return null;
}
export const LIBELLES_ACTION: Record<ActionService['type'], string> = {
  statut: 'ce changement', reglages: 'vos réglages', disponibilite: 'ce changement de disponibilité', confirmer: 'cette confirmation', confirmer_tout: 'cette confirmation',
  creer: 'l’ajout de ce plat', modifier: 'la modification de ce plat', archiver: 'l’archivage de ce plat', option_ajouter: 'l’ajout de ce supplément', option_retirer: 'le retrait de ce supplément',
  photo_definir: 'l’envoi de cette photo', photo_retirer: 'le retrait de cette photo',
};

/** Lecture du contrat partagé (API et application refusent les mêmes saisies) : l'action normalisée, ou `null`. */
function lireMenu(corps: unknown) { const lu = lireActionMenuApp(corps, REGLES_MENU_PLAFONNEES); return lu.ok ? lu.action : null; }
function champsPlat(p: PlatAEcrire | undefined) { return { nom: p?.nom, description: p?.description, prix: p?.prix, prixPromo: p?.prixPromo, sectionId: p?.sectionId }; }

/** Corps de la requête, SEULEMENT les champs prévus (jamais de restaurant) : la machine et le client n'envoient que ce que cette fonction produit. */
export interface EnvoiService { chemin: '/api/v1/restaurant/statut' | '/api/v1/restaurant/reglages' | '/api/v1/restaurant/menu/action' | typeof CHEMIN_PHOTO_APP; corps: object; /** Photo seulement : le fichier préparé, envoyé en formulaire multipart avec `corps` (le plat). */ fichier?: FichierPhotoPrete }
export function corpsDeAction(a: ActionService): EnvoiService | null {
  if (a === null || typeof a !== 'object') return null;
  switch (a.type) {
    case 'statut': { const lu = lireStatutApp({ champ: a.champ, valeur: a.valeur }); return lu ? { chemin: '/api/v1/restaurant/statut', corps: { champ: lu.champ, valeur: lu.valeur } } : null; }
    case 'reglages': { const lu = lireReglagesApp(a.valeurs, lireDelaiPreparation); return lu.ok ? { chemin: '/api/v1/restaurant/reglages', corps: lu.valeurs } : null; }
    case 'disponibilite': { const lu = lireMenu({ action: 'disponibilite', platId: a.platId, disponible: a.disponible }); return lu && lu.action === 'disponibilite' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: lu.action, platId: lu.platId, disponible: lu.disponible } } : null; }
    case 'confirmer': { const lu = lireMenu({ action: 'confirmer', platId: a.platId }); return lu && lu.action === 'confirmer' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: lu.action, platId: lu.platId } } : null; }
    case 'confirmer_tout': return { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'confirmer_tout' } };
    // Lot D4b : les valeurs envoyées sont CELLES que le contrat partagé a lues et normalisées (textes rognés), champ par champ ; une saisie invalide ne produit aucun corps (aucun appel réseau).
    case 'creer': { const lu = lireMenu({ action: 'creer', ...champsPlat(a.plat) }); return lu && lu.action === 'creer' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'creer', ...champsPlat(lu.plat) } } : null; }
    case 'modifier': { const lu = lireMenu({ action: 'modifier', platId: a.platId, ...champsPlat(a.plat) }); return lu && lu.action === 'modifier' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'modifier', platId: lu.platId, ...champsPlat(lu.plat) } } : null; }
    case 'archiver': { const lu = lireMenu({ action: 'archiver', platId: a.platId }); return lu && lu.action === 'archiver' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'archiver', platId: lu.platId } } : null; }
    case 'option_ajouter': { const lu = lireMenu({ action: 'option_ajouter', platId: a.platId, nom: a.option?.nom, prix: a.option?.prix }); return lu && lu.action === 'option_ajouter' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'option_ajouter', platId: lu.platId, nom: lu.option.nom, prix: lu.option.prix } } : null; }
    case 'option_retirer': { const lu = lireMenu({ action: 'option_retirer', optionId: a.optionId }); return lu && lu.action === 'option_retirer' ? { chemin: '/api/v1/restaurant/menu/action', corps: { action: 'option_retirer', optionId: lu.optionId } } : null; }
    // Lot D4c : le contrat partagé (le même que le serveur) valide AVANT tout appel réseau ; un fichier trop gros, d'un autre type ou vide ne produit AUCUN envoi.
    case 'photo_definir': {
      if (!fichierPhotoPret(a.fichier)) return null;
      const lu = lireDemandePhotoApp<FichierPhotoPrete>({ platId: a.platId, photo: a.fichier, retirer: undefined });
      return lu.ok && lu.demande.action === 'definir' ? { chemin: CHEMIN_PHOTO_APP, corps: { platId: lu.demande.platId }, fichier: a.fichier } : null;
    }
    case 'photo_retirer': { const lu = lireDemandePhotoApp({ platId: a.platId, photo: undefined, retirer: '1' }); return lu.ok && lu.demande.action === 'retirer' ? { chemin: CHEMIN_PHOTO_APP, corps: { platId: lu.demande.platId, retirer: '1' } } : null; }
    default: return null;
  }
}

// ---------- erreurs ----------
/** Table des refus du serveur pour le service et le menu : statut HTTP (et raison de sécurité éventuelle) vers un message français fixe. Le 401 (session terminée) est traité par l'appelant. */
export function refusService(statut: number, raison: RaisonSecuriteCompte | null = null): ErreurRestaurateur {
  if (statut === 403 && raison !== null) return new ErreurRestaurateur('securite', MESSAGE_SECURITE, false, raison);
  if (statut === 403) return new ErreurRestaurateur('refus', 'Ce compte ne peut pas modifier le service de ce restaurant. Actualisez puis vérifiez votre accès sur le site.');
  if (statut === 400 || statut === 404 || statut === 409) return new ErreurRestaurateur('refus', 'La demande n’a pas été acceptée (valeur invalide, ou plat introuvable). Actualisez puis réessayez.');
  if (statut === 413) return new ErreurRestaurateur('refus', 'La photo est trop volumineuse (5 Mo au maximum). Choisissez-en une autre.');
  if (statut === 429) return new ErreurRestaurateur('limite', 'Trop de tentatives. Patientez un instant avant de réessayer.');
  if (statut >= 500) return new ErreurRestaurateur('serveur', 'Le service est indisponible. Votre changement a peut-être été enregistré : l’état va être relu avant de réessayer.', true);
  return new ErreurRestaurateur('refus', 'Votre changement n’a pas pu être envoyé. Actualisez puis réessayez.');
}
export const erreurReseauService = () => new ErreurRestaurateur('reseau', 'Impossible de joindre Speedfood. Votre changement a peut-être été enregistré : l’état va être relu avant de réessayer.', true);
export const erreurReponseService = () => new ErreurRestaurateur('reponse_invalide', 'Réponse du service illisible. Votre changement a peut-être été enregistré : l’état va être relu avant de réessayer.', true);
/** Photo, échec LOCAL : rien n'est parti sur le réseau, rien n'est enregistré (non incertain, l'écran reste déverrouillé). Le code est d'un jeu fermé, ni adresse ni contenu. */
export const erreurLocalePhoto = (code: 'lecture' | 'formulaire') => new ErreurRestaurateur('local', 'La photo n’a pas pu être préparée pour l’envoi : rien n’a été enregistré. Choisissez la photo à nouveau, ou une autre. (code : ' + code + ')', false);
/** Photo, panne PENDANT l'envoi (réseau coupé, délai de 60 s) : des octets ont pu partir, donc incertain. Le code court aide à comprendre un prochain essai réel. */
export const erreurReseauPhoto = (code: 'delai' | 'reseau') => new ErreurRestaurateur('reseau', 'Impossible de joindre Speedfood pour envoyer la photo. Elle a peut-être été enregistrée : l’état va être relu avant de réessayer. (code : ' + code + ')', true);

// ---------- verdict ----------
export type VerdictService =
  | { genre: 'confirme'; message: string }
  | { genre: 'refus'; message: string; reessayer: false }
  | { genre: 'securite'; message: string }
  | { genre: 'incertain'; message: string; reessayer: boolean }
  | { genre: 'session'; message: string };

const MESSAGES_SUCCES = {
  ouvert: { true: 'Restaurant rouvert.', false: 'Restaurant fermé.' },
  accepte_commandes: { true: 'Commandes reprises.', false: 'Commandes en pause.' },
  reglages: 'Réglages enregistrés.',
  disponible: 'Plat marqué disponible.', indisponible: 'Plat marqué indisponible.', confirmer: 'Disponibilité confirmée.', confirmer_tout: 'Disponibilité confirmée pour tous les plats disponibles.',
  creer: 'Plat ajouté.', modifier: 'Plat modifié.', archiver: 'Plat archivé : il n’apparaît plus sur la carte.', option_ajouter: 'Supplément ajouté.', option_retirer: 'Supplément retiré.',
  photo_definir: 'Photo enregistrée.', photo_retirer: 'Photo retirée : le plat reste en vente, sans image.',
};
const MESSAGES_ENREGISTRE = {
  ouvert: { true: 'La réouverture est bien enregistrée.', false: 'La fermeture est bien enregistrée.' },
  accepte_commandes: { true: 'La reprise des commandes est bien enregistrée.', false: 'La pause des commandes est bien enregistrée.' },
  reglages: 'Vos réglages sont bien enregistrés.',
  disponible: 'Le plat est bien enregistré comme disponible.', indisponible: 'Le plat est bien enregistré comme indisponible.', confirmer: 'La confirmation est bien enregistrée.', confirmer_tout: 'La confirmation est bien enregistrée pour tous les plats.',
  creer: 'Le nouveau plat est bien enregistré.', modifier: 'Les modifications du plat sont bien enregistrées.', archiver: 'Le plat est bien archivé.', option_ajouter: 'Le supplément est bien enregistré.', option_retirer: 'Le supplément est bien retiré.',
  photo_definir: 'Une photo différente est maintenant enregistrée pour ce plat (la vôtre, sauf si elle a été changée depuis un autre appareil : vérifiez l’aperçu).', photo_retirer: 'La photo est bien retirée.',
};
function messageSucces(a: ActionService, table: typeof MESSAGES_SUCCES | typeof MESSAGES_ENREGISTRE): string {
  switch (a.type) {
    case 'statut': return table[a.champ][a.valeur ? 'true' : 'false'];
    case 'reglages': return table.reglages;
    case 'disponibilite': return a.disponible ? table.disponible : table.indisponible;
    case 'confirmer': return table.confirmer;
    case 'confirmer_tout': return table.confirmer_tout;
    case 'creer': return table.creer;
    case 'modifier': return table.modifier;
    case 'archiver': return table.archiver;
    case 'option_ajouter': return table.option_ajouter;
    case 'option_retirer': return table.option_retirer;
    case 'photo_definir': return table.photo_definir;
    case 'photo_retirer': return table.photo_retirer;
  }
}

/** Ce que le serveur dit APRÈS l'envoi : réglages relus (statut, réglages) ou menu relu (disponibilité). `undefined` = relecture impossible. */
export interface RelectureService { reglages?: ReglagesRestaurateur; menu?: MenuRestaurateur }
/** Le serveur a-t-il, dans l'état relu, la valeur demandée ? `null` = l'état concerné n'a pas pu être relu. */
export function etatCorrespond(a: ActionService, relue: RelectureService): boolean | null {
  switch (a.type) {
    case 'statut': return relue.reglages ? (a.champ === 'ouvert' ? relue.reglages.ouvert : relue.reglages.accepteCommandes) === a.valeur : null;
    case 'reglages': {
      if (!relue.reglages) return null;
      return (a.valeurs.horaires === undefined || relue.reglages.horaires === a.valeurs.horaires) && (a.valeurs.delaiPreparationMinutes === undefined || relue.reglages.delaiPreparationMinutes === a.valeurs.delaiPreparationMinutes);
    }
    case 'disponibilite': { if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId); return p !== undefined && p.disponible === a.disponible; }
    case 'confirmer': { if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId); return p !== undefined && p.disponible && p.confirmeLe !== null && p.confirmeLe !== a.avant; }
    case 'confirmer_tout': {
      if (!relue.menu) return null;
      // Chaque plat qui était disponible et l'est resté doit porter une confirmation NOUVELLE ; au moins un plat concerné.
      const concernes = a.avant.map(([id, avant]) => ({ avant, p: relue.menu!.plats.find(x => x.id === id) })).filter(c => c.p !== undefined && c.p.disponible);
      return a.avant.length > 0 && concernes.every(c => c.p!.confirmeLe !== null && c.p!.confirmeLe !== c.avant);
    }
    // Lot D4b : l'écran affiche ce que le SERVEUR a. Un plat créé se reconnaît à un identifiant NOUVEAU (absent de `avant`) avec le même nom et le même prix.
    case 'creer': { if (!relue.menu) return null; const avant = new Set(a.avant); return relue.menu.plats.some(p => !avant.has(p.id) && p.nom === a.plat.nom && p.prixGnf === a.plat.prix); }
    case 'modifier': {
      if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId);
      return p !== undefined && p.edition !== null && p.nom === a.plat.nom && p.prixGnf === a.plat.prix && p.edition.description === a.plat.description && p.edition.prixPromoGnf === a.plat.prixPromo && p.edition.sectionId === a.plat.sectionId;
    }
    case 'archiver': return relue.menu ? !relue.menu.plats.some(x => x.id === a.platId) : null;
    case 'option_ajouter': {
      if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId); const avant = new Set(a.avant);
      return p !== undefined && p.options.some(o => !avant.has(o.id) && o.nom === a.option.nom && o.prixGnf === a.option.prix);
    }
    // Plat disparu de l’état relu (archivé ailleurs) : on ne peut RIEN affirmer sur le supplément → inconnu (null), jamais « bien retiré ».
    case 'option_retirer': { if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId); return p === undefined ? null : !p.options.some(o => o.id === a.optionId); }
    // Lot D4c : une photo envoyée est enregistrée quand le serveur a une photo DIFFÉRENTE de celle d'avant (le serveur donne à chaque fichier un nom nouveau) ; retirée quand il n'en a plus. Plat disparu : inconnu (null) pour le retrait, jamais « bien retirée ».
    case 'photo_definir': { if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId); return p !== undefined && p.photoRef !== null && p.photoRef !== a.avant; }
    case 'photo_retirer': { if (!relue.menu) return null; const p = relue.menu.plats.find(x => x.id === a.platId); return p === undefined ? null : p.photoRef === null; }
  }
}
/** « Réessayer » seulement quand le bouton qui renverrait l'action existe encore (leçon D2-M4). */
export function boutonExiste(a: ActionService, relue: RelectureService): boolean {
  switch (a.type) {
    case 'statut': case 'reglages': return true;
    case 'disponibilite': return relue.menu?.plats.some(x => x.id === a.platId) === true;
    case 'confirmer': return relue.menu?.plats.some(x => x.id === a.platId && x.disponible) === true;
    case 'confirmer_tout': return relue.menu?.plats.some(x => x.disponible) === true;
    // Lot D4b : le formulaire d'ajout existe tant que le menu a pu être relu ; la modification, l'archivage et les suppléments demandent que le plat (ou le supplément) soit encore là.
    case 'creer': return relue.menu !== undefined;
    case 'modifier': return relue.menu?.plats.some(x => x.id === a.platId && x.edition !== null) === true;
    case 'archiver': case 'option_ajouter': return relue.menu?.plats.some(x => x.id === a.platId) === true;
    case 'option_retirer': return relue.menu?.plats.some(x => x.id === a.platId && x.options.some(o => o.id === a.optionId)) === true;
    // Lot D4c : le bouton « Ajouter / Changer la photo » existe tant que le plat est là ; « Retirer la photo », tant que le plat a une photo.
    case 'photo_definir': return relue.menu?.plats.some(x => x.id === a.platId) === true;
    case 'photo_retirer': return relue.menu?.plats.some(x => x.id === a.platId && x.photoRef !== null) === true;
  }
}

/** Le formulaire d'ajout se referme après une insertion confirmée OU incertaine (jamais de saisie prête à renvoyer un doublon) ; après un refus il reste ouvert pour corriger. Modifier : seulement si confirmé. */
export function formulaireSeReferme(action: ActionService, verdict: VerdictService): boolean {
  if (verdict.genre === 'confirme') return action.type === 'creer' || action.type === 'modifier' || action.type === 'option_ajouter';
  return (action.type === 'creer' || action.type === 'option_ajouter') && verdict.genre === 'incertain';
}

/**
 * Issue d'une tentative. `erreur` null = le serveur a répondu {ok:true} (écriture confirmée par la base). Après une réponse INCONNUE, l'état relu décide : s'il montre la valeur demandée,
 * c'est enregistré ; s'il montre l'état d'avant et que le bouton existe encore, « réessayer » est permis, SAUF pour une insertion (créer, ajouter un supplément, envoyer une photo) où le serveur peut finir l'écriture après la relecture : alors verdict incertain, sans réessai ; si la relecture a échoué, il est interdit (jamais à l'aveugle). Un refus certain
 * n'est jamais converti en succès. Même après un succès, un état relu DIFFÉRENT est signalé (modifié entre-temps depuis un autre appareil).
 */
export function verdictService(e: { erreur: ErreurRestaurateur | null; sessionTerminee?: string | null; action: ActionService; relue: RelectureService }): VerdictService {
  if (e.sessionTerminee) return { genre: 'session', message: e.sessionTerminee };
  const correspond = etatCorrespond(e.action, e.relue);
  if (e.erreur === null) {
    if (correspond === false) return { genre: 'incertain', message: 'Le serveur a répondu, mais l’état relu est différent (il a peut-être été modifié depuis un autre appareil). Vérifiez ce qui est affiché.', reessayer: false };
    return { genre: 'confirme', message: messageSucces(e.action, MESSAGES_SUCCES) + (correspond === null ? ' L’état n’a pas pu être relu : actualisez pour le voir.' : '') };
  }
  if (e.erreur.genre === 'securite') return { genre: 'securite', message: MESSAGE_SECURITE };
  if (!e.erreur.incertain) return { genre: 'refus', message: e.erreur.message, reessayer: false };
  if (correspond === null) return { genre: 'incertain', message: e.erreur.message + ' L’état n’a pas pu être relu : actualisez-le avant de réessayer.', reessayer: false };
  if (correspond) return { genre: 'confirme', message: messageSucces(e.action, MESSAGES_ENREGISTRE) };
  // Une INSERTION (créer, ajouter un supplément, envoyer une photo : un nouveau fichier) n'est jamais déclarée « non enregistrée » sur un simple doute : le serveur peut finir l'écriture après la relecture. Pas de « réessayer » (risque de doublon).
  if (e.action.type === 'photo_definir' && boutonExiste(e.action, e.relue)) return { genre: 'incertain', message: 'Le menu relu ne montre pas encore la nouvelle photo : elle n’a peut-être pas été enregistrée. Actualisez le menu dans un instant et vérifiez avant d’en envoyer une autre.', reessayer: false };
  if ((e.action.type === 'creer' || e.action.type === 'option_ajouter') && boutonExiste(e.action, e.relue)) return { genre: 'incertain', message: 'Le menu relu ne montre pas encore cet ajout : il n’a peut-être pas été enregistré. Actualisez le menu dans un instant et vérifiez avant de l’ajouter à nouveau.', reessayer: false };
  if (boutonExiste(e.action, e.relue)) return { genre: 'incertain', message: 'L’état relu ne montre pas votre changement : il n’a pas été enregistré. Vous pouvez réessayer.', reessayer: true };
  return { genre: 'refus', message: 'Le plat n’apparaît plus ou ne peut plus être modifié. Actualisez le menu.', reessayer: false };
}

// ---------- machine d'états ----------
export type EtatService =
  | { phase: 'repos' }
  | { phase: 'confirmation'; action: ActionService }
  | { phase: 'envoi'; action: ActionService }
  | { phase: 'relecture'; action: ActionService; erreur: ErreurRestaurateur | null; sessionTerminee: string | null }
  | { phase: 'verdict'; action: ActionService; verdict: VerdictService; lectureVerdict: number };
export const ETAT_SERVICE_REPOS: EtatService = { phase: 'repos' };

export type EvenementService =
  | { type: 'demander_confirmation'; action: ActionService; lecture: number }
  | { type: 'annuler_confirmation' }
  | { type: 'envoyer'; action: ActionService; lecture: number }
  | { type: 'repondre'; erreur: ErreurRestaurateur | null; sessionTerminee?: string | null }
  | { type: 'relire'; relue: RelectureService; lecture: number }
  | { type: 'effacer' };

/**
 * Verrou des boutons. `lecture` est un compteur qui augmente à chaque lecture RÉUSSIE (réglages ou menu). Verrouillé : pendant l'envoi et la relecture qui suit ; et après un verdict
 * incertain sans relecture réussie, tant que le compteur n'a pas changé. Un seul envoi à la fois pour tout l'écran.
 */
export function serviceVerrouille(etat: EtatService, lecture: number): boolean {
  if (etat.phase === 'envoi' || etat.phase === 'relecture') return true;
  return etat.phase === 'verdict' && etat.verdict.genre === 'incertain' && !etat.verdict.reessayer && etat.lectureVerdict === lecture;
}
const memeAction = (a: ActionService, b: ActionService) => JSON.stringify(a) === JSON.stringify(b);
/** Une action à confirmer ne part qu'après SA confirmation (même action, tous champs égaux) ; les autres, jamais pendant un verrou. */
export function peutEnvoyerService(etat: EtatService, action: ActionService, lecture: number): boolean {
  if (corpsDeAction(action) === null) return false;
  if (serviceVerrouille(etat, lecture)) return false;
  return actionAConfirmer(action) ? etat.phase === 'confirmation' && memeAction(etat.action, action) : true;
}

/** Transitions, une par événement. Un événement hors de son contexte (ou refusé par le verrou) laisse l'état inchangé : jamais d'envoi sans passage par `envoyer`. */
export function evoluerService(etat: EtatService, ev: EvenementService): EtatService {
  switch (ev.type) {
    case 'demander_confirmation':
      return serviceVerrouille(etat, ev.lecture) || !actionAConfirmer(ev.action) || corpsDeAction(ev.action) === null ? etat : { phase: 'confirmation', action: ev.action };
    case 'annuler_confirmation':
      return etat.phase === 'confirmation' ? ETAT_SERVICE_REPOS : etat;
    case 'envoyer':
      return peutEnvoyerService(etat, ev.action, ev.lecture) ? { phase: 'envoi', action: ev.action } : etat;
    case 'repondre':
      return etat.phase === 'envoi' ? { phase: 'relecture', action: etat.action, erreur: ev.erreur, sessionTerminee: ev.sessionTerminee ?? null } : etat;
    case 'relire':
      return etat.phase === 'relecture'
        ? { phase: 'verdict', action: etat.action, verdict: verdictService({ erreur: etat.erreur, sessionTerminee: etat.sessionTerminee, action: etat.action, relue: ev.relue }), lectureVerdict: ev.lecture }
        : etat;
    case 'effacer':
      return ETAT_SERVICE_REPOS;
  }
}
