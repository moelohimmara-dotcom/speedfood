import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { couleurs as c, polices } from '../design/tokens';
import { useMouvementReduit } from '../design/mouvement';
import type { SceneAccueil } from './parcours-accueil';

/**
 * Illustrations animées du parcours d'accueil : dessins vectoriels aux couleurs de Speedfood, animés par couches (Animated, pilote natif).
 * Décoratives : cachées aux lecteurs d'écran (le titre et le texte de l'écran disent tout). En mouvement réduit : dessin immobile, état final.
 */
const L = 280;
const H = 220;

/** Valeur animée en boucle (0 → 1), ou figée à 1 en mouvement réduit. `retard` décale le départ, `pause` attend entre deux tours. */
function useBoucle(duree: number, retard = 0, pause = 0, aller_retour = false) {
  const reduit = useMouvementReduit();
  const v = useRef(new Animated.Value(reduit ? 1 : 0)).current;
  useEffect(() => {
    if (reduit) { v.setValue(1); return; }
    v.setValue(0);
    const pas = [Animated.timing(v, { toValue: 1, duration: duree, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })];
    if (aller_retour) pas.push(Animated.timing(v, { toValue: 0, duration: duree, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    if (pause > 0) pas.push(Animated.delay(pause));
    const boucle = Animated.sequence([Animated.delay(retard), Animated.loop(Animated.sequence(pas))]);
    boucle.start();
    return () => boucle.stop();
  }, [reduit, v, duree, retard, pause, aller_retour]);
  return v;
}

/** Valeur animée une fois (0 → 1) avec un léger rebond, ou à 1 en mouvement réduit. */
function useEntree(retard: number, duree = 520) {
  const reduit = useMouvementReduit();
  const v = useRef(new Animated.Value(reduit ? 1 : 0)).current;
  useEffect(() => {
    if (reduit) { v.setValue(1); return; }
    v.setValue(0);
    const a = Animated.sequence([Animated.delay(retard), Animated.spring(v, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true })]);
    a.start();
    return () => a.stop();
  }, [reduit, v, retard, duree]);
  return v;
}

function Couche({ x, y, l, h, style, children }: { x: number; y: number; l: number; h: number; style?: object; children: React.ReactNode }) {
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x, top: y, width: l, height: h }, style]}>{children}</Animated.View>;
}

/** Repère de carte (goutte) de la couleur donnée. */
function Repere({ couleur, taille = 34 }: { couleur: string; taille?: number }) {
  return <Svg width={taille} height={taille * 1.25} viewBox="0 0 24 30"><Path d="M12 29c-1-2-10-11-10-17a10 10 0 0 1 20 0c0 6-9 15-10 17z" fill={couleur} /><Circle cx={12} cy={12} r={4} fill={c.surface} /></Svg>;
}

/** Scooter de livraison stylisé, coffre couleur mangue. */
function Scooter({ taille = 92 }: { taille?: number }) {
  return <Svg width={taille} height={taille * 0.72} viewBox="0 0 100 72">
    <Rect x={8} y={14} width={30} height={26} rx={6} fill={c.mangue} />
    <Path d="M14 22h18M14 30h12" stroke={c.encre} strokeWidth={3} strokeLinecap="round" />
    <Path d="M20 44h42l10-20h12" stroke={c.action} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M38 44c4-10 18-10 22 0" fill={c.action} />
    <Circle cx={22} cy={56} r={11} fill={c.encre} /><Circle cx={22} cy={56} r={4} fill={c.surface} />
    <Circle cx={80} cy={56} r={11} fill={c.encre} /><Circle cx={80} cy={56} r={4} fill={c.surface} />
    <Circle cx={56} cy={16} r={8} fill={c.orange} />
  </Svg>;
}

