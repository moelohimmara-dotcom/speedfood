import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { creerClientAdmin } from "@/lib/db/admin";
import { PageHeader, Panneau, EtatVide } from "@/components/admin/blocs";
import { FormulaireMenus } from "./FormulaireMenus";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mises à jour de menus (administration)" };

export default async function MenusEnMassePage() {
  await exigerPermissionPage("restaurant.moderer");
  const { data } = await creerClientAdmin().from("restaurants").select("id, nom").eq("mode_vente", "speedfood").order("nom", { ascending: true }).limit(200);
  const restaurants = (data ?? []) as Array<{ id: string; nom: string }>;
  return <div className="ad-pile"><PageHeader titre="Mises à jour de menus en masse" description="Chaque opération commence par un aperçu. Rien n'est visible avant confirmation explicite et audit." />{restaurants.length === 0 ? <EtatVide titre="Aucun établissement géré" texte="Les établissements en mode Speedfood apparaîtront ici." /> : <FormulaireMenus restaurants={restaurants} />}<Panneau titre="Règles"><ul><li>Prix en GNF entiers, bornés à 5 000 000 GNF.</li><li>CSV UTF-8 séparé par des points-virgules : nom;description;prix;prix_promo.</li><li>Les lignes rejetées sont conservées dans le rapport et ne bloquent pas les lignes valides.</li></ul></Panneau></div>;
}
