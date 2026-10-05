/**
 * Réduit une photo de téléphone avant l'envoi (navigateur uniquement). Une photo d'appareil fait souvent 4 à 10 Mo, bien
 * au-dessus de la limite de 5 Mo : le restaurateur voyait « L'image ne peut pas dépasser 5 Mo » sans comprendre pourquoi.
 * Ici elle est ramenée à 1 600 px sur le grand côté, en JPEG, soit environ 200 à 500 Ko. Une petite image est laissée telle quelle.
 */
const COTE_MAX = 1600;
const SEUIL_OCTETS = 1.5 * 1024 * 1024;

export async function reduireImage(fichier: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) return fichier;
  try {
    const bitmap = await createImageBitmap(fichier);
    const plusGrand = Math.max(bitmap.width, bitmap.height);
    if (fichier.size <= SEUIL_OCTETS && plusGrand <= COTE_MAX) {
      bitmap.close();
      return fichier;
    }
    const echelle = Math.min(1, COTE_MAX / plusGrand);
    const largeur = Math.max(1, Math.round(bitmap.width * echelle));
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle));
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return fichier;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    bitmap.close();
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= fichier.size) return fichier;
    return new File([blob], fichier.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Format que le navigateur ne sait pas décoder : on envoie l'original, le serveur le validera.
    return fichier;
  }
}
