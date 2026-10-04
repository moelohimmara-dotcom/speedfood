import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerRestaurantsAdmin, type StatutFiltre } from "@/lib/system-admin/restaurants";
import { EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { formaterDateCourte } from "../../formatage";

export const metadata = { title: "Restaurants (administration)" };

const LIBELLES_FILTRE: Record<StatutFiltre, string> = {
  tous: "Tous",
  en_attente: "En attente",
  publies: "Publiés",
  suspendus: "Suspendus",
  correction: "Correction demandée",
};

const ORDRE_FILTRES: StatutFiltre[] = ["tous", "en_attente", "publies", "suspendus", "correction"];

interface Recherche {
  q?: string;
  statut?: string;
}

/**
 * Liste, recherche et filtres des restaurants pour modération. La permission est vérifiée ici (page) ; chaque action
 * l'est de nouveau dans `src/lib/system-admin/restaurants.ts` (défense en profondeur).
 */
export default async function RestaurantsComptesSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  const contexte = await exigerPermissionPage("restaurant.moderer");

  const { q, statut: statutBrut } = await searchParams;
  const statut: StatutFiltre = ORDRE_FILTRES.includes(statutBrut as StatutFiltre) ? (statutBrut as StatutFiltre) : "tous";

  const restaurants = await listerRestaurantsAdmin({ q, statut });

  return (
    <div>
      <PageHeader titre="Catalogue" description="Validez, suspendez ou demandez une correction aux restaurants avant leur publication." />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <div className="ad-outils">
        <form method="GET" role="search" className="ad-recherche">
          {statut !== "tous" ? <input type="hidden" name="statut" value={statut} /> : null}
          <label htmlFor="q" className="sr-only">
            Rechercher un restaurant
          </label>
          <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Rechercher un restaurant" />
          <button type="submit" className="btn btn-secondary btn-compact">
            Rechercher
          </button>
        </form>
        <div className="ad-filtres" role="group" aria-label="Filtrer par statut">
          {ORDRE_FILTRES.map((valeur) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (valeur !== "tous") params.set("statut", valeur);
            const chaine = params.toString();
            return (
              <Link
                key={valeur}
                href={chaine ? `/system/catalogue/restaurants?${chaine}` : "/system/catalogue/restaurants"}
                className={`chip ${statut === valeur ? "actif" : ""}`}
                aria-current={statut === valeur ? "true" : undefined}
              >
                {LIBELLES_FILTRE[valeur]}
              </Link>
            );
          })}
        </div>
      </div>

      {restaurants.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="catalogue" titre="Aucun restaurant" texte="Aucun restaurant ne correspond à cette recherche. Essayez un autre filtre." />
        </div>
      ) : (
        <>
          <p className="ad-resume" role="status">
            {restaurants.length} restaurant{restaurants.length > 1 ? "s" : ""}
          </p>
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Restaurants du catalogue</caption>
              <thead>
                <tr>
                  <th scope="col">Restaurant</th>
                  <th scope="col">Catégorie</th>
                  <th scope="col">Quartier</th>
                  <th scope="col">Créé le</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => (
                  <tr key={r.id}>
                    <td className="ad-cellule-principale" data-label="Restaurant">
                      <Link href={`/system/catalogue/restaurants/${r.id}`}>{r.nom}</Link>
                    </td>
                    <td className="ad-secondaire" data-label="Catégorie">
                      {r.categorie || "—"}
                    </td>
                    <td className="ad-secondaire" data-label="Quartier">
                      {r.quartier || "—"}
                    </td>
                    <td className="ad-secondaire" data-label="Créé le">
                      {formaterDateCourte(r.cree_le)}
                    </td>
                    <td data-label="Statut">
                      {r.suspendu_le ? (
                        <Pastille ton="danger">Suspendu</Pastille>
                      ) : r.motif_correction ? (
                        <Pastille ton="attention">Correction demandée</Pastille>
                      ) : r.publie ? (
                        <Pastille ton="succes">Publié</Pastille>
                      ) : (
                        <Pastille ton="neutre">En attente</Pastille>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
