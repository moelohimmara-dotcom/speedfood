import { useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Bouton, GroupeLignes, LigneNavigation } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { adresseInstallation, lireVersionPubliee, miseAJourDisponible } from '../livraison/mise-a-jour';
import { gestion } from './gestion';
import { ErreurConnexion } from './client';
import { messageEssai, messageMiseAJour } from './parametres';
import { LIENS_AIDE } from './aide';
import { PreferencesReel } from './PreferencesReel';
/**
 * Paramètres (parité Kotlin, tranche 10.5, G16) : essai des notifications, version et vérification de mise à jour, visite guidée, oubli des commandes mémorisées sur l'appareil.
 * Rien n'est affiché qui ne fonctionne pas : la vérification de mise à jour n'existe que sur Android (l'iPhone passe par l'App Store ou TestFlight).
 */
export function ParametresReel({ connectee, ouvrirVisite, oublierCommandes, sessionTerminee }: { connectee: boolean; ouvrirVisite(): void; oublierCommandes(): Promise<void>; sessionTerminee(): void }) {
  const [message, setMessage] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [telechargeable, setTelechargeable] = useState(false);
  const [confirmerOubli, setConfirmerOubli] = useState(false);
  const [preferencesOuvertes, setPreferencesOuvertes] = useState(false);
  const verrou = useRef(false);
  const nom = Constants.expoConfig?.version ?? 'inconnue';
  const code = Number(Constants.expoConfig?.android?.versionCode ?? 0);
  async function seul(tache: () => Promise<void>) { if (verrou.current) return; verrou.current = true; setOccupe(true); try { await tache(); } finally { verrou.current = false; setOccupe(false); } }
  const essayer = () => seul(async () => {
    setMessage('Essai en cours…');
    try { setMessage(messageEssai(await gestion.essaiNotification())); }
    catch (e) { if (e instanceof ErreurConnexion && e.definitive) { setMessage(''); sessionTerminee(); } else setMessage(messageEssai(null)); }
  });
  const verifier = () => seul(async () => {
    setMessage('Vérification en cours…'); setTelechargeable(false);
    const publiee = await lireVersionPubliee();
    setMessage(messageMiseAJour(publiee, code, nom)); setTelechargeable(miseAJourDisponible(code, publiee));
  });
  const oublier = () => seul(async () => {
    setConfirmerOubli(false);
    try { await oublierCommandes(); setMessage('Les commandes mémorisées sur cet appareil ont été oubliées.'); } catch { setMessage('Impossible d’oublier les commandes de cet appareil pour le moment. Réessayez.'); }
  });
  return <View style={s.bloc}>
    <PreferencesReel ouvert={preferencesOuvertes} fermer={() => setPreferencesOuvertes(false)} sessionTerminee={() => { setPreferencesOuvertes(false); sessionTerminee(); }} />
    <Text accessibilityRole="header" style={s.titre}>Paramètres</Text>
    {message !== '' && <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={s.texte}>{message}</Text>}
    <Text style={s.secondaire}>Speedfood vous prévient à chaque étape de votre commande. Si rien n’arrive, vérifiez que les notifications de Speedfood sont autorisées dans les réglages du téléphone.</Text>
    {!connectee && <Text style={s.secondaire}>Connectez-vous pour tester les notifications.</Text>}
    <GroupeLignes>
      {connectee && <LigneNavigation premiere titre="Tester les notifications" sousTitre="Envoie une notification d’essai à ce téléphone" icone="cloche" disabled={occupe} onPress={() => { void essayer(); }} />}
      {Platform.OS === 'android' && <LigneNavigation premiere={!connectee} titre="Vérifier les mises à jour" sousTitre={'Version installée : ' + nom} icone="actualiser" disabled={occupe} onPress={() => { void verifier(); }} />}
      <LigneNavigation premiere={!connectee && Platform.OS !== 'android'} titre="Revoir la visite guidée" sousTitre="Un tour rapide de l’application" icone="aide" disabled={occupe} onPress={ouvrirVisite} />
      {connectee && <LigneNavigation titre="Mes préférences et allergies" sousTitre="Adaptent les résultats de recherche à vos goûts" icone="aide" disabled={occupe} onPress={() => setPreferencesOuvertes(true)} />}
      <LigneNavigation titre="Crédits photos" sousTitre="Auteurs et licences des photos de plats" icone="externe" disabled={occupe} onPress={() => { void Linking.openURL(LIENS_AIDE.credits).catch(() => setMessage('Impossible d’ouvrir la page des crédits sur cet appareil.')); }} />
    </GroupeLignes>
    {Platform.OS !== 'android' && <Text style={s.secondaire}>Version installée : {nom}</Text>}
    {telechargeable && <Bouton titre="Télécharger la nouvelle version" icone="externe" disabled={occupe} onPress={() => { void Linking.openURL(adresseInstallation()).catch(() => setMessage('Impossible d’ouvrir la page de téléchargement.')); }} />}
    <Text style={s.nom}>Cet appareil</Text>
    <Text style={s.secondaire}>Les commandes que vous envoyez sont gardées sur ce téléphone : leur suivi reste consultable sans connexion (la clé de suivi est dans le coffre du téléphone) et « Commander à nouveau » retrouve leurs plats et quantités.</Text>
    {confirmerOubli
      ? <><Text accessibilityRole="alert" style={s.texte}>Oublier les commandes de cet appareil ? Elles disparaissent de ce téléphone, avec leur clé de suivi ; vos commandes restent dans votre compte.</Text>
        <Bouton titre="Oublier" variante="danger" icone="corbeille" disabled={occupe} onPress={() => { void oublier(); }} /><Bouton titre="Retour" secondaire disabled={occupe} onPress={() => setConfirmerOubli(false)} /></>
      : <Bouton titre="Oublier les commandes de cet appareil" variante="danger" icone="corbeille" disabled={occupe} onPress={() => setConfirmerOubli(true)} />}
  </View>;
}
const s = StyleSheet.create({
  bloc: { gap: 12, marginTop: 12 },
  titre: { fontFamily: polices.titre, fontSize: 28, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre, marginTop: 6 },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.secondaire },
});
