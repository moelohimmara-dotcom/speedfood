import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { creerAuth, ErreurConnexion, type ResumeCompte } from './client';
import { GestionSession } from './session';
import { coffreSession } from './coffre';
import { couleurs as c, polices } from '../design/tokens';
const gestion = new GestionSession(creerAuth(),coffreSession);
let restauration: Promise<void> | null = null;
function Action({ titre, agir, disabled=false }: { titre:string; agir():void; disabled?:boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={titre} disabled={disabled} accessibilityState={{disabled}} onPress={agir} style={[s.bouton,disabled&&{opacity:.5}]}><Text style={s.boutonTexte}>{titre}</Text></Pressable>;
}
export function CompteReel({ ouvert, fermer }: { ouvert:boolean; fermer():void }) {
  const [email,setEmail]=useState(''); const [motDePasse,setMotDePasse]=useState('');
  const [connectee,setConnectee]=useState(false); const [profil,setProfil]=useState<ResumeCompte|null>(null);
  const [attente,setAttente]=useState(true); const [erreur,setErreur]=useState<string|null>(null); const [message,setMessage]=useState('');
  const revision=useRef(0);
  function fermerFormulaire(){setEmail('');setMotDePasse('');fermer();}
  async function executer(f:()=>Promise<void>){
    const n=++revision.current; setAttente(true);setErreur(null);setMessage('');
    try {await f();} catch(e){if(n===revision.current)setErreur(e instanceof ErreurConnexion?e.message:'Impossible de terminer cette opération. Réessayez.');}
    finally {if(n===revision.current){setConnectee(gestion.connectee);if(!gestion.connectee)setProfil(null);setAttente(false);}}
  }
  useEffect(()=>{
    let actif=true; restauration??=gestion.restaurer();
    void restauration.then(async()=>{if(!actif)return;if(gestion.connectee){const p=await gestion.espace();if(actif)setProfil(p);}}).catch(e=>{if(actif)setErreur(e instanceof ErreurConnexion?e.message:'Impossible de restaurer votre session.');}).finally(()=>{if(actif){setConnectee(gestion.connectee);setAttente(false);}});
    return()=>{actif=false;revision.current++;};
  },[]);
  useEffect(()=>{if(ouvert&&gestion.connectee){void executer(async()=>{setProfil(await gestion.espace());});}},[ouvert]);
  return <Modal visible={ouvert} onRequestClose={fermerFormulaire} animationType="slide"><SafeAreaView style={{flex:1,backgroundColor:c.fond}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Action titre="Retour au catalogue" agir={fermerFormulaire}/><Text accessibilityRole="header" style={s.titre}>Mon compte</Text>
    <Text style={s.texte}>{Platform.OS==='web'?'Dans cet aperçu web, votre session reste en mémoire : recharger ou fermer la page vous déconnecte.':'Votre session est protégée par le coffre du téléphone. Votre mot de passe n’est pas conservé.'}</Text>
    {attente&&<><ActivityIndicator color={c.action}/><Text accessibilityLiveRegion="polite" style={s.texte}>Connexion à Speedfood…</Text></>}
    {erreur&&<Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}{message!==''&&<Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    {!connectee?<>
      <Text style={s.texte}>Connectez-vous avec votre compte Speedfood existant.</Text>
      <Text style={s.texte}>Adresse e-mail</Text><TextInput accessibilityLabel="Adresse e-mail Speedfood" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!attente} style={s.champ}/>
      <Text style={s.texte}>Mot de passe</Text><TextInput accessibilityLabel="Mot de passe Speedfood" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" editable={!attente} style={s.champ}/>
      <Action titre="Me connecter" disabled={attente||!email.trim()||!motDePasse} agir={()=>{const demande=gestion.connecter(email,motDePasse);setEmail('');setMotDePasse('');void executer(async()=>{await demande;setProfil(await gestion.espace());});}}/>
      <Action titre="Créer un compte sur le site" disabled={attente} agir={()=>{void Linking.openURL('https://speedfood-app.moelohimmara.workers.dev/entrer').catch(()=>setErreur('Impossible d’ouvrir le site.'));}}/>
      {erreur&&<Action titre="Relire la session protégée" disabled={attente} agir={()=>{restauration=null;void executer(async()=>{await gestion.restaurer();if(gestion.connectee)setProfil(await gestion.espace());});}}/>}
    </>:<>
      <Text accessibilityRole="header" style={s.nom}>Compte connecté</Text>
      {profil?<><Text style={s.texte}>{profil.pseudo??'Profil à compléter sur le site'}</Text><Text style={s.texte}>{profil.favoris} favori(s) · {profil.adresses} adresse(s) enregistrée(s)</Text></>:<Text style={s.texte}>Votre espace n’a pas encore pu être lu.</Text>}
      <Action titre="Actualiser mon espace" disabled={attente} agir={()=>{void executer(async()=>{setProfil(await gestion.espace());});}}/>
      <Action titre="Me déconnecter de cet appareil" disabled={attente} agir={()=>{setProfil(null);void executer(async()=>{const r=await gestion.deconnecter();setMessage(r.distanteConfirmee?'Vous êtes déconnecté sur cet appareil.':'Session effacée sur cet appareil. La révocation distante n’a pas pu être confirmée.');});}}/>
    </>}
    {erreur&&<Action titre="Effacer la session de cet appareil" disabled={attente} agir={()=>{setProfil(null);void executer(async()=>{const r=await gestion.deconnecter();setMessage(r.distanteConfirmee?'Session locale effacée.':'Session locale effacée ; révocation distante non confirmée.');});}}/>}
    <Text style={s.secondaire}>Aucun envoi de commande n’est activé par cette connexion. Le panier reste un brouillon local.</Text>
  </ScrollView></SafeAreaView></Modal>;
}
const s=StyleSheet.create({contenu:{padding:22,gap:18,width:'100%',maxWidth:620,alignSelf:'center'},titre:{fontFamily:polices.titre,fontSize:34,color:c.encre},nom:{fontFamily:polices.titre,fontSize:23,color:c.encre},texte:{fontFamily:polices.texte,fontSize:15,lineHeight:23,color:c.encre},secondaire:{fontFamily:polices.texte,fontSize:12,lineHeight:19,color:c.secondaire},champ:{backgroundColor:c.surface,borderWidth:1,borderColor:c.bordure,borderRadius:16,padding:16,minHeight:54,fontFamily:polices.texte,fontSize:16,color:c.encre},bouton:{backgroundColor:c.action,minHeight:48,padding:14,borderRadius:26,alignItems:'center',justifyContent:'center'},boutonTexte:{color:c.surface,fontFamily:polices.texte,fontWeight:'700'}});
