import { useEffect, useState } from 'react';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ReserverTableReel } from '../src/connexion/ReserverTableReel';
import { MesReservationsReel } from '../src/connexion/MesReservationsReel';
import { ReservationsRestaurateurReel } from '../src/connexion/ReservationsRestaurateurReel';
import { GestionSession } from '../src/connexion/session';
import { creerAuth } from '../src/connexion/client';
import { Action } from '../src/connexion/BoutonAction';
import { couleurs as c, polices } from '../src/design/tokens';
import { creerTransportControle } from './transport';
import { PORTEURS_CONTROLE, COMPTES_CONTROLE, RESTAURANTS_CONTROLE } from './identites';

type Compte = 'A' | 'B' | 'R';
const POSITION: Record<Compte, number> = { A: 0, B: 1, R: 2 };
const transport = creerTransportControle();
let coffreFictif: string | null = null;
const sessionDe = (compte: Compte) => ({ accessToken: PORTEURS_CONTROLE[POSITION[compte]], refreshToken: 'refresh-factice-' + compte, userId: COMPTES_CONTROLE[POSITION[compte]], expiresAt: 9999999999 });
// Toute méthode produit autre que la réservation est bloquée AVANT le réseau ; aucun serveur réel n'est joignable.
const apiFermee = creerAuth((async () => { throw new Error('CONTROLE_APPEL_PRODUIT_REFUSE'); }) as typeof fetch);
const session = new GestionSession({
  ...apiFermee,
  connecter: async (email: string) => sessionDe(email.startsWith('b@') ? 'B' : email.startsWith('r@') ? 'R' : 'A'),
  renouveler: async (refresh: string) => sessionDe(refresh.endsWith('-B') ? 'B' : refresh.endsWith('-R') ? 'R' : 'A'),
  ...transport.api,
  deconnecter: async () => undefined,
}, { lire: async () => coffreFictif, ecrire: async v => { coffreFictif = v; }, effacer: async () => { coffreFictif = null; } });
// Le banc n'a pas de formulaire dans un Modal : le défilement vers le champ actif n'est pas nécessaire ici.
const clavier = { reference: () => () => undefined, auFocus: () => () => undefined, auBlur: () => undefined };

function Controle() {
  const [chargees, erreurPolices] = useFonts({ Manrope: require('../assets/fonts/manrope.ttf'), Bricolage: require('../assets/fonts/bricolage.ttf') });
  const [revision, setRevision] = useState(0); const [pret, setPret] = useState(false);
  const [compte, setCompte] = useState<Compte>('A'); const [erreur, setErreur] = useState(false);
  async function choisir(v: Compte) {
    setErreur(false);
    try { await session.connecter(v.toLowerCase() + '@controle.invalid', 'factice'); setCompte(v); setRevision(n => n + 1); setPret(true); }
    catch { setErreur(true); }
  }
  useEffect(() => { void choisir('A'); }, []);
  if (!chargees || erreurPolices) return <Text>Chargement des polices de contrôle…</Text>;
  return <SafeAreaProvider><SafeAreaView style={s.racine}><StatusBar style="dark"/>
    <View style={s.entete}>
      <Text style={s.titre}>CONTRÔLE LOCAL — DONNÉES FACTICES</Text>
      <Text style={s.texte}>{compte === 'R' ? 'Restaurateur' : 'Client ' + compte} · coffre en mémoire uniquement</Text>
      <View style={s.comptes}><Action titre="Client A" agir={() => { void choisir('A'); }}/><Action titre="Client B" agir={() => { void choisir('B'); }}/><Action titre="Restaurateur" agir={() => { void choisir('R'); }}/></View>
      {erreur && <Text accessibilityRole="alert" style={s.texte}>Connexion fictive interrompue.</Text>}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
      {pret && compte !== 'R' && <>
        <Text style={s.nom}>Restaurant ouvert aux réservations (selon le scénario)</Text>
        <ReserverTableReel key={'o' + revision} session={session} restaurantId={RESTAURANTS_CONTROLE.ouvert} restaurantNom="Chez Fatou (témoin)"/>
        <Text style={s.nom}>Restaurant fermé aux réservations</Text>
        <ReserverTableReel key={'f' + revision} session={session} restaurantId={RESTAURANTS_CONTROLE.ferme} restaurantNom="Chez Mariama (témoin)"/>
        <MesReservationsReel key={'m' + revision} session={session}/>
      </>}
      {pret && compte === 'R' && <ReservationsRestaurateurReel key={'r' + revision} session={session} clavier={clavier}/>}
    </ScrollView>
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({ racine: { flex: 1, backgroundColor: c.fond }, entete: { padding: 16, gap: 10, borderBottomWidth: 1, borderColor: c.bordure }, contenu: { padding: 16, gap: 16 }, titre: { fontFamily: polices.texte, fontWeight: '700', color: c.action, fontSize: 12 }, nom: { fontFamily: polices.titre, color: c.encre, fontSize: 18 }, texte: { fontFamily: polices.texte, color: c.encre, fontSize: 13 }, comptes: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' } });
registerRootComponent(Controle);
