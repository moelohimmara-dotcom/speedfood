import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { PlaceholderSection } from "../PlaceholderSection";

/**
 * Placeholder du bloc 8d (journal d'audit) : la permission est vérifiée dès
 * maintenant. Le journal affichera notamment les révélations de coordonnées
 * (`coordonnees.revelation`), avec acteur, cible, horodatage et motif —
 * la table `audit_events` est append-only (aucune modification ni suppression).
 */
export default async function AuditSystemePage() {
  await exigerPermissionPage("systeme.audit");

  return (
    <PlaceholderSection
      titre="Journal d'audit"
      bloc="8d"
      permission="systeme.audit"
      description="Journal filtrable des actions sensibles (modérations, invitations, révélations de coordonnées) et indicateurs d'activité avec définitions écrites."
    />
  );
}
