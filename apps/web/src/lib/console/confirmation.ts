// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Confirmation commune des consoles (fondations de la refonte, 15 octobre 2026). L'audit avait relevé CINQ façons de confirmer la même
 * idée (`window.confirm` natif sur 8 écrans, saisie de l'e-mail, mot « SUPPRIMER », motif, assistant en deux étapes). Trois niveaux, un
 * seul composant (`src/components/console/`), proportionnés à la gravité :
 *  - `simple`  : un bouton nommé (« Retirer »), pour une action réversible ou de faible portée ;
 *  - `motif`   : un motif écrit obligatoire, tracé dans le journal (action qui touche un client ou un restaurant) ;
 *  - `saisie`  : recopier une phrase exacte (« SUPPRIMER »), pour une action irréversible ou à large portée.
 */
export type NiveauConfirmation = "simple" | "motif" | "saisie";

export const MOTIF_MIN = 5;
export const MOTIF_MAX = 300;

export type ResultatValidation = { ok: true; motif?: string } | { ok: false; erreur: string };

function normaliser(texte: string): string {
  return texte.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Valide ce qui a été saisi pour confirmer. Ne s'occupe que du confort de l'interface : le serveur revérifie toujours (un motif vide
 * ou une phrase fausse envoyée directement à une action serveur doit y être refusée aussi).
 */
export function validerConfirmation(niveau: NiveauConfirmation, saisie: string, phrase?: string): ResultatValidation {
  if (niveau === "simple") return { ok: true };
  if (niveau === "motif") {
    const motif = saisie.replace(/\s+/g, " ").trim();
    if (motif.length < MOTIF_MIN) return { ok: false, erreur: `Indiquez un motif (${MOTIF_MIN} caractères au moins).` };
    if (motif.length > MOTIF_MAX) return { ok: false, erreur: `Le motif ne peut pas dépasser ${MOTIF_MAX} caractères.` };
    return { ok: true, motif };
  }
  if (!phrase || phrase.trim() === "") return { ok: false, erreur: "Aucune phrase de confirmation n'est définie." };
  return normaliser(saisie) === normaliser(phrase) ? { ok: true } : { ok: false, erreur: `Recopiez exactement « ${phrase} » pour confirmer.` };
}
