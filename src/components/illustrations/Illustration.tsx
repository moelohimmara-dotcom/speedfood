import { ICONES } from "@/lib/illustrations/icones.generated";
import type { Illustration as ModeleIllustration } from "@/lib/illustrations/modele";

/**
 * Dessine une illustration à partir de ses paramètres. Composant serveur, SVG pur, aucun script.
 * Les dessins viennent de `ICONES` (figés dans le dépôt) : la valeur reçue ne sert qu'à CHOISIR un motif et des couleurs,
 * jamais à injecter du balisage. Fournir une valeur déjà passée par `validerIllustration`.
 */
export function Illustration({
  valeur,
  nom,
  decoratif = false,
  className,
}: {
  valeur: ModeleIllustration;
  /** Nom accessible (nom du plat ou du restaurant). Ignoré si `decoratif`. */
  nom: string;
  decoratif?: boolean;
  className?: string;
}) {
  const icone = ICONES[valeur.motif];
  const large = valeur.style === "affiche";
  const w = large ? 160 : 100;
  const h = large ? 90 : 100;
  const aria = decoratif ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": nom };

  const place = (taille: number, cx: number, cy: number, couleur?: string) => {
    if (!icone) return null;
    const echelle = taille / icone.v;
    return (
      <g
        transform={`translate(${cx - taille / 2} ${cy - taille / 2}) scale(${echelle})`}
        color={couleur}
        dangerouslySetInnerHTML={{ __html: icone.c }}
      />
    );
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} {...aria} focusable="false">
      {valeur.style === "pastille" ? (
        <>
          <circle cx="50" cy="50" r="48" fill={valeur.fond} />
          {place(58, 50, 52, valeur.forme)}
        </>
      ) : null}
      {valeur.style === "assiette" ? (
        <>
          <rect width="100" height="100" fill={valeur.fond} />
          <circle cx="50" cy="52" r="42" fill="#fffefc" />
          <circle cx="50" cy="52" r="42" fill="none" stroke={valeur.accent} strokeWidth="3" />
          <circle cx="50" cy="52" r="33" fill="none" stroke={valeur.accent} strokeOpacity=".35" strokeWidth="1.5" />
          {place(44, 50, 52, valeur.forme)}
        </>
      ) : null}
      {valeur.style === "affiche" ? (
        <>
          <rect width="160" height="90" fill={valeur.fond} />
          <circle cx="132" cy="22" r="46" fill={valeur.accent} fillOpacity=".25" />
          <circle cx="20" cy="86" r="36" fill={valeur.accent} fillOpacity=".18" />
          {place(26, 24, 18, valeur.forme)}
          {place(22, 140, 70, valeur.forme)}
          {place(56, 80, 46, valeur.forme)}
        </>
      ) : null}
      {valeur.style === "monogramme" ? (
        <>
          <rect width="100" height="100" rx="22" fill={valeur.fond} />
          {valeur.texte ? (
            <text
              x="50"
              y="60"
              textAnchor="middle"
              fontFamily="var(--font-barlow), 'Arial Narrow', sans-serif"
              fontWeight="800"
              fontSize={valeur.texte.length > 2 ? 38 : 46}
              fill={valeur.forme}
            >
              {valeur.texte}
            </text>
          ) : (
            place(54, 50, 50, valeur.forme)
          )}
          {valeur.texte ? <circle cx="82" cy="82" r="9" fill={valeur.accent} /> : null}
        </>
      ) : null}
    </svg>
  );
}
