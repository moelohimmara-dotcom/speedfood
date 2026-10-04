import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RestaurantCard } from "@/components/RestaurantCard";
import { LienRetour } from "@/components/LienRetour";
import { Alert } from "@/components/ui";
import { estUuid } from "@/lib/commande/commun";
import { lireCatalogue } from "@/lib/decouverte/recherche";
import {
  LIBELLES_ALTERNATIVES,
  ORDRE_GROUPES_ALTERNATIVES,
  trouverAlternatives,
} from "@/lib/decouverte/alternatives";
import { ancienneteLisible, etatRestaurant, libelleDisponibilite } from "@/lib/disponibilite/etat";
import type { Metadata } from "next";

/**
 * « Trouver ailleurs » : alternatives à un plat épuisé (SPEC-PILOTE 3.3). Rien n'est
 * jamais ajouté au panier : le client choisit, chaque proposition porte sa disponibilité
 * horodatée et son groupe (même plat, ou suggestion d'un plat différent).
 */
export const metadata: Metadata = { title: "Trouver ailleurs" };

export default async function AlternativesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plat?: string }>;
}) {
  const { id } = await params;
  const { plat: platId } = await searchParams;
  if (!estUuid(id) || !estUuid(platId)) {
    notFound();
  }

  const catalogue = await lireCatalogue();
  if (catalogue.erreur) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
        <Alert ton="danger">Impossible de charger les alternatives pour le moment. Réessayez dans un instant.</Alert>
      </main>
    );
  }

  const restaurantSource = catalogue.restaurants.find((r) => r.id === id);
  const platSource = catalogue.platsParRestaurant.get(id)?.find((p) => p.id === platId);
  if (!restaurantSource) {
    notFound();
  }
  if (!platSource) {
    // Le restaurant existe, c'est le plat qui n'est plus au menu : on revient à sa fiche.
    redirect(`/restaurants/${id}`);
  }

  const { maintenant, fraicheurHeures } = catalogue;
  const alternatives = trouverAlternatives({
    source: { nom: platSource.nom, restaurantId: id, categorieId: restaurantSource.categorieId },
    restaurants: catalogue.restaurants,
    platsParRestaurant: catalogue.platsParRestaurant,
    fraicheurHeures,
    maintenant,
  });

  const epuise = !platSource.disponible;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <LienRetour href={`/restaurants/${id}`}>Retour à {restaurantSource.nom}</LienRetour>
      <h1 style={{ fontSize: "1.8rem", margin: "var(--space-3) 0 var(--space-2)" }}>Trouver ailleurs</h1>
      <p style={{ color: "var(--secondaire)", margin: "0 0 var(--space-2)" }}>
        « {platSource.nom} » {epuise ? "est épuisé" : "n'est pas forcément disponible"} chez {restaurantSource.nom}
        {platSource.confirmeLe
          ? ` (information de ${ancienneteLisible(new Date(platSource.confirmeLe), maintenant)})`
          : ""}
        .
      </p>
      <p style={{ color: "var(--secondaire)", fontSize: "0.85rem", margin: "0 0 var(--space-5)" }}>
        Rien n&apos;est ajouté à votre panier : c&apos;est vous qui choisissez. Seuls les restaurants ouverts qui
        acceptent des commandes sont proposés. La disponibilité est déclarée par chaque restaurant ; sans
        reconfirmation depuis {fraicheurHeures} h, elle s&apos;affiche « à confirmer ».
      </p>

      {alternatives.length === 0 ? (
        <Alert ton="info">
          Aucune alternative ouverte pour le moment.{" "}
          <Link href={`/restaurants?q=${encodeURIComponent(platSource.nom)}`} style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", minHeight: 44 }}>
            Chercher « {platSource.nom} » dans tout le catalogue
          </Link>
        </Alert>
      ) : (
        ORDRE_GROUPES_ALTERNATIVES.map((groupe) => {
          const duGroupe = alternatives.filter((a) => a.groupe === groupe);
          if (duGroupe.length === 0) {
            return null;
          }
          return (
            <section key={groupe}>
              <h2 className="groupe-resultats-titre">{LIBELLES_ALTERNATIVES[groupe]}</h2>
              <div className="grille-restaurants">
                {duGroupe.map((a) => (
                  <RestaurantCard
                    key={`${a.restaurant.id}-${a.plat.id}`}
                    id={a.restaurant.id}
                    nom={a.restaurant.nom}
                    etat={etatRestaurant(a.restaurant)}
                    photoUrl={a.restaurant.photoUrl}
                    logoUrl={a.restaurant.logoUrl}
                    couleurAccent={a.restaurant.couleurAccent}
                    couvertureIllustration={a.restaurant.couvertureIllustration}
                    logoIllustration={a.restaurant.logoIllustration}
                    categorie={a.restaurant.categorie}
                    quartier={a.restaurant.quartier}
                    plats={[
                      {
                        id: a.plat.id,
                        nom: a.plat.nom,
                        prixAffiche: a.plat.prixPromo ?? a.plat.prix,
                        disponibilite: libelleDisponibilite(a.etat, maintenant),
                      },
                    ]}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}
