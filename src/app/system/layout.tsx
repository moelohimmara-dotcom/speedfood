import Link from "next/link";
import { deconnexionAction } from "@/lib/auth/actions";
import { obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { aUnMembershipRestaurant } from "@/lib/auth/doubleAcces";
import { entreesNavPourRole, LIBELLES_ROLES, VERSION_MATRICE } from "@/lib/system-admin/permissions";
import { RappelDoubleAuthentification } from "@/components/RappelDoubleAuthentification";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminMenuMobile } from "@/components/admin/AdminMenuMobile";
import { IconeAdmin } from "@/components/admin/icones";
import type { Metadata } from "next";

/**
 * Shell de l'administration (refonte du 4 octobre 2026) : barre latérale sombre sur grand écran, en-tête et tiroir sur
 * téléphone et tablette. Les surfaces restent visuellement séparées du site client (ADR-010).
 *
 * Défense en profondeur : `obtenirContexteSysteme()` refait le contrôle de rôle dans chaque rendu (404 sans rôle
 * système), jamais sur le proxy seul (src/proxy.ts). Les entrées de navigation sont filtrées par permission
 * (`entreesNavPourRole`) ; chaque page affiche ensuite sa propre sous-navigation (`SousNav`).
 */
export const metadata: Metadata = { title: "Administration" };

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const contexte = await obtenirContexteSysteme();
  const entrees = entreesNavPourRole(contexte.role);
  const aAussiUnRestaurant = await aUnMembershipRestaurant(contexte.supabase, contexte.utilisateurId);

  const marque = (
    <div className="ad-marque">
      {/* eslint-disable-next-line @next/next/no-img-element -- icône locale de l'application, déjà optimisée. */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} />
      <div>
        <span className="ad-marque-nom">Speedfood</span>
        <span className="ad-marque-role">{LIBELLES_ROLES[contexte.role]}</span>
      </div>
    </div>
  );

  const liensBas = (
    <div className="ad-liens-bas">
      <Link href="/compte/securite" className="ad-lien-bas">
        <IconeAdmin nom="securite" />
        Sécurité du compte
      </Link>
      {aAussiUnRestaurant ? (
        <Link href="/restaurant" className="ad-lien-bas">
          <IconeAdmin nom="boutique" />
          Mon restaurant
        </Link>
      ) : null}
      <form action={deconnexionAction}>
        <button type="submit" className="ad-lien-bas">
          <IconeAdmin nom="sortie" />
          Se déconnecter
        </button>
      </form>
    </div>
  );

  const contenuLateral = (
    <div className="ad-lateral-interieur">
      {marque}
      <AdminNav entrees={entrees} />
      {liensBas}
    </div>
  );

  return (
    <div className="ad-app">
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>

      <aside className="ad-barre-laterale" aria-label="Administration Speedfood">
        {contenuLateral}
      </aside>

      <div className="ad-colonne">
        <header className="ad-entete-mobile">
          {marque}
          <AdminMenuMobile>{contenuLateral}</AdminMenuMobile>
        </header>

        <main id="contenu" tabIndex={-1} className="ad-contenu">
          <RappelDoubleAuthentification supabase={contexte.supabase} administrateur />

          {children}

          <footer className="ad-pied">
            <details>
              <summary>Séparation des surfaces</summary>
              <p>
                (ADR-010) Un membership restaurant n&apos;ouvre jamais cette console, et un rôle système ne donne aucun accès à la
                console restaurant. Les coordonnées clients restent masquées par défaut ; leur révélation exige la permission
                dédiée, un motif et laisse une trace d&apos;audit.
              </p>
            </details>
            <p>Matrice de permissions v{VERSION_MATRICE} (docs/MATRICE-PERMISSIONS.md).</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
