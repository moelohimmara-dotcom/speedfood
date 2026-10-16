import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { FilAriane } from "@/components/console/FilAriane";
import { PageHeader } from "@/components/admin/blocs";
import { grouperParCommune, lireQuartiersActifs } from "@/lib/geographie/quartiers";
import { FormulaireQuartier } from "../FormulaireQuartier";
import { FormulaireZonesDesservies } from "../FormulaireZonesDesservies";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Où je suis, où je livre" };

/** « Où je suis, où je livre » (sous-page du hub « Mon restaurant ») : le quartier du restaurant et les zones où il livre, avec frais et délai. */
export default async function ZonesPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil/zones");

  const { data: restaurant } = await supabase.from("restaurants").select("quartier_id").eq("id", membership.restaurant_id).maybeSingle();
  if (!restaurant) {
    return null;
  }
  const quartiers = await lireQuartiersActifs(supabase);
  const quartierActuelValide = quartiers.some((q) => q.id === restaurant.quartier_id);
  const { data: zonesDesservies } = await supabase
    .from("restaurant_zones_desservies")
    .select("id, frais_gnf, delai_minutes, communes(nom), neighborhoods(nom, communes(nom))")
    .eq("restaurant_id", membership.restaurant_id);
  const zonesPourFormulaire = (zonesDesservies ?? [])
    .map((z) => {
      const quartierNom = z.neighborhoods?.nom;
      const communeNom = z.neighborhoods?.communes?.nom;
      return {
        id: z.id,
        libelle: quartierNom ? `${quartierNom}${communeNom ? ` (${communeNom})` : ""}` : `Toute la commune de ${z.communes?.nom ?? ""}`,
        fraisGnf: z.frais_gnf,
        delaiMinutes: z.delai_minutes,
      };
    })
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));

  return (
    <div>
      <FilAriane elements={[{ libelle: "Mon restaurant", href: "/restaurant/profil" }, { libelle: "Où je suis, où je livre" }]} />
      <PageHeader titre="Où je suis, où je livre" description="Votre quartier, et les zones où vous livrez avec leurs frais et leur délai." />

      <div className="profil-section">
        <FormulaireQuartier
          groupes={grouperParCommune(quartiers)}
          quartierActuelId={restaurant.quartier_id}
          quartierActuelValide={quartierActuelValide}
        />
      </div>

      <div className="profil-section">
        <FormulaireZonesDesservies groupes={grouperParCommune(quartiers)} zones={zonesPourFormulaire} />
      </div>
    </div>
  );
}
