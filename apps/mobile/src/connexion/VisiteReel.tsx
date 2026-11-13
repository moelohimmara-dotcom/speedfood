import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bouton } from '../design/Composants';
import { CLE_VISITE_VUE, DIAPOS_CLIENT, DIAPOS_RESTAURATEUR, doitProposerVisite, etapeSuivante } from './visite';
import { couleurs as c, polices } from '../design/tokens';

/** La visite a-t-elle déjà été vue sur cet appareil ? Toute anomalie de lecture vaut « pas vue » : on la repropose, sans bloquer. */
export async function visiteDejaVue(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(CLE_VISITE_VUE)) === '1'; } catch { return false; }
}
/** Marque la visite comme vue (valeur non secrète) : elle ne se reproposera plus toute seule. Un échec d'écriture est sans conséquence. */
export async function marquerVisiteVue(): Promise<void> {
  try { await SecureStore.setItemAsync(CLE_VISITE_VUE, '1'); } catch { /* la visite se reproposera, rien de grave */ }
}
export async function doitOuvrirVisite(): Promise<boolean> {
  return doitProposerVisite(await visiteDejaVue());
}

/**
 * Visite guidée (parité Kotlin, lot 4, ligne A10) : deux écrans, « Passer » à tout moment, « Suivant » puis « C'est parti ».
 * Proposée automatiquement au premier lancement seulement ; rouvrable depuis l'accueil et l'espace restaurateur. Aucune permission demandée.
 */
export function VisiteGuidee({ ouvert, variante, fermer }: { ouvert: boolean; variante: 'client' | 'restaurateur'; fermer(): void }) {
  const diapos = variante === 'restaurateur' ? DIAPOS_RESTAURATEUR : DIAPOS_CLIENT;
  const [page, setPage] = useState(0);
  useEffect(() => { if (ouvert) setPage(0); }, [ouvert, variante]);
  function terminer() { void marquerVisiteVue(); fermer(); }
  function suivant() {
    const e = etapeSuivante(page, diapos.length);
    if (e.terminee) terminer(); else setPage(e.page);
  }
  const diapo = diapos[Math.min(page, diapos.length - 1)];
  return <Modal visible={ouvert} onRequestClose={terminer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}>
    <View style={s.contenu}>
      <Text style={s.progression}>{Math.min(page + 1, diapos.length)} / {diapos.length}</Text>
      <Text accessibilityRole="header" style={s.titre}>{diapo.titre}</Text>
      <Text style={s.texte}>{diapo.texte}</Text>
      <View style={s.points}>{diapos.map((d, i) => <View key={d.titre} style={[s.point, i === page && s.pointActif]} />)}</View>
      <Bouton titre={page >= diapos.length - 1 ? "C'est parti" : 'Suivant'} onPress={suivant} />
      <Bouton titre="Passer la visite" secondaire onPress={terminer} />
    </View>
  </SafeAreaView></Modal>;
}

const s = StyleSheet.create({
  contenu: { flex: 1, padding: 24, gap: 20, justifyContent: 'center', width: '100%', maxWidth: 620, alignSelf: 'center' },
  progression: { fontFamily: polices.texte, fontSize: 13, color: c.secondaire, textAlign: 'center' },
  titre: { fontFamily: polices.titre, fontSize: 32, lineHeight: 38, color: c.encre, textAlign: 'center' },
  texte: { fontFamily: polices.texte, fontSize: 17, lineHeight: 26, color: c.encre, textAlign: 'center' },
  points: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.bordure },
  pointActif: { width: 26, borderRadius: 5, backgroundColor: c.action },
});
