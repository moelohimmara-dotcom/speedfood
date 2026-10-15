import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerZonesEnAttente, marquerZonePrevenueAction, supprimerContactsZoneAction } from "@/lib/system-admin/liste-attente";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { Button } from "@/components/ui";
import { SousNav } from "../../SousNav";
import { FormulaireSuppressionContact } from "./FormulaireSuppressionContact";

export const metadata = { title: "Liste d'attente (administration)" };
export const dynamic = "force-dynamic";

const LIBELLE_NIVEAU = { region: "Région", prefecture: "Préfecture", commune: "Commune", quartier: "Quartier" } as const;

function jour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Personnes qui attendent un restaurant dans leur zone (« Prévenez-moi »). La page n'affiche que des nombres ; les contacts ne sortent que
 * par l'export CSV d'une zone, tracé dans le journal d'audit. Quand un restaurant ouvre dans une zone, on contacte les personnes (hors
 * Speedfood, par exemple par WhatsApp ou e-mail), puis on marque la zone comme prévenue et on supprime les contacts.
 */
export default async function ListeAttentePage() {
  const contexte = await exigerPermissionPage("attente.gerer");
  const zones = await listerZonesEnAttente();
  const total = zones.reduce((n, z) => n + z.personnes, 0);
  const prevenues = zones.reduce((n, z) => n + z.prevenues, 0);

  return (
    <div>
      <PageHeader titre="Catalogue" description="Personnes qui attendent un restaurant dans leur zone. Les contacts sont des données personnelles : chaque export est tracé." />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <section className="ad-cartes" aria-label="Chiffres clés de la liste d'attente">
        <CarteChiffre libelle="Personnes en attente" valeur={total} sous={`${prevenues} déjà prévenue${prevenues > 1 ? "s" : ""}`} />
        <CarteChiffre libelle="Zones concernées" valeur={zones.length} sous="Zones où au moins une personne attend" />
      </section>

      <Panneau titre="Zones en attente">
        {zones.length === 0 ? (
          <EtatVide titre="Personne n'attend pour l'instant" texte="Quand quelqu'un s'inscrit dans une zone sans restaurant, la zone apparaît ici avec le nombre de personnes." />
        ) : (
          <div className="ad-table-cadre">
            <table className="ad-table">
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col">Personnes</th>
                  <th scope="col">Prévenues</th>
                  <th scope="col">Dernière inscription</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={`${z.niveau}-${z.id}`}>
                    <td>
                      {z.nom} <Pastille ton="neutre">{LIBELLE_NIVEAU[z.niveau]}</Pastille>
                      {z.contexte ? <span className="ad-aide-champ"> · {z.contexte}</span> : null}
                    </td>
                    <td>{z.personnes}</td>
                    <td>{z.prevenues}</td>
                    <td>{jour(z.derniere)}</td>
                    <td>
                      <div className="ad-actions-ligne">
                        <a className="btn btn-secondary" href={`/system/catalogue/liste-attente/export?niveau=${z.niveau}&id=${z.id}`}>
                          Exporter (CSV)<span className="sr-only"> {z.nom}</span>
                        </a>
                        <form action={marquerZonePrevenueAction}>
                          <input type="hidden" name="niveau" value={z.niveau} />
                          <input type="hidden" name="id" value={z.id} />
                          <Button type="submit" variante="secondary" disabled={z.prevenues === z.personnes}>
                            Marquer prévenues<span className="sr-only"> {z.nom}</span>
                          </Button>
                        </form>
                        <form action={supprimerContactsZoneAction}>
                          <input type="hidden" name="niveau" value={z.niveau} />
                          <input type="hidden" name="id" value={z.id} />
                          <Button type="submit" variante="danger">
                            Supprimer les contacts<span className="sr-only"> {z.nom}</span>
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panneau>

      <Panneau titre="Retirer un contact (demande d'une personne)">
        <FormulaireSuppressionContact />
      </Panneau>
    </div>
  );
}
