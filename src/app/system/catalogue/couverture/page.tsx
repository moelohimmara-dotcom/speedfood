import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { lireCouverture } from "@/lib/system-admin/couverture";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { CarteCouverture } from "@/components/admin/CarteCouverture";
import { SousNav } from "../../SousNav";

export const metadata = { title: "Couverture (administration)" };
export const dynamic = "force-dynamic";

/**
 * Où Speedfood a des restaurants, où ils sont ouverts, et où des personnes attendent. Les restaurants de démonstration ne sont
 * pas comptés. Les contacts de la liste d'attente ne sont jamais affichés ici : seulement leur nombre par zone.
 */
export default async function CouverturePage() {
  const contexte = await exigerPermissionPage("taxonomie.editer");
  const { regions, communes, points, aRecruter, totaux } = await lireCouverture();

  return (
    <div>
      <PageHeader titre="Catalogue" description="Couverture par zone : restaurants référencés, restaurants ouverts et personnes en attente." />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />
      <div className="ad-pile">

        <section className="ad-cartes" aria-label="Chiffres clés de la couverture">
          <CarteChiffre libelle="Restaurants référencés" valeur={totaux.restaurants} sous={`${totaux.ouverts} ouvert${totaux.ouverts > 1 ? "s" : ""} aux commandes`} />
          <CarteChiffre libelle="Communes couvertes" valeur={`${totaux.communesCouvertes} / ${totaux.communesActives}`} sous="Communes actives avec au moins un restaurant" />
          <CarteChiffre
            libelle="Personnes en attente"
            valeur={totaux.attente}
            sous="Inscrites sur la liste « prévenez-moi »"
            ton="neutre"
          />
        </section>

        <Panneau titre="Carte de la couverture">
          <CarteCouverture points={points} />
        </Panneau>

        <Panneau titre="Où recruter en premier">
          {aRecruter.length === 0 ? (
            <EtatVide titre="Aucune zone sans restaurant n'a de liste d'attente" texte="Dès qu'une personne s'inscrit sur une zone sans restaurant, elle apparaît ici." />
          ) : (
            <div className="ad-table-cadre">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">Zone</th>
                    <th scope="col">Dans</th>
                    <th scope="col">Personnes en attente</th>
                  </tr>
                </thead>
                <tbody>
                  {aRecruter.map((z) => (
                    <tr key={`${z.niveau}-${z.contexte}-${z.nom}`}>
                      <td className="ad-cellule-principale" data-label="Zone">
                        {z.nom} <Pastille ton="neutre">{{ region: "Région", prefecture: "Préfecture", commune: "Commune", quartier: "Quartier" }[z.niveau]}</Pastille>
                      </td>
                      <td data-label="Dans">{z.contexte || "—"}</td>
                      <td className="ad-nombre" data-label="Personnes en attente">{z.attente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panneau>

        <Panneau titre="Couverture par région">
          <div className="ad-table-cadre">
            <table className="ad-table">
              <thead>
                <tr>
                  <th scope="col">Région</th>
                  <th scope="col">Restaurants</th>
                  <th scope="col">Ouverts</th>
                  <th scope="col">Préfectures couvertes</th>
                  <th scope="col">Communes couvertes</th>
                  <th scope="col">En attente</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.nom}>
                    <td className="ad-cellule-principale" data-label="Région">{r.nom}</td>
                    <td className="ad-nombre" data-label="Restaurants">{r.restaurants}</td>
                    <td className="ad-nombre" data-label="Ouverts">{r.ouverts}</td>
                    <td className="ad-nombre" data-label="Préfectures couvertes">
                      {r.prefecturesCouvertes} / {r.prefectures}
                    </td>
                    <td className="ad-nombre" data-label="Communes couvertes">
                      {r.communesCouvertes} / {r.communes}
                    </td>
                    <td className="ad-nombre" data-label="En attente">{r.attente}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panneau>

        <Panneau titre="Communes avec des restaurants ou des personnes en attente">
          {communes.length === 0 ? (
            <EtatVide titre="Aucune commune pour l'instant" />
          ) : (
            <div className="ad-table-cadre">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">Commune</th>
                    <th scope="col">Préfecture</th>
                    <th scope="col">Restaurants</th>
                    <th scope="col">Ouverts</th>
                    <th scope="col">Quartiers couverts</th>
                    <th scope="col">En attente</th>
                  </tr>
                </thead>
                <tbody>
                  {communes.map((c) => (
                    <tr key={`${c.prefecture}-${c.nom}`}>
                      <td className="ad-cellule-principale" data-label="Commune">{c.nom}</td>
                      <td data-label="Préfecture">{c.prefecture}</td>
                      <td className="ad-nombre" data-label="Restaurants">{c.restaurants}</td>
                      <td className="ad-nombre" data-label="Ouverts">{c.ouverts}</td>
                      <td className="ad-nombre" data-label="Quartiers couverts">{c.quartiersActifs > 0 ? `${c.quartiersCouverts} / ${c.quartiersActifs}` : "—"}</td>
                      <td className="ad-nombre" data-label="En attente">{c.attente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panneau>
      </div>
    </div>
  );
}
