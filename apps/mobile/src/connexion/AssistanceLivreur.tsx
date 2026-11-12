import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bouton } from '../design/Composants';
import { adresseAppel, adresseWhatsApp, lireAide } from './aide';
import { REGLES_LIVREUR, avertissementIdentite, texteIncidentLivreur } from './aide-livreur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Assistance conducteur (parité Kotlin, lot 3, ligne D8) : les règles de la plateforme, le numéro de l'assistance (le même que l'aide générale,
 * lu sur `/aide`, jamais affiché s'il n'est pas renseigné) et quoi faire d'un incident, selon qu'une course est en cours ou non.
 * Lisible même hors connexion pour les règles ; aucun envoi, aucune coordonnée de client.
 */
export function AssistanceLivreur({ ouvert, fermer, referenceCourse }: { ouvert: boolean; fermer(): void; referenceCourse: string | null }) {
  const [numero, setNumero] = useState<string | null>(null);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!ouvert) return;
    let actif = true; setAttente(true); setErreur(null);
    void lireAide().then(n => { if (actif) { setNumero(n); setAttente(false); } });
    return () => { actif = false; };
  }, [ouvert]);
  function ouvrir(adresse: string | null) {
    if (adresse === null) return;
    setErreur(null);
    void Linking.openURL(adresse).catch(() => setErreur('Impossible d’ouvrir ce lien sur cet appareil.'));
  }
  const whatsapp = adresseWhatsApp(numero); const appel = adresseAppel(numero);
  return <Modal visible={ouvert} onRequestClose={fermer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Bouton titre="Retour" onPress={fermer} />
    <Text accessibilityRole="header" style={s.titre}>Assistance conducteur</Text>
    <Text accessibilityRole="header" style={s.nom}>Règles de la plateforme</Text>
    {REGLES_LIVREUR.map(r => <Text key={r} style={s.texte}>• {r}</Text>)}
    <Text accessibilityRole="header" style={s.nom}>Appeler l'assistance</Text>
    {attente && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Recherche du contact d’assistance…</Text></>}
    {!attente && whatsapp && <Bouton titre="Écrire à l’assistance sur WhatsApp" onPress={() => ouvrir(whatsapp)} />}
    {!attente && appel && <Bouton titre="Appeler l’assistance" secondaire onPress={() => ouvrir(appel)} />}
    {!attente && !whatsapp && <Text style={s.texte}>Le numéro d'assistance n'est pas encore disponible. Écrivez à l'équipe Speedfood depuis « Mon compte ».</Text>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Text accessibilityRole="header" style={s.nom}>Un incident ?</Text>
    <Text style={s.texte}>{texteIncidentLivreur(referenceCourse)}</Text>
    <Text style={s.secondaire}>{avertissementIdentite()}</Text>
  </ScrollView></SafeAreaView></Modal>;
}

const s = StyleSheet.create({
  contenu: { padding: 22, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 },
  titre: { fontFamily: polices.titre, fontSize: 34, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 23, color: c.encre, marginTop: 8 },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
});
