import { PHOTO_TAILLE_MAX_OCTETS } from '../../../../packages/shared/src/contracts/restaurant-photo.ts';
import { fichierPhotoPret, type FichierPhotoPrete } from './serviceRestaurateur.ts';

/**
 * Lot D4c : du choix de la photo (galerie ou appareil photo) au fichier PRÊT À ENVOYER. Domaine pur : tout ce qui touche au téléphone (sélecteur système, appareil photo, réduction de l'image, taille du fichier)
 * est INJECTÉ (`DepsPhoto`, branché sur Expo dans `photoPlatNatif.ts`), pour que les règles se testent sans téléphone.
 *
 * Règles :
 *  - Annuler le sélecteur n'est PAS une erreur : aucun message, aucune écriture.
 *  - Une permission refusée (appareil photo) donne un message clair qui n'enferme pas : la galerie reste proposée. La galerie utilise le sélecteur système, sans permission.
 *  - L'image est réduite AVANT l'envoi (côté long de 1 600 px, JPEG compressé) ; si elle dépasse encore 5 Mo, une seconde réduction plus forte est tentée ; si elle dépasse toujours, elle est REFUSÉE ici :
 *    un fichier trop gros ou illisible ne part jamais au réseau.
 *  - Aucun réseau ici, aucun jeton.
 */
export type SourcePhoto = 'galerie' | 'camera';

export const COTE_LONG_PHOTO_PX = 1600;
export const QUALITE_JPEG = 0.8;
export const COTE_LONG_PHOTO_REPLI_PX = 1000;
export const QUALITE_JPEG_REPLI = 0.55;

export const MESSAGE_CAMERA_REFUSEE = 'L’accès à l’appareil photo est refusé. Autorisez-le dans les réglages du téléphone, ou choisissez une photo dans la galerie.';
export const MESSAGE_PHOTO_TROP_GROSSE_APP = 'Cette photo reste trop volumineuse (5 Mo au maximum) même après réduction. Choisissez-en une autre.';
export const MESSAGE_PHOTO_ILLISIBLE = 'Cette photo n’a pas pu être préparée. Choisissez-en une autre.';

export type SelectionPhoto = { annule: true } | { annule: false; uri: string; largeur: number; hauteur: number };
export interface DepsPhoto {
  /** Demande l'accès à l'appareil photo ; `true` seulement s'il est accordé. */
  demanderCamera(): Promise<boolean>;
  /** Ouvre le sélecteur système (galerie) ou l'appareil photo. */
  ouvrir(source: SourcePhoto): Promise<SelectionPhoto>;
  /** Réduit l'image aux dimensions d'arrivée (`hauteur` 0 = inconnue : la largeur seule est fixée, proportions gardées), en JPEG de qualité `qualite`, et renvoie le nouveau fichier local. */
  reduire(uri: string, largeur: number, hauteur: number, coteLong: number, qualite: number): Promise<{ uri: string }>;
  /** Taille réelle du fichier local, en octets. */
  taille(uri: string): Promise<number>;
}

export type ChoixPhoto =
  | { genre: 'annule' }
  | { genre: 'permission_refusee'; message: string }
  | { genre: 'refuse'; message: string }
  | { genre: 'pret'; fichier: FichierPhotoPrete };

/** Dimensions d'arrivée : le côté long ramené à `coteLong` au plus (jamais agrandi), proportions gardées ; `null` = dimensions inconnues ou invalides. */
export function dimensionsReduites(largeur: number, hauteur: number, coteLong: number): { largeur: number; hauteur: number } | null {
  if (![largeur, hauteur, coteLong].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) return null;
  const echelle = Math.min(1, coteLong / Math.max(largeur, hauteur));
  return { largeur: Math.max(1, Math.round(largeur * echelle)), hauteur: Math.max(1, Math.round(hauteur * echelle)) };
}

async function preparer(uri: string, largeur: number, hauteur: number, coteLong: number, qualite: number, d: DepsPhoto): Promise<FichierPhotoPrete | null> {
  // Dimensions inconnues (le système peut renvoyer 0) : on fixe la largeur et le téléphone garde les proportions.
  const cible = largeur > 0 && hauteur > 0 ? dimensionsReduites(largeur, hauteur, coteLong) : { largeur: coteLong, hauteur: 0 };
  if (cible === null) return null;
  const reduite = await d.reduire(uri, cible.largeur, cible.hauteur, coteLong, qualite);
  const size = await d.taille(reduite.uri);
  return { uri: reduite.uri, size, type: 'image/jpeg', nom: 'photo.jpg' } as FichierPhotoPrete;
}

/**
 * Le parcours complet. Ne lève jamais : toute panne du téléphone (sélecteur, réduction, lecture du fichier) devient un refus avec un message fixe. Le fichier rendu a TOUJOURS passé `fichierPhotoPret`
 * (JPEG, taille entre 1 octet et 5 Mo) : c'est la condition pour que `corpsDeAction` produise un envoi.
 */
export async function choisirPhoto(source: SourcePhoto, d: DepsPhoto): Promise<ChoixPhoto> {
  try {
    if (source === 'camera' && !(await d.demanderCamera())) return { genre: 'permission_refusee', message: MESSAGE_CAMERA_REFUSEE };
    const choix = await d.ouvrir(source);
    if (choix.annule) return { genre: 'annule' };
    if (typeof choix.uri !== 'string' || choix.uri.length === 0) return { genre: 'refuse', message: MESSAGE_PHOTO_ILLISIBLE };
    let fichier = await preparer(choix.uri, choix.largeur, choix.hauteur, COTE_LONG_PHOTO_PX, QUALITE_JPEG, d);
    if (fichier !== null && fichier.size > PHOTO_TAILLE_MAX_OCTETS) fichier = await preparer(choix.uri, choix.largeur, choix.hauteur, COTE_LONG_PHOTO_REPLI_PX, QUALITE_JPEG_REPLI, d);
    if (fichier === null || !Number.isSafeInteger(fichier.size) || fichier.size <= 0) return { genre: 'refuse', message: MESSAGE_PHOTO_ILLISIBLE };
    if (fichier.size > PHOTO_TAILLE_MAX_OCTETS) return { genre: 'refuse', message: MESSAGE_PHOTO_TROP_GROSSE_APP };
    return fichierPhotoPret(fichier) ? { genre: 'pret', fichier } : { genre: 'refuse', message: MESSAGE_PHOTO_ILLISIBLE };
  } catch {
    return { genre: 'refuse', message: MESSAGE_PHOTO_ILLISIBLE };
  }
}
