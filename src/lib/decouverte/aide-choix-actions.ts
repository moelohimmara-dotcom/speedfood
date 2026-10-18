"use server";

import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientServeur } from "@/lib/db/server";
import { clientLivraison } from "@/lib/livraison/lecture";
import { limiterAideChoix } from "@/lib/securite/limitation-debit";
import { budgetValide } from "./aide-choix";
import { chercherAideChoix, type PositionClient, type ResultatAideChoix } from "./aide-choix-service";

export interface DemandeAideChoix {
  budgetGnf: number;
  position: PositionClient;
  categorieId?: string;
  /** Retenir le quartier choisi sur le compte (compte connecté seulement). */
  retenirQuartier?: boolean;
}

export type ReponseAideChoix = { ok: true; resultat: ResultatAideChoix } | { ok: false; erreur: string };

function positionValide(p: unknown): p is PositionClient {
  if (!p || typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  if (x.type === "gps") return typeof x.latitude === "number" && typeof x.longitude === "number" && Number.isFinite(x.latitude) && Number.isFinite(x.longitude);
  return (x.type === "quartier" || x.type === "commune") && estUuid(x.id);
}

/**
 * Cherche des restaurants selon le budget et la position. La position GPS est utilisée pour CE calcul puis oubliée : elle n'est ni
 * enregistrée ni journalisée. Seul un quartier choisi peut être retenu sur le compte, sur demande explicite.
 */
export async function aideAuChoixAction(demande: DemandeAideChoix): Promise<ReponseAideChoix> {
  if (!demande || !budgetValide(demande.budgetGnf)) return { ok: false, erreur: "Indiquez un budget entre 5 000 et 1 000 000 GNF." };
  if (!positionValide(demande.position)) return { ok: false, erreur: "Indiquez votre position ou choisissez votre quartier." };
  if (demande.categorieId !== undefined && !estUuid(demande.categorieId)) return { ok: false, erreur: "Type de cuisine invalide." };
  try {
    await limiterAideChoix();
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof ErreurMetier ? erreur.message : "Réessayez dans un instant." };
  }
  try {
    const resultat = await chercherAideChoix({ budgetGnf: demande.budgetGnf, position: demande.position, categorieId: demande.categorieId });
    if (resultat.erreur) return { ok: false, erreur: "Impossible de lire les restaurants pour le moment. Réessayez dans un instant." };

    if (demande.retenirQuartier && demande.position.type === "quartier") {
      const {
        data: { user },
      } = await (await creerClientServeur()).auth.getUser();
      if (user) {
        await clientLivraison().from("client_profils").update({ quartier_prefere_id: demande.position.id }).eq("utilisateur_id", user.id);
      }
    }
    return { ok: true, resultat };
  } catch {
    return { ok: false, erreur: "Impossible de lancer la recherche pour le moment. Réessayez dans un instant." };
  }
}

/** Oublie le quartier retenu sur le compte. */
export async function oublierQuartierRetenuAction(): Promise<{ ok: boolean }> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { ok: false };
  const { error } = await clientLivraison().from("client_profils").update({ quartier_prefere_id: null }).eq("utilisateur_id", user.id);
  return { ok: !error };
}
