import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { couleurs as c, dureeMouvement } from './tokens';

/**
 * Logo Speedfood redessiné en vectoriel (27/11/2026, demande de Malika : « sortir le logo du cadre qui le fige »). Chaque pièce est un calque à part
 * (plumes de l'aile, pain du dessous, steak, pain du dessus, reflet, trois filets de vapeur) : elle peut bouger seule. Même grille 512 × 512 pour toutes.
 */
export const ROUGE_LOGO = '#8E1C1C';
export const VAPEUR_LOGO = '#D49A46';
const REFLET_LOGO = '#F4ECDF';

export const PLUMES = [
  'M268 300 C232 256 168 214 130 156 C116 226 166 288 238 326 Z',
  'M256 338 C196 292 116 248 56 188 C52 268 128 330 228 364 Z',
  'M242 372 C178 356 112 332 62 282 C74 346 146 386 228 400 Z',
  'M230 404 C188 402 140 388 100 358 C114 398 168 418 222 422 Z',
] as const;
export const PAIN_HAUT = 'M246 360 C246 302 292 268 346 268 C402 268 446 302 446 348 Q446 362 432 362 H260 Q246 362 246 360 Z';
export const PAIN_BAS = 'M168 402 H432 Q446 402 446 416 V428 Q446 456 418 456 H200 Q170 456 168 426 Z';
export const REFLET = 'M372 292 Q394 300 406 320';
export const VAPEURS = [
  'M292 228 C276 205 300 190 286 165 C276 148 292 135 290 125',
  'M322 232 C306 205 332 188 318 160 C308 140 326 128 324 118',
  'M356 226 C340 200 366 182 352 152 C344 134 360 118 366 110',
] as const;
/** Point d'attache de l'aile sur le burger : les plumes pivotent autour de lui. */
const ATTACHE = { x: 250, y: 360 };

type Calque = { taille: number; style?: object; children: React.ReactNode };
function Calque({ taille, style, children }: Calque) {
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: taille, height: taille }, style]}>
    <Svg width={taille} height={taille} viewBox="0 0 512 512">{children}</Svg>
  </Animated.View>;
}

/** Rotation d'un calque autour d'un point de la grille 512 (React Native tourne autour du centre : on décale, tourne, puis replace). */
function pivot(taille: number, px: number, py: number, angle: Animated.AnimatedInterpolation<string>) {
  const dx = ((px - 256) * taille) / 512; const dy = ((py - 256) * taille) / 512;
  return [{ translateX: dx }, { translateY: dy }, { rotate: angle }, { translateX: -dx }, { translateY: -dy }];
}

function creerValeurs(depart: number) {
  const n = () => new Animated.Value(depart);
  return { painBas: n(), steak: n(), painHaut: n(), reflet: n(), plumes: [n(), n(), n(), n()], vapeurs: [n(), n(), n()], battement: new Animated.Value(0), ondule: new Animated.Value(0) };
}

/**
 * Logo animé : le pain du dessous monte, le steak se pose, le pain du dessus tombe avec un rebond et son reflet s'allume ; les plumes se déploient
 * une à une puis l'aile bat une fois ; la vapeur s'élève puis ondule doucement tant que le logo est à l'écran. `reduit` : tout est immobile, à sa place.
 * `fond` : couleur des fines séparations entre les plumes (celle de l'écran).
 */
