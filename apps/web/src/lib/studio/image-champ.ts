/**
 * Règles de confort du champ « Image » de l'éditeur (palier 3, tâche 8). Module PUR. Elles évitent d'envoyer un fichier
 * qui sera de toute façon refusé ; l'AUTORITÉ reste le serveur (`televerserImage` : type déclaré, ENTÊTE réel du fichier,
 * taille, nom généré côté serveur), qui refait tous les contrôles.
 */

export const TAILLE_MAX_IMAGE = 5 * 1024 * 1024;
export const TYPES_IMAGE = ["image/jpeg", "image/png", "image/webp"] as const;

/** Taille lisible : « 5 Mo », « 6,3 Mo », « 120 Ko ». */
export function decrireTaille(octets: number): string {
  if (octets >= 1024 * 1024) {
    const mo = octets / (1024 * 1024);
    return `${Number.isInteger(mo) ? mo : mo.toFixed(1).replace(".", ",")} Mo`;
  }
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

/** Message de refus d'un fichier choisi (vide, trop gros, mauvais format), ou `null` s'il peut être envoyé. */
export function messageTailleImage(taille: number, type: string): string | null {
  if (!Number.isFinite(taille) || taille <= 0) return "Ce fichier est vide.";
  if (taille > TAILLE_MAX_IMAGE) return `Ce fichier fait ${decrireTaille(taille)} : le maximum est ${decrireTaille(TAILLE_MAX_IMAGE)}.`;
  if (!(TYPES_IMAGE as readonly string[]).includes(type)) {
    return "Format non pris en charge : choisissez une image JPEG, PNG ou WebP (les images SVG et GIF ne sont pas acceptées).";
  }
  return null;
}

/** Nom accessible d'une image de la liste (elle n'a pas de description : on donne son rang et sa date). */
export function libelleImageListe(index: number, creeLe: string | null): string {
  const date = creeLe && /^\d{4}-\d{2}-\d{2}/.test(creeLe) ? creeLe.slice(0, 10).split("-").reverse().join("/") : null;
  return `Utiliser l'image ${index + 1}${date ? `, téléversée le ${date}` : ""}`;
}
