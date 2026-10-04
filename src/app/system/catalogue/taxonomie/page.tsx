import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerTaxonomie } from "@/lib/system-admin/taxonomie";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { ListeTaxonomie } from "./ListeTaxonomie";

export const metadata = { title: "Taxonomie (administration)" };

export default async function TaxonomieSystemePage() {
  const contexte = await exigerPermissionPage("taxonomie.editer");

  const [categories, quartiers] = await Promise.all([
    listerTaxonomie("menu_categories"),
    listerTaxonomie("neighborhoods"),
  ]);

  return (
    <div>
      <PageHeader titre="Catalogue" description="Les catégories de menu et les quartiers proposés aux restaurants et aux clients." />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <div className="ad-grille-deux" style={{ marginTop: 0 }}>
        <Panneau titre="Catégories de menu">
          <ListeTaxonomie table="menu_categories" elements={categories} />
        </Panneau>
        <Panneau titre="Quartiers">
          <ListeTaxonomie table="neighborhoods" elements={quartiers} />
        </Panneau>
      </div>
    </div>
  );
}
