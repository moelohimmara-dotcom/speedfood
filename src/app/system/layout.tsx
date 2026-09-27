import Link from "next/link";
import { deconnexionAction } from "@/lib/auth/actions";
import { Badge, Button } from "@/components/ui";
import { obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import {
  LIBELLES_ROLES,
  roleAPermission,
  SECTIONS_SYSTEME,
  VERSION_MATRICE,
} from "@/lib/system-admin/permissions";
import { SystemNav } from "./SystemNav";

/**
 * Shell du CMS système (bloc 8a) : en-tête avec rôle courant, navigation vers
 * les sous-blocs (8b/8c/8d), rappel de la séparation des surfaces.
 *
 * Défense en profondeur : `obtenirContexteSysteme()` refait le contrôle de rôle
 * dans chaque rendu (404 sans rôle système) — jamais sur le proxy seul
 * (src/proxy.ts). Les entrées de navigation sont filtrées par permission.
 */
export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const contexte = await obtenirContexteSysteme();
  const entrees = SECTIONS_SYSTEME.filter((section) =>
    roleAPermission(contexte.role, section.permission)
  );

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--space-3)",
          marginBottom: "var(--space-5)",
        }}
      >
        <div style={{ flex: "1 1 260px" }}>
          <Link
            href="/system"
            style={{ fontFamily: "var(--font-barlow)", fontSize: "1.5rem", fontWeight: 800 }}
          >
            Administration Speedfood
          </Link>
          <p style={{ color: "var(--secondaire)", fontSize: "0.85rem" }}>
            CMS système — accès réservé aux rôles système.
          </p>
        </div>
        <Badge ton="neutre">Rôle : {LIBELLES_ROLES[contexte.role]}</Badge>
        <form action={deconnexionAction}>
          <Button type="submit" variante="secondary">
            Se déconnecter
          </Button>
        </form>
      </header>

      <SystemNav entrees={entrees} />

      <div
        className="alerte alerte-info"
        role="note"
        style={{ marginBottom: "var(--space-5)", fontSize: "0.85rem" }}
      >
        Séparation des surfaces (ADR-010) : un membership restaurant n&apos;ouvre jamais
        cette console, et un rôle système ne donne aucun accès à la console restaurant
        (/restaurant). Les coordonnées clients restent masquées par défaut ; leur
        révélation exige la permission dédiée, un motif et laisse une trace d&apos;audit.
      </div>

      {children}

      <p
        style={{
          marginTop: "var(--space-8)",
          color: "var(--secondaire)",
          fontSize: "0.75rem",
          textAlign: "center",
        }}
      >
        Matrice de permissions v{VERSION_MATRICE} — voir docs/MATRICE-PERMISSIONS.md
      </p>
    </div>
  );
}
