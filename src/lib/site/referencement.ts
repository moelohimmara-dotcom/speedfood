// Pur, sans dépendance serveur : testable seul (npm run test:unit).
import { normaliserTelephone } from "../commande/telephone";
import { validerContactAlerte } from "./zone-alerte";

/**
 * Demande de référencement (« Demander à être référencé »), qui remplace l'inscription libre des restaurateurs (ADR-020) : l'équipe rappelle,
 * visite, signe l'accord, puis crée l'établissement et tient son catalogue. Validation partagée entre le formulaire et l'action serveur.
 */

export const TYPES_ETABLISSEMENT = ["restaurant", "epicerie"] as const;
export type TypeEtablissement = (typeof TYPES_ETABLISSEMENT)[number];

export const LIBELLES_TYPES: Record<TypeEtablissement, string> = { restaurant: "Un restaurant", epicerie: "Une épicerie" };

export const STATUTS_REFERENCEMENT = ["nouvelle", "rappelee", "visite_prevue", "accord", "refusee", "creee"] as const;
export type StatutReferencement = (typeof STATUTS_REFERENCEMENT)[number];

export const LIBELLES_STATUTS_REFERENCEMENT: Record<StatutReferencement, string> = {
  nouvelle: "Nouvelle",
  rappelee: "Rappelée",
  visite_prevue: "Visite prévue",
  accord: "Accord signé",
  refusee: "Refusée",
  creee: "Établissement créé",
};

export interface DemandeReferencement {
  type: TypeEtablissement;
  organisation: string;
  commune: string;
  quartier: string;
  indications: string | null;
  latitude: number | null;
  longitude: number | null;
  categories: string | null;
  specialites: string | null;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
}

export type ResultatReferencement = { ok: true; demande: DemandeReferencement } | { ok: false; erreur: string };

export function lireTypeEtablissement(brut: unknown): TypeEtablissement | null {
  return TYPES_ETABLISSEMENT.find((t) => t === brut) ?? null;
}

export function lireStatutReferencement(brut: unknown): StatutReferencement | null {
  return STATUTS_REFERENCEMENT.find((s) => s === brut) ?? null;
}

function nettoyer(brut: unknown, max: number): string {
  return String(brut ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

/** Étendue approximative de la Guinée : sert à repérer une faute de frappe (signe oublié, chiffres inversés), pas à délimiter une frontière. */
const LATITUDE_GUINEE = [7, 13] as const;
const LONGITUDE_GUINEE = [-15.5, -7.5] as const;

function lireCoordonnee(brut: unknown): number | null | "invalide" {
  const texte = String(brut ?? "").trim().replace(",", ".");
  if (texte === "") return null;
  if (!/^-?\d{1,3}(\.\d{1,8})?$/.test(texte)) return "invalide";
  return Number(texte);
}

export function validerDemandeReferencement(brut: {
  type: unknown;
  organisation: unknown;
  commune: unknown;
  quartier: unknown;
  indications: unknown;
  latitude: unknown;
  longitude: unknown;
  categories: unknown;
  specialites: unknown;
  prenom: unknown;
  nom: unknown;
  email: unknown;
  telephone: unknown;
}): ResultatReferencement {
  const type = lireTypeEtablissement(brut.type);
  if (!type) return { ok: false, erreur: "Indiquez s'il s'agit d'un restaurant ou d'une épicerie." };
  const organisation = nettoyer(brut.organisation, 120);
  if (organisation.length < 2) return { ok: false, erreur: "Indiquez le nom de votre établissement." };
  const commune = nettoyer(brut.commune, 80);
  if (commune.length < 2) return { ok: false, erreur: "Indiquez la commune de votre établissement." };
  const quartier = nettoyer(brut.quartier, 80);
  if (quartier.length < 2) return { ok: false, erreur: "Indiquez le quartier de votre établissement." };

  const latitude = lireCoordonnee(brut.latitude);
  const longitude = lireCoordonnee(brut.longitude);
  if (latitude === "invalide" || longitude === "invalide") {
    return { ok: false, erreur: "Les coordonnées GPS doivent être des nombres (par exemple 9.5370 et -13.6785)." };
  }
  if ((latitude === null) !== (longitude === null)) return { ok: false, erreur: "Indiquez la latitude et la longitude ensemble, ou aucune des deux." };
  if (latitude !== null && longitude !== null) {
    if (latitude < LATITUDE_GUINEE[0] || latitude > LATITUDE_GUINEE[1] || longitude < LONGITUDE_GUINEE[0] || longitude > LONGITUDE_GUINEE[1]) {
      return { ok: false, erreur: "Ces coordonnées ne semblent pas situées en Guinée. Vérifiez le signe et l'ordre (latitude puis longitude)." };
    }
  }

  const prenom = nettoyer(brut.prenom, 60);
  if (prenom.length < 1) return { ok: false, erreur: "Indiquez le prénom du responsable." };
  const nom = nettoyer(brut.nom, 60);
  if (nom.length < 1) return { ok: false, erreur: "Indiquez le nom du responsable." };

  const courriel = validerContactAlerte(String(brut.email ?? ""));
  if (!courriel.ok || courriel.type !== "email") return { ok: false, erreur: "Cette adresse e-mail ne semble pas valide." };
  const telephone = normaliserTelephone(String(brut.telephone ?? ""));
  if (!telephone) return { ok: false, erreur: "Ce numéro ne semble pas valide (numéro guinéen à 9 chiffres, par exemple 622 00 00 00)." };

  const optionnel = (v: unknown, max: number) => nettoyer(v, max) || null;
  return {
    ok: true,
    demande: {
      type,
      organisation,
      commune,
      quartier,
      indications: optionnel(brut.indications, 300),
      latitude,
      longitude,
      categories: optionnel(brut.categories, 200),
      specialites: optionnel(brut.specialites, 200),
      prenom,
      nom,
      email: courriel.contact,
      telephone,
    },
  };
}
