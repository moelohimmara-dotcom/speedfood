import "server-only";
import { estUuid } from "@/lib/commande/commun";
import { clientLivraison } from "@/lib/livraison/lecture";
import { approuverLivreur, archiverLivreur, reactiverLivreur, refuserLivreur, suspendreLivreur } from "@/lib/livraison/livreurs-service";
import { assignerManuellement, avancerLivraison, repartir, traiterOffres } from "@/lib/livraison/service";
import { estStatutLivraison, type StatutLivraison } from "@/lib/livraison/statuts";
import type { TraceActionSysteme } from "./audit";

/**
 * Actions de l'exploitation sur les livraisons et les livreurs pour l'application (`/api/v1/equipe/livraisons/*`, `/livreurs/*`) : mêmes règles et mêmes services que le
 * site (`livraisons.ts`, `livreurs.ts`). L'appelant a vérifié la permission `commande.support` et écrit la trace d'audit retournée. Les opérations sensibles
 * réservées au super administrateur (dossier d'identité, création de fiches, liens d'activation) restent sur le site.
 */
export type ResultatExploitation = { ok: true; message: string; trace?: TraceActionSysteme } | { ok: false; message: string };

const refus = (message: string): ResultatExploitation => ({ ok: false, message });

function motifPropre(brut: unknown, obligatoire: boolean): { ok: true; motif: string | undefined } | { ok: false } {
  const m = (typeof brut === "string" ? brut : "").replace(/\s+/g, " ").trim();
  if (obligatoire && m.length < 5) return { ok: false };
  return { ok: true, motif: m === "" ? undefined : m.slice(0, 300) };
}

export async function actionLivraisonEquipe(utilisateurId: string, c: Record<string, unknown>): Promise<ResultatExploitation> {
  const livraisonId = c.livraisonId;
  if (typeof livraisonId !== "string" || !estUuid(livraisonId)) return refus("Livraison invalide.");

  switch (c.action) {
    case "assigner": {
      if (typeof c.livreurId !== "string" || !estUuid(c.livreurId)) return refus("Livreur invalide.");
      const r = await assignerManuellement(livraisonId, c.livreurId);
      if (!r.ok) return refus(r.message);
      return { ok: true, message: "Course affectée.", trace: { action: "livraison.assignee", cibleType: "livraison", cibleId: livraisonId, motif: "Affectation manuelle" } };
    }
    case "relancer": {
      await traiterOffres().catch(() => undefined);
      const parti = await repartir(livraisonId);
      return parti ? { ok: true, message: "Offre envoyée au livreur le plus proche." } : refus("Aucun livreur disponible à proximité pour le moment.");
    }
    case "avancer":
    case "annuler": {
      const vers: unknown = c.action === "annuler" ? "annulee" : c.vers;
      if (typeof vers !== "string" || !estStatutLivraison(vers)) return refus("Demande invalide.");
      const raison = typeof c.raison === "string" ? c.raison.trim().slice(0, 300) : "";
      const r = await avancerLivraison({ livraisonId, acteur: "admin", vers: vers as StatutLivraison, raison: raison || undefined });
      if (!r.ok) return refus(r.message);
      return {
        ok: true,
        message: "Livraison mise à jour.",
        trace: { action: "livraison.statut_modifie", cibleType: "livraison", cibleId: livraisonId, motif: `→ ${vers}${raison ? ` : ${raison.slice(0, 200)}` : ""}` },
      };
    }
    default:
      return refus("Action inconnue.");
  }
}

export async function actionLivreurEquipe(utilisateurId: string, c: Record<string, unknown>): Promise<ResultatExploitation> {
  const livreurId = c.livreurId;
  if (typeof livreurId !== "string" || !estUuid(livreurId)) return refus("Livreur invalide.");

  switch (c.action) {
    case "en_ligne":
    case "hors_ligne": {
      const enLigne = c.action === "en_ligne";
      const { data } = await clientLivraison()
        .from("livreurs")
        .update(enLigne ? { statut: "disponible", position_le: new Date().toISOString() } : { statut: "hors_ligne" })
        .eq("id", livreurId)
        .neq("statut", "en_course")
        .eq("cycle", "actif")
        .select("id");
      if (!data || data.length === 0) return refus("Ce livreur est en course, n'est pas actif ou n'existe plus.");
      if (enLigne) await traiterOffres().catch(() => undefined);
      return { ok: true, message: enLigne ? "Livreur en ligne." : "Livreur hors ligne." };
    }
    case "approuver": {
      const m = motifPropre(c.motif, false);
      if (!m.ok) return refus("Motif invalide.");
      const r = await approuverLivreur(livreurId, utilisateurId, m.motif);
      if (!r.ok) return refus(r.message);
      return { ok: true, message: "Livreur approuvé : il peut se mettre en ligne.", trace: { action: "livreur.approuve", cibleType: "livreur", cibleId: livreurId, motif: m.motif } };
    }
    case "refuser": {
      const m = motifPropre(c.motif, true);
      if (!m.ok || !m.motif) return refus("Indiquez le motif du refus (5 caractères au moins).");
      const r = await refuserLivreur(livreurId, utilisateurId, m.motif);
      if (!r.ok) return refus(r.message);
      return { ok: true, message: "Candidature refusée : la fiche est archivée.", trace: { action: "livreur.refuse", cibleType: "livreur", cibleId: livreurId, motif: m.motif } };
    }
    case "suspendre": {
      const m = motifPropre(c.motif, true);
      if (!m.ok || !m.motif) return refus("Indiquez le motif de la suspension (5 caractères au moins).");
      const r = await suspendreLivreur(livreurId, utilisateurId, m.motif);
      if (!r.ok) return refus(r.message);
      return { ok: true, message: "Livreur suspendu.", trace: { action: "livreur.suspendu", cibleType: "livreur", cibleId: livreurId, motif: m.motif } };
    }
    case "reactiver": {
      const r = await reactiverLivreur(livreurId, utilisateurId);
      if (!r.ok) return refus(r.message);
      return { ok: true, message: "Livreur réactivé.", trace: { action: "livreur.reactive", cibleType: "livreur", cibleId: livreurId } };
    }
    case "archiver": {
      const m = motifPropre(c.motif, true);
      if (!m.ok || !m.motif) return refus("Indiquez le motif de l'archivage (5 caractères au moins).");
      const r = await archiverLivreur(livreurId, utilisateurId, m.motif);
      if (!r.ok) return refus(r.message);
      return { ok: true, message: "Fiche archivée.", trace: { action: "livreur.archive", cibleType: "livreur", cibleId: livreurId, motif: m.motif } };
    }
    default:
      return refus("Action inconnue.");
  }
}
