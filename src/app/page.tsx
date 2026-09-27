import { Card, Badge } from "@/components/ui";

/**
 * Placeholder — catalogue public (bloc 5, PLAN-EXECUTION.md).
 * Aucune donnée réelle branchée : le bloc 2 (schéma/RLS) est accepté, le bloc 3
 * (composants UI) l'est aussi désormais. Reste à brancher la lecture Supabase
 * réelle du catalogue une fois le bloc 4 (authentification) accepté.
 */
export default function CataloguePage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--space-8) var(--space-4)",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>Speedfood</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-5)" }}>
        Socle du projet en place (blocs 1 à 3). Le catalogue public sera branché au
        bloc 5, une fois l&apos;authentification (bloc 4) acceptée.
      </p>
      <Card>
        <h3 style={{ marginBottom: "var(--space-2)" }}>Composants UI (bloc 3)</h3>
        <p style={{ color: "var(--secondaire)", fontSize: "0.9rem", marginBottom: "var(--space-3)" }}>
          Bouton, champ, carte, badge et alerte portés depuis le prototype.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge ton="succes">Ouvert</Badge>
          <Badge ton="danger">Fermé</Badge>
          <Badge ton="neutre">Démo</Badge>
        </div>
      </Card>
    </main>
  );
}
