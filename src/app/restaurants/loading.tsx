export default function Chargement() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <p style={{ color: "var(--secondaire)", margin: "0 0 var(--space-4)" }} role="status">
        Chargement des restaurants…
      </p>
      <div className="squelette-grille" aria-hidden="true">
        <div className="squelette" style={{ height: 44 }} />
        <div className="squelette" style={{ height: 220 }} />
        <div className="squelette" style={{ height: 220 }} />
      </div>
    </main>
  );
}
