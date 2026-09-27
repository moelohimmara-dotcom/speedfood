/**
 * Placeholder — CMS système (bloc 8, PLAN-EXECUTION.md).
 * Surfaces /restaurant et /system strictement séparées (ADR-010) : un membership restaurant
 * n'accorde jamais un rôle système, et réciproquement.
 */
export default function CmsSystemePage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--space-8) var(--space-4)",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>CMS système</h1>
      <p style={{ color: "var(--secondaire)" }}>
        Réservé aux rôles système (bloc 8a) : super_admin, operations, content_editor, support.
        À construire après le bloc 2 (schéma) et le gel de la matrice de permissions.
      </p>
    </main>
  );
}
