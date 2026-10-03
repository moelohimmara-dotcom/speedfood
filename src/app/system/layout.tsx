import Link from "next/link";
import { deconnexionAction } from "@/lib/auth/actions";
import { Badge } from "@/components/ui";
import { obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { aUnMembershipRestaurant } from "@/lib/auth/doubleAcces";
import {
  entreesNavPourRole,
  LIBELLES_ROLES,
  VERSION_MATRICE,
} from "@/lib/system-admin/permissions";
import { RappelDoubleAuthentification } from "@/components/RappelDoubleAuthentification";
import { SystemNav } from "./SystemNav";

/**
 * Shell du CMS système : en-tête avec rôle courant, navigation groupée par
 * domaine (Catalogue/Contenu/Commandes/Accès/Paramètres/Audit), rappel de la
 * séparation des surfaces.
 *
 * Défense en profondeur : `obtenirContexteSysteme()` refait le contrôle de rôle
 * dans chaque rendu (404 sans rôle système) — jamais sur le proxy seul
 * (src/proxy.ts). Les entrées de navigation sont filtrées par permission
 * (`entreesNavPourRole` : un groupe apparaît si au moins une de ses
 * sous-sections est accessible ; chaque page affiche ensuite sa propre
 * sous-navigation via `SousNav`).
 */
export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const contexte = await obtenirContexteSysteme();
  const entrees = entreesNavPourRole(contexte.role);
  const aAussiUnRestaurant = await aUnMembershipRestaurant(contexte.supabase, contexte.utilisateurId);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
      <header className="sys-entete">
        <div className="sys-entete-titre">
          <Link
            href="/system"
            style={{ fontFamily: "var(--font-barlow)", fontSize: "1.5rem", fontWeight: 800 }}
          >
            Administration Speedfood
          </Link>
          <Badge ton="neutre">Rôle : {LIBELLES_ROLES[contexte.role]}</Badge>
        </div>
        <div className="sys-entete-liens">
          <Link href="/compte/securite" className="lien-console">
            Sécurité du compte
          </Link>
          {aAussiUnRestaurant ? (
            <Link href="/restaurant" className="lien-console">
              Mon restaurant
            </Link>
          ) : null}
          <form action={deconnexionAction}>
            <button type="submit" className="lien-console lien-console-bouton">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <SystemNav entrees={entrees} />

      <RappelDoubleAuthentification supabase={contexte.supabase} administrateur />

      <details className="sys-note">
        <summary>Séparation des surfaces</summary>
        <p>
          (ADR-010) Un membership restaurant n&apos;ouvre jamais cette console, et un rôle système ne donne
          aucun accès à la console restaurant (/restaurant). Les coordonnées clients restent masquées par
          défaut ; leur révélation exige la permission dédiée, un motif et laisse une trace d&apos;audit.
        </p>
      </details>

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
