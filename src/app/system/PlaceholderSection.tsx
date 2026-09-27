import { Badge, Card } from "@/components/ui";
import {
  LIBELLES_PERMISSIONS,
  LIBELLES_ROLES,
  rolesAvecPermission,
  type Permission,
} from "@/lib/system-admin/permissions";

interface PlaceholderSectionProps {
  titre: string;
  bloc: "8a" | "8b" | "8c" | "8d";
  permission: Permission;
  description: string;
  children?: React.ReactNode;
}

/**
 * Écran placeholder des futurs sous-blocs du CMS (8a/8b/8c/8d). Chaque page
 * qui l'utilise a DÉJÀ vérifié la permission affichée via
 * `exigerPermissionPage` — le badge n'est qu'un rappel, pas le contrôle.
 */
export function PlaceholderSection({
  titre,
  bloc,
  permission,
  description,
  children,
}: PlaceholderSectionProps) {
  return (
    <Card>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-3)" }}>
        <Badge ton="neutre">Bloc {bloc} — à venir</Badge>
        <Badge ton="neutre">Permission : {LIBELLES_PERMISSIONS[permission]}</Badge>
      </div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>{titre}</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-3)" }}>{description}</p>
      <p style={{ fontSize: "0.85rem", color: "var(--secondaire)" }}>
        Accès réservé aux rôles :{" "}
        {rolesAvecPermission(permission)
          .map((role) => LIBELLES_ROLES[role])
          .join(", ")}
        .
      </p>
      {children}
    </Card>
  );
}
