import { useEffect, useState } from 'react';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LivreurReel } from '../src/connexion/LivreurReel';
import { GestionSession } from '../src/connexion/session';
import { creerAuth } from '../src/connexion/client';
import { Action } from '../src/connexion/BoutonAction';
import { couleurs as c, polices } from '../src/design/tokens';
import { creerTransportControle } from './transport';
import { PORTEURS_CONTROLE, COMPTES_CONTROLE } from './identites';

const transport = creerTransportControle();
let coffreFictif: string | null = null;
const sessionDe = (compte: 'A' | 'B') => ({ accessToken: PORTEURS_CONTROLE[compte === 'A' ? 0 : 1], refreshToken: 'refresh-factice-' + compte, userId: COMPTES_CONTROLE[compte === 'A' ? 0 : 1], expiresAt: 9999999999 });
// Toute méthode produit autre que fiche est bloquée AVANT le réseau ; aucun serveur réel n'est joignable.
const apiFermee = creerAuth((async () => { throw new Error('CONTROLE_APPEL_PRODUIT_REFUSE'); }) as typeof fetch);
const session = new GestionSession({
  ...apiFermee,
  connecter: async (email: string) => sessionDe(email.startsWith('b@') ? 'B' : 'A'),
  renouveler: async (refresh: string) => sessionDe(refresh.endsWith('-B') ? 'B' : 'A'),
  ficheLivreur: transport.ficheLivreur,
  etatLivreur: transport.etatLivreur,
  basculerEnLigneLivreur: transport.basculerEnLigneLivreur,
  repondreOffreLivreur: transport.repondreOffreLivreur,
  avancerCourseLivreur: transport.avancerCourseLivreur,
  deconnecter: async () => undefined,
}, { lire: async () => coffreFictif, ecrire: async v => { coffreFictif = v; }, effacer: async () => { coffreFictif = null; } });

function Controle() {
  const [chargees, erreurPolices] = useFonts({ Manrope: require('../assets/fonts/manrope.ttf'), Bricolage: require('../assets/fonts/bricolage.ttf') });
  const [revision, setRevision] = useState(0); const [pret, setPret] = useState(false); const [ouvert, setOuvert] = useState(true);
  const [compte, setCompte] = useState<'A' | 'B'>('A'); const [erreur, setErreur] = useState(false);
  async function choisir(v: 'A' | 'B') {
    setErreur(false);
    try { await session.connecter(v.toLowerCase() + '@controle.invalid', 'factice'); setCompte(v); setRevision(n => n + 1); setPret(true); }
    catch { setErreur(true); }
  }
  useEffect(() => { void choisir('A'); }, []);
  if (!chargees || erreurPolices) return <Text>Chargement des polices de contrôle…</Text>;
  return <SafeAreaProvider><SafeAreaView style={s.racine}><StatusBar style="dark"/>
    <View style={s.entete}>
      <Text style={s.titre}>CONTRÔLE LOCAL — DONNÉES FACTICES</Text>
      <Text style={s.texte}>Compte {compte} · coffre en mémoire uniquement</Text>
      <View style={s.comptes}><Action titre="Compte A" agir={() => { void choisir('A'); }}/><Action titre="Compte B" agir={() => { void choisir('B'); }}/></View>
      {erreur && <Text accessibilityRole="alert" style={s.texte}>Connexion fictive interrompue.</Text>}
    </View>
    {pret && ouvert ? <LivreurReel key={revision} session={session} fermer={() => setOuvert(false)}/> : <View style={s.entete}><Text style={s.texte}>Fiche fermée.</Text><Action titre="Ouvrir la fiche" agir={() => setOuvert(true)}/></View>}
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({ racine: { flex: 1, backgroundColor: c.fond }, entete: { padding: 16, gap: 10, borderBottomWidth: 1, borderColor: c.bordure }, titre: { fontFamily: polices.texte, fontWeight: '700', color: c.action, fontSize: 12 }, texte: { fontFamily: polices.texte, color: c.encre, fontSize: 13 }, comptes: { flexDirection: 'row', gap: 14 } });
registerRootComponent(Controle);
