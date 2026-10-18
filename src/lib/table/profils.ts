// Pur, sans dépendance : testable seul (npm run test:unit). Voir docs/COMMANDE-SUR-PLACE.md.

import type { ReglageValidation, ServiceTable } from "./regles";

/**
 * Profils de service en un clic. Un profil règle la FAÇON DE SERVIR et la VALIDATION ; il ne touche JAMAIS à « commander sans compte » :
 * c'est une dérogation au principe « pas d'écriture sans compte » (TDR §5.1) que le restaurateur doit décider lui-même.
 */
export type ProfilService = "fast_food" | "restaurant" | "haut_de_gamme";

export interface ReglagesProfil {
  service: ServiceTable;
  validation: ReglageValidation;
}

export const PROFILS: Record<ProfilService, ReglagesProfil & { libelle: string; description: string }> = {
  fast_food: {
    libelle: "Fast-food",
    description: "Au comptoir, numéro d'appel, les commandes partent directement en cuisine.",
    service: "comptoir",
    validation: "aucune",
  },
  restaurant: {
    libelle: "Restaurant",
    description: "À table, une note par table ; le serveur valide la première commande de chaque table.",
    service: "table",
    validation: "premiere",
  },
  haut_de_gamme: {
    libelle: "Haut de gamme",
    description: "À table, le serveur valide chaque commande avant la cuisine.",
    service: "table",
    validation: "toutes",
  },
};

export const ORDRE_PROFILS: readonly ProfilService[] = ["fast_food", "restaurant", "haut_de_gamme"];

/** Le profil qui correspond exactement à ces réglages, ou `null` (réglage personnalisé). */
export function profilCorrespondant(r: ReglagesProfil): ProfilService | null {
  return ORDRE_PROFILS.find((p) => PROFILS[p].service === r.service && PROFILS[p].validation === r.validation) ?? null;
}

/** Réglages obtenus en appliquant un profil à des réglages existants : seuls `service` et `validation` changent. */
export function appliquerProfil<T extends ReglagesProfil>(actuels: T, profil: ProfilService): T {
  return { ...actuels, service: PROFILS[profil].service, validation: PROFILS[profil].validation };
}

export interface ReglagesSurPlace extends ReglagesProfil {
  actif: boolean;
  sansCompte: boolean;
}

/** Phrase de synthèse affichée en haut de la page : l'état du service en une ligne. */
export function resumerService(r: ReglagesSurPlace): string {
  if (!r.actif) return "Service sur place : désactivé";
  const mode = r.service === "comptoir" ? "Au comptoir (numéro d'appel)" : "À table (une note par table)";
  const compte = r.sansCompte ? "Commande sans compte autorisée" : "Compte requis";
  const validation = r.validation === "aucune" ? "Aucune validation" : r.validation === "premiere" ? "Première commande validée" : "Toutes les commandes validées";
  return `Service sur place : activé · ${mode} · ${compte} · ${validation}`;
}

/** Le client peut-il commander sans compte alors que la validation est « aucune » ? Le serveur impose alors « première » : on le dit. */
export function validationEffective(r: Pick<ReglagesSurPlace, "validation" | "sansCompte">): ReglageValidation {
  return r.sansCompte && r.validation === "aucune" ? "premiere" : r.validation;
}

export function reglagesIdentiques(a: ReglagesSurPlace, b: ReglagesSurPlace): boolean {
  return a.actif === b.actif && a.service === b.service && a.sansCompte === b.sansCompte && a.validation === b.validation;
}
