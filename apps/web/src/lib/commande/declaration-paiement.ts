import "server-only";
import { ErreurMetier, type ErreurApi } from "@/lib/contracts/erreurs";
import type { ResultatActionCommande } from "@/lib/contracts/commande";
import { limiterDeclarationPaiement } from "@/lib/securite/limitation-debit";
import { creerClientAdmin } from "@/lib/db/admin";
import { estJetonValide } from "./jetons";
import { chargerSuiviParJeton } from "./requetes";
import { lireReferencePaiement, paiementOuvert, peutDeclarer, type ModePaiement } from "@/lib/paiement/regles";

/**
 * Déclaration du règlement par le client : UN seul chemin pour le site (`declarerPaiementAction`) et l'application native (`POST /api/v1/suivi/paiement`).
 *
 * Le client déclare avoir réglé le restaurant (code marchand Orange Money ou MTN MoMo) (les espèces ne sont plus acceptées : refus VALIDATION). Speedfood ne vérifie aucun paiement :
 * cette déclaration est ensuite CONFIRMÉE (ou contestée) par le restaurateur. Garde-fous : jeton valide, paiement ouvert seulement après acceptation et sans
 * proposition de prix en cours, mode réellement proposé par ce restaurant (code renseigné), référence facultative de 4 à 40 caractères simples, jamais de
 * montant venu du navigateur, et rien n'est modifié si le restaurateur a déjà confirmé la réception.
 *
 * Les paramètres sont `unknown` : l'application native lit un corps JSON, dont rien n'est typé. Le résultat suit le contrat des actions de commande.
 */

function erreurInattendue(): ErreurApi {
  return { code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." };
}

export async function declarerPaiement(jeton: unknown, mode: unknown, referenceBrute: unknown): Promise<ResultatActionCommande> {
  if (!estJetonValide(jeton)) {
    return { ok: false, erreur: { code: "INTROUVABLE", message: "Lien de suivi introuvable." } };
  }
  if (mode === "especes") {
    return { ok: false, erreur: { code: "VALIDATION", message: "Le paiement en espèces n'est pas pris en charge par Speedfood. Le paiement en ligne Chap Chap Pay arrive bientôt." } };
  }
  if (mode !== "orange_money" && mode !== "mtn_momo") {
    return { ok: false, erreur: { code: "VALIDATION", message: "Mode de paiement invalide." } };
  }
  // Une référence qui n'est ni un texte ni vide est refusée comme une référence invalide (le site, lui, ne reçoit que des textes).
  const reference =
    referenceBrute === undefined || referenceBrute === null
      ? lireReferencePaiement("")
      : typeof referenceBrute === "string"
        ? lireReferencePaiement(referenceBrute.slice(0, 80))
        : { ok: false as const };
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
        paiement_statut: "declare",
        paiement_reference: reference.valeur,
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
