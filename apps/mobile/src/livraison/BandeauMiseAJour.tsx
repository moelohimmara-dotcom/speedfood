import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { couleurs as c, polices } from '../design/tokens';
import { adresseInstallation, lireVersionPubliee, versionAProposer, type VersionPubliee } from './mise-a-jour';

/** Annonce une version plus récente (Android seulement : l'iPhone se met à jour par l'App Store ou TestFlight, jamais par un fichier). Silencieux hors ligne. */
export function BandeauMiseAJour() {
  const [version, setVersion] = useState<VersionPubliee | null>(null);
  const [reportee, setReportee] = useState<number | null>(null);
  const [erreur, setErreur] = useState(false);
  const codeInstalle = Number(Constants.expoConfig?.android?.versionCode ?? 0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let actif = true;
    void lireVersionPubliee().then(v => { if (actif) setVersion(v); });
    return () => { actif = false; };
  }, []);
  const proposee = Platform.OS === 'android' ? versionAProposer(codeInstalle, version, reportee) : null;
  if (!proposee) return null;
  return <View accessibilityRole="alert" style={s.bandeau}>
    <Text style={s.titre}>Nouvelle version {proposee.nom}</Text>
    {proposee.notes ? <Text style={s.texte}>{proposee.notes}</Text> : null}
    {erreur ? <Text style={s.texte}>Impossible d’ouvrir la page de téléchargement.</Text> : null}
    <View style={s.rangee}>
      <Pressable accessibilityRole="button" accessibilityLabel="Télécharger la mise à jour" onPress={() => { setErreur(false); void Linking.openURL(adresseInstallation()).catch(() => setErreur(true)); }} style={s.action}><Text style={s.actionTexte}>Télécharger</Text></Pressable>
      {!proposee.obligatoire && <Pressable accessibilityRole="button" accessibilityLabel="Plus tard" onPress={() => setReportee(proposee.code)} style={s.plusTard}><Text style={s.plusTardTexte}>Plus tard</Text></Pressable>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  bandeau: { backgroundColor: c.avertissementFond, borderBottomColor: c.bordure, borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  titre: { color: c.avertissement, fontFamily: polices.titre, fontSize: 16, fontWeight: '700' },
  texte: { color: c.encre, fontFamily: polices.texte, fontSize: 14, lineHeight: 20 },
  rangee: { flexDirection: 'row', gap: 12, marginTop: 4 },
  action: { backgroundColor: c.action, borderRadius: 999, minHeight: 44, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  actionTexte: { color: c.surface, fontFamily: polices.texte, fontWeight: '700' },
  plusTard: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  plusTardTexte: { color: c.secondaire, fontFamily: polices.texte, fontWeight: '600' },
});
