import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import { Icone } from '../design/Icone';
import { couleurs as c } from '../design/tokens';

/**
 * Champ de mot de passe avec bouton « Afficher / Masquer » (revue du 18/11/2026 : sur un clavier de téléphone, saisir 8 caractères à l'aveugle fait des erreurs).
 * Le bouton fait 48 dp, son nom accessible dit l'action et l'état (« Afficher le mot de passe » / « Masquer le mot de passe ») ; le champ garde l'étiquette visible comme nom accessible.
 * Le mot de passe est de nouveau masqué dès que le champ change de rôle (nouveau rendu de l'écran) : aucun état conservé hors de l'écran.
 */
export function ChampMotDePasse({ etiquette, valeur, changer, editable, autoComplete, style }: { etiquette: string; valeur: string; changer(v: string): void; editable: boolean; autoComplete: 'current-password' | 'new-password'; style: StyleProp<TextStyle> }) {
  const [visible, setVisible] = useState(false);
  return <View style={s.conteneur}>
    <TextInput accessibilityLabel={etiquette} value={valeur} onChangeText={changer} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={autoComplete} editable={editable} style={[style, s.margeOeil]} />
    <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} accessibilityState={{ selected: visible }} hitSlop={4} onPress={() => setVisible(v => !v)} style={s.oeil}>
      <Icone nom={visible ? 'masque' : 'visible'} taille={22} couleur={c.encre} />
    </Pressable>
  </View>;
}
const s = StyleSheet.create({
  conteneur: { justifyContent: 'center' },
  margeOeil: { paddingRight: 56 },
  oeil: { position: 'absolute', right: 4, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
