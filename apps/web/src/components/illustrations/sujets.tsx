/**
 * Illustrations de sujets Speedfood (parcours, états, métier) — dessins originaux du dépôt, même langage que le mobile
 * (apps/mobile/src/design/IllustrationSujet.tsx) : trait encre épais aux extrémités rondes, aplats aux couleurs
 * verrouillées de globals.css, fond crème. SVG serveur pur, aucun script, aucune image externe, aucun emoji.
 * Liste fermée, identique côté mobile ; chaque usage garde un libellé visible (aucune signification par la seule image).
 */
export type SujetIllustration =
  | 'panier' | 'sac' | 'horloge' | 'moto' | 'retrait' | 'especes' | 'compte'
  | 'cloche' | 'coeur' | 'loupe' | 'position' | 'telephone' | 'etoile' | 'toque' | 'indisponible';

const ENCRE = 'var(--encre)';
const TRAIT = { stroke: ENCRE, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Dessin({ sujet }: { sujet: SujetIllustration }) {
  switch (sujet) {
    case 'panier': return <>
      <path d="M22 34h52l-6 34a6 6 0 0 1-6 5H34a6 6 0 0 1-6-5l-6-34Z" fill="var(--surface)" {...TRAIT} />
      <path d="M36 34c0-8 5-13 12-13s12 5 12 13" {...TRAIT} />
      <circle cx="38" cy="82" r="3.5" fill="var(--rouge-fonce)" /><circle cx="58" cy="82" r="3.5" fill="var(--rouge-fonce)" />
    </>;
    case 'sac': return <>
      <path d="M28 32h40l4 44a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6l4-44Z" fill="var(--surface)" {...TRAIT} />
      <path d="M36 32v-6a12 12 0 0 1 24 0v6" {...TRAIT} />
      <path d="M38 52h20" stroke="var(--rouge-fonce)" strokeWidth="5" strokeLinecap="round" />
    </>;
    case 'horloge': return <>
      <circle cx="48" cy="50" r="30" fill="var(--surface)" {...TRAIT} />
      <path d="M48 34v16l11 7" {...TRAIT} />
      <path d="M38 14h20" stroke="var(--rouge-fonce)" strokeWidth="5" strokeLinecap="round" />
    </>;
    case 'moto': return <>
      <circle cx="28" cy="70" r="10" fill="var(--surface)" {...TRAIT} /><circle cx="70" cy="70" r="10" fill="var(--surface)" {...TRAIT} />
      <path d="M28 70l12-24h14l8 12h8M40 46l-6 24M54 46l6 24" {...TRAIT} />
      <path d="M58 30h14l4 10H62z" fill="var(--mangue)" {...TRAIT} />
      <path d="M14 82h18M60 82h22" stroke="var(--rouge-fonce)" strokeWidth="4" strokeLinecap="round" />
    </>;
    case 'retrait': return <>
      <path d="M24 40l4-16h40l4 16" fill="var(--orange)" {...TRAIT} />
      <path d="M28 40v34a6 6 0 0 0 6 6h28a6 6 0 0 0 6-6V40" fill="var(--surface)" {...TRAIT} />
      <path d="M24 40a8 8 0 0 0 16 0 8 8 0 0 0 16 0 8 8 0 0 0 16 0" {...TRAIT} />
      <rect x="42" y="56" width="12" height="14" rx="2" fill="var(--mangue)" {...TRAIT} />
    </>;
    case 'especes': return <>
      <rect x="16" y="30" width="64" height="38" rx="6" fill="var(--succes-fond)" {...TRAIT} />
      <circle cx="48" cy="49" r="10" fill="var(--surface)" {...TRAIT} />
      <circle cx="26" cy="40" r="3" fill="var(--succes)" /><circle cx="70" cy="58" r="3" fill="var(--succes)" />
      <path d="M30 78h36" stroke="var(--secondaire)" strokeWidth="4" strokeLinecap="round" />
    </>;
    case 'compte': return <>
      <circle cx="48" cy="36" r="13" fill="var(--surface)" {...TRAIT} />
      <path d="M24 80c3-14 12-21 24-21s21 7 24 21" fill="var(--surface)" {...TRAIT} />
      <circle cx="72" cy="30" r="7" fill="var(--mangue)" {...TRAIT} />
    </>;
    case 'cloche': return <>
      <path d="M48 18a18 18 0 0 1 18 18c0 12 4 16 7 19H23c3-3 7-7 7-19a18 18 0 0 1 18-18Z" fill="var(--mangue)" {...TRAIT} />
      <path d="M40 62a8 8 0 0 0 16 0" {...TRAIT} />
      <circle cx="70" cy="26" r="6" fill="var(--rouge-fonce)" />
    </>;
    case 'coeur': return <path d="M48 80S20 62 20 40a14 14 0 0 1 28-5 14 14 0 0 1 28 5c0 22-28 40-28 40Z" fill="var(--rouge)" {...TRAIT} />;
    case 'loupe': return <>
      <circle cx="42" cy="42" r="20" fill="var(--surface)" {...TRAIT} />
      <path d="M57 57l17 17" stroke="var(--rouge-fonce)" strokeWidth="6" strokeLinecap="round" />
      <path d="M32 42h20M42 32v20" stroke="var(--bordure)" strokeWidth="4" strokeLinecap="round" />
    </>;
    case 'position': return <>
      <path d="M48 84S24 58 24 38a24 24 0 0 1 48 0c0 20-24 46-24 46Z" fill="var(--rouge)" {...TRAIT} />
      <circle cx="48" cy="38" r="9" fill="var(--surface)" />
    </>;
    case 'telephone': return <>
      <path d="M30 16h12l5 18-8 6a40 40 0 0 0 17 17l6-8 18 5v12a6 6 0 0 1-6 6C46 70 26 50 24 22a6 6 0 0 1 6-6Z" fill="var(--surface)" {...TRAIT} />
      <path d="M56 24a16 16 0 0 1 16 16M56 34a7 7 0 0 1 6 6" stroke="var(--rouge-fonce)" strokeWidth="4" strokeLinecap="round" fill="none" />
    </>;
    case 'etoile': return <path d="M48 16l9 19 21 2-15 14 4 21-19-11-19 11 4-21L18 37l21-2z" fill="var(--mangue)" {...TRAIT} />;
    case 'toque': return <>
      <path d="M28 44a12 12 0 1 1 6-22 14 14 0 0 1 28 0 12 12 0 1 1 6 22v14H28z" fill="var(--surface)" {...TRAIT} />
      <path d="M28 66h40M28 76h40" stroke="var(--rouge-fonce)" strokeWidth="4" strokeLinecap="round" />
    </>;
    case 'indisponible': return <>
      <path d="M26 78V38l22-18 22 18v40" fill="var(--surface)" {...TRAIT} />
      <path d="M18 78h60" {...TRAIT} />
      <path d="M38 78V58h20v20" fill="var(--avertissement-fond)" {...TRAIT} />
      <path d="M34 34l28 28M62 34L34 62" stroke="var(--rouge-fonce)" strokeWidth="5" strokeLinecap="round" />
    </>;
  }
}

export function IllustrationSujet({ sujet, taille = 120, nom, decoratif = false, className }: {
  sujet: SujetIllustration;
  taille?: number;
  /** Nom accessible de l'illustration. Ignoré si `decoratif`. */
  nom: string;
  decoratif?: boolean;
  className?: string;
}) {
  const aria = decoratif ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': nom };
  return (
    <svg viewBox="0 0 96 96" width={taille} height={taille} className={className} {...aria} focusable="false">
      <circle cx="48" cy="48" r="45" fill="var(--creme)" />
      <g fill="none"><Dessin sujet={sujet} /></g>
    </svg>
  );
}
