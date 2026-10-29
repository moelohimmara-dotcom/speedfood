import "server-only";
import { estUuid } from "@/lib/commande/commun";
import { clientLivraison } from "./lecture";
import { enregistrerPosition, livreurDuCompte } from "./livreur";
import { avancerLivraison, repondreOffre } from "./service";
import type { StatutLivraison } from "./statuts";

/**
 * Actions du livreur, UN seul chemin pour la console du site (actions serveur, identité = session) et l'application native (`/api/v1/livreur/*`, identité =
 * jeton porteur). L'identité arrive ici DÉJÀ établie par l'appelant ; l'identifiant de livreur n'est jamais pris dans la requête : il se déduit du compte.
 * Toutes les règles (machine à états, commande prête, code de remise) sont revérifiées dans `service.ts`.
 */

export type ResultatLivreur = { ok: true } | { ok: false; message: string };

const PAS_LIVREUR: ResultatLivreur = { ok: false, message: "Ce compte n'est pas un compte livreur." };

export async function basculerEnLigne(utilisateurId: string, enLigne: boolean): Promise<ResultatLivreur> {
  const fiche = await livreurDuCompte(utilisateurId);
  if (!fiche) return PAS_LIVREUR;
  const { data } = await clientLivraison()
    .from("livreurs")
    .update(enLigne ? { statut: "disponible" } : { statut: "hors_ligne" })
    .eq("id", fiche.id)
    .neq("statut", "en_course")
    .eq("cycle", enLigne ? "actif" : fiche.cycle)
    .select("id");
  if (!data || data.length === 0) {
    return { ok: false, message: enLigne && fiche.cycle !== "actif" ? "Votre fiche n'est pas active : vous ne pouvez pas vous mettre en ligne." : "Vous êtes en course : terminez-la avant de changer de statut." };
  }
  return { ok: true };
}

export async function envoyerPosition(utilisateurId: string, latitude: number, longitude: number): Promise<ResultatLivreur> {
  const fiche = await livreurDuCompte(utilisateurId);
  if (!fiche) return PAS_LIVREUR;
  const ok = await enregistrerPosition(fiche.id, Number(latitude), Number(longitude));
  return ok ? { ok: true } : { ok: false, message: "Position refusée." };
}

export async function repondreOffreLivreur(utilisateurId: string, offreId: string, reponse: string): Promise<ResultatLivreur> {
  const fiche = await livreurDuCompte(utilisateurId);
  if (!fiche) return PAS_LIVREUR;
  if (!estUuid(offreId) || (reponse !== "acceptee" && reponse !== "refusee")) return { ok: false, message: "Demande invalide." };
  return repondreOffre(offreId, fiche.id, reponse);
}

const ETAPES_LIVREUR: readonly StatutLivraison[] = ["vers_restaurant", "recuperee", "vers_client", "livree", "echec"];

export async function avancerMaCourse(utilisateurId: string, vers: string, code?: string, raison?: string): Promise<ResultatLivreur> {
  const fiche = await livreurDuCompte(utilisateurId);
  if (!fiche) return PAS_LIVREUR;
  if (!(ETAPES_LIVREUR as readonly string[]).includes(vers)) return { ok: false, message: "Étape invalide." };

  const { data: course } = await clientLivraison()
    .from("livraisons")
    .select("id")
    .eq("livreur_id", fiche.id)
    .in("statut", ["assignee", "vers_restaurant", "recuperee", "vers_client"])
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!course) return { ok: false, message: "Vous n'avez pas de course en cours." };

  return avancerLivraison({
    livraisonId: course.id as string,
    acteur: "livreur",
    livreurId: fiche.id,
    vers: vers as StatutLivraison,
    code: vers === "livree" ? String(code ?? "").slice(0, 12) : undefined,
    raison: vers === "echec" ? String(raison ?? "Livraison non aboutie").slice(0, 300) : undefined,
  });
}
