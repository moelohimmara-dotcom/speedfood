export default function Chargement() {
  return (
    <main className="squelette-decouverte" aria-busy="true">
      <p className="sr-only" role="status">
        Chargement des restaurants…
      </p>
      <div className="squelette squelette-hero" aria-hidden="true" />
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "var(--space-4)" }} aria-hidden="true">
        <div className="squelette squelette-ligne" />
        <div className="squelette-grille-cartes">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="squelette squelette-carte" />
          ))}
        </div>
      </div>
    </main>
  );
}
