import { projeterFicheLivreur, type FicheLivreur } from "./livreur-fiche.ts";

/**
 * Contrat de l'état livreur pour les applications natives (lot G2) : la fiche de G1 et, séparément, l'offre en attente.
 * Aucune donnée de client (nom, téléphone, adresse), aucune coordonnée du client ; les points géographiques servent au
 * calcul des distances côté serveur et ne sortent jamais. Frais en GNF entiers, jamais de flottant monétaire.
 */
export interface OffreLivreur {
  offreId: string;
  /** Échéance ISO de l'offre : passé cette heure, elle n'est plus proposable et disparaît à la relecture. */
  expireLe: string;
  restaurantNom: string;
  /** Distance de la course (restaurant vers client), en km à une décimale ; `null` si inconnue. */
  distanceCourseKm: number | null;
  /** Distance du livreur au restaurant, en km à une décimale ; `null` si sa position est inconnue. */
  distanceRestaurantKm: number | null;
  fraisGnf: number;
}

export interface EtatLivreur {
  fiche: FicheLivreur;
  offre: OffreLivreur | null;
}

function texte(brut: unknown, defaut: string, max: number): string {
  if (typeof brut !== "string") return defaut;
  const propre = brut.trim().replace(/\s+/g, " ");
  return propre === "" ? defaut : propre.slice(0, max);
}

function distanceKm(brut: unknown): number | null {
  if (typeof brut !== "number" || !Number.isFinite(brut) || brut < 0) return null;
  return Math.round(brut * 10) / 10;
}

/**
 * Projection défensive de l'offre : ne conserve que les six champs du contrat. Une distance douteuse devient `null`
 * (inconnue, jamais un faux zéro) ; un frais qui n'est pas un entier d'au moins 0, une échéance illisible ou un
 * identifiant absent REJETTENT l'offre entière (mieux vaut aucune offre qu'une offre au prix douteux).
 */
export function projeterOffreLivreur(brut: unknown): OffreLivreur | null {
  if (typeof brut !== "object" || brut === null) return null;
  const o = brut as Record<string, unknown>;
  if (typeof o.offreId !== "string" || o.offreId === "") return null;
  if (typeof o.expireLe !== "string" || Number.isNaN(Date.parse(o.expireLe))) return null;
  if (typeof o.fraisGnf !== "number" || !Number.isInteger(o.fraisGnf) || o.fraisGnf < 0) return null;
  return {
    offreId: o.offreId,
    expireLe: o.expireLe,
    restaurantNom: texte(o.restaurantNom, "Restaurant", 80),
    distanceCourseKm: distanceKm(o.distanceCourseKm),
    distanceRestaurantKm: distanceKm(o.distanceRestaurantKm),
    fraisGnf: o.fraisGnf,
  };
}

/** Projection de l'état complet : fiche par le contrat G1, offre par la projection ci-dessus (`null` si absente ou rejetée). */
export function projeterEtatLivreur(ficheBrute: unknown, offreBrute: unknown): EtatLivreur {
  return { fiche: projeterFicheLivreur(ficheBrute as Parameters<typeof projeterFicheLivreur>[0]), offre: projeterOffreLivreur(offreBrute) };
}

function invalide(): never { throw new Error("ETAT_LIVREUR_ILLISIBLE"); }

/**
 * Lecture STRICTE de la réponse d'état par le client : enveloppe exacte, fiche par le parseur G1, offre revérifiée champ
 * par champ. Une offre présente mais illisible (échéance ou frais douteux) rend la réponse illisible plutôt que d'être
 * adoucie ou inventée ; les distances restent adoucies en « inconnue » par la projection partagée.
 */
export function lireReponseEtatLivreur(v: unknown): EtatLivreur | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return invalide();
  const o = v as Record<string, unknown>;
  if (o.ok !== true || !Object.hasOwn(o, "etat")) return invalide();
  if (o.etat === null) return null;
  if (typeof o.etat !== "object" || Array.isArray(o.etat)) return invalide();
  const e = o.etat as Record<string, unknown>;
  const fiche = projeterFicheLivreur(e.fiche);
  if (e.offre === null) return { fiche, offre: null };
  const offre = projeterOffreLivreur(e.offre);
  if (offre === null) return invalide();
  return { fiche, offre };
}

/** Réponse de la bascule de disponibilité : seul `{ ok: true }` confirme ; tout le reste est illisible ou un refus explicite. */
export function lireReponseEnLigneLivreur(v: unknown): true {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return invalide();
  if ((v as Record<string, unknown>).ok !== true) return invalide();
  return true;
}
