import type { EvenementStatutCommande } from "../contracts/commande";
import type { StatutCommande } from "../contracts/statuts";

/** Bornes du délai de préparation déclaré par le restaurateur (minutes) : les mêmes que la contrainte de la base (`restaurants.delai_preparation_minutes`). */
export const DELAI_PREPARATION_MIN = 5;
export const DELAI_PREPARATION_MAX = 240;

export type DelaiPreparation = { ok: true; valeur: number | null } | { ok: false; message: string };

/**
 * Lit le délai saisi (nombre ou texte) : vide = aucune estimation (null) ; sinon un entier de 5 à 240 minutes. Utilisée par la console du site ET par l'application, pour
 * que les deux refusent exactement les mêmes valeurs.
 */
export function lireDelaiPreparation(brut: unknown): DelaiPreparation {
  if (brut === null || brut === undefined) return { ok: true, valeur: null };
  const texte = typeof brut === "number" ? String(brut) : typeof brut === "string" ? brut.trim() : null;
  if (texte === null) return { ok: false, message: "Le délai de préparation est invalide." };
  if (texte === "") return { ok: true, valeur: null };
  if (!/^\d{1,4}$/.test(texte)) return { ok: false, message: "Indiquez le délai en minutes, en chiffres seulement." };
  const valeur = Number(texte);
  if (valeur < DELAI_PREPARATION_MIN || valeur > DELAI_PREPARATION_MAX) {
    return { ok: false, message: `Le délai de préparation doit être compris entre ${DELAI_PREPARATION_MIN} et ${DELAI_PREPARATION_MAX} minutes.` };
  }
  return { ok: true, valeur };
}

/**
 * Heure estimée à laquelle la commande sera prête : heure d'ACCEPTATION par le restaurant + son délai habituel de préparation. Rien n'est promis avant l'acceptation
 * (statut « en_attente »), ni après que la commande est prête, terminée ou close : dans ces cas, null. Calculée ici, côté serveur, pour que le site et l'application
 * affichent la même heure. Renvoie un horodatage ISO (UTC).
 */
export function calculerPretEstimeeLe(statut: StatutCommande, delaiMinutes: number | null | undefined, evenements: readonly EvenementStatutCommande[]): string | null {
  if (statut !== "acceptee" || delaiMinutes === null || delaiMinutes === undefined) return null;
  const acceptation = [...evenements].reverse().find((e) => e.statutSuivant === "acceptee");
  if (!acceptation) return null;
  const debut = Date.parse(acceptation.horodatage);
  if (Number.isNaN(debut)) return null;
  return new Date(debut + delaiMinutes * 60_000).toISOString();
}

/** « 14:35 » : l'heure d'un horodatage ISO, à l'heure de Conakry (UTC+0, sans changement d'heure). Chaîne vide si l'horodatage est illisible. */
export function heureDepuisIso(iso: string): string {
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) return "";
  const d = new Date(instant);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
