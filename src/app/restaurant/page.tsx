/**
 * Placeholder — console restaurant (bloc 6, PLAN-EXECUTION.md).
 * Surface protégée par authentification et RLS (ADR-004) : rien de réel ici tant que
 * les blocs 2 (schéma) et 4 (auth) ne sont pas acceptés.
 */
export default function ConsoleRestaurantPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "var(--space-8) var(--space-4)",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>Espace restaurant</h1>
      <p style={{ color: "var(--secondaire)" }}>
        Console à construire au bloc 6, après authentification (bloc 4) et schéma/RLS (bloc 2).
      </p>
    </main>
  );
}
