import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { roleAPermission, sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerLivreursAdmin } from "@/lib/livraison/admin-lectures";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { CarteChiffre, EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { AjouterLivreurs, BoutonLivreur, SupprimerLivreursDemo } from "./ActionsLivreurs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Livreurs (administration)" };
export const dynamic = "force-dynamic";

const STATUTS = { hors_ligne: "Hors ligne", disponible: "En ligne", en_course: "En course" } as const;
const VEHICULES: Record<string, string> = { moto: "Moto", velo: "Vélo", voiture: "Voiture", pied: "À pied" };

/** Livreurs : qui est en ligne, en course ou hors ligne ; ajout de livreurs de démonstration ou avec un vrai compte. Permission `commande.support`. */
export default async function LivreursPage() {
  const contexte = await exigerPermissionPage("commande.support");
  const livreurs = await listerLivreursAdmin();
  const maintenant = new Date();
  const compte = (statut: keyof typeof STATUTS) => livreurs.filter((l) => l.statut === statut).length;
  const simules = livreurs.filter((l) => l.simule).length;

  return (
    <div>
      <PageHeader titre="Livreurs" description="Qui peut recevoir une course. Les livreurs de démonstration répondent seuls aux offres ; de vrais livreurs rejoindront après le pilote." />
      <SousNav entrees={sousSectionsAccessibles("Commandes", contexte.role)} />

      <div className="ad-cartes livreurs-compteurs">
        <CarteChiffre libelle="En ligne" valeur={compte("disponible")} sous="Prêts à recevoir une offre" ton={compte("disponible") > 0 ? "succes" : "neutre"} />
        <CarteChiffre libelle="En course" valeur={compte("en_course")} sous="Une livraison en cours" />
        <CarteChiffre libelle="Hors ligne" valeur={compte("hors_ligne")} sous="Pas d'offre pour l'instant" />
      </div>

      <div className="livreurs-barre">
        <AjouterLivreurs peutLierUnCompte={roleAPermission(contexte.role, "parametres.editer")} />
        <SupprimerLivreursDemo nombre={simules} />
      </div>

      {livreurs.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="acces" titre="Aucun livreur" texte="Ajoutez des livreurs de démonstration pour essayer la répartition des courses : ils se mettent en ligne tout de suite." />
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
                <th scope="col">Dernière course</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {livreurs.map((l) => (
                <tr key={l.id}>
                  <td className="ad-cellule-principale" data-label="Livreur">
                    {l.nom}
                    {l.simule ? <span className="ad-secondaire livreurs-sous">Démonstration</span> : null}
                  </td>
                  <td data-label="Véhicule">{VEHICULES[l.vehicule] ?? l.vehicule}</td>
                  <td data-label="Statut">
                    <Pastille ton={l.statut === "disponible" ? "succes" : l.statut === "en_course" ? "attention" : "neutre"}>{STATUTS[l.statut]}</Pastille>
                  </td>
                  <td className="ad-secondaire" data-label="Position">
                    {l.aPosition && l.positionLe ? `Mise à jour ${ancienneteLisible(new Date(l.positionLe), maintenant)}` : "Inconnue"}
                  </td>
                  <td className="ad-secondaire" data-label="Dernière course">
                    {l.derniereCourseLe ? ancienneteLisible(new Date(l.derniereCourseLe), maintenant) : "Aucune"}
                  </td>
                  <td data-label="Actions">
                    {l.statut === "en_course" ? <span className="ad-secondaire">En course</span> : <BoutonLivreur livreurId={l.id} nom={l.nom} enLigne={l.statut === "disponible"} />}
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
