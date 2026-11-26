/**
 * Horaires d'ouverture d'un restaurant, lus dans le texte libre que les restaurateurs saisissent déjà (« Tous les jours, 11h-23h », « Lundi au samedi, 11h-15h et 18h-23h »).
 * Fonction pure, sans réseau ni base. Heure de Conakry : la Guinée est à UTC+0 toute l'année (pas d'heure d'été), donc l'heure UTC EST l'heure locale.
 *
 * Un texte qui n'est pas compris donne `null` : on ne devine jamais. Sans horaires lisibles, l'état d'ouverture reste celui que le restaurateur règle lui-même (l'interrupteur « Ouvert »).
 * Les horaires sont une INFORMATION de plus, pas une remplaçante de l'interrupteur : un restaurant peut fermer plus tôt, jamais être déclaré « ouvert » par ses seules horaires s'il a coupé l'interrupteur.
 */
export type Jour = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = lundi … 6 = dimanche
export interface Plage { jour: Jour; debutMin: number; /** Peut dépasser 1440 : la plage se termine le lendemain (18h-02h → 1080 à 1560). */ finMin: number }
export interface PlanningHebdo { plages: Plage[] }

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** « 11h », « 11h30 », « 7h-15h » : minutes depuis minuit, ou `null`. « 00h » et « 24h » valent minuit (fin de journée). */
function minutes(h: string, estFin: boolean): number | null {
  const m = /^(\d{1,2})h(\d{2})?$/.exec(h.trim());
  if (!m) return null;
  const heures = Number(m[1]); const mins = m[2] ? Number(m[2]) : 0;
  if (heures > 24 || mins > 59 || (heures === 24 && mins > 0)) return null;
  const total = heures * 60 + mins;
  return estFin && total === 0 ? 1440 : total;
}

function lireJours(texte: string): Jour[] | null {
  const t = normaliser(texte);
  if (t === "tous les jours" || t === "7j/7" || t === "7j sur 7") return [0, 1, 2, 3, 4, 5, 6];
  const plage = /^(\w+) au (\w+)$/.exec(t);
  if (plage) {
    const a = (JOURS as readonly string[]).indexOf(plage[1]); const b = (JOURS as readonly string[]).indexOf(plage[2]);
    if (a < 0 || b < 0) return null;
    const jours: Jour[] = []; for (let j = a; ; j = (j + 1) % 7) { jours.push(j as Jour); if (j === b) break; }
    return jours;
  }
  const liste = t.split(/ et |, /).map((x) => (JOURS as readonly string[]).indexOf(x.trim()));
  if (liste.length > 0 && liste.every((x) => x >= 0)) return [...new Set(liste)] as Jour[];
  return null;
}

/**
 * Comprend « <jours>, <plage>[ et <plage>] » : « Tous les jours, 11h-23h », « Lundi au samedi, 11h-15h et 18h-23h », « Mardi au dimanche, 18h-02h ».
 * Plusieurs blocs séparés par « ; » sont admis (« Lundi au vendredi, 8h-18h ; Samedi, 9h-14h »). `null` si une partie n'est pas comprise.
 */
export function lireHoraires(texte: string | null | undefined): PlanningHebdo | null {
  if (typeof texte !== "string" || texte.trim() === "" || texte.length > 300) return null;
  const plages: Plage[] = [];
  for (const bloc of texte.split(";")) {
    const separation = bloc.indexOf(",");
    if (separation < 0) return null;
    const jours = lireJours(bloc.slice(0, separation));
    if (!jours) return null;
    for (const horaire of normaliser(bloc.slice(separation + 1)).split(/ et /)) {
      const [debutBrut, finBrut, ...reste] = horaire.split("-");
      if (finBrut === undefined || reste.length > 0) return null;
      const debut = minutes(debutBrut, false); const fin = minutes(finBrut, true);
      if (debut === null || fin === null || debut === fin) return null;
      for (const jour of jours) plages.push({ jour, debutMin: debut, finMin: fin > debut ? fin : fin + 1440 });
    }
  }
  return plages.length > 0 ? { plages } : null;
}

