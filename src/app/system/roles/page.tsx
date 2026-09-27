import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { PlaceholderSection } from "../PlaceholderSection";

/**
 * Placeholder du bloc 8a (gestion des rôles système) : la permission est
 * vérifiée dès maintenant. Seul `super_admin` atteint cette page — attribution
 * et retrait des rôles système uniquement, jamais d'auto-attribution, et jamais
 * depuis une inscription publique (ADR-010, TDR.md §4).
 */
export default async function RolesSystemePage() {
  await exigerPermissionPage("systeme.roles");

  return (
    <PlaceholderSection
      titre="Rôles système"
      bloc="8a"
      permission="systeme.roles"
      description="Attribution et retrait des rôles système (super_admin, operations, content_editor, support) avec traces d'audit. La procédure de récupération d'accès reste documentée dans docs/STATUT-PROJET.md (dashboard Supabase + SQL en dernier recours)."
    />
  );
}
