import { StyleSheet, Text, View } from 'react-native';
import { Icone } from '../design/Icone';
import { couleurs as c, polices } from '../design/tokens';
import { ETAPES_SUIVI } from './suivi-affichage';
/** Frise « Envoyée, Acceptée, Prête, Terminée » (parité Kotlin) : étapes passées pleines et cochées, étape en cours cerclée. Le nom accessible dit « Étape 2 sur 4 : Acceptée ». */
export function FriseSuivi({ etape }: { etape: number }) {
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`Étape ${etape + 1} sur ${ETAPES_SUIVI.length} : ${ETAPES_SUIVI[etape].libelle}`} style={s.rangee}>
    {ETAPES_SUIVI.map((e, i) => {
      const faite = i < etape; const courante = i === etape;
      return <View key={e.statut} style={s.etape}>
        <View style={s.ligneZone}>
          <View style={[s.trait, i === 0 && { opacity: 0 }, i <= etape && { backgroundColor: c.action }]} />
          <View style={[s.rond, (faite || courante) && { backgroundColor: c.action, borderColor: c.action }, courante && s.rondCourant]}>{faite && <Icone nom="coche" taille={14} couleur={c.surface} />}</View>
          <View style={[s.trait, i === ETAPES_SUIVI.length - 1 && { opacity: 0 }, i < etape && { backgroundColor: c.action }]} />
        </View>
        <Text style={[s.libelle, courante && s.libelleCourant]}>{e.libelle}</Text>
      </View>;
    })}
  </View>;
}
const s = StyleSheet.create({
  rangee: { flexDirection: 'row' },
  etape: { flex: 1, alignItems: 'center', gap: 6 },
  ligneZone: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  trait: { flex: 1, height: 4, backgroundColor: c.bordure },
  rond: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.bordure, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  rondCourant: { borderWidth: 4, borderColor: c.mangue, backgroundColor: c.action },
  libelle: { fontFamily: polices.texte, fontSize: 12, color: c.secondaire, textAlign: 'center' },
  libelleCourant: { color: c.encre, fontWeight: '700' },
});
