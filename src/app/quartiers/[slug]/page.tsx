import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CartePub } from "@/components/site/CartePub";
import { lireQuartier } from "@/lib/site/accueil";
import { origineDuSite } from "@/lib/partage/origine";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { quartier } = await lireQuartier(slug);
  if (!quartier) {
    return { title: "Quartier introuvable", robots: { index: false } };
  }
  const origine = await origineDuSite();
  return {
    title: `Restaurants à ${quartier.nom}, Conakry`,
    description: `${quartier.restaurants} restaurant${quartier.restaurants > 1 ? "s" : ""} à ${quartier.nom} sur Speedfood : cartes, prix et disponibilité confirmée par chaque restaurant.`,
    alternates: { canonical: `${origine}/quartiers/${quartier.slug}` },
  };
}

export default async function QuartierPage({ params }: Props) {
  const { slug } = await params;
  const { quartier, restaurants, platsParRestaurant, erreur } = await lireQuartier(slug);
  if (!erreur && !quartier) {
    notFound();
  }
  const ordonnes = [...restaurants].sort((a, b) => Number(b.ouvert && b.accepteCommandes) - Number(a.ouvert && a.accepteCommandes) || a.nom.localeCompare(b.nom, "fr"));

  return (
    <main className="pub-conteneur pub-rubrique">
      <nav aria-label="Fil d'Ariane" className="pub-fil">
        <Link href="/quartiers">Quartiers</Link>
        <span aria-hidden="true"> / </span>
        <span>{quartier?.nom ?? "Quartier"}</span>
      </nav>
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">
          {quartier ? `${quartier.restaurants} restaurant${quartier.restaurants > 1 ? "s" : ""}` : "Quartier"}
          {quartier && quartier.ouverts > 0 ? ` · ${quartier.ouverts} ouvert${quartier.ouverts > 1 ? "s" : ""} en ce moment` : ""}
        </p>
        <h1 className="pub-titre pub-h1-page">
          Restaurants à <span className="pub-surligne">{quartier?.nom ?? "Conakry"}</span>
        </h1>
      </div>

      {erreur ? (
        <p className="pub-vide">Impossible de charger ce quartier pour le moment. Réessayez dans un instant.</p>
      ) : (
        <div className="pub-grille-cartes">
          {ordonnes.map((r, i) => (
            <CartePub key={r.id} restaurant={r} plats={platsParRestaurant.get(r.id) ?? []} grande={i === 0 && ordonnes.length >= 3} niveauTitre={2} />
          ))}
        </div>
      )}
      <div>
        <Link href="/restaurants" className="pub-btn pub-btn-clair">
          Tous les restaurants
        </Link>
      </div>
    </main>
  );
}
