import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { PageHeader, Panneau, EtatVide, Pastille } from "@/components/admin/blocs";
import { listerCampagnes, valeursParDefaut } from "@/lib/system-admin/campagnes-service";
import { FormulaireCampagne } from "./FormulaireCampagne";
export const dynamic = "force-dynamic";
export const metadata = { title: "Codes promo et campagnes (administration)" };
export default async function CampagnesPage() {
  await exigerPermissionPage("restaurant.moderer"); const campagnes = listerCampagnes(); const d = valeursParDefaut();
  return <div className="ad-pile"><PageHeader titre="Codes promo et campagnes" description="Les campagnes restent en brouillon jusqu'à une confirmation explicite. Les notifications sont seulement préparées." /><FormulaireCampagne /><Panneau titre="Campagnes d'essai"><div className="ad-table-cadre"><table className="ad-table"><thead><tr><th>Code</th><th>Nom</th><th>Ciblage</th><th>État</th><th>Utilisations</th></tr></thead><tbody>{campagnes.length === 0 ? <tr><td colSpan={5}><EtatVide titre="Aucune campagne" texte="Créez un code pour commencer." /></td></tr> : campagnes.map((c) => <tr key={c.id}><td className="ad-cellule-principale">{c.code}</td><td>{c.nom}</td><td>{c.ciblage}</td><td><Pastille ton="neutre">{c.etat}</Pastille></td><td>{c.utilisations}/{c.plafondUtilisations}</td></tr>)}</tbody></table></div></Panneau><Panneau titre="Valeurs par défaut"><ul><li>Plafond par campagne : {d.plafondMontantGnf.toLocaleString("fr-FR")} GNF.</li><li>Plafond d'utilisations : {d.plafondUtilisations}.</li><li>Durée indicative : {d.dureeJours} jours (les dates saisies restent explicites).</li></ul></Panneau></div>;
}
