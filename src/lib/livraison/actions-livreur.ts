"use server";

import { creerClientServeur } from "@/lib/db/server";
import { estUuid } from "@/lib/commande/commun";
import { clientLivraison } from "./lecture";
import { enregistrerPosition, lireEtatLivreur, livreurDuCompte, type EtatLivreur } from "./livreur";
import { avancerLivraison, repondreOffre } from "./service";
import type { StatutLivraison } from "./statuts";

/**
 * Actions du livreur depuis sa console. L'identité vient de la SESSION (compte lié à une fiche livreur) : un identifiant de livreur
 * envoyé par le navigateur n'est jamais cru. Toutes les règles (machine à états, commande prête, code de remise) sont revérifiées
 * dans le service.
 */

async function livreurConnecte() {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return null;
  const fiche = await livreurDuCompte(user.id);
  return fiche ? { utilisateurId: user.id, fiche } : null;
}

export type ResultatLivreur = { ok: true } | { ok: false; message: string };

export async function lireMonEtatAction(): Promise<EtatLivreur | null> {
  const moi = await livreurConnecte();
  return moi ? lireEtatLivreur(moi.utilisateurId) : null;
}

export async function basculerEnLigneAction(enLigne: boolean): Promise<ResultatLivreur> {
  const moi = await livreurConnecte();
  if (!moi) return { ok: false, message: "Ce compte n'est pas un compte livreur." };
  const { data } = await clientLivraison()
    .from("livreurs")
    .update(enLigne ? { statut: "disponible" } : { statut: "hors_ligne" })
    .eq("id", moi.fiche.id)
    .neq("statut", "en_course")
    .eq("cycle", enLigne ? "actif" : moi.fiche.cycle)
    .select("id");
  if (!data || data.length === 0) {
    return { ok: false, message: enLigne && moi.fiche.cycle !== "actif" ? "Votre fiche n'est pas active : vous ne pouvez pas vous mettre en ligne." : "Vous êtes en course : terminez-la avant de changer de statut." };
  }
  return { ok: true };
}

export async function envoyerPositionAction(latitude: number, longitude: number): Promise<ResultatLivreur> {
  const moi = await livreurConnecte();
  if (!moi) return { ok: false, message: "Ce compte n'est pas un compte livreur." };
  const ok = await enregistrerPosition(moi.fiche.id, Number(latitude), Number(longitude));
  return ok ? { ok: true } : { ok: false, message: "Position refusée." };
}

export async function repondreOffreLivreurAction(offreId: string, reponse: "acceptee" | "refusee"): Promise<ResultatLivreur> {
  const moi = await livreurConnecte();
  if (!moi) return { ok: false, message: "Ce compte n'est pas un compte livreur." };
  if (!estUuid(offreId) || (reponse !== "acceptee" && reponse !== "refusee")) return { ok: false, message: "Demande invalide." };
  return repondreOffre(offreId, moi.fiche.id, reponse);
}

const ETAPES_LIVREUR: readonly StatutLivraison[] = ["vers_restaurant", "recuperee", "vers_client", "livree", "echec"];

export async function avancerMaCourseAction(vers: string, code?: string, raison?: string): Promise<ResultatLivreur> {
  const moi = await livreurConnecte();
  if (!moi) return { ok: false, message: "Ce compte n'est pas un compte livreur." };
  if (!(ETAPES_LIVREUR as readonly string[]).includes(vers)) return { ok: false, message: "Étape invalide." };

  const { data: course } = await clientLivraison()
    .from("livraisons")
    .select("id")
    .eq("livreur_id", moi.fiche.id)
    .in("statut", ["assignee", "vers_restaurant", "recuperee", "vers_client"])
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!course) return { ok: false, message: "Vous n'avez pas de course en cours." };

  return avancerLivraison({
    livraisonId: course.id as string,
    acteur: "livreur",
    livreurId: moi.fiche.id,
    vers: vers as StatutLivraison,
    code: vers === "livree" ? String(code ?? "").slice(0, 12) : undefined,
    raison: vers === "echec" ? String(raison ?? "Livraison non aboutie").slice(0, 300) : undefined,
  });
}
