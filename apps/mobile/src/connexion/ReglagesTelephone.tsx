import { StyleSheet, Switch, Text, View } from 'react-native';
import { couleurs as c, polices } from '../design/tokens';
/**
 * Réglages du TÉLÉPHONE (parité Kotlin, G19 et G23) : des interrupteurs qui ne parlent jamais au serveur. Chaque ligne dit ce que le réglage change.
 * Le choix est appliqué tout de suite ; l'écran qui l'utilise le garde sur l'appareil.
 */
export interface LigneReglageTelephone { cle: string; libelle: string; aide: string; actif: boolean; changer: (actif: boolean) => void }
export function ReglagesTelephone({ titre, lignes }: { titre: string; lignes: readonly LigneReglageTelephone[] }) {
  return <View style={s.carte}>
    <Text accessibilityRole="header" style={s.titre}>{titre}</Text>
    {lignes.map(l => <View key={l.cle} style={s.ligne}>
      <View style={s.texte}>
        <Text style={s.libelle}>{l.libelle}</Text>
        <Text style={s.aide}>{l.aide}</Text>
      </View>
      <Switch accessibilityLabel={l.libelle} value={l.actif} onValueChange={l.changer} trackColor={{ true: c.action, false: c.bordure }} />
    </View>)}
  </View>;
}
const s = StyleSheet.create({
  carte: { gap: 12, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 14, backgroundColor: c.surface },
  titre: { fontFamily: polices.texte, fontSize: 18, lineHeight: 26, fontWeight: '800', color: c.encre },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texte: { flex: 1, gap: 2 },
  libelle: { fontFamily: polices.texte, fontSize: 16, lineHeight: 24, fontWeight: '700', color: c.encre },
  aide: { fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: c.secondaire },
});
