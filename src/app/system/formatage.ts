/**
 * Formats d'affichage des dates du tableau de bord `/system`. Module de
 * présentation pur (pas de `use server`) : aucun secret ni donnée sensible,
 * juste du rendu en français.
 */

/** Date + heure courtes, ex. « 27/09/2026, 18:30 ». */
export function formaterDateCourte(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Échéance d'une proposition de commande, avec reste-à-vivre quand elle est
 * proche — l'opérateur doit voir immédiatement ce qui va expirer.
 */
export function formaterEcheance(iso: string | null): string {
  if (!iso) {
    return "Sans échéance";
  }
  const deltaMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const date = formaterDateCourte(iso);
  if (deltaMinutes < 0) {
    return `Échéance dépassée (${date})`;
  }
  if (deltaMinutes < 60) {
    return `Échéance dans ${deltaMinutes} min (${date})`;
  }
  const heures = Math.round(deltaMinutes / 60);
  if (heures < 24) {
    return `Échéance dans ${heures} h (${date})`;
  }
  return `Échéance le ${date}`;
}
