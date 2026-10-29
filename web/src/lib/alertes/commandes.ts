/**
 * Règles pures des alertes de nouvelle commande (console restaurateur) : détecter les arrivées, mesurer
 * l'attente, composer le titre d'onglet. Aucun accès réseau, aucun DOM : testable sans navigateur.
 */

/** Une commande « à traiter » depuis plus longtemps que ceci est mise en évidence (le client attend). */
export const SEUIL_RETARD_MINUTES = 10;

/** Fréquence de vérification des nouvelles commandes quand la console est ouverte. */
export const INTERVALLE_VERIFICATION_MS = 15_000;

/** Tant qu'une commande reste à traiter, le carillon est rejoué à cet intervalle (relance). */
export const INTERVALLE_RELANCE_SON_MS = 120_000;

/** Identifiants présents maintenant qui n'étaient pas connus avant : ce sont les nouvelles commandes. */
export function nouvellesCommandes(connues: ReadonlySet<string>, courantes: readonly string[]): string[] {
  return courantes.filter((id) => !connues.has(id));
}

/** Minutes entières écoulées depuis une date ISO ; 0 si la date est dans le futur ou illisible. */
export function minutesDepuis(iso: string, maintenant: Date): number {
  const debut = new Date(iso).getTime();
  if (!Number.isFinite(debut)) {
    return 0;
  }
  return Math.max(0, Math.floor((maintenant.getTime() - debut) / 60_000));
}

export function enRetard(creeLe: string, maintenant: Date, seuilMinutes: number = SEUIL_RETARD_MINUTES): boolean {
  return minutesDepuis(creeLe, maintenant) >= seuilMinutes;
}

/** Titre d'onglet pendant une alerte : « (2) Nouvelle commande · Commandes · Speedfood ». */
export function titreAlerte(titreInitial: string, nombre: number): string {
  if (nombre <= 0) {
    return titreInitial;
  }
  const libelle = nombre === 1 ? "Nouvelle commande" : "Nouvelles commandes";
  return `(${nombre}) ${libelle} · ${titreInitial}`;
}

/** Relance du son : vrai s'il reste des commandes à traiter et que le dernier son date de plus de l'intervalle. */
export function relanceSonDue(aTraiter: number, dernierSonMs: number | null, maintenantMs: number, intervalleMs: number = INTERVALLE_RELANCE_SON_MS): boolean {
  if (aTraiter <= 0) {
    return false;
  }
  return dernierSonMs === null || maintenantMs - dernierSonMs >= intervalleMs;
}
