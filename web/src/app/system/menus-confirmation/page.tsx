import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { listerMenusAConfirmer } from "@/lib/system-admin/menus-confirmation-service";
import { LIBELLES_ETAT_MENU } from "@/lib/system-admin/menus-confirmation-regles";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { ActionsMenus } from "./ActionsMenus";

/**
 * Lot L5 — rappel de confirmation du menu avant le service.
 *
 * L'écran montre les établissements de l'équipe dont des plats sont à reconfirmer, la fraîcheur de
 * leur menu (heures depuis la dernière confirmation), le rappel du jour, et permet de confirmer le
 * menu du jour en un geste.
 *
 * La lecture est ouverte à `restaurant.consulter` ; les gestes (confirmation, rappel) demandent
 * `restaurant.moderer` — le serveur revérifie à chaque appel.
 */

export const metadata = { title: "Confirmation des menus (administration)" };
export const dynamic = "force-dynamic";

export default async function PageMenusConfirmation() {
  const contexte = await exigerPermissionPage("restaurant.consulter");
  const peutAgir = roleAPermission(contexte.role, "restaurant.moderer");
  const tableau = await listerMenusAConfirmer();
  const { compteurs } = tableau;

  const lignes = tableau.aReconfirmer.map((etat) => ({
    restaurantId: etat.restaurantId,
    nom: etat.nom,
    quartier: etat.quartier,
    telephoneCommandes: etat.telephoneCommandes,
    platsAConfirmer: etat.platsAConfirmer,
    aDesPlats: etat.plats > 0,
  }));

  return (
    <div className="ad-pile">
      <PageHeader
        titre="Confirmation des menus"
        description={
          <>
            Avant le service de {tableau.heureService} h, les plats dont la confirmation a plus de{" "}
            {tableau.seuilHeures} h doivent être reconfirmés : c&apos;est la même règle que celle appliquée
            aux clients. Le rappel du jour est dû à partir de {tableau.heureService - tableau.heureRappelAvant} h.
          </>
        }
      />

      <section className="ad-cartes" aria-label="Chiffres clés de la confirmation des menus">
        <CarteChiffre libelle="Établissements à reconfirmer" valeur={compteurs.aConfirmer} sous={`sur ${compteurs.etablissements} établissements de l'équipe`} ton={compteurs.aConfirmer > 0 ? "danger" : "succes"} />
        <CarteChiffre libelle="Plats à reconfirmer" valeur={compteurs.platsAConfirmer} sous="plats disponibles sans confirmation fraîche" />
        <CarteChiffre libelle="Menus confirmés" valeur={compteurs.confirmes} sous={`fraîcheur : ${tableau.seuilHeures} h`} ton="succes" />
        <CarteChiffre libelle="Rappels dus" valeur={tableau.rappelsDus} sous="avant l'heure de service" />
      </section>

      <Panneau titre="Établissements à reconfirmer" compteur={lignes.length}>
        {lignes.length === 0 ? (
          <EtatVide
            titre="Aucun menu à reconfirmer"
            texte="Tous les plats disponibles des établissements de l'équipe ont une confirmation fraîche. Rien à relancer avant le service."
          />
        ) : (
          <ActionsMenus lignes={lignes} peutAgir={peutAgir} />
        )}
      </Panneau>

      <Panneau titre="Tous les établissements de l'équipe" compteur={tableau.etablissements.length}>
        {tableau.etablissements.length === 0 ? (
          <EtatVide
            titre="Aucun établissement tenu par l'équipe"
            texte="Les établissements en mode de vente « Speedfood » apparaissent ici avec leur menu."
          />
        ) : (
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">État du menu de chaque établissement</caption>
              <thead>
                <tr>
                  <th scope="col">Établissement</th>
                  <th scope="col">Menu</th>
                  <th scope="col">Dernière confirmation</th>
                  <th scope="col">Rappel</th>
                  <th scope="col">État</th>
                </tr>
              </thead>
              <tbody>
                {tableau.etablissements.map((etat) => (
                  <tr key={etat.restaurantId}>
                    <td className="ad-cellule-principale" data-label="Établissement">
                      {etat.nom}
                      <span className="ad-liste-meta">{etat.quartier}</span>
                    </td>
                    <td className="ad-secondaire" data-label="Menu">
                      {etat.plats} plat{etat.plats > 1 ? "s" : ""} · {etat.platsDisponibles} disponible
                      {etat.platsDisponibles > 1 ? "s" : ""}
                      {etat.platsAConfirmer > 0 ? ` · ${etat.platsAConfirmer} à reconfirmer` : ""}
                    </td>
                    <td className="ad-secondaire" data-label="Dernière confirmation">
                      {etat.dernierConfirmationLe
                        ? new Date(etat.dernierConfirmationLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                        : "jamais"}
                    </td>
                    <td className="ad-secondaire" data-label="Rappel">
                      {etat.fenetre.libelle}
                    </td>
                    <td data-label="État">
                      <Pastille ton={LIBELLES_ETAT_MENU[etat.etat].ton}>{LIBELLES_ETAT_MENU[etat.etat].texte}</Pastille>
                      {etat.ferme ? <Pastille ton="danger">Établissement fermé</Pastille> : null}
                      {etat.enPause ? <Pastille ton="attention">Commandes en pause</Pastille> : null}
                    </td>
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
