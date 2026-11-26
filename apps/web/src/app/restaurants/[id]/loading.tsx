/** Squelette de la fiche d'un restaurant : bandeau, titre, puis lignes de plats (et non la forme de la liste des restaurants). */
export default function ChargementFiche() {
  return (
    <main className="squelette-decouverte" aria-busy="true">
      <p className="sr-only" role="status">
        Chargement du restaurant…
      </p>
      <div className="squelette squelette-hero" aria-hidden="true" />
      <div className="u-maxw-1160px-m-0-auto-p-s4" aria-hidden="true">
        <div className="squelette squelette-ligne" />
        <div className="squelette-fiche-plats">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="squelette squelette-plat" />
          ))}
        </div>
      </div>
    </main>
  );
}
