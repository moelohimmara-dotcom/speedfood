import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { roleAPermission, sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerConflitsNumero } from "@/lib/identite/numeros";
import { cederNumeroAction, refuserNumeroAction } from "@/lib/system-admin/numeros-actions";
import { EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { formaterDateCourte } from "../../formatage";

export const metadata = { title: "Numéros à arbitrer (administration)" };

const LIBELLES_SOURCE = { candidature: "Candidature de restaurateur", livreur: "Livreur" } as const;

/**
 * Numéros de téléphone réclamés par deux comptes professionnels. Règle : un numéro, un titulaire. Avant de CÉDER le numéro au demandeur, appelez-le : le cédant doit être d'accord
 * ou ne plus en être l'usager (le motif est obligatoire et conservé dans l'audit). REFUSER laisse le numéro à son titulaire. Permission `compte.consulter` pour voir, `compte.inviter` pour décider.
 */
export default async function NumerosPage() {
  const contexte = await exigerPermissionPage("compte.consulter");
  const peutDecider = roleAPermission(contexte.role, "compte.inviter");
  const conflits = await listerConflitsNumero();
  const ouverts = conflits.filter((c) => c.statut === "en_attente");
  const traites = conflits.filter((c) => c.statut !== "en_attente");

  return (
    <div>
      <PageHeader
        titre="Accès"
        description="Un numéro, un titulaire : deux personnes n'utilisent pas le même numéro, sauf si le titulaire le cède. Appelez avant de décider."
      />
      <SousNav entrees={sousSectionsAccessibles("Accès", contexte.role)} />

      <h2 className="u-mb-s2">À arbitrer ({ouverts.length})</h2>
      {ouverts.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="acces" titre="Rien à arbitrer" texte="Aucun numéro n'est réclamé par deux comptes." />
        </div>
      ) : (
        <div className="ad-table-cadre">
          <table className="ad-table">
            <caption className="sr-only">Numéros réclamés par deux comptes</caption>
            <thead>
              <tr>
                <th scope="col">Numéro</th>
                <th scope="col">Titulaire actuel</th>
                <th scope="col">Demandeur</th>
                <th scope="col">Reçu le</th>
                <th scope="col">Décision</th>
              </tr>
            </thead>
            <tbody>
              {ouverts.map((c) => (
                <tr key={c.id}>
                  <td className="ad-cellule-principale u-ws-nowrap" data-label="Numéro">
                    <span className="u-fw-800">{c.telephone}</span>
                    <div className="ad-secondaire u-fs-0-82rem">{LIBELLES_SOURCE[c.source]}</div>
                  </td>
                  <td className="u-ow-anywhere" data-label="Titulaire actuel">
                    {c.titulaireEmail ?? "(compte supprimé)"}
                  </td>
                  <td className="u-ow-anywhere" data-label="Demandeur">
                    {c.demandeurEmail ?? "(compte supprimé)"}
                  </td>
                  <td className="ad-secondaire u-ws-nowrap" data-label="Reçu le">
                    {formaterDateCourte(c.creeLe)}
                  </td>
                  <td data-label="Décision">
                    {peutDecider ? (
                      <form className="u-d-grid-g-4px-justify-items-start-ta-left">
                        <input type="hidden" name="id" value={c.id} />
                        <label className="sr-only" htmlFor={`motif-${c.id}`}>
                          Motif (obligatoire pour céder)
                        </label>
                        <input id={`motif-${c.id}`} name="motif" maxLength={300} placeholder="Motif (obligatoire pour céder)" />
                        <div className="questions-actions">
                          <button type="submit" formAction={cederNumeroAction} className="btn btn-secondary btn-compact">
                            Céder au demandeur
                          </button>
                          <button type="submit" formAction={refuserNumeroAction} className="btn btn-danger btn-compact">
                            Garder au titulaire
                          </button>
                        </div>
                      </form>
                    ) : (
                      <span className="ad-secondaire">Droit « inviter » requis</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {traites.length > 0 ? (
        <>
          <h2 className="u-mb-s2 u-mt-s4">Déjà traités</h2>
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Conflits de numéro traités</caption>
              <thead>
                <tr>
                  <th scope="col">Numéro</th>
                  <th scope="col">Demandeur</th>
                  <th scope="col">Décision</th>
                  <th scope="col">Le</th>
                  <th scope="col">Motif</th>
                </tr>
              </thead>
              <tbody>
                {traites.map((c) => (
                  <tr key={c.id}>
                    <td className="u-ws-nowrap" data-label="Numéro">
                      {c.telephone}
                    </td>
                    <td className="u-ow-anywhere" data-label="Demandeur">
                      {c.demandeurEmail ?? "(compte supprimé)"}
                    </td>
                    <td data-label="Décision">
                      <Pastille ton={c.statut === "cede" ? "succes" : "neutre"}>{c.statut === "cede" ? "Cédé" : "Gardé par le titulaire"}</Pastille>
                    </td>
                    <td className="ad-secondaire u-ws-nowrap" data-label="Le">
                      {c.traiteLe ? formaterDateCourte(c.traiteLe) : "—"}
                    </td>
                    <td className="ad-secondaire" data-label="Motif">
                      {c.motif ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
