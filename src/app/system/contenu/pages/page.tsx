import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerPages } from "@/lib/system-admin/contenus";
import { Card, Badge } from "@/components/ui";
import { SousNavContenus } from "./SousNavContenus";
import { FormulaireNouvellePage } from "./FormulaireNouvellePage";

interface Recherche {
  statut?: string;
}

/**
 * Ajustement léger post-tableau de bord : le filtre `statut` permet aux
 * compteurs du centre de commandement (`/system?statut=publie|brouillon`)
 * d'ouvrir directement la liste correspondante. Le reste de l'écran (bloc 8c)
 * est inchangé.
 */
export default async function ContenusSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  await exigerPermissionPage("contenu.editer");
  const { statut: statutBrut } = await searchParams;
  const statut = statutBrut === "publie" || statutBrut === "brouillon" ? statutBrut : "tous";
  const pages = (await listerPages()).filter((p) => statut === "tous" || p.statut === statut);

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Contenus</h1>
      <SousNavContenus />

      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-4)" }}>
        {(["tous", "publie", "brouillon"] as const).map((valeur) => (
          <Link
            key={valeur}
            href={valeur === "tous" ? "/system/contenus" : `/system/contenus?statut=${valeur}`}
            className={`chip ${statut === valeur ? "actif" : ""}`}
          >
            {valeur === "tous" ? "Toutes" : valeur === "publie" ? "Publiées" : "Brouillons"}
          </Link>
        ))}
      </div>

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Nouvelle page</h2>
        <FormulaireNouvellePage />
      </Card>

      {pages.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucune page pour l&apos;instant.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pages.map((p) => (
            <Link key={p.id} href={`/system/contenus/pages/${p.id}`} style={{ textDecoration: "none" }}>
              <Card style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong style={{ color: "var(--encre)" }}>{p.titre}</strong>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>/{p.slug}</p>
                </div>
                <Badge ton={p.statut === "publie" ? "succes" : "neutre"}>
                  {p.statut === "publie" ? "Publié" : "Brouillon"}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
