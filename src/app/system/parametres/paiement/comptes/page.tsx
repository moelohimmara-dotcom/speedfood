import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerComptesAdmin } from "@/lib/paiement/en-ligne/admin-lectures";
import { EtatVide, PageHeader, Panneau } from "@/components/admin/blocs";
import { LienRetour } from "@/components/LienRetour";
import { SousNav } from "../../../SousNav";
import { FormulaireCompte } from "./FormulaireCompte";

export const metadata = { title: "Comptes de versement (paramètres)" };
export const dynamic = "force-dynamic";

/**
 * Comptes mobile money où Speedfood verse les restaurants et les livreurs. Réservé à `super_admin`. Le numéro saisi n'est plus affiché
 * (seul l'état du compte l'est) et n'apparaît dans aucun journal. Un compte n'est utilisé qu'après avoir été marqué vérifié, c'est-à-dire
 * après confirmation du titulaire hors de l'application.
 */
export default async function ComptesVersementPage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const comptes = await listerComptesAdmin();
  const restaurants = comptes.filter((c) => c.proprietaireType === "restaurant");
  const livreurs = comptes.filter((c) => c.proprietaireType === "livreur");

  return (
    <div>
      <LienRetour href="/system/parametres/paiement">Paiement en ligne</LienRetour>
      <PageHeader titre="Comptes de versement" description="Où Speedfood verse chaque restaurant et chaque livreur. Réservé aux super administrateurs." />
      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />

      <Panneau titre="Restaurants publiés">
        {restaurants.length === 0 ? <EtatVide titre="Aucun restaurant publié" /> : restaurants.map((c) => <FormulaireCompte key={c.proprietaireId} type="restaurant" id={c.proprietaireId} nom={c.nom} etat={c.etat} />)}
      </Panneau>
      <div className="u-mt-s6">
        <Panneau titre="Livreurs">
          {livreurs.length === 0 ? <EtatVide titre="Aucun livreur" texte="Les livreurs de démonstration n'ont pas de compte de versement." /> : livreurs.map((c) => <FormulaireCompte key={c.proprietaireId} type="livreur" id={c.proprietaireId} nom={c.nom} etat={c.etat} />)}
        </Panneau>
      </div>
    </div>
  );
}
