import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { roleAPermission, sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerSignalementsDoublons } from "@/lib/system-admin/doublons";
import { autoriserDoublonAction, refuserDoublonAction } from "@/lib/system-admin/doublons-actions";
import { EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { formaterDateCourte } from "../../formatage";

export const metadata = { title: "Doublons d'inscription (administration)" };

/**
 * Inscriptions suspendues parce que leur adresse e-mail (forme canonique : sans points ni « +étiquette » chez Gmail) appartient déjà à un autre compte. Permission `compte.consulter` pour voir,
 * `compte.inviter` pour décider. Autoriser débloque le compte ; refuser le garde suspendu.
 */
export default async function DoublonsPage() {
  const contexte = await exigerPermissionPage("compte.consulter");
  const peutDecider = roleAPermission(contexte.role, "compte.inviter");
  const signalements = await listerSignalementsDoublons();
  const ouverts = signalements.filter((s) => s.statut === "en_attente");
  const traites = signalements.filter((s) => s.statut !== "en_attente");

  return (
    <div>
      <PageHeader
        titre="Accès"
        description="Une personne, un compte : les inscriptions dont l'adresse correspond à celle d'un compte existant sont suspendues jusqu'à votre décision."
      />
      <SousNav entrees={sousSectionsAccessibles("Accès", contexte.role)} />

      <h2 className="u-mb-s2">À examiner ({ouverts.length})</h2>
      {ouverts.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="acces" titre="Rien à examiner" texte="Aucune inscription n'est suspendue pour doublon." />
        </div>
      ) : (
        <div className="ad-table-cadre">
          <table className="ad-table">
            <caption className="sr-only">Inscriptions suspendues</caption>
            <thead>
              <tr>
                <th scope="col">Nouvelle inscription</th>
                <th scope="col">Compte déjà existant</th>
                <th scope="col">Reçue le</th>
                <th scope="col">Décision</th>
              </tr>
            </thead>
            <tbody>
              {ouverts.map((s) => (
                <tr key={s.id}>
                  <td className="ad-cellule-principale u-ow-anywhere" data-label="Nouvelle inscription">
                    <span className="u-fw-800">{s.nouvelEmail ?? "(compte supprimé)"}</span>
                  </td>
                  <td className="u-ow-anywhere" data-label="Compte déjà existant">
                    {s.emailExistant ?? "(compte supprimé)"}
                    <div className="ad-secondaire u-fs-0-82rem">Forme canonique : {s.emailCanonique}</div>
                  </td>
                  <td className="ad-secondaire u-ws-nowrap" data-label="Reçue le">
                    {formaterDateCourte(s.creeLe)}
                  </td>
                  <td data-label="Décision">
                    {peutDecider ? (
                      <form className="u-d-grid-g-4px-justify-items-start-ta-left">
                        <input type="hidden" name="id" value={s.id} />
                        <label className="sr-only" htmlFor={`motif-${s.id}`}>
                          Motif (facultatif)
                        </label>
                        <input id={`motif-${s.id}`} name="motif" maxLength={300} placeholder="Motif (facultatif)" />
                        <div className="questions-actions">
                          <button type="submit" formAction={autoriserDoublonAction} className="btn btn-secondary btn-compact">
                            Autoriser (personne différente)
                          </button>
                          <button type="submit" formAction={refuserDoublonAction} className="btn btn-danger btn-compact">
                            Refuser (même personne)
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
              <caption className="sr-only">Signalements traités</caption>
              <thead>
                <tr>
                  <th scope="col">Inscription</th>
                  <th scope="col">Décision</th>
                  <th scope="col">Le</th>
                  <th scope="col">Motif</th>
                </tr>
              </thead>
              <tbody>
                {traites.map((s) => (
                  <tr key={s.id}>
                    <td className="u-ow-anywhere" data-label="Inscription">
                      {s.nouvelEmail ?? "(compte supprimé)"}
                    </td>
                    <td data-label="Décision">
                      <Pastille ton={s.statut === "autorise" ? "succes" : "neutre"}>{s.statut === "autorise" ? "Autorisée" : "Refusée"}</Pastille>
                    </td>
                    <td className="ad-secondaire u-ws-nowrap" data-label="Le">
                      {s.traiteLe ? formaterDateCourte(s.traiteLe) : "—"}
                    </td>
                    <td className="ad-secondaire" data-label="Motif">
                      {s.motif ?? "—"}
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
