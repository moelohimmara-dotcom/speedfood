/**
 * Espace client (parité Kotlin, lot 1, lignes B9 favoris, B10 adresses, B11 profil) : types, lecture stricte et règles locales. Mêmes routes (`/api/v1/client/*`) et mêmes règles que le site ;
 * le serveur revérifie tout, ces contrôles évitent seulement un aller-retour inutile. Aucune règle ici n'est plus permissive que celle du serveur.
 */
export const AVATARS_CLIENT = [
  { cle: 'burger', emoji: '🍔', libelle: 'Burger' }, { cle: 'pizza', emoji: '🍕', libelle: 'Pizza' }, { cle: 'riz', emoji: '🍚', libelle: 'Riz' },
  { cle: 'poulet', emoji: '🍗', libelle: 'Poulet' }, { cle: 'poisson', emoji: '🐟', libelle: 'Poisson' }, { cle: 'cafe', emoji: '☕', libelle: 'Café' },
  { cle: 'pain', emoji: '🥖', libelle: 'Pain' }, { cle: 'salade', emoji: '🥗', libelle: 'Salade' }, { cle: 'brochette', emoji: '🍢', libelle: 'Brochette' }, { cle: 'glace', emoji: '🍦', libelle: 'Glace' },
] as const;
export const MODES_PREFERES_CLIENT = [
  { valeur: null, libelle: 'Aucune préférence' }, { valeur: 'retrait', libelle: 'Retrait sur place' }, { valeur: 'livraison', libelle: 'Livraison' }, { valeur: 'sur_place', libelle: 'Sur place, à table' },
] as const;
export const ADRESSES_MAX = 5;
export const FAVORIS_MAX = 100;
export const emojiAvatarClient = (cle: string | null | undefined): string => AVATARS_CLIENT.find(a => a.cle === cle)?.emoji ?? '🍽️';

export interface ProfilClient { pseudo: string; avatar: string; modePrefere: string | null; notificationsCommande: boolean }
export interface AdresseClient { id: string; libelle: string; adresse: string; parDefaut: boolean }
export interface FavoriClient { restaurantId: string; nom: string; ouvert: boolean }
export interface EspaceComplet { profil: ProfilClient | null; adresses: AdresseClient[]; favoris: FavoriClient[] }

/** `refus` = rien n'a été enregistré ; `incertain` = l'écriture a pu être faite : on relit l'espace, on ne rejoue jamais (un favori se bascule). */
export class ErreurEspaceClient extends Error {
  readonly genre: 'refus' | 'incertain';
  constructor(genre: 'refus' | 'incertain', message: string) { super(message); this.name = 'ErreurEspaceClient'; this.genre = genre; }
}

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const estUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const invalide = (): never => { throw Error('ESPACE_CLIENT_INVALIDE'); };
const objet = (v: unknown): Record<string, unknown> => (!v || typeof v !== 'object' || Array.isArray(v)) ? invalide() : v as Record<string, unknown>;
const texte = (v: unknown, max: number): string => (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) ? invalide() : v;
const booleen = (v: unknown): boolean => typeof v !== 'boolean' ? invalide() : v;
const MODES = MODES_PREFERES_CLIENT.map(m => m.valeur).filter((m): m is Exclude<typeof m, null> => m !== null) as readonly string[];
const estMode = (v: unknown): v is string => typeof v === 'string' && MODES.includes(v);
const estAvatar = (v: unknown): v is string => typeof v === 'string' && AVATARS_CLIENT.some(a => a.cle === v);

/** Lecture stricte de `GET /client/espace` : au moindre doute l'espace est refusé en bloc (jamais deviné). Les champs inconnus (avis, etc.) sont ignorés. */
export function lireEspaceComplet(v: Record<string, unknown>): EspaceComplet {
  if (!v || v.ok !== true) return invalide();
  let profil: ProfilClient | null = null;
  if (v.profil !== null && v.profil !== undefined) {
    const p = objet(v.profil);
    if (!estAvatar(p.avatar)) return invalide();
    if (p.modePrefere !== null && p.modePrefere !== undefined && !estMode(p.modePrefere)) return invalide();
    profil = { pseudo: texte(p.pseudo, 60), avatar: p.avatar, modePrefere: (p.modePrefere ?? null) as string | null, notificationsCommande: booleen(p.notificationsCommande) };
  }
  if (!Array.isArray(v.adresses) || v.adresses.length > ADRESSES_MAX || !Array.isArray(v.favoris) || v.favoris.length > FAVORIS_MAX) return invalide();
  const adresses = v.adresses.map(x => { const o = objet(x); if (!estUuid(o.id)) return invalide(); return { id: o.id, libelle: texte(o.libelle, 60), adresse: texte(o.adresse, 400), parDefaut: booleen(o.parDefaut) }; });
  const favoris = v.favoris.map(x => { const o = objet(x); if (!estUuid(o.restaurantId)) return invalide(); return { restaurantId: o.restaurantId, nom: texte(o.nom, 200), ouvert: booleen(o.ouvert) }; });
  return { profil, adresses, favoris };
}

const PSEUDO_AUTORISE = /^[A-Za-zÀ-ÿ0-9 _.-]+$/;
export function validerPseudo(brut: string): { ok: true; pseudo: string } | { ok: false; erreur: string } {
  const pseudo = brut.replace(/\s+/g, ' ').trim();
  if (pseudo.length < 3 || pseudo.length > 24) return { ok: false, erreur: 'Le pseudo doit contenir entre 3 et 24 caractères.' };
  if (!PSEUDO_AUTORISE.test(pseudo)) return { ok: false, erreur: 'Le pseudo peut contenir des lettres, des chiffres, des espaces, des points et des tirets.' };
  return { ok: true, pseudo };
}

export function validerAdresse(libelleBrut: string, adresseBrute: string): { ok: true; libelle: string; adresse: string } | { ok: false; erreur: string } {
  const libelle = libelleBrut.replace(/\s+/g, ' ').trim(); const adresse = adresseBrute.replace(/\s+/g, ' ').trim();
  if (libelle.length < 2 || libelle.length > 30) return { ok: false, erreur: 'Donnez un nom court à cette adresse (2 à 30 caractères), par exemple « Maison ».' };
  if (adresse.length < 5 || adresse.length > 300) return { ok: false, erreur: 'Décrivez l’adresse pour le livreur (5 à 300 caractères) : quartier, rue, point de repère.' };
  return { ok: true, libelle, adresse };
}

/** Champs de profil à modifier : seuls ceux fournis changent (comme le serveur). */
export interface ChampsProfil { pseudo?: string; avatar?: string; modePrefere?: string | null; notificationsCommande?: boolean }
export function verifierProfil(c: ChampsProfil): string | null {
  if (c.pseudo === undefined && c.avatar === undefined && c.modePrefere === undefined && c.notificationsCommande === undefined) return 'Aucune modification à enregistrer.';
  if (c.pseudo !== undefined) { const v = validerPseudo(c.pseudo); if (!v.ok) return v.erreur; }
  if (c.avatar !== undefined && !estAvatar(c.avatar)) return 'Choisissez un avatar dans la liste.';
  if (c.modePrefere !== undefined && c.modePrefere !== null && !estMode(c.modePrefere)) return 'Mode de commande inconnu.';
  if (c.notificationsCommande !== undefined && typeof c.notificationsCommande !== 'boolean') return 'Réglage invalide.';
  return null;
}

export type ActionAdresse = { action: 'ajouter'; libelle: string; adresse: string } | { action: 'supprimer' | 'defaut'; adresseId: string };
