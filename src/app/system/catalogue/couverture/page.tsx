import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { lireCouverture } from "@/lib/system-admin/couverture";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";

export const metadata = { title: "Couverture (administration)" };
export const dynamic = "force-dynamic";

/**
 * Où Speedfood a des restaurants, où ils sont ouverts, et où des personnes attendent. Les restaurants de démonstration ne sont
 * pas comptés. Les contacts de la liste d'attente ne sont jamais affichés ici : seulement leur nombre par zone.
 */
export default async function CouverturePage() {
  const contexte = await exigerPermissionPage("taxonomie.editer");
  const { regions, communes, aRecruter, totaux } = await lireCouverture();

  return (
    <div>
      <PageHeader titre="Catalogue" description="Couverture par zone : restaurants référencés, restaurants ouverts et personnes en attente." />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <section className="ad-cartes" aria-label="Chiffres clés de la couverture">
        <CarteChiffre libelle="Restaurants référencés" valeur={totaux.restaurants} sous={`${totaux.ouverts} ouvert${totaux.ouverts > 1 ? "s" : ""} aux commandes`} />
        <CarteChiffre libelle="Communes couvertes" valeur={`${totaux.communesCouvertes} / ${totaux.communesActives}`} sous="Communes actives avec au moins un restaurant" />
        <CarteChiffre
          libelle="Personnes en attente"
          valeur={totaux.attente}
          sous="Inscrites sur la liste « prévenez-moi »"
          ton={totaux.attente > 0 ? "succes" : "neutre"}
        />
      </section>

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
                    <td>
                      {z.nom} <Pastille ton="neutre">{{ region: "Région", prefecture: "Préfecture", commune: "Commune", quartier: "Quartier" }[z.niveau]}</Pastille>
                    </td>
                    <td>{z.contexte || "—"}</td>
                    <td>{z.attente}</td>
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
                  <td>{r.nom}</td>
                  <td>{r.restaurants}</td>
                  <td>{r.ouverts}</td>
                  <td>
                    {r.prefecturesCouvertes} / {r.prefectures}
                  </td>
                  <td>
                    {r.communesCouvertes} / {r.communes}
                  </td>
                  <td>{r.attente}</td>
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
                    <td>{c.nom}</td>
                    <td>{c.prefecture}</td>
                    <td>{c.restaurants}</td>
                    <td>{c.ouverts}</td>
                    <td>{c.quartiersActifs > 0 ? `${c.quartiersCouverts} / ${c.quartiersActifs}` : "—"}</td>
                    <td>{c.attente}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panneau>
    </div>
  );
}
