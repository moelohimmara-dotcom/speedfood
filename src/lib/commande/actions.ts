"use server";

import { ErreurMetier, type ErreurApi } from "@/lib/contracts/erreurs";
import type {
  CreationCommandePayload,
  ReponseProposition,
  ResultatActionCommande,
  ResultatCreationCommande,
} from "@/lib/contracts/commande";
import { validerCreationCommande } from "./validation";
import { creerCommande } from "./creation";
import { repondreProposition } from "./propositions";
import { estJetonValide } from "./jetons";
import { limiterCreationCommande, limiterReponseProposition } from "@/lib/securite/limitation-debit";

/**
 * Actions serveur du parcours client invité (ADR-005).
 *
 * ADR-011 : ces actions passent par `creerClientAdmin()` (service-role) car les
 * tables de commande n'ont aucune policy RLS pour `anon`. Le service-role ne
 * quitte jamais le serveur (imports "server-only" en aval) et l'autorisation du
 * client repose sur la connaissance du jeton de suivi opaque.
 */

function erreurInattendue(): ErreurApi {
  return {
    code: "ERREUR_SERVEUR",
    message: "Une erreur est survenue. Réessayez dans un instant.",
  };
}

/**
 * Crée une commande invitée. Tous les montants sont recalculés côté serveur ;
 * l'idempotence repose sur `cleIdempotence` (voir lib/commande/creation.ts).
 */
export async function creerCommandeAction(
  payload: CreationCommandePayload
): Promise<ResultatCreationCommande> {
  const validation = validerCreationCommande(payload);
  if (!validation.ok) {
    return validation;
  }

  try {
    await limiterCreationCommande(validation.valeurs.restaurantId, validation.valeurs.client.telephone);
    const cree = await creerCommande(validation.valeurs);
    return {
      ok: true,
      reference: cree.reference,
      jeton: cree.jeton,
      idempotent: cree.idempotent,
    };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return { ok: false, erreur: erreur.toApi() };
    }
    return { ok: false, erreur: erreurInattendue() };
  }
}

/**
 * Réponse du client à la proposition révisée courante (accepter ou refuser).
 * Idempotente ; seul le porteur du jeton peut répondre.
 */
export async function repondrePropositionAction(
  jeton: string,
  propositionId: string,
  reponse: ReponseProposition
): Promise<ResultatActionCommande> {
  if (!estJetonValide(jeton)) {
    return { ok: false, erreur: { code: "INTROUVABLE", message: "Lien de suivi introuvable." } };
  }
  if (reponse !== "acceptee" && reponse !== "refusee") {
    return { ok: false, erreur: { code: "VALIDATION", message: "Réponse invalide." } };
  }
  if (typeof propositionId !== "string" || propositionId.length === 0) {
    return { ok: false, erreur: { code: "VALIDATION", message: "Proposition invalide." } };
  }

  try {
    await limiterReponseProposition();
    await repondreProposition(jeton, propositionId, reponse);
    return { ok: true };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return { ok: false, erreur: erreur.toApi() };
    }
    return { ok: false, erreur: erreurInattendue() };
  }
}
