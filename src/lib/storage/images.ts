import "server-only";
import { randomUUID } from "node:crypto";
import { creerClientAdmin } from "@/lib/db/admin";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { cheminMediaDepuisUrl } from "./chemins";
import { limiterTeleversement } from "@/lib/securite/limitation-debit";

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

function signatureCorrespond(o: Uint8Array, type: string): boolean {
  const ascii = (debut: number, texte: string) =>
    [...texte].every((c, i) => o[debut + i] === c.charCodeAt(0));
  if (type === "image/jpeg") {
    return o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;
  }
  if (type === "image/png") {
    return o[0] === 0x89 && ascii(1, "PNG") && o[4] === 0x0d && o[5] === 0x0a && o[6] === 0x1a && o[7] === 0x0a;
  }
  if (type === "image/webp") {
    return ascii(0, "RIFF") && ascii(8, "WEBP");
  }
  return false;
}

export type DossierMedia = "restaurants" | "plats" | "bannieres" | "logos" | "studio";

/**
 * Valide et téléverse une image, renvoie son URL publique.
 * Lève `ErreurMetier("VALIDATION", ...)` si le fichier est absent, d'un type
 * non autorisé, ou trop volumineux.
 */
export async function televerserImage(
  fichier: File | null,
  dossier: DossierMedia,
  restaurantId?: string
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

  // Le type MIME déclaré par le navigateur ne prouve rien : on vérifie la signature
  // réelle du fichier (revue de sécurité, point 14).
  const entete = new Uint8Array(await fichier.slice(0, 12).arrayBuffer());
  if (!signatureCorrespond(entete, fichier.type)) {
    throw new ErreurMetier("VALIDATION", "Le fichier n'est pas une image valide.", {
      image: "Fichier invalide.",
    });
  }

  // Quota d'envois par restaurant (audit du 4 octobre 2026), compté seulement pour un fichier valide.
  if (restaurantId) {
    await limiterTeleversement(restaurantId);
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
 * Supprime un fichier qui vient d'être téléversé mais que l'enregistrement en base n'a pas retenu (échec de l'écriture) :
 * sans cela il resterait orphelin dans le stockage. Le fichier est tout neuf (nom aléatoire), aucune ligne ne le référence.
 */
export async function supprimerTeleversementOrphelin(url: string | null | undefined): Promise<void> {
  const chemin = url ? cheminMediaDepuisUrl(url) : null;
  if (!chemin) {
    return;
  }
  await creerClientAdmin().storage.from("medias").remove([chemin]).catch(() => undefined);
}

/**
 * Supprime une ancienne image lors d'un remplacement. Best-effort : une
 * erreur de suppression n'empêche jamais l'enregistrement de la nouvelle
 * image (le fichier orphelin reste dans le bucket, sans conséquence
 * fonctionnelle — juste un peu de stockage inutilisé).
 *
 * À appeler APRÈS la mise à jour de la ligne concernée. Garde-fou entre
 * restaurants : un membre peut écrire une URL arbitraire dans sa propre ligne
 * (RLS), y compris celle d'une image d'un autre restaurant. Tant qu'une autre
 * ligne référence encore ce fichier, on ne le supprime pas.
 */
export async function supprimerImage(url: string | null): Promise<void> {
  if (!url) {
    return;
  }
  const chemin = cheminMediaDepuisUrl(url);
  if (!chemin) {
    return;
  }

  const admin = creerClientAdmin();
  const [restaurantsPhoto, restaurantsLogo, plats, bannieres] = await Promise.all([
    admin.from("restaurants").select("id", { count: "exact", head: true }).eq("photo_url", url),
    admin.from("restaurants").select("id", { count: "exact", head: true }).eq("logo_url", url),
    admin.from("menu_items").select("id", { count: "exact", head: true }).eq("photo_url", url),
    admin.from("content_banners").select("id", { count: "exact", head: true }).eq("image_url", url),
  ]);
  const erreurs = [restaurantsPhoto, restaurantsLogo, plats, bannieres].some((r) => r.error);
  const encoreReference = [restaurantsPhoto, restaurantsLogo, plats, bannieres].some(
    (r) => (r.count ?? 0) > 0
  );
  // En cas de doute (erreur de lecture), on conserve le fichier.
  if (erreurs || encoreReference) {
    return;
  }

  await admin.storage.from("medias").remove([chemin]);
}
