import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { creerClientServeur } from "@/lib/db/server";
import { retirerFavoriAction } from "@/lib/client/actions-espace";

export const metadata: Metadata = { title: "Mes restaurants favoris" };
export const dynamic = "force-dynamic";

/** Mes restaurants favoris : lus avec la session du client (la RLS ne lui montre que les siens), seuls les restaurants publiés sont proposés. */
export default async function MesFavorisPage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer?suite=/compte/favoris");

  const { data } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("client_favoris")
    .select("restaurant_id, cree_le, restaurants(id, nom, publie, horaires)")
    .order("cree_le", { ascending: false })
    .limit(100);
  type Ligne = { restaurant_id: string; restaurants: { id: string; nom: string; publie: boolean; horaires: string } | { id: string; nom: string; publie: boolean; horaires: string }[] | null };
  const favoris = ((data ?? []) as unknown as Ligne[])
    .map((l) => (Array.isArray(l.restaurants) ? l.restaurants[0] : l.restaurants))
    .filter((r): r is { id: string; nom: string; publie: boolean; horaires: string } => Boolean(r) && r?.publie === true);

  return (
    <main className="page-texte">
      <p>
        <Link href="/compte">← Mon compte</Link>
      </p>
      <h1>Mes restaurants favoris</h1>

      {favoris.length === 0 ? (
        <Card>
          <p>Vous n&apos;avez pas encore de favori.</p>
          <p className="aide-champ">Sur la page d&apos;un restaurant, appuyez sur « Ajouter aux favoris » pour le retrouver ici.</p>
          <Link href="/restaurants" className="btn btn-primary">
            Voir les restaurants
          </Link>
        </Card>
      ) : (
        favoris.map((r) => (
          <Card key={r.id} className="espace-commande">
            <div className="espace-commande-tete">
              <strong>
                <Link href={`/restaurants/${r.id}`}>{r.nom}</Link>
              </strong>
            </div>
            {r.horaires ? <p className="espace-secondaire">{r.horaires}</p> : null}
            <div className="espace-commande-actions">
              <Link href={`/restaurants/${r.id}`} className="btn btn-primary btn-compact">
                Voir le menu
              </Link>
              <form action={retirerFavoriAction.bind(null, r.id)}>
                <button type="submit" className="btn btn-secondary btn-compact">
                  Retirer
                </button>
              </form>
            </div>
          </Card>
        ))
      )}
    </main>
  );
}
