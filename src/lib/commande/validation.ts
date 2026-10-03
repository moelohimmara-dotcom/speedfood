/**
 * Validation des saisies de commande, partagée navigateur/serveur.
 *
 * Le navigateur peut pré-valider pour afficher les erreurs plus vite, mais le
 * serveur revalide TOUT via ce même module : le navigateur n'est jamais une
 * source d'autorité (TDR.md §6).
 *
 * Règle téléphone (TDR.md §5) : le TDR impose un « nom et numéro de contact »
 * sans format précis. On applique donc une validation raisonnable du format
 * guinéen : 9 chiffres après l'indicatif +224, premier chiffre 6 ou 7
 * (numéros mobiles de Guinée), séparateurs et indicatifs usuels acceptés à la
 * saisie puis normalisés en `+224XXXXXXXXX`. À revoir avec les restaurateurs
 * pilotes si des numéros fixes (2x/3x/4x) doivent aussi commander.
 */

import type {
  CreationCommandePayload,
  LigneCommandeClient,
  ModeRetrait,
} from "@/lib/contracts/commande";
import type { ErreurApi } from "@/lib/contracts/erreurs";
import { estUuid } from "./commun";

export const QUANTITE_MAX_LIGNE = 30;
export const LIGNES_MAX_COMMANDE = 50;
export const PRIX_MAX_GNF = 5_000_000;
export const OPTIONS_MAX_LIGNE = 20;

export type ResultatValidationCreation =
  | { ok: true; valeurs: CreationCommandePayload }
  | { ok: false; erreur: ErreurApi };

/** Normalise un numéro guinéen en `+224XXXXXXXXX`, ou null si invalide. */
const CLE_IDEMPOTENCE_VALIDE =
  /^(panier-)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normaliserTelephone(brut: string): string | null {
  const chiffres = brut.replace(/[\s.\-()]/g, "");
  const m = chiffres.match(/^(?:\+|00)?224(?:0)?([67]\d{8})$/);
  if (m) {
    return `+224${m[1]}`;
  }
  // Saisie nationale sans indicatif : 9 chiffres commençant par 6 ou 7.
  const national = chiffres.match(/^0?([67]\d{8})$/);
  if (national) {
    return `+224${national[1]}`;
  }
  return null;
}

function erreurValidation(
  message: string,
  champs?: Record<string, string>
): { ok: false; erreur: ErreurApi } {
  return { ok: false, erreur: { code: "VALIDATION", message, champs } };
}

/**
 * Valide et normalise les lignes du panier ; fusionne les doublons
 * (même plat ET mêmes suppléments — deux mêmes plats avec des suppléments
 * différents restent deux lignes distinctes, ce ne sont pas les mêmes
 * produits).
 */
export function validerLignes(brut: unknown): { ok: true; lignes: LigneCommandeClient[] } | { ok: false; erreur: ErreurApi } {
  if (!Array.isArray(brut) || brut.length === 0) {
    return erreurValidation("Votre panier est vide.", { lignes: "Ajoutez au moins un plat." });
  }
  if (brut.length > LIGNES_MAX_COMMANDE) {
    return erreurValidation(`Une commande ne peut pas dépasser ${LIGNES_MAX_COMMANDE} lignes.`);
  }

  const parCle = new Map<string, { menuItemId: string; quantite: number; optionIds: string[] }>();
  for (const ligne of brut) {
    if (typeof ligne !== "object" || ligne === null) {
      return erreurValidation("Ligne de commande invalide.");
    }
    const { menuItemId, quantite, optionIds } = ligne as {
      menuItemId?: unknown;
      quantite?: unknown;
      optionIds?: unknown;
    };
    if (!estUuid(menuItemId)) {
      return erreurValidation("Plat invalide dans le panier.");
    }
    if (typeof quantite !== "number" || !Number.isInteger(quantite) || quantite < 1) {
      return erreurValidation("Quantité invalide.", { lignes: "Chaque quantité doit être un entier ≥ 1." });
    }
    const optionIdsBrut = optionIds === undefined ? [] : optionIds;
    if (!Array.isArray(optionIdsBrut) || optionIdsBrut.length > OPTIONS_MAX_LIGNE) {
      return erreurValidation("Suppléments invalides dans le panier.");
    }
    const optionIdsUniques = [...new Set(optionIdsBrut)];
    if (!optionIdsUniques.every((o) => estUuid(o))) {
      return erreurValidation("Suppléments invalides dans le panier.");
    }
    const optionIdsTries = (optionIdsUniques as string[]).sort();

    const cle = `${menuItemId}|${optionIdsTries.join(",")}`;
    const existante = parCle.get(cle);
    const cumul = (existante?.quantite ?? 0) + quantite;
    if (cumul > QUANTITE_MAX_LIGNE) {
      return erreurValidation(
        `Quantité maximale : ${QUANTITE_MAX_LIGNE} par plat (avec les mêmes suppléments).`,
        { lignes: "Réduisez la quantité de certains plats." }
      );
    }
    parCle.set(cle, { menuItemId, quantite: cumul, optionIds: optionIdsTries });
  }

  const lignes: LigneCommandeClient[] = [...parCle.values()];
  return { ok: true, lignes };
}

