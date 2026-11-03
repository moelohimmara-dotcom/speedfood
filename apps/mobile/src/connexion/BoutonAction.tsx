import { Pressable, StyleSheet, Text } from 'react-native';
import { couleurs as c, polices } from '../design/tokens';

/** Bouton des écrans de l'espace restaurateur (commandes, service, menu) : libellé = nom accessible, grisé et non pressable quand `disabled`. */
export function Action({ titre, agir, disabled = false, secondaire = false }: { titre: string; agir(): void; disabled?: boolean; secondaire?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={titre} disabled={disabled} accessibilityState={{ disabled }} onPress={agir} style={[s.bouton, secondaire && s.boutonSecondaire, disabled && { opacity: .5 }]}><Text style={[s.boutonTexte, secondaire && s.boutonTexteSecondaire]}>{titre}</Text></Pressable>;
}

const s = StyleSheet.create({
  bouton: { backgroundColor: c.action, minHeight: 48, padding: 14, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  boutonSecondaire: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.action },
  boutonTexte: { color: c.surface, fontFamily: polices.texte, fontWeight: '700' },
  boutonTexteSecondaire: { color: c.action },
});
