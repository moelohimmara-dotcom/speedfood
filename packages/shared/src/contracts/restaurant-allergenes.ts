import { estAllergene, type Allergene } from "../menu/classement-personnalise.ts";

/**
 * Allergènes d'un plat, DÉCLARÉS par son restaurant (`POST /api/v1/restaurant/menu/allergenes`). Trois états, jamais confondus :
 *  - une liste (non vide) : les allergènes présents ;
 *  - une liste vide : le restaurant déclare qu'aucun des 14 allergènes réglementaires n'est présent ;
 *  - `null` : retire la déclaration (le plat redevient « non renseigné »).
 * Corps : exactement `platId` et `allergenes`, rien d'autre ; le restaurant est celui du compte, jamais lu dans le corps.
 */
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type LectureAllergenes = { ok: true; platId: string; allergenes: Allergene[] | null } | { ok: false; message: string };

export function lireDemandeAllergenes(corps: unknown): LectureAllergenes {
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return { ok: false, message: "Demande invalide." };
  const o = corps as Record<string, unknown>;
  const cles = Object.keys(o);
  if (cles.length !== 2 || !cles.includes("platId") || !cles.includes("allergenes")) return { ok: false, message: "Demande invalide." };
  if (typeof o.platId !== "string" || !REGEX_UUID.test(o.platId)) return { ok: false, message: "Plat introuvable." };
  if (o.allergenes === null) return { ok: true, platId: o.platId, allergenes: null };
  if (!Array.isArray(o.allergenes) || !o.allergenes.every(estAllergene) || new Set(o.allergenes).size !== o.allergenes.length) return { ok: false, message: "Allergènes invalides." };
  return { ok: true, platId: o.platId, allergenes: o.allergenes as Allergene[] };
}
