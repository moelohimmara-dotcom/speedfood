import { Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bouton } from '../design/Composants';
import { Icone } from '../design/Icone';
import { couleurs as c, polices } from '../design/tokens';
import { SITE_WEB } from './aide';
import { BOUTON_PAS_MAINTENANT, LIEN_CONFIDENTIALITE, LIGNES_DIVULGATION } from './consentement-position';
/**
 * Divulgation de la position du livreur : une fenêtre dédiée, plein écran, AVANT toute demande d'autorisation du téléphone (exigence « divulgation bien visible » de Google Play pour la position).
 * Elle dit ce qui est collecté, quand, pourquoi, et ce que le livreur garde en main. Un seul choix affirmatif lance le suivi ; refuser ou fermer ne met pas en ligne et ne démarre aucun suivi.
 * Les textes viennent de `consentement-position.ts` ; cet écran ne contient aucune règle.
 */
export function DivulgationPosition({ ouvert, titre, texte, boutonOui, boutonNon, autoriser, appOuverteSeulement, annuler }: {
  ouvert: boolean; titre: string; texte: string; boutonOui: string; boutonNon: string;
  autoriser(): void; appOuverteSeulement(): void; annuler(): void;
}) {
  return <Modal visible={ouvert} animationType="slide" onRequestClose={annuler}><SafeAreaView style={s.page}><ScrollView contentContainerStyle={s.contenu}>
    <View style={s.rond} accessibilityElementsHidden importantForAccessibility="no"><Icone nom="position" taille={34} couleur={c.encre} /></View>
    <Text accessibilityRole="header" style={s.titre}>{titre}</Text>
    <Text style={s.texte}>{texte}</Text>
    <View style={s.liste}>{LIGNES_DIVULGATION.map(l => <View key={l.titre} style={s.ligne}>
      <View style={s.pastille} accessibilityElementsHidden importantForAccessibility="no"><Icone nom={l.icone} taille={20} couleur={c.action} /></View>
      <View style={{ flex: 1, gap: 2 }}><Text accessibilityRole="header" style={s.ligneTitre}>{l.titre}</Text><Text style={s.ligneTexte}>{l.texte}</Text></View>
    </View>)}</View>
    <Bouton titre={LIEN_CONFIDENTIALITE} variante="texte" onPress={() => { void Linking.openURL(SITE_WEB + '/confidentialite').catch(() => undefined); }} />
    <Bouton titre={boutonOui} onPress={autoriser} />
    <Bouton titre={boutonNon} variante="contour" onPress={appOuverteSeulement} />
    <Bouton titre={BOUTON_PAS_MAINTENANT} variante="texte" onPress={annuler} />
  </ScrollView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fond },
  contenu: { padding: 24, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 },
  rond: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.mangue, alignItems: 'center', justifyContent: 'center' },
  titre: { fontFamily: polices.titre, fontSize: 30, lineHeight: 35, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 16, lineHeight: 24, color: c.encre },
  liste: { gap: 14, padding: 18, backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.bordure },
  ligne: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  pastille: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.actionTeinte, alignItems: 'center', justifyContent: 'center' },
  ligneTitre: { fontFamily: polices.titre, fontSize: 17, color: c.encre },
  ligneTexte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 22, color: c.encre },
});
