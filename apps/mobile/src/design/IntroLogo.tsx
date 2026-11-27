import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { couleurs as c, dureeMouvement, polices } from './tokens';
import { useMouvementReduit } from './mouvement';
import { Texte } from './Composants';

/** Phrase d'accroche sous le nom, à l'ouverture. */
export const ACCROCHE_INTRO = 'Vos plats préférés, près de chez vous';

/**
 * Intro du logo à chaque ouverture (choix de Malika, novembre 2026, enrichie le 27/11/2026) : deux halos aux couleurs Speedfood s'ouvrent, le logo arrive
 * avec un léger rebond et une petite rotation, puis le nom et l'accroche montent ; l'ensemble s'efface (environ 1,8 s). En mouvement réduit, aucune
 * animation : l'intro disparaît aussitôt. L'écran principal reste monté dessous : l'intro ne retarde aucune lecture.
 */
export function IntroLogo({ onTerminee }: { onTerminee(): void }) {
  const reduit = useMouvementReduit();
  const halo = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const nom = useRef(new Animated.Value(0)).current;
  const accroche = useRef(new Animated.Value(0)).current;
  const sortie = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(true);
  const fin = useRef(onTerminee); fin.current = onTerminee;

  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    let fait = false;
    const terminer = () => { if (fait) return; fait = true; setVisible(false); fin.current(); };
    if (reduit) {
      for (const v of [halo, logo, nom, accroche]) v.setValue(1);
      minuteur = setTimeout(terminer, dureeMouvement(reduit, 120));
      return () => { if (minuteur) clearTimeout(minuteur); };
    }
    const d = (ms: number) => dureeMouvement(reduit, ms);
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(halo, { toValue: 1, duration: d(600), easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logo, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]),
      Animated.stagger(140, [
        Animated.timing(nom, { toValue: 1, duration: d(380), easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(accroche, { toValue: 1, duration: d(380), easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(380),
      Animated.timing(sortie, { toValue: 0, duration: d(360), easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    sequence.start(({ finished }) => { if (finished) terminer(); });
    // Garde-fou : quoi qu'il arrive à l'animation, l'écran principal n'est jamais masqué plus de 3 s.
    minuteur = setTimeout(terminer, 3000);
    return () => { if (minuteur) clearTimeout(minuteur); sequence.stop(); };
  }, [reduit, halo, logo, nom, accroche, sortie]);

  if (!visible) return null;
  const monte = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] });
  const anneau = (debut: number, finale: number, opacite: number) => ({
    opacity: halo.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, opacite, opacite * 0.6] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [debut, finale] }) }],
  });
  return <Animated.View style={[s.voile, { opacity: sortie }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={s.centre}>
      <View style={s.scene}>
        <Animated.View style={[s.anneau, { backgroundColor: c.mangue }, anneau(0.4, 1.15, 0.35)]} />
        <Animated.View style={[s.anneau, s.anneauInterieur, { backgroundColor: c.orange }, anneau(0.3, 0.95, 0.25)]} />
        <Animated.Image source={require('../../assets/images/speedfood.png')} accessibilityIgnoresInvertColors style={[s.logo, {
          opacity: logo.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [
            { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
            { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
          ],
        }]} />
      </View>
      <Animated.View style={monte(nom)}><Texte style={s.marque}>Speedfood</Texte></Animated.View>
      <Animated.View style={monte(accroche)}><Texte style={s.accroche}>{ACCROCHE_INTRO}</Texte></Animated.View>
    </View>
  </Animated.View>;
}

const s = StyleSheet.create({
  voile: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.fond, zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  centre: { alignItems: 'center', gap: 10 },
  scene: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  anneau: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  anneauInterieur: { width: 160, height: 160, borderRadius: 80 },
  logo: { width: 112, height: 112, borderRadius: 28 },
  marque: { fontFamily: polices.titre, fontSize: 32, fontWeight: '800', color: c.encre },
  accroche: { fontFamily: polices.texte, fontSize: 15, color: c.secondaire },
});
