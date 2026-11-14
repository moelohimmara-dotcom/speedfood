import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, type TextProps, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { couleurs as c, dureeMouvement, polices } from './tokens';
import { useMouvementReduit } from './mouvement';
import { Icone, type NomIcone } from './Icone';
import { useApplication } from '../etat/Application';
export function Texte({ style, ...props }: TextProps) { return <Text {...props} style={[s.texte, style]} />; }
export function Titre({ children, petit = false }: PropsWithChildren<{ petit?: boolean }>) { return <Texte accessibilityRole="header" style={[s.titre, petit && { fontSize: 25 }]}>{children}</Texte>; }
export function Bouton({ titre, onPress, secondaire = false, disabled = false, icone, iconeSeule = false, libelleCourt, testID }: { titre: string; onPress(): void; secondaire?: boolean; disabled?: boolean; icone?: NomIcone; iconeSeule?: boolean; libelleCourt?: string; testID?: string }) {
  const couleurIcone = secondaire || disabled ? c.encre : c.surface;
  if (libelleCourt && icone) {
    // Tuile d'accueil : icône au-dessus, mot court dessous ; le nom accessible reste le titre complet.
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={titre} testID={testID} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.boutonTuile, secondaire && s.boutonSecondaire, disabled && { backgroundColor: c.bordure }, pressed && { opacity: .8 }]}>
      <Icone nom={icone} couleur={c.encre} taille={24} />
      <Texte style={{ color: c.encre, fontWeight: '700', fontSize: 12.5, textAlign: 'center' }}>{libelleCourt}</Texte>
    </Pressable>;
  }
  if (iconeSeule && icone) {
    // Icône seule à l'écran ; le nom accessible reste le titre complet (jamais un bouton muet).
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={titre} testID={testID} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.boutonIcone, secondaire && s.boutonSecondaire, disabled && { backgroundColor: c.bordure }, pressed && { opacity: .8 }]}>
      <Icone nom={icone} couleur={couleurIcone} taille={22} />
    </Pressable>;
  }
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={titre} testID={testID} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.bouton, secondaire && s.boutonSecondaire, disabled && { backgroundColor: c.bordure }, pressed && { opacity: .8 }]}>
    {icone && <Icone nom={icone} couleur={couleurIcone} taille={20} />}
    <Texte style={{ color: disabled || secondaire ? c.encre : c.surface, fontWeight: '700', textAlign: 'center' }}>{titre}</Texte>
  </Pressable>;
}
export function Ecran({ children, retour = false, style }: PropsWithChildren<{ retour?: boolean; style?: ViewStyle }>) {
  const { statutSauvegarde, reessayerSauvegarde } = useApplication();
  return <View style={s.ecran}>
    <View style={s.entete}>
      {retour && <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/')} accessibilityRole="button" accessibilityLabel="Retour" style={s.touche}><Icone nom="retour" /></Pressable>}
      <Image source={require('../../assets/images/speedfood.png')} style={{ width: 34, height: 34, borderRadius: 10 }} accessibilityIgnoresInvertColors />
      <Texte style={{ fontFamily: polices.titre, fontSize: 25, fontWeight: '800' }}>Speedfood</Texte>
      <View style={{ flex: 1 }} /><View style={s.badge}><Texte style={{ fontSize: 11, fontWeight: '700' }}>DÉMO</Texte></View>
    </View>
    <View style={{ paddingHorizontal: 22, paddingVertical: 5, backgroundColor: statutSauvegarde === 'erreur' ? c.avertissementFond : c.fond }}>
      <Texte accessibilityLiveRegion="polite" style={{ color: statutSauvegarde === 'erreur' ? c.avertissement : c.secondaire, fontSize: 11, lineHeight: 17 }}>
        {{ pret: 'Données locales prêtes', enregistrement: 'Enregistrement sur cet appareil…', enregistre: 'Enregistré sur cet appareil', erreur: 'Non enregistré : vos changements restent en mémoire.' }[statutSauvegarde]}
      </Texte>
      {statutSauvegarde === 'erreur' && <Pressable onPress={reessayerSauvegarde} accessibilityRole="button" accessibilityLabel="Réessayer la sauvegarde" style={{ minHeight: 44, justifyContent: 'center' }}><Texte style={{ color: c.action, fontWeight: '700' }}>Réessayer la sauvegarde</Texte></Pressable>}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.contenu, style]}>
      {children}
      <Texte style={s.noteFin}>Version de démonstration · données fictives.{ '\n' }Aucune commande réelle ni paiement.</Texte>
    </ScrollView>
  </View>;
}
/**
 * Squelette de chargement : des barres qui respirent en opacité pendant une lecture (charte animations).
 * En mouvement réduit, le squelette est statique ; il ne remplace jamais un message d'état annoncé.
 */
export function Squelette({ lignes = 3 }: { lignes?: number }) {
  const reduit = useMouvementReduit();
  const opacite = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduit) { opacite.setValue(0.8); return; }
    const boucle = Animated.loop(Animated.sequence([
      Animated.timing(opacite, { toValue: 0.45, duration: dureeMouvement(reduit, 700), useNativeDriver: true }),
      Animated.timing(opacite, { toValue: 1, duration: dureeMouvement(reduit, 700), useNativeDriver: true }),
    ]));
    boucle.start();
    return () => boucle.stop();
  }, [reduit, opacite]);
  return <Animated.View accessibilityLabel="Chargement en cours" style={{ gap: 10, opacity: opacite }}>
    {Array.from({ length: lignes }, (_, i) => <View key={i} style={{ height: 16, borderRadius: 8, backgroundColor: c.bordure, width: i === lignes - 1 ? '55%' : '100%' }} />)}
  </Animated.View>;
}
export function EtatVide({ titre, message, action = 'Découvrir les restaurants', onPress = () => router.push('/') }: { titre: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={{ gap: 18, paddingVertical: 36 }}><View style={s.pastille}><Icone nom="panier" taille={30} /></View><Titre>{titre}</Titre><Texte style={{ color: c.secondaire, lineHeight: 24 }}>{message}</Texte><Bouton titre={action} onPress={onPress} /></View>;
}
export const s = StyleSheet.create({
  texte: { fontFamily: polices.texte, color: c.encre, fontSize: 15, lineHeight: 23 },
  titre: { fontFamily: polices.titre, fontWeight: '700', fontSize: 32, lineHeight: 37, color: c.encre },
  ecran: { flex: 1, backgroundColor: c.fond },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, minHeight: 68, borderBottomColor: c.bordure, borderBottomWidth: 1 },
  contenu: { padding: 22, gap: 22, width: '100%', maxWidth: 660, alignSelf: 'center', paddingBottom: 30 },
  touche: { minWidth: 46, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  bouton: { minHeight: 54, backgroundColor: c.action, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  boutonSecondaire: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.encre },
  boutonIcone: { width: 54, height: 54, backgroundColor: c.action, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  boutonTuile: { flex: 1, minHeight: 76, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { backgroundColor: c.mangue, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  note: { backgroundColor: c.avertissementFond, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: c.bordure },
  noteFin: { textAlign: 'center', fontSize: 12, lineHeight: 18, color: c.secondaire, paddingTop: 10 },
  pastille: { backgroundColor: c.mangue, borderRadius: 24, padding: 20, alignSelf: 'flex-start' },
});
