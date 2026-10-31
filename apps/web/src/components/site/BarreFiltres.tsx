import Link from "next/link";

export interface OptionFiltre {
  cle: string;
  libelle: string;
  /** Nombre de restaurants que donnerait ce filtre (avec les autres filtres actifs). */
  n: number;
  href: string;
  actif: boolean;
}

/**
 * Barre de filtres de la page Restaurants : une rangée horizontale (cuisine puis quartier) qui défile sous le doigt et reste collée sous
 * l'en-tête. Chaque puce dit combien de restaurants elle donnerait. Rendu serveur, de simples liens : fonctionne sans JavaScript et l'état
 * des filtres reste dans l'adresse (partageable). Un filtre sans résultat reste cliquable mais s'estompe, pour ne pas surprendre.
 */
export function BarreFiltres({
  cuisines,
  quartiers,
  effacer,
  total,
}: {
  cuisines: OptionFiltre[];
  quartiers: OptionFiltre[];
  /** Lien « Tout effacer » (absent quand aucun filtre de cuisine ou de quartier n'est actif). */
  effacer: string | null;
  total: number;
}) {
  const puce = (o: OptionFiltre) => (
    <Link key={o.cle} href={o.href} className={`chip chip-compte${o.actif ? " actif" : ""}${o.n === 0 && !o.actif ? " chip-vide" : ""}`} aria-current={o.actif ? "true" : undefined}>
      {o.libelle}
      <span className="chip-n" aria-label={`${o.n} restaurant${o.n > 1 ? "s" : ""}`}>
        {o.n}
      </span>
    </Link>
  );
  return (
    <nav className="barre-filtres" aria-label="Filtres par cuisine et par quartier">
      <div className="barre-filtres-rail">
        <span className="barre-filtres-etiquette">Cuisine</span>
        {cuisines.map(puce)}
        <span className="barre-filtres-sep" aria-hidden="true" />
        <span className="barre-filtres-etiquette">Quartier</span>
        {quartiers.map(puce)}
        {effacer ? (
          <Link href={effacer} className="chip chip-effacer">
            Tout effacer
          </Link>
        ) : null}
      </div>
      <p className="barre-filtres-total" role="status">
        <strong>{total}</strong> restaurant{total > 1 ? "s" : ""}
      </p>
    </nav>
  );
}
