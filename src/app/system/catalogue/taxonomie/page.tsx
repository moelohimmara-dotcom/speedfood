import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerTaxonomie } from "@/lib/system-admin/taxonomie";
import { Card } from "@/components/ui";
import { SousNavContenus } from "../SousNavContenus";
import { ListeTaxonomie } from "./ListeTaxonomie";

export default async function TaxonomieSystemePage() {
  await exigerPermissionPage("taxonomie.editer");

  const [categories, quartiers] = await Promise.all([
    listerTaxonomie("menu_categories"),
    listerTaxonomie("neighborhoods"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Contenus</h1>
      <SousNavContenus />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <Card>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Catégories de menu</h2>
          <ListeTaxonomie table="menu_categories" elements={categories} />
        </Card>

        <Card>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Quartiers</h2>
          <ListeTaxonomie table="neighborhoods" elements={quartiers} />
        </Card>
      </div>
    </div>
  );
}
