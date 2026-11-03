"use server";

import { ErreurMetier, type ErreurApi } from "@/lib/contracts/erreurs";
import type {
  CreationCommandePayload,
  ReponseProposition,
  ResultatActionCommande,
  ResultatCreationCommande,
} from "@/lib/contracts/commande";
import { validerCreationCommande } from "./validation";
import { executerCreationCommande } from "./creation-service";
import { repondreProposition } from "./propositions";
import { estJetonValide } from "./jetons";
import { limiterReponseProposition } from "@/lib/securite/limitation-debit";
import { creerClientServeur } from "@/lib/db/server";
import { declarerPaiement } from "./declaration-paiement";

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
 * Crée une commande pour le compte identifié qui l'envoie (TDR v0.2 §5.1 : plus de commande invitée).
 * Tous les montants sont recalculés côté serveur ; l'idempotence repose sur `cleIdempotence`
 * (voir lib/commande/creation.ts). Sans session, rien n'est créé.
 */
export async function creerCommandeAction(
  payload: CreationCommandePayload
): Promise<ResultatCreationCommande> {
  // L'identité vient de la session côté serveur, jamais d'un champ envoyé par le navigateur.
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  // Sans compte : seule la commande à table peut passer, et seulement si le restaurant l'a autorisé (revérifié dans creerCommande).
  if (!user && (typeof payload !== "object" || payload === null || payload.mode !== "sur_place")) {
    return {
      ok: false,
      erreur: { code: "NON_AUTHENTIFIE", message: "Connectez-vous pour envoyer votre commande." },
    };
  }

  const validation = validerCreationCommande(payload);
  if (!validation.ok) {
    return validation;
  }

  return executerCreationCommande(validation.valeurs, user?.id ?? null, { antiRobot: true });
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

/**
 * Le client déclare avoir réglé le restaurant (code marchand Orange Money ou MTN MoMo) (jamais en espèces) : toute la logique (contrôles, plafond,
 * écriture) vit dans `declaration-paiement.ts`, partagée avec l'application native (`POST /api/v1/suivi/paiement`). Aucune copie ici.
 */
export async function declarerPaiementAction(
  jeton: string,
  mode: string,
  referenceBrute: string
): Promise<ResultatActionCommande> {
  return declarerPaiement(jeton, mode, referenceBrute);
}
