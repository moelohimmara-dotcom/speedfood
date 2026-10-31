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
import { limiterDeclarationPaiement, limiterReponseProposition } from "@/lib/securite/limitation-debit";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerClientServeur } from "@/lib/db/server";
import { chargerSuiviParJeton } from "./requetes";
import { lireReferencePaiement, paiementOuvert, peutDeclarer, type ModePaiement } from "@/lib/paiement/regles";

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
 * Le client déclare avoir réglé le restaurant (code marchand Orange Money ou MTN MoMo) ou choisit de payer en espèces.
 * Speedfood ne vérifie aucun paiement : cette déclaration est ensuite CONFIRMÉE (ou contestée) par le restaurateur.
 * Garde-fous : jeton valide, paiement ouvert seulement après acceptation et sans proposition de prix en cours, mode
 * réellement proposé par ce restaurant (code renseigné), référence facultative de 4 à 40 caractères simples, jamais de
 * montant venu du navigateur, et rien n'est modifié si le restaurateur a déjà confirmé la réception.
 */
export async function declarerPaiementAction(
  jeton: string,
  mode: string,
  referenceBrute: string
): Promise<ResultatActionCommande> {
  if (!estJetonValide(jeton)) {
    return { ok: false, erreur: { code: "INTROUVABLE", message: "Lien de suivi introuvable." } };
  }
  if (mode !== "especes" && mode !== "orange_money" && mode !== "mtn_momo") {
    return { ok: false, erreur: { code: "VALIDATION", message: "Mode de paiement invalide." } };
  }
  const reference = lireReferencePaiement(String(referenceBrute ?? "").slice(0, 80));
  if (!reference.ok) {
    return { ok: false, erreur: { code: "VALIDATION", message: "La référence contient 4 à 40 lettres, chiffres, points ou tirets." } };
  }

  try {
    await limiterDeclarationPaiement();
    const suivi = await chargerSuiviParJeton(jeton);
    if (!suivi) {
      return { ok: false, erreur: { code: "INTROUVABLE", message: "Lien de suivi introuvable." } };
    }
    if (!paiementOuvert(suivi.statut, suivi.propositionActive !== null)) {
      return { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Le paiement s'ouvre quand le restaurant a accepté la commande." } };
    }
    if (!peutDeclarer(suivi.paiement.statut)) {
      return { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Le restaurant a déjà confirmé votre paiement." } };
    }
    // Un paiement en ligne ouvert ou abouti n'est pas remplacé par une déclaration manuelle : l'argent serait compté deux fois.
    const etatEnLigne = suivi.paiement.enLigne.etat;
    if (etatEnLigne === "cree" || etatEnLigne === "en_attente" || etatEnLigne === "confirme" || etatEnLigne === "libere" || etatEnLigne === "en_litige") {
      return { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Un paiement en ligne est déjà en cours pour cette commande." } };
    }
    const option = suivi.paiement.options.find((o) => o.mode === mode);
    if (!option) {
      return { ok: false, erreur: { code: "VALIDATION", message: "Ce restaurant n'accepte pas ce mode de paiement." } };
    }

    const choisi = mode as ModePaiement;
    const { data, error } = await creerClientAdmin()
      .from("orders")
      .update({
        paiement_mode: choisi,
        paiement_statut: choisi === "especes" ? "especes" : "declare",
        paiement_reference: choisi === "especes" ? null : reference.valeur,
        paiement_declare_le: new Date().toISOString(),
      })
      .eq("jeton_suivi", jeton)
      .neq("paiement_statut", "recu")
      .select("id");
    if (error || !data || data.length === 0) {
      return { ok: false, erreur: { code: "CONFLIT_ETAT", message: "Le paiement n'a pas pu être enregistré. Actualisez la page." } };
    }
    return { ok: true };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return { ok: false, erreur: erreur.toApi() };
    }
    return { ok: false, erreur: erreurInattendue() };
  }
}
