import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerBannieres } from "@/lib/system-admin/contenus";
import { Card } from "@/components/ui";
import { SousNavContenus } from "../SousNavContenus";
import { FormulaireNouvelleBanniere } from "./FormulaireNouvelleBanniere";
import { BanniereItem } from "./BanniereItem";

export default async function BannieresSystemePage() {
  await exigerPermissionPage("contenu.editer");
  const bannieres = await listerBannieres();

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Contenus</h1>
      <SousNavContenus />

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Nouvelle bannière</h2>
        <FormulaireNouvelleBanniere />
      </Card>

      {bannieres.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucune bannière pour l&apos;instant.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bannieres.map((b) => (
            <BanniereItem key={b.id} banniere={b} />
          ))}
        </div>
      )}
    </div>
  );
}
