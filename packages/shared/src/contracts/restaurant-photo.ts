/**
 * Contrat de `POST /api/v1/restaurant/menu/photo` de l'application native (lot D4c : envoyer, remplacer ou retirer la photo d'un plat).
 * Pur : aucun import du site, de Next, de Supabase ni de Node ; l'API et l'application le chargent tel quel.
 *
 * Formulaire multipart : `platId` (UUID) + `photo` (fichier) pour envoyer ou remplacer ; `platId` + `retirer=1` (sans fichier) pour retirer.
 * Le restaurant n'est JAMAIS un champ : il vient de l'appartenance du compte. La signature réelle des octets est contrôlée côté serveur (le type déclaré ne prouve rien).
 */

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CHEMIN_PHOTO_APP = "/api/v1/restaurant/menu/photo";

/** Taille maximale d'une photo : celle du site et du bucket `medias` (5 Mo). */
export const PHOTO_TAILLE_MAX_OCTETS = 5 * 1024 * 1024;
/** Limite du corps ENTIER de la requête (fichier, champs et enveloppe multipart) : au-delà, refus avant toute lecture du formulaire. */
export const PHOTO_CORPS_MAX_OCTETS = PHOTO_TAILLE_MAX_OCTETS + 64 * 1024;
export const PHOTO_TYPES_AUTORISES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

export const MESSAGE_PHOTO_TROP_GROSSE = "La photo ne peut pas dépasser 5 Mo.";
export const MESSAGE_PHOTO_FORMAT = "Format d'image non pris en charge (JPEG, PNG ou WebP uniquement).";

/** Ce que le contrat demande à un fichier : une taille et un type déclaré (un `File` du formulaire, ou le fichier préparé par l'application). */
export interface FichierPhoto { size: number; type: string }

export type DemandePhoto<F extends FichierPhoto> = { action: "retirer"; platId: string } | { action: "definir"; platId: string; fichier: F };
export type LectureDemandePhoto<F extends FichierPhoto> =
  | { ok: true; demande: DemandePhoto<F> }
  /** `tropGros` : le fichier dépasse 5 Mo (l'API répond 413). */
  | { ok: false; message: string; tropGros?: true };

const refus = (message: string): { ok: false; message: string } => ({ ok: false, message });

function ressembleAUnFichier(v: unknown): v is FichierPhoto {
  return typeof v === "object" && v !== null && typeof (v as { size?: unknown }).size === "number" && typeof (v as { type?: unknown }).type === "string";
}

/**
 * Lit les trois champs du formulaire. Refus (avant tout appel au service et au stockage) : plat qui n'est pas un UUID, `retirer` autre que « 1 », `retirer` accompagné d'un fichier, champ `photo` absent
 * ou qui n'est pas un fichier (un texte), fichier vide, de plus de 5 Mo, ou d'un type hors JPEG, PNG, WebP. Aucune autre clé n'est lue : un `restaurantId` du formulaire n'existe pas pour ce contrat.
 */
export function lireDemandePhotoApp<F extends FichierPhoto>(champs: { platId: unknown; photo: unknown; retirer: unknown }): LectureDemandePhoto<F> {
  const platId = typeof champs.platId === "string" && REGEX_UUID.test(champs.platId) ? champs.platId : null;
  if (platId === null) return refus("Plat inconnu.");
  const photoAbsente = champs.photo === undefined || champs.photo === null;
  if (champs.retirer !== undefined && champs.retirer !== null) {
    if (champs.retirer !== "1" || !photoAbsente) return refus("Demande invalide.");
    return { ok: true, demande: { action: "retirer", platId } };
  }
  if (!ressembleAUnFichier(champs.photo)) return refus("Choisissez une image.");
  const fichier = champs.photo as F;
  if (!Number.isSafeInteger(fichier.size) || fichier.size <= 0) return refus("Choisissez une image.");
  if (fichier.size > PHOTO_TAILLE_MAX_OCTETS) return { ok: false, message: MESSAGE_PHOTO_TROP_GROSSE, tropGros: true };
  if (!PHOTO_TYPES_AUTORISES.includes(fichier.type)) return refus(MESSAGE_PHOTO_FORMAT);
  return { ok: true, demande: { action: "definir", platId, fichier } };
}
