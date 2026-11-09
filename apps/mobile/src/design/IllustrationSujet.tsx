import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { couleurs as c } from './tokens';

/**
 * Illustrations de sujets Speedfood (parcours, états, métier) — dessins originaux du dépôt, même langage que
 * IllustrationPlat : trait encre épais aux extrémités rondes, aplats aux couleurs verrouillées des tokens, fond clair.
 * Aucune image externe, aucun emoji, aucune signification portée par la seule couleur : chaque usage garde un libellé.
 * Liste fermée ; la même liste existe côté web (apps/web/src/components/illustrations/sujets.tsx).
 */
export type SujetIllustration =
  | 'panier' | 'sac' | 'horloge' | 'moto' | 'retrait' | 'especes' | 'compte'
  | 'cloche' | 'coeur' | 'loupe' | 'position' | 'telephone' | 'etoile' | 'toque' | 'indisponible';

const T = { stroke: c.encre, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function IllustrationSujet({ sujet, taille = 120, nom }: { sujet: SujetIllustration; taille?: number; nom: string }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 96 96" accessibilityLabel={nom} role="img">
      <Circle cx="48" cy="48" r="45" fill={c.fond} />
      <G fill="none">
      {sujet === 'panier' && <>
        <Path d="M22 34h52l-6 34a6 6 0 0 1-6 5H34a6 6 0 0 1-6-5l-6-34Z" fill={c.surface} {...T} />
        <Path d="M22 34h52" {...T} /><Path d="M36 34c0-8 5-13 12-13s12 5 12 13" {...T} />
        <Circle cx="38" cy="82" r="3.5" fill={c.action} /><Circle cx="58" cy="82" r="3.5" fill={c.action} />
      </>}
      {sujet === 'sac' && <>
        <Path d="M28 32h40l4 44a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6l4-44Z" fill={c.surface} {...T} />
        <Path d="M36 32v-6a12 12 0 0 1 24 0v6" {...T} />
        <Path d="M38 52h20" stroke={c.action} strokeWidth="5" strokeLinecap="round" />
      </>}
      {sujet === 'horloge' && <>
        <Circle cx="48" cy="50" r="30" fill={c.surface} {...T} />
        <Path d="M48 34v16l11 7" {...T} />
        <Path d="M38 14h20" stroke={c.action} strokeWidth="5" strokeLinecap="round" />
      </>}
      {sujet === 'moto' && <>
        <Circle cx="28" cy="70" r="10" fill={c.surface} {...T} /><Circle cx="70" cy="70" r="10" fill={c.surface} {...T} />
        <Path d="M28 70l12-24h14l8 12h8M40 46l-6 24M54 46l6 24" {...T} />
        <Path d="M58 30h14l4 10H62z" fill={c.mangue} {...T} />
        <Path d="M14 82h18M60 82h22" stroke={c.action} strokeWidth="4" strokeLinecap="round" />
      </>}
      {sujet === 'retrait' && <>
        <Path d="M24 40l4-16h40l4 16" fill={c.orange} {...T} />
        <Path d="M28 40v34a6 6 0 0 0 6 6h28a6 6 0 0 0 6-6V40" fill={c.surface} {...T} />
        <Path d="M24 40a8 8 0 0 0 16 0 8 8 0 0 0 16 0 8 8 0 0 0 16 0" {...T} />
        <Rect x="42" y="56" width="12" height="14" rx="2" fill={c.mangue} {...T} />
      </>}
      {sujet === 'especes' && <>
        <Rect x="16" y="30" width="64" height="38" rx="6" fill={c.succesFond} {...T} />
        <Circle cx="48" cy="49" r="10" fill={c.surface} {...T} />
        <Circle cx="26" cy="40" r="3" fill={c.succes} /><Circle cx="70" cy="58" r="3" fill={c.succes} />
        <Path d="M30 78h36" stroke={c.secondaire} strokeWidth="4" strokeLinecap="round" />
      </>}
      {sujet === 'compte' && <>
        <Circle cx="48" cy="36" r="13" fill={c.surface} {...T} />
        <Path d="M24 80c3-14 12-21 24-21s21 7 24 21" fill={c.surface} {...T} />
        <Circle cx="72" cy="30" r="7" fill={c.mangue} {...T} />
      </>}
      {sujet === 'cloche' && <>
        <Path d="M48 18a18 18 0 0 1 18 18c0 12 4 16 7 19H23c3-3 7-7 7-19a18 18 0 0 1 18-18Z" fill={c.mangue} {...T} />
        <Path d="M40 62a8 8 0 0 0 16 0" {...T} />
        <Circle cx="70" cy="26" r="6" fill={c.action} />
      </>}
      {sujet === 'coeur' && <>
        <Path d="M48 80S20 62 20 40a14 14 0 0 1 28-5 14 14 0 0 1 28 5c0 22-28 40-28 40Z" fill={c.rouge} {...T} />
      </>}
      {sujet === 'loupe' && <>
        <Circle cx="42" cy="42" r="20" fill={c.surface} {...T} />
        <Path d="M57 57l17 17" stroke={c.action} strokeWidth="6" strokeLinecap="round" />
        <Path d="M32 42h20M42 32v20" stroke={c.bordure} strokeWidth="4" strokeLinecap="round" />
      </>}
      {sujet === 'position' && <>
        <Path d="M48 84S24 58 24 38a24 24 0 0 1 48 0c0 20-24 46-24 46Z" fill={c.rouge} {...T} />
        <Circle cx="48" cy="38" r="9" fill={c.surface} />
      </>}
      {sujet === 'telephone' && <>
        <Path d="M30 16h12l5 18-8 6a40 40 0 0 0 17 17l6-8 18 5v12a6 6 0 0 1-6 6C46 70 26 50 24 22a6 6 0 0 1 6-6Z" fill={c.surface} {...T} />
        <Path d="M56 24a16 16 0 0 1 16 16M56 34a7 7 0 0 1 6 6" stroke={c.action} strokeWidth="4" strokeLinecap="round" fill="none" />
      </>}
      {sujet === 'etoile' && <>
        <Path d="M48 16l9 19 21 2-15 14 4 21-19-11-19 11 4-21L18 37l21-2z" fill={c.mangue} {...T} />
      </>}
      {sujet === 'toque' && <>
        <Path d="M28 44a12 12 0 1 1 6-22 14 14 0 0 1 28 0 12 12 0 1 1 6 22v14H28z" fill={c.surface} {...T} />
        <Path d="M28 66h40M28 76h40" stroke={c.action} strokeWidth="4" strokeLinecap="round" />
      </>}
      {sujet === 'indisponible' && <>
        <Path d="M26 78V38l22-18 22 18v40" fill={c.surface} {...T} />
        <Path d="M18 78h60" {...T} />
        <Path d="M38 78V58h20v20" fill={c.avertissementFond} {...T} />
        <Path d="M34 34l28 28M62 34L34 62" stroke={c.action} strokeWidth="5" strokeLinecap="round" />
      </>}
      </G>
    </Svg>
  );
}
