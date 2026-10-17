import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerLivraisonsAdmin, listerLivreursAdmin } from "@/lib/livraison/admin-lectures";
import { Alert } from "@/components/ui";
import { CarteChiffre, EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../SousNav";
import { formaterDateCourte } from "../formatage";
import { ActionsLivraison } from "./ActionsLivraison";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Livraisons (administration)" };
export const dynamic = "force-dynamic";

/** Tableau de bord des livraisons : répartition des courses, livreurs sollicités, reprise en main. Permission `commande.support`. */
export default async function LivraisonsPage() {
  const contexte = await exigerPermissionPage("commande.support");
  const [livraisons, livreurs] = await Promise.all([listerLivraisonsAdmin(), listerLivreursAdmin()]);
  const disponibles = livreurs.filter((l) => l.statut === "disponible").map((l) => ({ id: l.id, nom: l.nom }));
  const sansLivreur = livraisons.filter((l) => l.mode === "speedfood" && (l.statut === "a_assigner" || l.statut === "offre_envoyee"));
  const enCours = livraisons.filter((l) => ["assignee", "vers_restaurant", "recuperee", "vers_client"].includes(l.statut)).length;
  const terminees = livraisons.filter((l) => l.statut === "livree").length;

  return (
    <div>
      <PageHeader titre="Livraisons" description="Courses en cours, livreur sollicité ou affecté, reprise en main. Les livreurs de démonstration répondent automatiquement aux offres." />
      <SousNav entrees={sousSectionsAccessibles("Commandes", contexte.role)} />

      <div className="ad-cartes livreurs-compteurs">
        <CarteChiffre libelle="En recherche de livreur" valeur={sansLivreur.length} sous="Offre envoyée ou en attente" ton={sansLivreur.length > 0 ? "danger" : "neutre"} />
        <CarteChiffre libelle="En cours" valeur={enCours} sous="Livreur affecté, course en route" />
        <CarteChiffre libelle="Livrées" valeur={terminees} sous="Parmi les 60 dernières livraisons" ton={terminees > 0 ? "succes" : "neutre"} />
      </div>

      {sansLivreur.length > 0 ? (
        <Alert ton="info" style={{ marginBottom: "var(--space-4)" }}>
          {sansLivreur.length} course{sansLivreur.length > 1 ? "s" : ""} en recherche de livreur. {disponibles.length === 0 ? "Aucun livreur n'est en ligne : créez des livreurs de démonstration ou mettez-en un en ligne (onglet Livreurs)." : ""}
        </Alert>
      ) : null}

      {livraisons.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="commandes" titre="Aucune livraison" texte="Une livraison est créée quand un restaurant accepte une commande en livraison." />
        </div>
      ) : (
        <div className="ad-table-cadre">
          <table className="ad-table">
            <caption className="sr-only">Livraisons</caption>
            <thead>
              <tr>
                <th scope="col">Commande</th>
                <th scope="col">Restaurant</th>
                <th scope="col">Statut</th>
                <th scope="col">Livreur</th>
                <th scope="col">Frais</th>
                <th scope="col">Créée le</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {livraisons.map((l) => (
                <tr key={l.id}>
                  <td className="ad-cellule-principale" data-label="Commande">
                    {l.commandeReference}
                  </td>
                  <td data-label="Restaurant">
                    {l.restaurantNom}
                    <span className="ad-secondaire" style={{ display: "block", fontSize: "0.8rem" }}>
                      {l.mode === "propre" ? "Livre lui-même" : "Livreur Speedfood"}
                    </span>
                  </td>
                  <td data-label="Statut">
                    <Pastille ton={l.statut === "livree" ? "succes" : l.statut === "echec" || l.statut === "annulee" ? "danger" : "neutre"}>{l.libelle}</Pastille>
                    {l.offreEnCours ? (
                      <span className="ad-secondaire" style={{ display: "block", fontSize: "0.8rem" }}>
                        Offre à {l.offreEnCours.livreurNom}
                      </span>
                    ) : null}
                    {l.raison ? (
                      <span className="ad-secondaire" style={{ display: "block", fontSize: "0.8rem" }}>
                        {l.raison}
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Livreur">{l.livreurNom ?? "—"}</td>
                  <td data-label="Frais" style={{ whiteSpace: "nowrap" }}>
                    {l.fraisGnf > 0 ? `${l.fraisGnf.toLocaleString("fr-FR")} GNF` : "—"}
                    {l.distanceKm !== null ? (
                      <span className="ad-secondaire" style={{ display: "block", fontSize: "0.8rem" }}>
                        {l.distanceKm.toLocaleString("fr-FR")} km
                      </span>
                    ) : null}
                  </td>
                  <td className="ad-secondaire" data-label="Créée le" style={{ whiteSpace: "nowrap" }}>
                    {formaterDateCourte(l.creeLe)}
                  </td>
                  <td data-label="Actions">
                    <ActionsLivraison livraison={{ id: l.id, mode: l.mode, statut: l.statut, commandeReference: l.commandeReference }} disponibles={disponibles} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
