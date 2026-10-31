import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { lireAuditEquipe } from "@/lib/system-admin/audit-equipe-service";
import { actionJournalAuditConnue, periodeJournalAuditValide } from "@/lib/system-admin/audit-equipe-regles";

/**
 * Journal d'audit et indicateurs d'activité : permission `systeme.audit`. Lecture seule depuis l'application ; le journal
 * est en écriture seule par le serveur (ADR-010), donc rien n'est modifiable ici.
 *
 * Filtres : `action` (un type d'action du catalogue) et `depuis` (1 = 24 heures, 7 = 7 jours, 30 = 30 jours ; absent
 * = tout l'historique). Un filtre inconnu est ignoré plutôt qu'appliqué à l'aveugle.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "systeme.audit");
  if (!auth.ok) return auth.reponse;
  try {
    const url = new URL(request.url);
    const resultat = await lireAuditEquipe(auth.contexte, {
      action: actionJournalAuditConnue(url.searchParams.get("action")),
      depuisJours: periodeJournalAuditValide(url.searchParams.get("depuis")),
    });
    return repondre({ ok: true, ...resultat });
  } catch {
    return repondreErreur({
      code: "ERREUR_SERVEUR",
      message: "Le journal d'audit n'a pas pu être chargé. Réessayez dans un instant.",
    });
  }
}

export const dynamic = "force-dynamic";
