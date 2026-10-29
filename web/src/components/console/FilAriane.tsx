import Link from "next/link";

/**
 * Fil d'Ariane des consoles (fondations de la refonte, phase 1) : dit où l'on est (Famille › Page › Élément) et remplace les titres répétés
 * (« Catalogue » sur six pages, « Accès » sur trois) relevés par l'audit. Le dernier élément est la page courante (`aria-current`), jamais un lien.
 * Composant serveur : aucune interactivité.
 */
export interface ElementFil {
  libelle: string;
  href?: string;
}

export function FilAriane({ elements }: { elements: ElementFil[] }) {
  if (elements.length === 0) return null;
  return (
    <nav className="sx-fil" aria-label="Fil d'Ariane">
      <ol>
        {elements.map((element, i) => {
          const dernier = i === elements.length - 1;
          return (
            <li key={`${i}-${element.libelle}`}>
              {dernier || !element.href ? (
                <span aria-current={dernier ? "page" : undefined}>{element.libelle}</span>
              ) : (
                <Link href={element.href}>{element.libelle}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
