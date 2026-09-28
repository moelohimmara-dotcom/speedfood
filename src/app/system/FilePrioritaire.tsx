import Link from "next/link";
import { Badge, Card } from "@/components/ui";

/**
 * File « à traiter en priorité » du tableau de bord : uniquement ce qui
 * attend une décision humaine, avec lien direct vers l'écran d'action.
 * Une ligne vide n'est jamais affichée ; la section reste visible avec un
 * message « rien à faire » quand le rôle a accès à une file mais qu'elle est
 * vide — c'est une information de pilotage en soi.
 */
export interface LigneFilePriorite {
  href: string;
  titre: string;
  meta: string;
  badge: string;
  ton: "succes" | "danger" | "neutre";
}

export function FilePrioritaire({ lignes }: { lignes: LigneFilePriorite[] }) {
  return (
    <section id="file-prioritaire" style={{ marginBottom: "var(--space-6)" }}>
      <h2 style={{ fontSize: "1.15rem", marginBottom: "var(--space-3)" }}>
        À traiter en priorité
      </h2>
      {lignes.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>
            Rien en attente : aucune validation de restaurant ni de proposition client
            dans les files ouvertes à votre rôle.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lignes.map((ligne) => (
            <Link key={ligne.href} href={ligne.href} style={{ textDecoration: "none" }}>
              <Card
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "var(--space-4)",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                  <strong style={{ color: "var(--encre)" }}>{ligne.titre}</strong>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.85rem",
                      color: "var(--secondaire)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {ligne.meta}
                  </p>
                </div>
                <Badge ton={ligne.ton}>{ligne.badge}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
