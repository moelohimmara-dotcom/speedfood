"use server";

import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientServeur } from "@/lib/db/server";
import { limiterNotation } from "@/lib/securite/limitation-debit";
import { enregistrerAvisClient, type ResultatEnregistrement } from "./service";

export interface SaisieNotation {
  restaurant: { note: number; etiquettes: string[]; commentaire: string };
  livreur: { note: number; etiquettes: string[] } | null;
}

/** Le client note le restaurant (et le livreur s'il y en a eu un) pour la commande de ce suivi. Compte connecté obligatoire. */
export async function noterCommandeAction(jeton: string, saisie: SaisieNotation): Promise<ResultatEnregistrement> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { ok: false, erreur: "Connectez-vous pour noter cette commande." };
  if (typeof jeton !== "string" || jeton.length > 200 || !saisie || typeof saisie !== "object") return { ok: false, erreur: "Demande invalide." };
  try {
    await limiterNotation();
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof ErreurMetier ? erreur.message : "Réessayez dans un instant." };
  }
  try {
    return await enregistrerAvisClient({
      jeton,
      utilisateurId: user.id,
      restaurant: { note: saisie.restaurant?.note, etiquettes: saisie.restaurant?.etiquettes, commentaire: saisie.restaurant?.commentaire },
      livreur: saisie.livreur ? { note: saisie.livreur.note, etiquettes: saisie.livreur.etiquettes } : null,
    });
  } catch {
    return { ok: false, erreur: "Enregistrement impossible, réessayez dans un instant." };
  }
}
