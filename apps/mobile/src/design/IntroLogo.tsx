import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { couleurs as c, dureeMouvement, polices } from './tokens';
import { useMouvementReduit } from './mouvement';
import { Texte } from './Composants';

/**
 * Intro du logo à l'ouverture (choix de Malika, novembre 2026) : le logo grandit en douceur avec un fondu
 * (environ 1,2 s au total), puis l'écran d'accueil se révèle. En mouvement réduit, aucune animation :
 * l'intro disparaît aussitôt. L'écran principal reste monté dessous : l'intro ne retarde aucune lecture.
 */
export function IntroLogo({ onTerminee }: { onTerminee(): void }) {
  const reduit = useMouvementReduit();
  const progression = useRef(new Animated.Value(0)).current;
  const sortie = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    if (reduit) {
      progression.setValue(1);
      minuteur = setTimeout(() => { setVisible(false); onTerminee(); }, dureeMouvement(reduit, 120));
      return () => { if (minuteur) clearTimeout(minuteur); };
    }
    const entree = Animated.timing(progression, { toValue: 1, duration: dureeMouvement(reduit, 650), useNativeDriver: true });
    const fondu = Animated.timing(sortie, { toValue: 0, duration: dureeMouvement(reduit, 350), useNativeDriver: true });
    entree.start(() => {
      minuteur = setTimeout(() => {
        fondu.start(() => { setVisible(false); onTerminee(); });
      }, 200);
    });
    return () => { if (minuteur) clearTimeout(minuteur); entree.stop(); fondu.stop(); };
  }, [reduit, progression, sortie, onTerminee]);

  if (!visible) return null;
  const echelle = progression.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  return <Animated.View style={[s.voile, { opacity: sortie }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={s.centre}>
      <Animated.Image source={require('../../assets/images/speedfood.png')} style={[s.logo, { opacity: progression, transform: [{ scale: echelle }] }]} accessibilityIgnoresInvertColors />
      <Animated.View style={{ opacity: progression }}>
        <Texte style={s.marque}>Speedfood</Texte>
      </Animated.View>
    </View>
  </Animated.View>;
}

const s = StyleSheet.create({
  voile: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.fond, zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  centre: { alignItems: 'center', gap: 14 },
  logo: { width: 104, height: 104, borderRadius: 26 },
  marque: { fontFamily: polices.titre, fontSize: 30, fontWeight: '800', color: c.encre },
});
