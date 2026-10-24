import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { listerEtablissementsEquipe, valeursParDefautFermeture } from "@/lib/system-admin/etablissements-service";
import { LIBELLES_ETAT_FERMETURE, LIBELLES_TYPE_FERMETURE } from "@/lib/system-admin/etablissements-regles";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { FermeturesEtablissements } from "./FermeturesEtablissements";

/**
 * Lot L6 — fermeture et suspension d'un établissement.
 *
 * L'écran montre l'état de chaque établissement tenu par l'équipe et permet de le fermer, de le
 * suspendre, puis de lever la fermeture. La décision est visible par les clients : elle exige un
 * motif écrit, une confirmation explicite et elle est journalisée.
 *
 * Qui peut fermer ? Le rôle `restaurant.moderer` : Opérations et Super administrateur. Ni l'éditeur
 * de contenu ni le support : c'est une décision commerciale sur un établissement en ligne.
 */

export const metadata = { title: "Fermeture des établissements (administration)" };
export const dynamic = "force-dynamic";

export default async function PageEtablissements() {
  const contexte = await exigerPermissionPage("restaurant.consulter");
  const peutAgir = roleAPermission(contexte.role, "restaurant.moderer");
  const etablissements = await listerEtablissementsEquipe();
  const valeurs = valeursParDefautFermeture();

  const fermeturesEnCours = etablissements.filter((e) => e.fermetureActive !== null);
  const suspensions = fermeturesEnCours.filter((e) => e.fermetureActive?.type === "suspension");
  const fermetures = fermeturesEnCours.filter((e) => e.fermetureActive?.type === "fermeture");
  const reprisesAFaire = fermeturesEnCours.filter((e) => e.fermetureActive?.etat === "expiree");

  const lignes = etablissements.map((e) => ({
    id: e.id,
    nom: e.nom,
    quartier: e.quartier,
    ouvert: e.ouvert,
    accepteCommandes: e.accepteCommandes,
    fermetureActive: e.fermetureActive
      ? {
          id: e.fermetureActive.id,
          type: e.fermetureActive.type,
          motif: e.fermetureActive.motif,
          messagePublic: e.fermetureActive.messagePublic,
          dureeHeures: e.fermetureActive.dureeHeures,
          repriseLe: e.fermetureActive.repriseLe ? e.fermetureActive.repriseLe.toISOString() : null,
          etat: e.fermetureActive.etat,
        }
      : null,
    fermeturesPassees: e.fermeturesPassees,
  }));

  return (
    <div className="ad-pile">
      <PageHeader
        titre="Fermeture et suspension des établissements"
        description="Fermer un établissement, c'est le retirer des commandes : la décision est visible par les clients. Elle exige un motif écrit, une confirmation explicite, et elle reste dans le journal d'audit."
      />

      <section className="ad-cartes" aria-label="Chiffres clés des fermetures">
        <CarteChiffre libelle="Fermetures en cours" valeur={fermetures.length} sous="établissements fermés aux clients" ton={fermetures.length > 0 ? "danger" : "succes"} />
        <CarteChiffre libelle="Suspensions" valeur={suspensions.length} sous="commandes en pause, reprise planifiée" />
        <CarteChiffre libelle="Reprises à faire" valeur={reprisesAFaire.length} sous="la reprise prévue est passée" ton={reprisesAFaire.length > 0 ? "danger" : "neutre"} />
        <CarteChiffre libelle="Établissements de l'équipe" valeur={etablissements.length} sous="mode de vente « Speedfood »" />
      </section>

      <Panneau titre="Établissements" compteur={etablissements.length}>
        {etablissements.length === 0 ? (
          <EtatVide
            titre="Aucun établissement tenu par l'équipe"
            texte="Les établissements en mode de vente « Speedfood » apparaissent ici, avec leur état de fermeture."
          />
        ) : (
          <FermeturesEtablissements lignes={lignes} valeurs={valeurs} peutAgir={peutAgir} />
        )}
      </Panneau>

      {fermeturesEnCours.length > 0 ? (
        <Panneau titre="Fermetures en cours" compteur={fermeturesEnCours.length}>
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Fermetures et suspensions en cours</caption>
              <thead>
                <tr>
                  <th scope="col">Établissement</th>
                  <th scope="col">Type</th>
                  <th scope="col">Motif</th>
                  <th scope="col">Message aux clients</th>
                  <th scope="col">Reprise</th>
                  <th scope="col">État</th>
                </tr>
              </thead>
              <tbody>
                {fermeturesEnCours.map((etat) => {
                  const fermeture = etat.fermetureActive;
                  if (!fermeture) return null;
                  const libelle = LIBELLES_ETAT_FERMETURE[fermeture.etat];
                  return (
                    <tr key={fermeture.id}>
                      <td className="ad-cellule-principale" data-label="Établissement">
                        {etat.nom}
                      </td>
                      <td className="ad-secondaire" data-label="Type">
                        {LIBELLES_TYPE_FERMETURE[fermeture.type]}
                      </td>
                      <td className="ad-secondaire" data-label="Motif">
                        {fermeture.motif}
                      </td>
                      <td className="ad-secondaire" data-label="Message aux clients">
                        {fermeture.messagePublic}
                      </td>
                      <td className="ad-secondaire" data-label="Reprise">
                        {fermeture.repriseLe
                          ? new Date(fermeture.repriseLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                          : "décidée à la main"}
                      </td>
                      <td data-label="État">
                        <Pastille ton={libelle.ton}>{libelle.texte}</Pastille>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panneau>
      ) : null}
    </div>
  );
}