/** 1. Carte du quartier : les restaurants apparaissent l'un après l'autre, votre position pulse. */
function SceneRestaurants() {
  const r1 = useEntree(150); const r2 = useEntree(450); const r3 = useEntree(750);
  const pulse = useBoucle(1400, 300, 200);
  const chute = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-36, 0] }) }] });
  return <>
    <Svg width={L} height={H} viewBox={`0 0 ${L} ${H}`}>
      <Rect x={10} y={16} width={L - 20} height={H - 32} rx={28} fill={c.surface} stroke={c.bordure} strokeWidth={2} />
      <Path d="M10 120 C80 100 140 150 270 110" stroke={c.mangue} strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.55} />
      <Path d="M120 16 C110 80 160 140 140 204" stroke={c.bordure} strokeWidth={10} fill="none" strokeLinecap="round" />
      <Path d="M30 60h70M180 170h70" stroke={c.bordure} strokeWidth={8} strokeLinecap="round" />
    </Svg>
    <Couche x={128} y={118} l={34} h={34} style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) }] }}>
      <View style={[st.disque, { backgroundColor: c.orange }]} />
    </Couche>
    <Couche x={137} y={127} l={16} h={16}><View style={[st.disque, { backgroundColor: c.orange, borderWidth: 3, borderColor: c.surface }]} /></Couche>
    <Couche x={52} y={56} l={34} h={44} style={chute(r1)}><Repere couleur={c.action} /></Couche>
    <Couche x={196} y={48} l={34} h={44} style={chute(r2)}><Repere couleur={c.rouge} /></Couche>
    <Couche x={70} y={140} l={34} h={44} style={chute(r3)}><Repere couleur={c.action} /></Couche>
  </>;
}

/** 2. Téléphone : un plat glisse dans la commande, la confirmation arrive, puis les moyens de paiement. */
function SceneCommande() {
  const plat = useEntree(150); const coche = useEntree(650); const om = useEntree(950); const momo = useEntree(1150);
  const monte = (v: Animated.Value, d = 24) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [d, 0] }) }] });
  return <>
    <Svg width={L} height={H} viewBox={`0 0 ${L} ${H}`}>
      <Rect x={90} y={10} width={100} height={200} rx={20} fill={c.encre} />
      <Rect x={97} y={24} width={86} height={172} rx={12} fill={c.fond} />
    </Svg>
    <Couche x={104} y={44} l={72} h={60} style={monte(plat)}>
      <Svg width={72} height={60} viewBox="0 0 72 60">
        <Rect x={0} y={0} width={72} height={60} rx={12} fill={c.surface} />
        <Circle cx={22} cy={30} r={15} fill={c.mangue} /><Circle cx={22} cy={30} r={8} fill={c.orange} />
        <Path d="M44 22h20M44 32h14M44 42h18" stroke={c.bordure} strokeWidth={4} strokeLinecap="round" />
      </Svg>
    </Couche>
    <Couche x={124} y={116} l={32} h={32} style={{ opacity: coche, transform: [{ scale: coche }] }}>
      <Svg width={32} height={32} viewBox="0 0 32 32"><Circle cx={16} cy={16} r={16} fill={c.succes} /><Path d="M9 16l5 5 9-10" stroke={c.surface} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
    </Couche>
    <Couche x={16} y={150} l={78} h={34} style={monte(om, 14)}><View style={[st.puce, { backgroundColor: c.orange }]}><Text style={st.puceTexte}>Orange Money</Text></View></Couche>
    <Couche x={188} y={150} l={78} h={34} style={monte(momo, 14)}><View style={[st.puce, { backgroundColor: c.mangue }]}><Text style={[st.puceTexte, { color: c.encre }]}>MTN MoMo</Text></View></Couche>
  </>;
}

