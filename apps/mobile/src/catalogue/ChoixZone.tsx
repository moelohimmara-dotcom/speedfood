import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { TOUTES_ZONES, type ZoneLivraison } from './accueil';
/** « Où voulez-vous commander ? » (parité Kotlin) : « Toutes les zones » puis les zones où il y a des restaurants, avec leur nombre. Aucune position n'est demandée. */
export function ChoixZone({ visible, zones, nombres, total, courante, choisir, fermer }: { visible: boolean; zones: ZoneLivraison[]; nombres: Record<string, number>; total: number; courante: ZoneLivraison | null; choisir(id: string): void; fermer(): void }) {
  const Ligne = ({ id, nom, nombre, choisie }: { id: string; nom: string; nombre: number; choisie: boolean }) =>
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: choisie }} accessibilityLabel={`${nom}, ${nombre} restaurant${nombre > 1 ? 's' : ''}`} onPress={() => choisir(id)} style={s.ligne}>
      <View style={[s.radio, choisie && s.radioChoisi]}>{choisie && <View style={s.radioPoint} />}</View>
      <Text style={s.texte}>{nom} ({nombre})</Text>
    </Pressable>;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={fermer}><View style={s.fond}><SafeAreaView style={s.feuille}>
    <Text accessibilityRole="header" style={s.titre}>Où voulez-vous commander ?</Text>
    <ScrollView contentContainerStyle={{ gap: 4 }}>
      <Ligne id={TOUTES_ZONES} nom="Toutes les zones" nombre={total} choisie={courante === null} />
      {zones.map(z => <Ligne key={z.id} id={z.id} nom={z.nom} nombre={nombres[z.id] ?? 0} choisie={courante?.id === z.id} />)}
      <Text style={s.secondaire}>Aucune position n’est demandée : vous choisissez la zone vous-même.</Text>
    </ScrollView>
    <Bouton titre="Fermer" secondaire onPress={fermer} />
  </SafeAreaView></View></Modal>;
}
const s = StyleSheet.create({
  fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: { backgroundColor: c.fond, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 14, maxHeight: '85%' },
  titre: { fontFamily: polices.titre, fontSize: 24, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 16, color: c.encre, flex: 1 },
  secondaire: { fontFamily: polices.texte, fontSize: 13, color: c.secondaire, marginTop: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.encre, alignItems: 'center', justifyContent: 'center' },
  radioChoisi: { borderColor: c.action },
  radioPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.action },
});
