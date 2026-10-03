import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { aUnRoleSysteme } from "@/lib/auth/doubleAcces";
import { RappelDoubleAuthentification } from "@/components/RappelDoubleAuthentification";
import { NavigationConsole } from "./NavigationConsole";

/**
 * Console restaurant (bloc 6, TDR.md §5) : navigation basse en 4 tâches compréhensibles plutôt qu'en
 * jargon technique ("libellés simples", "sans naviguer dans le CMS système"), avec la pastille des
 * commandes à traiter. Un lien vers `/system` n'apparaît que si ce compte a *aussi* un rôle système
 * (ADR-010) : un restaurateur ordinaire ne voit jamais cette option.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, membership } = await obtenirContexteRestaurant("/restaurant");
  const [aAussiUnRoleSysteme, { count: aTraiter }] = await Promise.all([
    aUnRoleSysteme(supabase, user.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", membership.restaurant_id)
      .eq("statut", "en_attente"),
  ]);

  return (
    <div className="console-cadre avec-navigation-console">
      <aside className="console-cote">
        <p className="console-marque">Speedfood <span>Espace restaurateur</span></p>
        <NavigationConsole aTraiter={aTraiter ?? 0} />
        <p className="console-liens">
          <Link href="/compte/securite" className="lien-console">
            Sécurité du compte
          </Link>
          {aAussiUnRoleSysteme ? (
            <Link href="/system" className="lien-console">
              Console admin →
            </Link>
          ) : null}
        </p>
      </aside>
      <div className="console-principal">
        <RappelDoubleAuthentification supabase={supabase} administrateur={aAussiUnRoleSysteme} />
        {children}
      </div>
    </div>
  );
}
