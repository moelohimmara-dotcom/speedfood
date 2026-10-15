import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerZonesEnAttente } from "@/lib/system-admin/liste-attente";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { ActionsZoneAttente } from "./ActionsZoneAttente";
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
                    <td className="ad-cellule-principale" data-label="Zone">
                      {z.nom} <Pastille ton="neutre">{LIBELLE_NIVEAU[z.niveau]}</Pastille>
                      {z.contexte ? <span className="ad-aide-champ"> · {z.contexte}</span> : null}
                    </td>
                    <td className="ad-nombre" data-label="Personnes">{z.personnes}</td>
                    <td className="ad-nombre" data-label="Prévenues">{z.prevenues}</td>
                    <td data-label="Dernière inscription">{jour(z.derniere)}</td>
                    <td data-label="Actions">
                      <ActionsZoneAttente niveau={z.niveau} id={z.id} nom={z.nom} personnes={z.personnes} prevenues={z.prevenues} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panneau>

      <Panneau titre="Retirer un contact">
        <FormulaireSuppressionContact />
      </Panneau>
    </div>
  );
}
