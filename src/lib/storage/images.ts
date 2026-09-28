import "server-only";
import { randomUUID } from "node:crypto";
import { creerClientAdmin } from "@/lib/db/admin";
import { ErreurMetier } from "@/lib/contracts/erreurs";

/**
 * Téléversement d'images (bucket Storage `medias`, voir migration
 * 20260928010000). Toujours via `creerClientAdmin()` (service-role) : le
 * bucket n'a aucune policy d'écriture pour anon/authenticated — un upload
 * direct depuis le navigateur n'est pas possible par conception, chaque
 * upload passe par une Server Action qui valide d'abord (type, taille,
 * appartenance/permission) avant d'écrire dans le bucket.
 *
 * Le nom de fichier est toujours généré côté serveur (jamais celui fourni
 * par le client) : évite tout risque de traversée de chemin ou de collision.
 */

const TYPES_AUTORISES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;

const EXTENSIONS_PAR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type DossierMedia = "restaurants" | "plats" | "bannieres" | "logos";

/**
 * Valide et téléverse une image, renvoie son URL publique.
 * Lève `ErreurMetier("VALIDATION", ...)` si le fichier est absent, d'un type
 * non autorisé, ou trop volumineux.
 */
export async function televerserImage(
  fichier: File | null,
  dossier: DossierMedia
): Promise<string> {
  if (!fichier || fichier.size === 0) {
    throw new ErreurMetier("VALIDATION", "Aucun fichier reçu.", { image: "Choisissez une image." });
  }
  if (!TYPES_AUTORISES.has(fichier.type)) {
    throw new ErreurMetier("VALIDATION", "Format d'image non pris en charge (JPEG, PNG ou WebP uniquement).", {
      image: "Format non pris en charge.",
    });
  }
  if (fichier.size > TAILLE_MAX_OCTETS) {
    throw new ErreurMetier("VALIDATION", "L'image ne peut pas dépasser 5 Mo.", {
      image: "Fichier trop volumineux.",
    });
  }

  const extension = EXTENSIONS_PAR_TYPE[fichier.type];
  const chemin = `${dossier}/${randomUUID()}.${extension}`;

  const admin = creerClientAdmin();
  const { error } = await admin.storage.from("medias").upload(chemin, fichier, {
    contentType: fichier.type,
    upsert: false,
  });

  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible d'enregistrer l'image. Réessayez.");
  }

  const { data } = admin.storage.from("medias").getPublicUrl(chemin);
  return data.publicUrl;
}

/**
 * Supprime une ancienne image lors d'un remplacement. Best-effort : une
 * erreur de suppression n'empêche jamais l'enregistrement de la nouvelle
 * image (le fichier orphelin reste dans le bucket, sans conséquence
 * fonctionnelle — juste un peu de stockage inutilisé).
 */
export async function supprimerImage(url: string | null): Promise<void> {
  if (!url) {
    return;
  }
  const marqueur = "/object/public/medias/";
  const index = url.indexOf(marqueur);
  if (index === -1) {
    return;
  }
  const chemin = url.slice(index + marqueur.length);
  const admin = creerClientAdmin();
  await admin.storage.from("medias").remove([chemin]);
}
