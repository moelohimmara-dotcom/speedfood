import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerMisesEnAvant, listerRestaurantsPublies } from "@/lib/system-admin/misesEnAvant";
import { EtatVide, PageHeader, Panneau } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { FormulaireNouvelleMiseEnAvant } from "./FormulaireNouvelleMiseEnAvant";
import { MiseEnAvantItem } from "./MiseEnAvantItem";

export const metadata = { title: "Mises en avant (administration)" };

export default async function MisesEnAvantSystemePage() {
  const contexte = await exigerPermissionPage("contenu.mettre_en_avant");

  const [misesEnAvant, restaurants] = await Promise.all([listerMisesEnAvant(), listerRestaurantsPublies()]);

  const idsDejaMisEnAvant = new Set(misesEnAvant.map((m) => m.restaurant_id));
  const restaurantsDisponibles = restaurants.filter((r) => !idsDejaMisEnAvant.has(r.id));

  return (
    <div>
      <PageHeader
        titre="Catalogue"
        description="Décision opérationnelle (permission distincte des contenus éditoriaux) : quels restaurants publiés apparaissent en avant au catalogue."
      />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <Panneau titre="Ajouter une mise en avant">
        {restaurantsDisponibles.length === 0 ? (
          <p style={{ margin: 0, color: "var(--secondaire)" }}>
            Tous les restaurants publiés sont déjà mis en avant, ou aucun restaurant n&apos;est publié.
          </p>
        ) : (
          <FormulaireNouvelleMiseEnAvant restaurants={restaurantsDisponibles} prochainePosition={misesEnAvant.length} />
        )}
      </Panneau>

      <div style={{ marginTop: "var(--space-5)" }}>
        {misesEnAvant.length === 0 ? (
          <div className="ad-panneau">
            <EtatVide icone="catalogue" titre="Aucune mise en avant" texte="Aucun restaurant n'est mis en avant pour l'instant." />
          </div>
        ) : (
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Restaurants mis en avant</caption>
              <thead>
                <tr>
                  <th scope="col">Restaurant</th>
                  <th scope="col">Position</th>
                  <th scope="col">Statut</th>
                  <th scope="col" className="ad-droite">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {misesEnAvant.map((m) => (
                  <MiseEnAvantItem key={m.id} miseEnAvant={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
