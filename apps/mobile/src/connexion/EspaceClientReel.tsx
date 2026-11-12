import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ADRESSES_MAX, AVATARS_CLIENT, ErreurEspaceClient, MODES_PREFERES_CLIENT, emojiAvatarClient, validerAdresse, validerPseudo, type EspaceComplet } from './espace-client';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
/**
 * « Mon espace » (parité Kotlin, lot 1, lignes B9 favoris, B10 adresses, B11 profil). Chaque écriture : un seul essai, jamais rejouée toute seule ; APRÈS chaque écriture (réussie, refusée ou incertaine)
 * l'espace est relu pour afficher l'état réel du serveur. Un 401 renvoie à la connexion. Le porteur reste dans la session : rien d'identifiant ne passe par cet écran.
 */
export function EspaceClientReel({ ouvert, fermer, sessionTerminee }: { ouvert: boolean; fermer(): void; sessionTerminee(): void }) {
  const [espace, setEspace] = useState<EspaceComplet | null>(null);
  const [attente, setAttente] = useState(false); const [erreur, setErreur] = useState<string | null>(null); const [message, setMessage] = useState('');
  const [pseudo, setPseudo] = useState(''); const [avatar, setAvatar] = useState<string>(AVATARS_CLIENT[0].cle); const [mode, setMode] = useState<string | null>(null); const [notifications, setNotifications] = useState(true);
  const [libelle, setLibelle] = useState(''); const [adresse, setAdresse] = useState(''); const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const enCours = useRef(false); const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  function remplir(e: EspaceComplet) {
    setEspace(e);
    if (e.profil) { setPseudo(e.profil.pseudo); setAvatar(e.profil.avatar); setMode(e.profil.modePrefere); setNotifications(e.profil.notificationsCommande); }
  }
  function traiter(e: unknown) {
    if (e instanceof ErreurConnexion && e.definitive) { sessionTerminee(); return; }
    setErreur(e instanceof ErreurEspaceClient || e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.');
  }
  /** Lecture à l'ouverture : un seul essai, jamais rejouée toute seule. */
  useEffect(() => {
    if (!ouvert) return;
    setEspace(null); setErreur(null); setMessage(''); setASupprimer(null);
    if (enCours.current) return;
    enCours.current = true; setAttente(true);
    void gestion.espaceComplet().then(e => { if (actif.current) remplir(e); }, e => { if (actif.current) traiter(e); }).finally(() => { enCours.current = false; if (actif.current) setAttente(false); });
  }, [ouvert]);

  /** Une écriture, puis relecture de l'état réel (même après un refus ou un résultat incertain). */
  async function ecrire(f: () => Promise<{ message: string }>) {
    if (enCours.current) return;
    enCours.current = true; setAttente(true); setErreur(null); setMessage(''); setASupprimer(null);
    try {
      try { const r = await f(); if (actif.current) setMessage(r.message); }
      catch (e) { if (e instanceof ErreurConnexion && e.definitive) { if (actif.current) traiter(e); return; } if (actif.current) traiter(e); }
      try { const e = await gestion.espaceComplet(); if (actif.current) remplir(e); }
      catch (e) { if (actif.current) { if (e instanceof ErreurConnexion && e.definitive) traiter(e); else setErreur(avant => avant ?? 'Impossible de relire votre espace. Actualisez dans un instant.'); } }
    } finally { enCours.current = false; if (actif.current) setAttente(false); }
  }
  const pseudoValide = validerPseudo(pseudo).ok;
  const adresseValide = validerAdresse(libelle, adresse).ok;
  return <Modal visible={ouvert} onRequestClose={fermer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Bouton titre="Retour" onPress={fermer} />
    <Text accessibilityRole="header" style={s.titre}>Mon espace</Text>
    {attente && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Un instant…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Bouton titre="Actualiser mon espace" secondaire disabled={attente} onPress={() => { void ecrire(async () => ({ message: '' })); }} />
    {espace && <>
      <Text accessibilityRole="header" style={s.nom}>Mon profil</Text>
      <View style={s.carte}>
        <Text style={s.texte}>Pseudo</Text>
        <TextInput accessibilityLabel="Votre pseudo" value={pseudo} onChangeText={setPseudo} autoCorrect={false} maxLength={40} editable={!attente} style={s.champ} />
        <Text style={s.texte}>Avatar : {emojiAvatarClient(avatar)}</Text>
        <View style={s.rangee}>{AVATARS_CLIENT.map(a => <Pressable key={a.cle} accessibilityRole="button" accessibilityLabel={'Avatar ' + a.libelle} accessibilityState={{ selected: avatar === a.cle }} disabled={attente} onPress={() => setAvatar(a.cle)} style={[s.puce, avatar === a.cle && s.puceActive]}><Text style={s.emoji}>{a.emoji}</Text></Pressable>)}</View>
        <Text style={s.texte}>Mode de commande préféré</Text>
        <View style={s.rangee}>{MODES_PREFERES_CLIENT.map(m => <Pressable key={m.libelle} accessibilityRole="button" accessibilityState={{ selected: mode === m.valeur }} disabled={attente} onPress={() => setMode(m.valeur)} style={[s.puceTexte, mode === m.valeur && s.puceActive]}><Text style={s.texte}>{m.libelle}</Text></Pressable>)}</View>
        <View style={s.ligne}><Text style={[s.texte, { flex: 1 }]}>Notifications de mes commandes</Text><Switch accessibilityLabel="Notifications de mes commandes" value={notifications} onValueChange={setNotifications} disabled={attente} /></View>
        <Bouton titre="Enregistrer mon profil" disabled={attente || !pseudoValide} onPress={() => { void ecrire(() => gestion.enregistrerProfil({ pseudo, avatar, modePrefere: mode, notificationsCommande: notifications })); }} />
      </View>
      <Text accessibilityRole="header" style={s.nom}>Mes adresses</Text>
      <Text style={s.secondaire}>{espace.adresses.length} sur {ADRESSES_MAX} adresses. L’adresse principale est proposée en premier pour vos livraisons.</Text>
      {espace.adresses.length === 0 && <Text style={s.texte}>Aucune adresse enregistrée.</Text>}
      {espace.adresses.map(a => <View key={a.id} style={s.carte}>
        <Text style={s.nomPetit}>{a.libelle}{a.parDefaut ? ' · principale' : ''}</Text><Text style={s.texte}>{a.adresse}</Text>
        {!a.parDefaut && <Bouton titre={'Définir « ' + a.libelle + ' » comme principale'} secondaire disabled={attente} onPress={() => { void ecrire(() => gestion.actionAdresse({ action: 'defaut', adresseId: a.id })); }} />}
        {aSupprimer === a.id
          ? <><Text accessibilityRole="alert" style={s.texte}>Supprimer cette adresse ?</Text><Bouton titre="Oui, supprimer" disabled={attente} onPress={() => { void ecrire(() => gestion.actionAdresse({ action: 'supprimer', adresseId: a.id })); }} /><Bouton titre="Non, garder" secondaire disabled={attente} onPress={() => setASupprimer(null)} /></>
          : <Bouton titre={'Supprimer « ' + a.libelle + ' »'} secondaire disabled={attente} onPress={() => setASupprimer(a.id)} />}
      </View>)}
      {espace.adresses.length < ADRESSES_MAX
        ? <View style={s.carte}>
          <Text style={s.nomPetit}>Ajouter une adresse</Text>
          <Text style={s.texte}>Nom court (par exemple Maison)</Text>
          <TextInput accessibilityLabel="Nom de l’adresse" value={libelle} onChangeText={setLibelle} maxLength={40} editable={!attente} style={s.champ} />
          <Text style={s.texte}>Adresse pour le livreur : quartier, rue, point de repère</Text>
          <TextInput accessibilityLabel="Adresse de livraison" value={adresse} onChangeText={setAdresse} multiline maxLength={320} editable={!attente} style={[s.champ, { minHeight: 90 }]} />
          <Bouton titre="Enregistrer cette adresse" disabled={attente || !adresseValide} onPress={() => { const v = validerAdresse(libelle, adresse); if (!v.ok) return; void ecrire(async () => { const r = await gestion.actionAdresse({ action: 'ajouter', libelle, adresse }); if (actif.current) { setLibelle(''); setAdresse(''); } return r; }); }} />
        </View>
        : <Text style={s.texte}>Vous avez déjà {ADRESSES_MAX} adresses : supprimez-en une avant d’en ajouter.</Text>}
      <Text accessibilityRole="header" style={s.nom}>Mes favoris</Text>
      {espace.favoris.length === 0 && <Text style={s.texte}>Aucun favori. Touchez le cœur d’un restaurant pour le retrouver ici.</Text>}
      {espace.favoris.map(f => <View key={f.restaurantId} style={s.carte}>
        <Text style={s.nomPetit}>{f.nom}</Text><Text style={s.texte}>{f.ouvert ? 'Ouvert' : 'Fermé'}</Text>
        <Bouton titre={'Retirer ' + f.nom + ' des favoris'} secondaire disabled={attente} onPress={() => { void ecrire(() => gestion.basculerFavori(f.restaurantId)); }} />
      </View>)}
    </>}
  </ScrollView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({
  contenu: { padding: 22, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 },
  titre: { fontFamily: polices.titre, fontSize: 34, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 23, color: c.encre, marginTop: 8 },
  nomPetit: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, padding: 16, gap: 12 },
  champ: { backgroundColor: c.fond, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, padding: 14, minHeight: 50, fontFamily: polices.texte, fontSize: 16, color: c.encre },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  puce: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.bordure, backgroundColor: c.fond },
  puceTexte: { minHeight: 48, paddingHorizontal: 14, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.bordure, backgroundColor: c.fond },
  puceActive: { borderColor: c.action, borderWidth: 2 },
  emoji: { fontSize: 26 },
});
