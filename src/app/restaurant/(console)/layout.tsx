import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { deconnexionAction } from "@/lib/auth/actions";
import { aUnRoleSysteme } from "@/lib/auth/doubleAcces";
import { RappelDoubleAuthentification } from "@/components/RappelDoubleAuthentification";
import { Chevron } from "@/components/Chevron";
import { NavigationConsole } from "./NavigationConsole";

/**
 * Console restaurant (bloc 6, TDR.md §5) : navigation basse sur téléphone, barre latérale sur ordinateur,
 * en 4 tâches compréhensibles plutôt qu'en jargon technique ("libellés simples", "sans naviguer dans le
 * CMS système"), avec la pastille des commandes à traiter, le lien vers la page publique, le compte et la
 * déconnexion. Un lien vers `/system` n'apparaît que si ce compte a *aussi* un rôle système (ADR-010) :
 * un restaurateur ordinaire ne voit jamais cette option.
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

  return (
    <div className="console-cadre avec-navigation-console">
      <aside className="console-cote">
        <p className="console-marque">
          Speedfood <span>{restaurant?.nom ?? "Espace restaurateur"}</span>
        </p>
        <NavigationConsole aTraiter={aTraiter ?? 0} />
        <div className="console-cote-bas">
          {restaurant?.publie ? (
            <Link href={`/restaurants/${membership.restaurant_id}`} className="console-voir-page" target="_blank" rel="noopener noreferrer">
              Voir ma page publique <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
          <div className="console-liens">
            <Link href="/compte/securite" className="lien-console">
              Sécurité du compte
            </Link>
            {aAussiUnRoleSysteme ? (
              <Link href="/system" className="lien-console">
                Console admin <Chevron sens="droite" />
              </Link>
            ) : null}
            <form action={deconnexionAction}>
              <button type="submit" className="lien-console lien-console-bouton">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="console-principal">
        <RappelDoubleAuthentification supabase={supabase} administrateur={aAussiUnRoleSysteme} />
        {children}
      </div>
    </div>
  );
}