/** 3. Le scooter traverse la ville jusqu'au repère (une croix de pharmacie) devant la maison. */
function SceneLivraison() {
  const trajet = useBoucle(2600, 200, 700);
  const repere = useBoucle(900, 0, 0, true);
  return <>
    <Svg width={L} height={H} viewBox={`0 0 ${L} ${H}`}>
      <Path d="M0 170h280" stroke={c.encre} strokeWidth={4} strokeLinecap="round" />
      <Path d="M20 186h30M80 186h30M140 186h30M200 186h30" stroke={c.mangue} strokeWidth={4} strokeLinecap="round" />
      <G>
        <Rect x={206} y={88} width={56} height={80} rx={6} fill={c.surface} stroke={c.bordure} strokeWidth={2} />
        <Path d="M200 92l34-30 34 30z" fill={c.action} />
        <Rect x={226} y={132} width={16} height={36} rx={3} fill={c.mangue} />
      </G>
      <G>
        <Rect x={160} y={70} width={30} height={30} rx={6} fill={c.succes} />
        <Path d="M175 76v18M166 85h18" stroke={c.surface} strokeWidth={5} strokeLinecap="round" />
        <Path d="M175 100v68" stroke={c.bordure} strokeWidth={3} />
      </G>
    </Svg>
    <Couche x={160} y={30} l={30} h={38} style={{ transform: [{ translateY: repere.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}><Repere couleur={c.orange} taille={30} /></Couche>
    <Couche x={0} y={106} l={92} h={66} style={{ transform: [{ translateX: trajet.interpolate({ inputRange: [0, 1], outputRange: [-20, 98] }) }] }}><Scooter /></Couche>
  </>;
}

/** 4. Restaurateurs et livreurs : la toque, l'auvent du restaurant et le scooter se rejoignent. */
function ScenePros() {
  const toque = useEntree(120); const auvent = useEntree(380); const scooter = useEntree(640);
  const flotte = useBoucle(1600, 900, 0, true);
  return <>
    <Couche x={22} y={70} l={110} h={120} style={{ opacity: auvent, transform: [{ scale: auvent.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
      <Svg width={110} height={120} viewBox="0 0 110 120">
        <Rect x={8} y={44} width={94} height={72} rx={8} fill={c.surface} stroke={c.bordure} strokeWidth={2} />
        <Path d="M2 46l12-30h82l12 30z" fill={c.action} />
        <Path d="M2 46c9 10 18 10 27 0 9 10 18 10 27 0 9 10 18 10 27 0 9 10 18 10 25 0" fill={c.rouge} />
        <Rect x={40} y={74} width={30} height={42} rx={4} fill={c.mangue} />
      </Svg>
    </Couche>
    <Couche x={104} y={4} l={72} h={70} style={{ opacity: toque, transform: [{ translateY: Animated.add(toque.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }), flotte.interpolate({ inputRange: [0, 1], outputRange: [0, -6] })) }] }}>
      <Svg width={72} height={70} viewBox="0 0 72 70">
        <Path d="M14 40a16 16 0 0 1 8-30 18 18 0 0 1 28 0 16 16 0 0 1 8 30z" fill={c.surface} stroke={c.encre} strokeWidth={3} />
        <Rect x={16} y={40} width={40} height={20} rx={4} fill={c.surface} stroke={c.encre} strokeWidth={3} />
      </Svg>
    </Couche>
    <Couche x={160} y={110} l={110} h={80} style={{ opacity: scooter, transform: [{ translateX: scooter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }}><Scooter taille={108} /></Couche>
  </>;
}

export function IllustrationAccueil({ scene }: { scene: SceneAccueil }) {
  return <View style={st.cadre} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {scene === 'restaurants' && <SceneRestaurants />}
    {scene === 'commande' && <SceneCommande />}
    {scene === 'livraison' && <SceneLivraison />}
    {scene === 'pros' && <ScenePros />}
  </View>;
}

const st = StyleSheet.create({
  cadre: { width: L, height: H, alignSelf: 'center' },
  disque: { flex: 1, borderRadius: 999 },
  puce: { flex: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  puceTexte: { fontFamily: polices.texte, fontSize: 11, fontWeight: '700', color: c.surface },
});