/**
 * Valide entièrement une création de commande et renvoie la charge utile
 * normalisée (téléphone en `+224…`, adresse nulle en retrait).
 */
export function validerCreationCommande(brut: unknown): ResultatValidationCreation {
  if (typeof brut !== "object" || brut === null) {
    return erreurValidation("Requête invalide.");
  }
  const payload = brut as Partial<CreationCommandePayload> & {
    client?: { nom?: unknown; telephone?: unknown; adresse?: unknown };
  };
  const champs: Record<string, string> = {};

  const cleIdempotence =
    typeof payload.cleIdempotence === "string" ? payload.cleIdempotence.trim() : "";
  // Revue de sécurité, point 10 : une clé courte ou devinable permettrait de rejouer la
  // commande d'un tiers et d'en récupérer le jeton de suivi. On exige un UUID (122 bits
  // aléatoires), avec l'ancien préfixe « panier- » toléré pour les pages déjà ouvertes.
  if (!CLE_IDEMPOTENCE_VALIDE.test(cleIdempotence)) {
    champs.cleIdempotence = "Clé d'idempotence invalide.";
  }

  if (!estUuid(payload.restaurantId)) {
    champs.restaurantId = "Restaurant invalide.";
  }

  const nom = typeof payload.client?.nom === "string" ? payload.client.nom.trim() : "";
  if (nom.length < 2 || nom.length > 120) {
    champs.nom = "Indiquez votre nom (2 à 120 caractères).";
  }

  const telephoneBrut = typeof payload.client?.telephone === "string" ? payload.client.telephone : "";
  const telephone = normaliserTelephone(telephoneBrut);
  if (!telephone) {
    champs.telephone =
      "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (ex. +224 622 12 34 56).";
  }

  const mode = payload.mode;
  if (mode !== "retrait" && mode !== "livraison") {
    champs.mode = "Choisissez le retrait ou la livraison.";
  }

  let adresse: string | null = null;
  const adresseBrute =
    typeof payload.client?.adresse === "string" ? payload.client.adresse.trim() : "";
  if (mode === "livraison") {
    if (adresseBrute.length < 5 || adresseBrute.length > 300) {
      champs.adresse = "L'adresse de livraison est obligatoire (5 à 300 caractères).";
    } else {
      adresse = adresseBrute;
    }
  } else if (adresseBrute.length > 300) {
    champs.adresse = "L'adresse ne peut pas dépasser 300 caractères.";
  } else if (adresseBrute.length > 0) {
    adresse = adresseBrute;
  }

  if (payload.consentementReglement !== true) {
    champs.consentement =
      "Vous devez confirmer avoir pris connaissance du règlement directement avec le restaurant.";
  }

  const lignes = validerLignes(payload.lignes);
  if (!lignes.ok) {
    champs.lignes = lignes.erreur.champs?.lignes ?? lignes.erreur.message;
  }

  if (Object.keys(champs).length > 0 || !telephone || !lignes.ok || (mode !== "retrait" && mode !== "livraison")) {
    return erreurValidation("Certains champs sont à corriger.", champs);
  }

  return {
    ok: true,
    valeurs: {
      cleIdempotence,
      restaurantId: payload.restaurantId as string,
      client: { nom, telephone, adresse },
      mode: mode as ModeRetrait,
      lignes: lignes.lignes,
      consentementReglement: true,
    },
  };
}
