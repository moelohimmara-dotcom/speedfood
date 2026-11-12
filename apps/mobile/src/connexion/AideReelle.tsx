import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { LIENS_AIDE, QUESTIONS_AIDE, QUESTIONS_AIDE_RESTAURATEUR, adresseAppel, adresseWhatsApp, lireAide } from './aide';
/**
 * « Aide et contact » (parité Kotlin, ligne A11) : contact de l'assistance (WhatsApp et appel si l'administration a renseigné un numéro), centre d'aide du site,
 * questions fréquentes, à propos et liens légaux. Lecture publique : aucune connexion n'est exigée, rien n'est envoyé.
 */
export function AideReelle({ ouvert, fermer, restaurateur = false }: { ouvert: boolean; fermer(): void; restaurateur?: boolean }) {
  const [numero, setNumero] = useState<string | null>(null);
  const [attente, setAttente] = useState(false);
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!ouvert) return;
    let actif = true; setAttente(true); setErreur(null);
    void lireAide().then(n => { if (actif) { setNumero(n); setAttente(false); } });
    return () => { actif = false; };
  }, [ouvert]);
  function ouvrirLien(adresse: string | null) {
    if (adresse === null) return;
    setErreur(null);
    void Linking.openURL(adresse).catch(() => setErreur('Impossible d’ouvrir ce lien sur cet appareil.'));
  }
  const whatsapp = adresseWhatsApp(numero); const appel = adresseAppel(numero);
  const questions = restaurateur ? QUESTIONS_AIDE_RESTAURATEUR.concat(QUESTIONS_AIDE) : QUESTIONS_AIDE;
  return <Modal visible={ouvert} onRequestClose={fermer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Bouton titre="Retour" onPress={fermer} />
    <Text accessibilityRole="header" style={s.titre}>Aide et contact</Text>
    <Text accessibilityRole="header" style={s.nom}>Nous contacter</Text>
    {attente && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Recherche du contact d’assistance…</Text></>}
    {!attente && whatsapp && <Bouton titre="Écrire à l’assistance sur WhatsApp" onPress={() => ouvrirLien(whatsapp)} />}
    {!attente && appel && <Bouton titre="Appeler l’assistance" secondaire onPress={() => ouvrirLien(appel)} />}
    {!attente && !whatsapp && <Text style={s.texte}>Pour toute question, consultez le centre d’aide du site.</Text>}
    <Bouton titre="Centre d’aide complet (site)" secondaire onPress={() => ouvrirLien(LIENS_AIDE.centre)} />
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Text accessibilityRole="header" style={s.nom}>Questions fréquentes</Text>
    {questions.map((q, i) => <Pressable key={q.question} accessibilityRole="button" accessibilityState={{ expanded: ouverte === i }} accessibilityLabel={q.question} onPress={() => setOuverte(ouverte === i ? null : i)} style={s.carte}>
      <Text style={s.question}>{q.question}</Text>{ouverte === i && <Text style={s.texte}>{q.reponse}</Text>}
    </Pressable>)}
    <Text accessibilityRole="header" style={s.nom}>À propos</Text>
    <Text style={s.texte}>Speedfood est le portail de commande de repas de Conakry : vous parcourez les restaurants, commandez, puis suivez votre commande jusqu’à la remise.{Constants.expoConfig?.version ? ' Version ' + Constants.expoConfig.version + '.' : ''}</Text>
    <Bouton titre="Qui sommes-nous" secondaire onPress={() => ouvrirLien(LIENS_AIDE.apropos)} />
    <Bouton titre="Conditions" secondaire onPress={() => ouvrirLien(LIENS_AIDE.conditions)} />
    <Bouton titre="Confidentialité" secondaire onPress={() => ouvrirLien(LIENS_AIDE.confidentialite)} />
  </ScrollView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({
  contenu: { padding: 22, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 },
  titre: { fontFamily: polices.titre, fontSize: 34, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 23, color: c.encre, marginTop: 8 },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  question: { fontFamily: polices.texte, fontSize: 15, lineHeight: 22, fontWeight: '700', color: c.encre },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, padding: 16, gap: 8, minHeight: 48 },
});
