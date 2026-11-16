import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Bouton } from '../design/Composants';
import { Icone, type NomIcone } from '../design/Icone';
import { couleurs as c, polices } from '../design/tokens';
import { gestion } from './gestion';
import { CLE_ENTREE_VUE, PISTES, destinationPiste, doitProposerEntree, type EspaceEntree, type PisteEntree } from './entree';
/**
 * Premier écran « Qui êtes-vous ? » (parité Kotlin, G17) : client, restaurateur, livreur, et un lien « Équipe Speedfood ». Proposé au premier lancement, rouvrable depuis le catalogue.
 * Une piste professionnelle lit les droits du compte (`/moi`) pour mener à l'espace, à la connexion ou à un message précis. Rien n'est envoyé : lecture seule.
 */
export async function doitOuvrirEntree(): Promise<boolean> {
  try { return doitProposerEntree((await SecureStore.getItemAsync(CLE_ENTREE_VUE)) === '1'); } catch { return false; }
}
async function marquerEntreeVue(): Promise<void> { try { await SecureStore.setItemAsync(CLE_ENTREE_VUE, '1'); } catch { /* l'écran se reproposera, rien de grave */ } }
const ICONES: Record<string, NomIcone> = { client: 'panier', restaurateur: 'restaurateur', livreur: 'livreur' };

export function EntreeReelle({ ouvert, fermer, ouvrirEspace, ouvrirConnexion, ouvrirCandidature, ouvrirAide, ouvrirVisite }: {
  ouvert: boolean; fermer(): void; ouvrirEspace(espace: EspaceEntree): void; ouvrirConnexion(message: string): void; ouvrirCandidature(): void; ouvrirAide(): void; ouvrirVisite(): void;
}) {
  const [occupe, setOccupe] = useState(false);
  const [refus, setRefus] = useState<{ message: string; assistance: boolean; candidature: boolean } | null>(null);
  function quitter(suite?: () => void) { void marquerEntreeVue(); setRefus(null); fermer(); suite?.(); }
  async function choisir(piste: PisteEntree) {
    if (occupe) return;
    setRefus(null);
    if (piste === 'client') { quitter(); return; }
    setOccupe(true);
    try {
      const connectee = gestion.connectee;
      let roles = null; if (connectee) { try { roles = await gestion.moi(); } catch { roles = null; } }
      const d = destinationPiste(piste, { connectee, roles });
      if (d.genre === 'espace') quitter(() => ouvrirEspace(d.espace));
      else if (d.genre === 'connexion') quitter(() => ouvrirConnexion(d.message));
      else if (d.genre === 'refus') setRefus({ message: d.message, assistance: d.assistance, candidature: d.candidature });
      else if (d.genre === 'indisponible') setRefus({ message: d.message, assistance: false, candidature: false });
    } finally { setOccupe(false); }
  }
  return <Modal visible={ouvert} onRequestClose={() => quitter()} animationType="fade"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}><ScrollView contentContainerStyle={s.contenu}>
    <Text style={s.marque}>Speedfood</Text>
    <Text accessibilityRole="header" style={s.titre}>Qui êtes-vous ?</Text>
    <Text style={s.texte}>Des espaces séparés, chacun avec son propre compte. Choisissez le vôtre.</Text>
    {PISTES.map(p => <View key={p.id} style={s.carte}>
      <Icone nom={ICONES[p.id]} taille={30} couleur={c.action} />
      <Text accessibilityRole="header" style={s.nom}>{p.titre}</Text>
      <Text style={s.texte}>{p.texte}</Text>
      <Bouton titre={p.bouton} secondaire={p.id !== 'client'} disabled={occupe} onPress={() => { void choisir(p.id); }} />
    </View>)}
    {occupe && <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: 8 }}><ActivityIndicator color={c.action} /><Text style={s.secondaire}>Vérification de votre compte…</Text></View>}
    {refus && <View style={s.carte}>
      <Text accessibilityRole="alert" style={s.texte}>{refus.message}</Text>
      {refus.candidature && <Bouton titre="J’ai un restaurant" icone="restaurateur" onPress={() => quitter(ouvrirCandidature)} />}
      {refus.assistance && <Bouton titre="Aide et contact" icone="message" onPress={() => quitter(ouvrirAide)} />}
    </View>}
    <Bouton titre="Revoir la visite guidée" secondaire icone="etoile" onPress={() => quitter(ouvrirVisite)} />
    <Bouton titre="Équipe Speedfood" secondaire icone="liste" disabled={occupe} onPress={() => { void choisir('equipe'); }} />
  </ScrollView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({
  contenu: { padding: 22, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 },
  marque: { fontFamily: polices.titre, fontSize: 22, color: c.action },
  titre: { fontFamily: polices.titre, fontSize: 36, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 22, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 13, color: c.secondaire },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, padding: 20, gap: 12 },
});
