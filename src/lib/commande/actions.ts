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
import { limiterCreationCommande, limiterDeclarationPaiement, limiterReponseProposition } from "@/lib/securite/limitation-debit";
import { creerClientAdmin } from "@/lib/db/admin";
import { chargerSuiviParJeton } from "./requetes";
import { lireReferencePaiement, paiementOuvert, peutDeclarer, type ModePaiement } from "@/lib/paiement/regles";
import { verifierAntiRobot } from "@/lib/securite/turnstile";
import { after } from "next/server";
import { notifierRestaurant } from "@/lib/push/envoi";

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
    // Anti-robot d'abord (si actif) : un jeton invalide ne consomme aucun plafond.
    await verifierAntiRobot(validation.valeurs.jetonVerification);
    await limiterCreationCommande(validation.valeurs.restaurantId, validation.valeurs.client.telephone);
    const cree = await creerCommande(validation.valeurs);
    if (!cree.idempotent) {
      // Alerte « page fermée » du restaurant : après la réponse au client, sans jamais la retarder ni la faire échouer.
      const restaurantId = validation.valeurs.restaurantId;
      after(async () => {
        try {
          await notifierRestaurant(restaurantId);
        } catch {
          console.error("push_indisponible");
        }
      });
    }
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
