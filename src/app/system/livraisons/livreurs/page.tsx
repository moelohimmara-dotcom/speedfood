import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerLivreursAdmin } from "@/lib/livraison/admin-lectures";
import { EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { ActionsLivreurs, BoutonLivreur } from "./ActionsLivreurs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Livreurs (administration)" };
export const dynamic = "force-dynamic";

const STATUTS = { hors_ligne: "Hors ligne", disponible: "Disponible", en_course: "En course" } as const;
const VEHICULES: Record<string, string> = { moto: "Moto", velo: "Vélo", voiture: "Voiture", pied: "À pied" };

/** Livreurs : en ligne, hors ligne, en course. Les livreurs de démonstration se créent d'un clic. Permission `commande.support`. */
export default async function LivreursPage() {
  const contexte = await exigerPermissionPage("commande.support");
  const livreurs = await listerLivreursAdmin();

  return (
    <div>
      <PageHeader titre="Livreurs" description="Livreurs de démonstration (simulés) : ils répondent seuls aux offres de course. De vrais livreurs viendront après le pilote." />
      <SousNav entrees={sousSectionsAccessibles("Commandes", contexte.role)} />
      <ActionsLivreurs nombreSimules={livreurs.filter((l) => l.simule).length} />

      {livreurs.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="acces" titre="Aucun livreur" texte="Créez des livreurs de démonstration pour essayer la répartition des courses." />
        </div>
      ) : (
        <div className="ad-table-cadre">
          <table className="ad-table">
            <caption className="sr-only">Livreurs</caption>
            <thead>
              <tr>
                <th scope="col">Livreur</th>
                <th scope="col">Véhicule</th>
                <th scope="col">Statut</th>
                <th scope="col">Position</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {livreurs.map((l) => (
                <tr key={l.id}>
                  <td className="ad-cellule-principale" data-label="Livreur">
                    {l.nom}
                    {l.simule ? <span className="ad-secondaire" style={{ display: "block", fontSize: "0.8rem" }}>Démonstration</span> : null}
                  </td>
                  <td data-label="Véhicule">{VEHICULES[l.vehicule] ?? l.vehicule}</td>
                  <td data-label="Statut">
                    <Pastille ton={l.statut === "disponible" ? "succes" : l.statut === "en_course" ? "attention" : "neutre"}>{STATUTS[l.statut]}</Pastille>
                  </td>
                  <td className="ad-secondaire" data-label="Position">
                    {l.aPosition ? "Connue" : "Inconnue"}
                  </td>
                  <td data-label="Actions">
                    {l.statut === "en_course" ? <span className="ad-secondaire">—</span> : <BoutonLivreur livreurId={l.id} nom={l.nom} enLigne={l.statut === "disponible"} />}
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
