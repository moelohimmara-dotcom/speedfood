import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerTaxonomie } from "@/lib/system-admin/taxonomie";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { FilAriane } from "@/components/console/FilAriane";
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
      <FilAriane elements={[{ libelle: "Catalogue", href: "/system/catalogue/restaurants" }, { libelle: "Taxonomie" }]} />
      <PageHeader titre="Taxonomie" description="Les catégories de menu et les quartiers proposés aux restaurants et aux clients." />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <div className="tx-colonnes">
        <Panneau titre="Catégories de menu">
          <ListeTaxonomie table="menu_categories" elements={categories} />
        </Panneau>
        <Panneau titre="Quartiers">
          <p className="ad-aide-champ">
            Quartiers de Conakry. Les communes et leurs quartiers « Centre de … » se gèrent dans{" "}
            <Link href="/system/catalogue/geographie" className="lien-texte">
              Géographie
            </Link>
            .
          </p>
          <ListeTaxonomie table="neighborhoods" elements={quartiers} />
        </Panneau>
      </div>
    </div>
  );
}
