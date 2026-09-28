import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerBannieres } from "@/lib/system-admin/contenus";
import { Card } from "@/components/ui";
import { SousNavContenus } from "../SousNavContenus";
import { FormulaireNouvelleBanniere } from "./FormulaireNouvelleBanniere";
import { BanniereItem } from "./BanniereItem";

interface Recherche {
  statut?: string;
}

/**
 * Ajustement léger post-tableau de bord : le filtre `statut` permet aux
 * compteurs du centre de commandement (`/system/contenus/bannieres?statut=…`)
 * d'ouvrir directement la liste correspondante. Le reste de l'écran (bloc 8c)
 * est inchangé.
 */
export default async function BannieresSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  await exigerPermissionPage("contenu.editer");
  const { statut: statutBrut } = await searchParams;
  const statut = statutBrut === "publie" || statutBrut === "brouillon" ? statutBrut : "tous";
  const bannieres = (await listerBannieres()).filter((b) => statut === "tous" || b.statut === statut);

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Contenus</h1>
      <SousNavContenus />

      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-4)" }}>
        {(["tous", "publie", "brouillon"] as const).map((valeur) => (
          <Link
            key={valeur}
            href={
              valeur === "tous"
                ? "/system/contenus/bannieres"
                : `/system/contenus/bannieres?statut=${valeur}`
            }
            className={`chip ${statut === valeur ? "actif" : ""}`}
          >
            {valeur === "tous" ? "Toutes" : valeur === "publie" ? "Publiées" : "Brouillons"}
          </Link>
        ))}
      </div>

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
