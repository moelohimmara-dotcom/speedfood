import Link from "next/link";
import { IconeAdmin } from "./icones";

/**
 * Briques de la console d'administration (refonte du 4 octobre 2026). Une même grammaire sur tous les écrans :
 * `PageHeader` en tête, `Panneau` pour grouper, `Tuile` pour un chiffre, `EtatVide` quand il n'y a rien.
 * Aucun accès aux données ici : ce sont des composants d'affichage.
 */

export function PageHeader({
  titre,
  description,
  actions,
  retour,
}: {
  titre: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  retour?: { href: string; libelle: string };
}) {
  return (
    <header className="ad-entete-page">
      {retour ? (
        <Link href={retour.href} className="ad-retour">
          <span className="ad-retour-fleche" aria-hidden="true">
            <IconeAdmin nom="chevron" taille={16} />
          </span>
          {retour.libelle}
        </Link>
      ) : null}
      <div className="ad-entete-page-ligne">
        <div>
          <h1>{titre}</h1>
          {description ? <p className="ad-entete-page-desc">{description}</p> : null}
        </div>
        {actions ? <div className="ad-entete-page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Panneau({
  titre,
  compteur,
  actions,
  children,
  sansMarge = false,
  id,
}: {
  titre?: string;
  compteur?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Retire le remplissage intérieur : pour une liste qui va d'un bord à l'autre. */
  sansMarge?: boolean;
  id?: string;
}) {
  return (
    <section className="ad-panneau" id={id} aria-labelledby={titre && id ? `${id}-titre` : undefined}>
      {titre ? (
        <div className="ad-panneau-tete">
          <h2 id={id ? `${id}-titre` : undefined}>
            {titre}
            {typeof compteur === "number" ? <span className="ad-panneau-compteur">{compteur}</span> : null}
          </h2>
          {actions}
        </div>
      ) : null}
      <div className={sansMarge ? "ad-panneau-corps ad-panneau-corps-plein" : "ad-panneau-corps"}>{children}</div>
    </section>
  );
}

export function Tuile({
  valeur,
  libelle,
  definition,
  href,
  ton = "neutre",
}: {
  valeur: number | string;
  libelle: string;
  definition?: string;
  href?: string;
  ton?: "neutre" | "danger" | "succes";
}) {
  const contenu = (
    <>
      <span className={`ad-tuile-valeur ad-ton-${ton}`}>{valeur}</span>
      <span className="ad-tuile-libelle">{libelle}</span>
      {definition ? <span className="ad-tuile-def">{definition}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="ad-tuile ad-tuile-lien">
      {contenu}
    </Link>
  ) : (
    <div className="ad-tuile">{contenu}</div>
  );
}

export function EtatVide({ titre, texte, icone = "coche" }: { titre: string; texte?: string; icone?: string }) {
  return (
    <div className="ad-etat-vide">
      <span className="ad-etat-vide-icone">
        <IconeAdmin nom={icone} taille={24} />
      </span>
      <p className="ad-etat-vide-titre">{titre}</p>
      {texte ? <p className="ad-etat-vide-texte">{texte}</p> : null}
    </div>
  );
}

/** Pastille d'état : toujours un texte (jamais la couleur seule). */
export function Pastille({ ton = "neutre", children }: { ton?: "neutre" | "danger" | "succes" | "attention"; children: React.ReactNode }) {
  return <span className={`ad-pastille ad-pastille-${ton}`}>{children}</span>;
}
