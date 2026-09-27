import Link from "next/link";
import { Card } from "@/components/ui";
import { obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import {
  LIBELLES_PERMISSIONS,
  LIBELLES_ROLES,
  permissionsDuRole,
  roleAPermission,
  SECTIONS_SYSTEME,
  VERSION_MATRICE,
} from "@/lib/system-admin/permissions";

/**
 * Accueil du CMS système (bloc 8a) : vue d'ensemble des sections ouvertes au
 * rôle courant et rappel du périmètre de ce rôle. Les écrans métier arrivent
 * dans les blocs 8b/8c/8d ; chaque page placeholder vérifie déjà sa permission.
 */
export default async function AccueilCmsSystemePage() {
  const contexte = await obtenirContexteSysteme();
  const permissions = permissionsDuRole(contexte.role);
  const sections = SECTIONS_SYSTEME.filter((section) =>
    roleAPermission(contexte.role, section.permission)
  );

  return (
    <div>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-2)" }}>Vue d&apos;ensemble</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-5)" }}>
        Vous êtes connecté en tant que {LIBELLES_ROLES[contexte.role]}. Chaque section
        affichée ci-dessous est ouverte à votre rôle ; les autres n&apos;existent pas pour lui.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        {sections.map((section) => (
          <Card key={section.href}>
            <p style={{ color: "var(--secondaire)", fontSize: "0.75rem", marginBottom: 4 }}>
              Bloc {section.bloc}
            </p>
            <h2 style={{ fontSize: "1.15rem", marginBottom: 4 }}>
              <Link href={section.href}>{section.libelle}</Link>
            </h2>
            <p style={{ color: "var(--secondaire)", fontSize: "0.85rem" }}>{section.resume}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 style={{ fontSize: "1.15rem", marginBottom: "var(--space-3)" }}>
          Ce que votre rôle permet
        </h2>
        <ul style={{ paddingLeft: "1.2rem", color: "var(--secondaire)", fontSize: "0.9rem" }}>
          {permissions.map((permission) => (
            <li key={permission} style={{ marginBottom: 4 }}>
              {LIBELLES_PERMISSIONS[permission]}
            </li>
          ))}
        </ul>
        <p style={{ marginTop: "var(--space-3)", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          Matrice de permissions v{VERSION_MATRICE} — toute évolution est versionnée dans
          docs/MATRICE-PERMISSIONS.md et dans src/lib/system-admin/permissions.ts.
        </p>
      </Card>
    </div>
  );
}