/** Jour et minute de la semaine à l'heure de Conakry (UTC+0). */
export function momentConakry(maintenant: Date): { jour: Jour; minute: number } {
  return { jour: (((maintenant.getUTCDay() + 6) % 7) as Jour), minute: maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes() };
}

export interface EtatHoraire {
  ouvert: boolean;
  /** Minutes avant la fermeture (si ouvert) ou avant la prochaine ouverture (si fermé) ; `null` si aucune ouverture n'est prévue dans la semaine. */
  minutesAvantChangement: number | null;
  /** Prochaine ouverture, quand le restaurant est fermé : jour de la semaine et heure. */
  prochaineOuverture: { jour: Jour; debutMin: number } | null;
  /** « Ouvert jusqu'à 23h », « Ferme bientôt (22h) », « Ouvre à 18h », « Ouvre demain à 11h », « Ouvre lundi à 11h ». */
  libelle: string;
}

export const heureLisible = (min: number): string => { const m = ((min % 1440) + 1440) % 1440; const h = Math.floor(m / 60); const r = m % 60; return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, "0")}`; };
const SEUIL_FERMETURE_PROCHE_MIN = 45;

export function etatHoraire(planning: PlanningHebdo, maintenant: Date): EtatHoraire {
  const { jour, minute } = momentConakry(maintenant);
  const t = jour * 1440 + minute; // minute de la semaine
  const SEMAINE = 7 * 1440;
  // Une plage d'un jour peut commencer la semaine précédente (nuit de dimanche à lundi) : on teste la plage et sa copie décalée d'une semaine.
  const intervalles = planning.plages.flatMap((p) => { const d = p.jour * 1440 + p.debutMin; const f = p.jour * 1440 + p.finMin; return [[d, f], [d - SEMAINE, f - SEMAINE], [d + SEMAINE, f + SEMAINE]] as const; });
  const courant = intervalles.find(([d, f]) => d <= t && t < f);
  if (courant) {
    // Plages qui se touchent (11h-15h puis 15h-23h) : la fermeture est celle de la dernière plage jointe.
    let fin = courant[1]; let avance = true;
    while (avance) { avance = false; for (const [d, f] of intervalles) if (d <= fin && f > fin) { fin = f; avance = true; } }
    const reste = fin - t;
    const heure = heureLisible(fin);
    return { ouvert: true, minutesAvantChangement: reste, prochaineOuverture: null, libelle: reste <= SEUIL_FERMETURE_PROCHE_MIN ? `Ferme bientôt (${heure})` : `Ouvert jusqu'à ${heure}` };
  }
  const prochaine = intervalles.filter(([d]) => d > t).sort((a, b) => a[0] - b[0])[0];
  if (!prochaine) return { ouvert: false, minutesAvantChangement: null, prochaineOuverture: null, libelle: "Fermé" };
  const jourOuverture = ((Math.floor(prochaine[0] / 1440) % 7) + 7) % 7 as Jour;
  const debutMin = ((prochaine[0] % 1440) + 1440) % 1440;
  const ecartJours = Math.floor(prochaine[0] / 1440) - jour;
  const quand = ecartJours === 0 ? `à ${heureLisible(debutMin)}` : ecartJours === 1 ? `demain à ${heureLisible(debutMin)}` : `${JOURS[jourOuverture]} à ${heureLisible(debutMin)}`;
  return { ouvert: false, minutesAvantChangement: prochaine[0] - t, prochaineOuverture: { jour: jourOuverture, debutMin }, libelle: `Ouvre ${quand}` };
}

/** Raccourci : l'état d'après le texte des horaires, ou `null` si le texte n'est pas compris. */
export function etatDepuisTexte(texte: string | null | undefined, maintenant: Date): EtatHoraire | null {
  const planning = lireHoraires(texte);
  return planning ? etatHoraire(planning, maintenant) : null;
}
