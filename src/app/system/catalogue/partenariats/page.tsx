import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerDemandesPartenariat } from "@/lib/system-admin/partenariats-lecture";
import { changerStatutPartenariatAction, supprimerPartenariatAction } from "@/lib/system-admin/partenariats";
import { LIBELLES_FORMES, LIBELLES_STATUTS, STATUTS_PARTENARIAT } from "@/lib/site/partenariat";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";

export const metadata = { title: "Partenariats (administration)" };
export const dynamic = "force-dynamic";

function jour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Demandes reçues par la page « Devenir partenaire » (investir, soutenir la communauté, apporter des moyens, contribuer). Les restaurateurs
 * n'y figurent pas : ils s'inscrivent eux-mêmes. On répond hors Speedfood (e-mail, téléphone), puis on change le statut.
 */
export default async function PartenariatsPage() {
  const contexte = await exigerPermissionPage("attente.gerer");
  const demandes = await listerDemandesPartenariat();
  const nouvelles = demandes.filter((d) => d.statut === "nouvelle").length;

  return (
    <div>
      <PageHeader titre="Catalogue" description="Demandes de partenariat reçues par le site. Les coordonnées sont des données personnelles : seuls les rôles autorisés les voient." />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />
      <div className="ad-pile">
        <section className="ad-cartes" aria-label="Chiffres clés des partenariats">
          <CarteChiffre libelle="Nouvelles demandes" valeur={nouvelles} sous="À lire et à contacter" />
          <CarteChiffre libelle="Demandes affichées" valeur={demandes.length} sous="Les 200 plus récentes" />
        </section>

        <Panneau titre="Demandes de partenariat">
          {demandes.length === 0 ? (
            <EtatVide titre="Aucune demande pour l'instant" texte="Quand une personne remplit le formulaire de la page Devenir partenaire, sa demande apparaît ici." />
          ) : (
            <div className="ad-table-cadre">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">Qui</th>
                    <th scope="col">Proposition</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((d) => (
                    <tr key={d.id}>
                      <td className="ad-cellule-principale" data-label="Qui">
                        {d.organisation}
                        <span className="ad-aide-champ"> · {d.nomContact} · {jour(d.creeLe)}</span>
                      </td>
                      <td data-label="Proposition">
                        <Pastille ton="neutre">{LIBELLES_FORMES[d.forme]}</Pastille>
                        <p className="partenariat-admin-message">{d.message}</p>
                      </td>
                      <td data-label="Contact">{d.contact}</td>
                      <td data-label="Statut">
                        <form action={changerStatutPartenariatAction} className="partenariat-admin-statut">
                          <input type="hidden" name="id" value={d.id} />
                          <select name="statut" defaultValue={d.statut} aria-label={`Statut de la demande de ${d.organisation}`}>
                            {STATUTS_PARTENARIAT.map((s) => (
                              <option key={s} value={s}>{LIBELLES_STATUTS[s]}</option>
                            ))}
                          </select>
                          <button type="submit" className="btn btn-secondary btn-compact">Enregistrer</button>
                        </form>
                      </td>
                      <td data-label="Actions">
                        <form action={supprimerPartenariatAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="btn btn-danger btn-compact">Supprimer</button>
                        </form>
                      </td>
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
