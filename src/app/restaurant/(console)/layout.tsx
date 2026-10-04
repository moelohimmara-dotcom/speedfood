import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { deconnexionAction } from "@/lib/auth/actions";
import { aUnRoleSysteme } from "@/lib/auth/doubleAcces";
import { RappelDoubleAuthentification } from "@/components/RappelDoubleAuthentification";
import { AlerteCommandes } from "@/components/AlerteCommandes";
import { InstallationApp } from "@/components/InstallationApp";
import { AdminMenuMobile } from "@/components/admin/AdminMenuMobile";
import { IconeAdmin } from "@/components/admin/icones";
import { NavRestaurantBas, NavRestaurantCote } from "@/components/restaurant/NavRestaurant";
import { lireClesVapid } from "@/lib/push/envoi";

/**
 * Espace restaurateur (refonte du 4 octobre 2026) : même squelette que l'administration (barre latérale sombre sur grand écran,
 * en-tête et tiroir sur téléphone) pour une identité commune, avec en plus une barre de navigation sous le pouce sur téléphone et
 * tablette : le restaurateur est au comptoir, une main occupée. Quatre tâches, la pastille indique les commandes à traiter.
 * Un lien vers `/system` n'apparaît que si ce compte a aussi un rôle système (ADR-010).
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, membership } = await obtenirContexteRestaurant("/restaurant");
  const [aAussiUnRoleSysteme, { count: aTraiter }, { data: restaurant }] = await Promise.all([
    aUnRoleSysteme(supabase, user.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", membership.restaurant_id)
      .eq("statut", "en_attente"),
    supabase.from("restaurants").select("nom, publie").eq("id", membership.restaurant_id).maybeSingle(),
  ]);
  const nombreATraiter = aTraiter ?? 0;

  const marque = (
    <div className="ad-marque">
      {/* eslint-disable-next-line @next/next/no-img-element -- icône locale de l'application, déjà optimisée. */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} />
      <div>
        <span className="ad-marque-nom">Speedfood</span>
        <span className="ad-marque-role">{restaurant?.nom ?? "Espace restaurateur"}</span>
      </div>
    </div>
  );

  const liensBas = (
    <div className="ad-liens-bas">
      <div className="rc-outils">
        <AlerteCommandes clePublique={lireClesVapid()?.clePublique ?? null} />
        <InstallationApp />
      </div>
      {restaurant?.publie ? (
        <Link href={`/restaurants/${membership.restaurant_id}`} className="ad-lien-bas" target="_blank" rel="noopener noreferrer">
          <IconeAdmin nom="boutique" />
          Voir ma page publique
        </Link>
      ) : null}
      <Link href="/compte/securite" className="ad-lien-bas">
        <IconeAdmin nom="securite" />
        Sécurité du compte
      </Link>
      {aAussiUnRoleSysteme ? (
        <Link href="/system" className="ad-lien-bas">
          <IconeAdmin nom="acces" />
          Console admin
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
      <NavRestaurantCote aTraiter={nombreATraiter} />
      {liensBas}
    </div>
  );

  return (
    <div className="ad-app console-resto">
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>

      <aside className="ad-barre-laterale" aria-label="Espace restaurateur">
        {contenuLateral}
      </aside>

      <div className="ad-colonne">
        <header className="ad-entete-mobile">
          {marque}
          <AdminMenuMobile>{contenuLateral}</AdminMenuMobile>
        </header>

        <main id="contenu" tabIndex={-1} className="ad-contenu">
          <RappelDoubleAuthentification supabase={supabase} administrateur={aAussiUnRoleSysteme} />
          {children}
        </main>
      </div>

      <NavRestaurantBas aTraiter={nombreATraiter} />
    </div>
  );
}
