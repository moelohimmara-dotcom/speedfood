import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { aUnRoleSysteme } from "@/lib/auth/doubleAcces";
import { OngletNav } from "./OngletNav";

/**
 * Console restaurant (bloc 6, TDR.md §5) : navigation regroupée en 4 tâches
 * compréhensibles plutôt qu'en jargon technique, comme demandé par le TDR :
 * "libellés simples", "sans naviguer dans le CMS système". Un lien vers
 * `/system` n'apparaît que si ce compte a *aussi* un rôle système (ADR-010) :
 * un restaurateur ordinaire ne voit jamais cette option.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await obtenirContexteRestaurant("/restaurant");
  const aAussiUnRoleSysteme = await aUnRoleSysteme(supabase, user.id);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      <nav
        style={{
          display: "flex",
          gap: 4,
          background: "var(--surface)",
          border: "1px solid var(--bordure)",
          borderRadius: "var(--radius-pill)",
          padding: 4,
          marginBottom: "var(--space-6)",
          overflowX: "auto",
          maxWidth: "100%",
        }}
      >
        <OngletNav href="/restaurant" label="Accueil" />
        <OngletNav href="/restaurant/commandes" label="Commandes" />
        <OngletNav href="/restaurant/menu" label="Menu" />
        <OngletNav href="/restaurant/profil" label="Mon restaurant" />
      </nav>
      {aAussiUnRoleSysteme ? (
        <p style={{ marginTop: -16, marginBottom: "var(--space-5)", textAlign: "right" }}>
          <Link href="/system" style={{ fontSize: "0.85rem", color: "var(--secondaire)", fontWeight: 700 }}>
            Console admin →
          </Link>
        </p>
      ) : null}
      {children}
    </div>
  );
}
