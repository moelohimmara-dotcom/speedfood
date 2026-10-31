import { maximumAxe, type CategorieStatut, type JourSerie } from "@/lib/system-admin/pilotageCalculs";

/**
 * Graphiques du tableau de bord : SVG et HTML purs, rendus côté serveur, aucune bibliothèque. Règles d'accessibilité :
 * - chaque graphique a un nom accessible qui résume ce qu'il montre ;
 * - la couleur ne porte jamais seule le sens : légende avec les valeurs, infobulle `<title>` par barre, et un tableau des
 *   chiffres dans un volet repliable (« Voir les chiffres »).
 * Couleurs : tokens du design system uniquement.
 */

export const COULEURS_CATEGORIE: Record<CategorieStatut, string> = {
  terminees: "var(--succes)",
  enCours: "var(--secondaire)",
  enAttente: "var(--orange)",
  ecartees: "var(--danger)",
};

export const LIBELLES_CATEGORIE: Record<CategorieStatut, string> = {
  terminees: "Terminées",
  enCours: "Acceptées ou prêtes",
  enAttente: "En attente de réponse",
  ecartees: "Refusées ou annulées",
};

const ORDRE_PILE: CategorieStatut[] = ["terminees", "enCours", "enAttente", "ecartees"];

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

/** Légende commune : pastille de couleur, libellé et valeur. */
export function Legende({ elements }: { elements: { cle: string; libelle: string; valeur?: number | string; couleur: string }[] }) {
  return (
    <ul className="ad-legende">
      {elements.map((element) => (
        <li key={element.cle}>
          <span className="ad-legende-pastille" style={{ background: element.couleur }} aria-hidden="true" />
          <span>{element.libelle}</span>
          {element.valeur !== undefined ? <strong>{element.valeur}</strong> : null}
        </li>
      ))}
    </ul>
  );
}

