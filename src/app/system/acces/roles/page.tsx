import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerRolesSysteme } from "@/lib/system-admin/roles";
import { EtatVide, PageHeader, Panneau } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { FormulaireAttributionRole } from "./FormulaireAttributionRole";
import { RoleItem } from "./RoleItem";

export const metadata = { title: "Rôles système (administration)" };

/**
 * Attribution et retrait des rôles système (super_admin, operations, content_editor, support), permission
 * `systeme.roles` réservée à `super_admin` (ADR-010, TDR.md §4). Jamais d'auto-attribution depuis une inscription
 * publique : seul ce formulaire, tenu par un super_admin déjà en place, fait entrer un compte dans
 * `system_admin_memberships`.
 *
 * Garde-fou obligatoire : `retirerRoleAction` (src/lib/system-admin/roles.ts) refuse de retirer le dernier super_admin
 * restant. La procédure de secours en dernier recours (dashboard Supabase + SQL direct) reste documentée dans
 * docs/STATUT-PROJET.md.
 */
export default async function RolesSystemePage() {
  const contexte = await exigerPermissionPage("systeme.roles");
  const membres = await listerRolesSysteme();

  return (
    <div>
      <PageHeader titre="Accès" description="Qui peut faire quoi dans l'administration. Seul un super administrateur modifie les rôles." />
      <SousNav entrees={sousSectionsAccessibles("Accès", contexte.role)} />

      <Panneau titre="Attribuer un rôle">
        <p style={{ color: "var(--secondaire)", marginTop: 0 }}>
          Le compte doit déjà exister (créé via /inscription) : cet écran attribue un rôle système, il n&apos;en crée pas.
        </p>
        <FormulaireAttributionRole />
      </Panneau>

      <div style={{ marginTop: "var(--space-5)" }}>
        {membres.length === 0 ? (
          <div className="ad-panneau">
            <EtatVide icone="acces" titre="Aucun rôle système" texte="Aucun compte n'a de rôle système." />
          </div>
        ) : (
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Comptes disposant d&apos;un rôle système</caption>
              <thead>
                <tr>
                  <th scope="col">Compte</th>
                  <th scope="col">Rôle</th>
                  <th scope="col" className="ad-droite">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {membres.map((membre) => (
                  <RoleItem key={membre.utilisateurId} membre={membre} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
