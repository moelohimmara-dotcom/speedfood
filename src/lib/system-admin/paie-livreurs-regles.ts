/** Règles pures de la paie des livreurs. Barème de DÉVELOPPEMENT, modifiable ici uniquement. */
export const BAREME_PAIE_DEVELOPPEMENT = {
  forfaitParCourseGnf: 15000,
  partVariableParKmGnf: 500,
  kilometrageMaximumPrisEnCompte: 50,
} as const;

export interface CoursePaie {
  id: string;
  livreurId: string;
  livreurNom: string;
  creeLe: string;
  distanceKm: number | null;
  statut: "livree";
  versementId: string | null;
  versementEtat: "a_verser" | "envoye" | "confirme" | "echoue" | null;
}
export interface LignePaieLivreur {
  livreurId: string;
  livreurNom: string;
  courses: CoursePaie[];
  nombreCourses: number;
  forfaitGnf: number;
  variableGnf: number;
  totalGnf: number;
  versementId: string | null;
  versementEtat: CoursePaie["versementEtat"];
}

export function validerPeriode(debut: Date, fin: Date): void {
  if (!(debut instanceof Date) || Number.isNaN(debut.getTime()) || !(fin instanceof Date) || Number.isNaN(fin.getTime()) || debut >= fin) {
    throw new Error("La période doit avoir une date de début antérieure à la date de fin.");
  }
}
export function calculerGainCourse(distanceKm: number | null, bareme = BAREME_PAIE_DEVELOPPEMENT): number {
  const distance = Number.isFinite(distanceKm) && (distanceKm as number) > 0 ? Math.min(distanceKm as number, bareme.kilometrageMaximumPrisEnCompte) : 0;
  return bareme.forfaitParCourseGnf + Math.round(distance * bareme.partVariableParKmGnf);
}
export function calculerRelevePaie(courses: CoursePaie[], debut: Date, fin: Date, livreurId?: string): LignePaieLivreur[] {
  validerPeriode(debut, fin);
  const groupes = new Map<string, CoursePaie[]>();
  for (const course of courses) {
    const date = new Date(course.creeLe);
    if (Number.isNaN(date.getTime()) || date < debut || date >= fin || (livreurId && course.livreurId !== livreurId)) continue;
    const groupe = groupes.get(course.livreurId) ?? [];
    groupe.push(course);
    groupes.set(course.livreurId, groupe);
  }
  return [...groupes.values()].map((liste) => {
    const premiere = liste[0];
    const variableGnf = liste.reduce((total, c) => total + calculerGainCourse(c.distanceKm) - BAREME_PAIE_DEVELOPPEMENT.forfaitParCourseGnf, 0);
    return { livreurId: premiere.livreurId, livreurNom: premiere.livreurNom, courses: liste, nombreCourses: liste.length, forfaitGnf: liste.length * BAREME_PAIE_DEVELOPPEMENT.forfaitParCourseGnf, variableGnf, totalGnf: liste.reduce((total, c) => total + calculerGainCourse(c.distanceKm), 0), versementId: liste.find((c) => c.versementId)?.versementId ?? null, versementEtat: liste.find((c) => c.versementEtat)?.versementEtat ?? null };
  }).sort((a, b) => a.livreurNom.localeCompare(b.livreurNom, "fr"));
}
