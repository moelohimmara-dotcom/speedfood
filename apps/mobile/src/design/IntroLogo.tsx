import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { couleurs as c, dureeMouvement, polices } from './tokens';
import { useMouvementReduit } from './mouvement';
import { Texte } from './Composants';
import { LogoAnime } from './LogoSpeedfood';
import * as SplashScreen from 'expo-splash-screen';

/** Phrase d'accroche sous le nom, à l'ouverture. */
export const ACCROCHE_INTRO = 'Vos plats préférés, près de chez vous';
const TAILLE_LOGO = 170;

/**
 * Intro du logo à chaque ouverture (choix de Malika, novembre 2026 ; logo vectoriel en pièces le 28/11/2026) : deux halos aux couleurs Speedfood s'ouvrent,
 * le burger se monte pièce par pièce, l'aile se déploie et bat, la vapeur s'élève ; puis le nom et l'accroche montent, et le logo s'envole légèrement
 * en s'effaçant. Environ 2,7 s. Toute la ligne de temps (effacement compris) part d'un bloc sur le moteur natif : même si le fil JavaScript est occupé
 * (chargement du catalogue), l'intro s'efface à l'heure, et elle ne capte jamais les touchers. En mouvement réduit : aucune animation.
 */
export function IntroLogo({ onTerminee }: { onTerminee(): void }) {
  const reduit = useMouvementReduit();
  const halo = useRef(new Animated.Value(0)).current;
  const nom = useRef(new Animated.Value(0)).current;
  const accroche = useRef(new Animated.Value(0)).current;
  const sortie = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(true);
  const fin = useRef(onTerminee); fin.current = onTerminee;
  const fait = useRef(false);
  const terminer = () => { if (fait.current) return; fait.current = true; setVisible(false); fin.current(); };

  // L'intro est montée : l'écran de démarrage natif (crème) s'efface et l'animation commence devant la personne.
  useEffect(() => { void SplashScreen.hideAsync().catch(() => undefined); }, []);

  useEffect(() => {
    if (reduit) {
      for (const v of [halo, nom, accroche]) v.setValue(1);
      const m = setTimeout(terminer, dureeMouvement(reduit, 120));
      return () => clearTimeout(m);
    }
    const d = (ms: number) => dureeMouvement(reduit, ms);
    const apres = (ms: number, a: Animated.CompositeAnimation) => Animated.sequence([Animated.delay(ms), a]);
    const t = (v: Animated.Value, vers: number, ms: number, courbe: (x: number) => number) => Animated.timing(v, { toValue: vers, duration: d(ms), easing: courbe, useNativeDriver: true });
    // Ligne de temps : halos 0–0,6 s ; logo monté vers 1,3 s (LogoAnime) ; nom 1,3 s, accroche 1,44 s ; effacement de 2,24 à 2,66 s.
    const a = Animated.parallel([
      t(halo, 1, 600, Easing.out(Easing.cubic)),
      apres(1300, t(nom, 1, 380, Easing.out(Easing.cubic))),
      apres(1440, t(accroche, 1, 380, Easing.out(Easing.cubic))),
      apres(2240, t(sortie, 0, 420, Easing.in(Easing.quad))),
    ]);
    a.start(({ finished }) => { if (finished) terminer(); });
    // Garde-fou : quoi qu'il arrive à l'animation, l'écran principal n'est jamais masqué plus de 3,5 s.
    const garde = setTimeout(terminer, 3500);
    return () => { clearTimeout(garde); a.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduit]);

  if (!visible) return null;
  const monte = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] });
  const anneau = (debut: number, finale: number, opacite: number) => ({
    opacity: halo.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, opacite, opacite * 0.6] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [debut, finale] }) }],
  });
  // À la sortie, le logo s'envole un peu vers la droite et le haut, comme l'aile l'y invite.
  const envol = { transform: [
    { translateX: sortie.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
    { translateY: sortie.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
    { scale: sortie.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) },
  ] };
  return <Animated.View pointerEvents="none" style={[s.voile, { opacity: sortie }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={s.centre}>
      <View style={s.scene}>
        <Animated.View style={[s.anneau, { backgroundColor: c.mangue }, anneau(0.4, 1.15, 0.3)]} />
        <Animated.View style={[s.anneau, s.anneauInterieur, { backgroundColor: c.orange }, anneau(0.3, 0.95, 0.18)]} />
        <Animated.View style={envol}><LogoAnime taille={TAILLE_LOGO} reduit={reduit} /></Animated.View>
      </View>
      <Animated.View style={monte(nom)}><Texte style={s.marque}>Speedfood</Texte></Animated.View>
      <Animated.View style={monte(accroche)}><Texte style={s.accroche}>{ACCROCHE_INTRO}</Texte></Animated.View>
    </View>
  </Animated.View>;
}

const s = StyleSheet.create({
  voile: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.fond, zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  centre: { alignItems: 'center', gap: 6 },
  scene: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  anneau: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  anneauInterieur: { width: 170, height: 170, borderRadius: 85 },
  marque: { fontFamily: polices.titre, fontSize: 32, fontWeight: '800', color: c.encre },
  accroche: { fontFamily: polices.texte, fontSize: 15, color: c.secondaire },
});