export function LogoAnime({ taille, reduit, fond = c.fond, surFin }: { taille: number; reduit: boolean; fond?: string; surFin?: () => void }) {
  // Toutes les valeurs animées, créées une seule fois (à 1 en mouvement réduit : chaque pièce est déjà à sa place).
  const valeurs = useRef<ReturnType<typeof creerValeurs> | null>(null);
  if (!valeurs.current) valeurs.current = creerValeurs(reduit ? 1 : 0);
  const { painBas, steak, painHaut, reflet, plumes, vapeurs, ondule } = valeurs.current;
  const battement = valeurs.current.battement;
  const fin = useRef(surFin); fin.current = surFin;

  useEffect(() => {
    if (reduit) { fin.current?.(); return; }
    const d = (ms: number) => dureeMouvement(reduit, ms);
    // Durées FIXES (un ressort peut mettre plusieurs secondes à se stabiliser et retarder tout le reste) ; le rebond est dessiné par la courbe `back`.
    // Les étapes se chevauchent : burger de 0 à 0,56 s, plumes de 0,3 à 0,9 s, vapeur de 0,5 à 1,16 s, battement de 0,9 à 1,3 s.
    const vers = (x: Animated.Value, apres: number, duree: number, courbe: (t: number) => number) =>
      Animated.sequence([Animated.delay(apres), Animated.timing(x, { toValue: 1, duration: d(duree), easing: courbe, useNativeDriver: true })]);
    const rebond = Easing.out(Easing.back(2.2));
    const montage = Animated.parallel([
      vers(painBas, 0, 320, Easing.out(Easing.cubic)),
      vers(steak, 90, 320, Easing.out(Easing.cubic)),
      vers(painHaut, 180, 380, rebond),
      vers(reflet, 560, 260, Easing.out(Easing.quad)),
      ...plumes.map((p, i) => vers(p, 300 + i * 70, 380, Easing.out(Easing.back(1.6)))),
      ...vapeurs.map((p, i) => vers(p, 500 + i * 120, 420, Easing.out(Easing.cubic))),
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(battement, { toValue: 1, duration: d(170), easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(battement, { toValue: 0, duration: d(240), easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ]);
    const onde = Animated.loop(Animated.sequence([
      Animated.timing(ondule, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(ondule, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    montage.start(({ finished }) => { if (finished) { onde.start(); fin.current?.(); } });
    return () => { montage.stop(); onde.stop(); };
    // Les valeurs animées sont créées une fois par montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduit]);

  const t = taille;
  const glisse = (x: Animated.Value, depuis: number) => ({ opacity: x.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: x.interpolate({ inputRange: [0, 1], outputRange: [(depuis * t) / 512, 0] }) }] });
  const angleBattement = battement.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-9deg'] });
  return <View style={{ width: t, height: t }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {/* Vapeur : monte depuis le burger puis ondule. */}
    {VAPEURS.map((d, i) => <Calque key={d} taille={t} style={{
      opacity: Animated.multiply(vapeurs[i], ondule.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] })),
      transform: [{ translateY: Animated.add(vapeurs[i].interpolate({ inputRange: [0, 1], outputRange: [(40 * t) / 512, 0] }), ondule.interpolate({ inputRange: [0, 1], outputRange: [0, (-6 * t) / 512] })) }, { translateX: ondule.interpolate({ inputRange: [0, 1], outputRange: [0, ((i % 2 ? 3 : -3) * t) / 512] }) }],
    }}><Path d={d} stroke={VAPEUR_LOGO} strokeWidth={11} strokeLinecap="round" fill="none" /></Calque>)}
    {/* Aile : chaque plume se déploie depuis l'attache, puis l'aile entière bat une fois. */}
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: t, height: t, transform: pivot(t, ATTACHE.x, ATTACHE.y, angleBattement) }}>
      {PLUMES.map((d, i) => <Calque key={d} taille={t} style={{
        opacity: plumes[i].interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
        transform: pivot(t, ATTACHE.x, ATTACHE.y, plumes[i].interpolate({ inputRange: [0, 1], outputRange: [`${38 - i * 4}deg`, '0deg'] })),
      }}><Path d={d} fill={ROUGE_LOGO} stroke={fond} strokeWidth={8} strokeLinejoin="round" /></Calque>)}
    </Animated.View>
    <Calque taille={t} style={glisse(painBas, 70)}><Path d={PAIN_BAS} fill={ROUGE_LOGO} /></Calque>
    <Calque taille={t} style={glisse(steak, -50)}><Rect x={248} y={372} width={198} height={20} rx={10} fill={ROUGE_LOGO} /></Calque>
    <Calque taille={t} style={glisse(painHaut, -140)}><Path d={PAIN_HAUT} fill={ROUGE_LOGO} /></Calque>
    <Calque taille={t} style={{ opacity: reflet, transform: [{ translateY: painHaut.interpolate({ inputRange: [0, 1], outputRange: [(-140 * t) / 512, 0] }) }] }}><Path d={REFLET} stroke={REFLET_LOGO} strokeWidth={10} strokeLinecap="round" fill="none" /></Calque>
  </View>;
}