/** Barres empilées : une barre par jour, quatre familles de statuts. */
export function GraphiqueBarresJours({ jours, identifiant }: { jours: JourSerie[]; identifiant: string }) {
  const largeur = 640;
  const hauteur = 230;
  const marge = { gauche: 34, droite: 6, haut: 10, bas: 28 };
  const largeurUtile = largeur - marge.gauche - marge.droite;
  const hauteurUtile = hauteur - marge.haut - marge.bas;
  const maximum = maximumAxe(Math.max(0, ...jours.map((j) => j.total)));
  const pas = largeurUtile / jours.length;
  const largeurBarre = Math.max(4, Math.min(34, pas * 0.68));
  const echelle = (valeur: number) => (valeur / maximum) * hauteurUtile;
  const intervalleEtiquettes = Math.max(1, Math.ceil(jours.length / 7));
  const total = jours.reduce((somme, j) => somme + j.total, 0);
  const idTitre = `${identifiant}-titre`;
  const graduations = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maximum * f));

  return (
    <figure className="ad-graphique">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-labelledby={idTitre} className="ad-graphique-svg">
        <title id={idTitre}>
          {`Commandes par jour sur ${jours.length} jours : ${pluriel(total, "commande")} au total, jusqu'à ${maximum >= 1 ? Math.max(...jours.map((j) => j.total)) : 0} en une journée.`}
        </title>
        {graduations.map((valeur) => {
          const y = marge.haut + hauteurUtile - echelle(valeur);
          return (
            <g key={valeur}>
              <line x1={marge.gauche} x2={largeur - marge.droite} y1={y} y2={y} className="ad-graphique-grille" />
              <text x={marge.gauche - 6} y={y + 4} textAnchor="end" className="ad-graphique-axe">
                {valeur}
              </text>
            </g>
          );
        })}
        {jours.map((jour, indice) => {
          const x = marge.gauche + indice * pas + (pas - largeurBarre) / 2;
          let cumul = 0;
          return (
            <g key={jour.jour}>
              <title>
                {`${jour.libelle} : ${pluriel(jour.total, "commande")} (${jour.terminees} terminée${jour.terminees > 1 ? "s" : ""}, ${jour.enCours} en cours, ${jour.enAttente} en attente, ${jour.ecartees} écartée${jour.ecartees > 1 ? "s" : ""})`}
              </title>
              {ORDRE_PILE.map((categorie) => {
                const valeur = jour[categorie];
                if (valeur === 0) {
                  return null;
                }
                const h = echelle(valeur);
                const y = marge.haut + hauteurUtile - echelle(cumul) - h;
                cumul += valeur;
                return (
                  <rect
                    key={categorie}
                    x={x}
                    y={y}
                    width={largeurBarre}
                    height={Math.max(1, h)}
                    rx={2}
                    fill={COULEURS_CATEGORIE[categorie]}
                    className="ad-graphique-segment"
                  />
                );
              })}
              {indice % intervalleEtiquettes === 0 || indice === jours.length - 1 ? (
                <text x={x + largeurBarre / 2} y={hauteur - 8} textAnchor="middle" className="ad-graphique-axe">
                  {jour.libelle}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Anneau de répartition (somme des parts = total) avec le total au centre. */
export function Anneau({
  parts,
  centre,
  identifiant,
}: {
  parts: { cle: string; libelle: string; valeur: number; couleur: string }[];
  centre: string;
  identifiant: string;
}) {
  const total = parts.reduce((somme, p) => somme + p.valeur, 0);
  let decalage = 0;
  const idTitre = `${identifiant}-titre`;
  return (
    <figure className="ad-anneau">
      <svg viewBox="0 0 42 42" role="img" aria-labelledby={idTitre} className="ad-anneau-svg">
        <title id={idTitre}>
          {total === 0
            ? "Aucune commande sur la période."
            : `Répartition de ${pluriel(total, "commande")} : ${parts.map((p) => `${p.libelle} ${p.valeur}`).join(", ")}.`}
        </title>
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--bordure)" strokeWidth="6" />
        {total > 0
          ? parts.map((part) => {
              if (part.valeur === 0) {
                return null;
              }
              const longueur = (part.valeur / total) * 100;
              const arc = (
                <circle
                  key={part.cle}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke={part.couleur}
                  strokeWidth="6"
                  strokeDasharray={`${longueur} ${100 - longueur}`}
                  strokeDashoffset={25 - decalage}
                />
              );
              decalage += longueur;
              return arc;
            })
          : null}
        <text x="21" y="21.5" textAnchor="middle" className="ad-anneau-valeur">
          {total}
        </text>
        <text x="21" y="27" textAnchor="middle" className="ad-anneau-libelle">
          {centre}
        </text>
      </svg>
    </figure>
  );
}

/** Commandes par heure de la journée (0 h à 23 h) ; l'heure la plus chargée est mise en évidence. */
export function GraphiqueHeures({ valeurs, identifiant }: { valeurs: number[]; identifiant: string }) {
  const largeur = 480;
  const hauteur = 130;
  const marge = { gauche: 4, droite: 4, haut: 14, bas: 22 };
  const pas = (largeur - marge.gauche - marge.droite) / 24;
  const maximum = Math.max(1, ...valeurs);
  const heurePointe = valeurs.indexOf(Math.max(...valeurs));
  const total = valeurs.reduce((a, b) => a + b, 0);
  const idTitre = `${identifiant}-titre`;
  const hauteurUtile = hauteur - marge.haut - marge.bas;
  return (
    <figure className="ad-graphique">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-labelledby={idTitre} className="ad-graphique-svg">
        <title id={idTitre}>
          {total === 0
            ? "Aucune commande sur la période."
            : `Commandes par heure : pic à ${heurePointe} h avec ${pluriel(valeurs[heurePointe], "commande")}.`}
        </title>
        {valeurs.map((valeur, heure) => {
          const h = (valeur / maximum) * hauteurUtile;
          const x = marge.gauche + heure * pas + 1;
          const estPointe = total > 0 && heure === heurePointe;
          return (
            <g key={heure}>
              <title>{`${heure} h : ${pluriel(valeur, "commande")}`}</title>
              <rect
                x={x}
                y={marge.haut + hauteurUtile - h}
                width={pas - 2}
                height={Math.max(valeur > 0 ? 2 : 0, h)}
                rx={2}
                fill={estPointe ? "var(--rouge-fonce)" : "var(--secondaire)"}
                opacity={estPointe ? 1 : 0.55}
              />
              {heure % 3 === 0 ? (
                <text x={x + (pas - 2) / 2} y={hauteur - 6} textAnchor="middle" className="ad-graphique-axe">
                  {heure} h
                </text>
              ) : null}
            </g>
          );
        })}
        {total > 0 ? (
          <text x={marge.gauche + heurePointe * pas + pas / 2} y={marge.haut - 3} textAnchor="middle" className="ad-graphique-valeur">
            {valeurs[heurePointe]}
          </text>
        ) : null}
      </svg>
    </figure>
  );
}

/** Courbe miniature d'une série (tendance dans une carte de chiffre). Décorative : le chiffre est déjà écrit. */
export function Tendance({ valeurs }: { valeurs: number[] }) {
  if (valeurs.length < 2) {
    return null;
  }
  const largeur = 100;
  const hauteur = 28;
  const maximum = Math.max(1, ...valeurs);
  const points = valeurs
    .map((valeur, i) => `${((i / (valeurs.length - 1)) * largeur).toFixed(1)},${(hauteur - 3 - (valeur / maximum) * (hauteur - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="ad-tendance" aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--rouge-fonce)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Barres horizontales HTML (comparaison de quelques quantités, par exemple les statuts des restaurants). */
export function BarresHorizontales({
  lignes,
}: {
  lignes: { cle: string; libelle: string; valeur: number; couleur: string; href?: string }[];
}) {
  const maximum = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <ul className="ad-barres-h">
      {lignes.map((ligne) => {
        const contenu = (
          <>
            <span className="ad-barres-h-libelle">{ligne.libelle}</span>
            <span className="ad-barres-h-piste" aria-hidden="true">
              <span className="ad-barres-h-barre" style={{ width: `${(ligne.valeur / maximum) * 100}%`, background: ligne.couleur }} />
            </span>
            <strong className="ad-barres-h-valeur">{ligne.valeur}</strong>
          </>
        );
        return <li key={ligne.cle}>{ligne.href ? <a href={ligne.href}>{contenu}</a> : <div>{contenu}</div>}</li>;
      })}
    </ul>
  );
}

/** Variation par rapport à la période précédente : toujours écrite (« + 25 % », « − 10 % »), jamais la couleur seule. */
export function Variation({
  valeur,
  hausseEstBonne = true,
  texteVide = "Pas de comparaison possible",
}: {
  valeur: number | null;
  hausseEstBonne?: boolean;
  texteVide?: string;
}) {
  if (valeur === null) {
    return <span className="ad-variation ad-variation-neutre">{texteVide}</span>;
  }
  const pourcent = Math.round(valeur * 100);
  if (pourcent === 0) {
    return <span className="ad-variation ad-variation-neutre">Stable par rapport à la période précédente</span>;
  }
  const bon = (pourcent > 0) === hausseEstBonne;
  return (
    <span className={`ad-variation ${bon ? "ad-variation-bon" : "ad-variation-mauvais"}`}>
      <span aria-hidden="true">{pourcent > 0 ? "▲" : "▼"}</span> {pourcent > 0 ? "+" : "−"} {Math.abs(pourcent)} % par rapport à la période précédente
    </span>
  );
}
