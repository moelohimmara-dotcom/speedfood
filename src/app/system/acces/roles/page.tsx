import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerRolesSysteme } from "@/lib/system-admin/roles";
import { Card } from "@/components/ui";
import { SousNav } from "../../SousNav";
import { FormulaireAttributionRole } from "./FormulaireAttributionRole";
import { RoleItem } from "./RoleItem";

/**
 * Attribution et retrait des rôles système (super_admin, operations,
 * content_editor, support), permission `systeme.roles` réservée à
 * `super_admin` (ADR-010, TDR.md §4). Jamais d'auto-attribution depuis une
 * inscription publique : seul ce formulaire, tenu par un super_admin déjà en
 * place, fait entrer un compte dans `system_admin_memberships`.
 *
 * Garde-fou obligatoire : `retirerRoleAction` (src/lib/system-admin/roles.ts)
 * refuse de retirer le dernier super_admin restant. La procédure de secours en
 * dernier recours (dashboard Supabase + SQL direct) reste documentée dans
 * docs/STATUT-PROJET.md.
 */
export default async function RolesSystemePage() {
  const contexte = await exigerPermissionPage("systeme.roles");
  const membres = await listerRolesSysteme();

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Accès</h1>
      <SousNav entrees={sousSectionsAccessibles("Accès", contexte.role)} />

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Attribuer un rôle</h2>
        <p style={{ color: "var(--secondaire)", marginTop: 0, marginBottom: "var(--space-3)" }}>
          Le compte doit déjà exister (créé via /inscription) — cet écran attribue un rôle système,
          il n&apos;en crée pas.
        </p>
        <FormulaireAttributionRole />
      </Card>

      {membres.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucun compte n&apos;a de rôle système.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {membres.map((membre) => (
            <RoleItem key={membre.utilisateurId} membre={membre} />
          ))}
        </div>
      )}
    </div>
  );
}
