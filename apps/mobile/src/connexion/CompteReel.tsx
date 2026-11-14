import { useEffect, useRef, useState } from 'react';
import { creerLectureDifferee } from './lecture-differee';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import * as Crypto from 'expo-crypto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErreurConnexion, URL_AUTH_SOCIALE, type ResumeCompte } from './client';
import { SITE_WEB } from './aide';
import { lireCodeRetourSocial, preparerVerificateur, urlConnexionSociale, versBase64Url, type FournisseurSocial } from './reseaux-sociaux';
import { gestion } from './gestion';
import type {CommandeCompte,PropositionClient,ResumeSuivi} from './commandes';
import { confirmationSuppressionValide, ErreurSuppressionCompte, MOT_CONFIRMATION } from './suppression-compte';
import { InscriptionReelle, OubliReel } from './AccesReel';
import { EspaceClientReel } from './EspaceClientReel';
import { PorteVerrou, ReglageVerrou } from './VerrouProReel';
import { ReglementReel } from './ReglementReel';
import { RestaurateurReel } from './RestaurateurReel';
import { LivreurReel } from './LivreurReel';
import { EquipeReel } from './EquipeReel';
import { ErreurReglement, verdictDeclaration, type ModeReglement, type VerdictDeclaration } from './reglement';
import { couleurs as c, polices } from '../design/tokens';
import { Bouton } from '../design/Composants';
import type { NomIcone } from '../design/Icone';
import { notifications } from '../notifications';
import { MESSAGES_ETAT_RESTO } from '../notifications/autorisation';
import { creerDemandeEspace } from './ouverture-espace';
let restauration: Promise<void> | null = null;
const Action = ({ titre, agir, disabled = false, icone }: { titre: string; agir(): void; disabled?: boolean; icone?: NomIcone }) => <Bouton titre={titre} onPress={agir} disabled={disabled} icone={icone} />;
/** `demande` : à l'ouverture, relire les commandes et, si `reference` est donnée, ouvrir le suivi de CETTE commande (le jeton reste dans la session, jamais dans l'écran). `espaceRestaurateur` : ouvrir l'espace après connexion (appui notification `commande_nouvelle`). */
export function CompteReel({ ouvert, fermer, demande=null }: { ouvert:boolean; fermer():void; demande?:{reference:string|null;espaceRestaurateur?:boolean}|null }) {
  const [email,setEmail]=useState(''); const [motDePasse,setMotDePasse]=useState('');
  const [connectee,setConnectee]=useState(false); const [profil,setProfil]=useState<ResumeCompte|null>(null);
  const [attente,setAttente]=useState(true); const [erreur,setErreur]=useState<string|null>(null); const [message,setMessage]=useState('');
  const revision=useRef(0);const lectures=useRef(0);
  const [commandes,setCommandes]=useState<CommandeCompte[]|null>(null);
  const [suivi,setSuivi]=useState<{id:string;valeur:ResumeSuivi;luLe:string;lecture:number}|null>(null);
  const [confirmerAnnulation,setConfirmerAnnulation]=useState(false);
  const [confirmerProposition,setConfirmerProposition]=useState<'acceptee'|'refusee'|null>(null);
  const [acces,setAcces]=useState<'connexion'|'inscription'|'oubli'>('connexion');
  const [espaceOuvert,setEspaceOuvert]=useState(false);
  const [suppressionOuverte,setSuppressionOuverte]=useState(false);const [motSuppression,setMotSuppression]=useState('');
  // Entrée « Espace restaurateur » : un simple confort d'affichage (lu sur /api/v1/moi). Chaque route de l'espace revérifie le droit côté serveur.
  const [restaurateur,setRestaurateur]=useState<boolean|null>(null);const [restaurateurOuvert,setRestaurateurOuvert]=useState(false);const [restaurateurOccupe,setRestaurateurOccupe]=useState(false);
  const [livreur,setLivreur]=useState(false);const [livreurOuvert,setLivreurOuvert]=useState(false);
  const [equipe,setEquipe]=useState(false);const [equipeOuverte,setEquipeOuverte]=useState(false);
  function effacerLectures(){setCommandes(null);setSuivi(null);setConfirmerAnnulation(false);setConfirmerProposition(null);setSuppressionOuverte(false);setMotSuppression('');}
  async function lireCommandes(){effacerLectures();const n=revision.current;const r=await gestion.commandes();if(n===revision.current)setCommandes(r);return r;}
  async function lireSuivi(id:string){setSuivi(null);setConfirmerAnnulation(false);setConfirmerProposition(null);const n=revision.current;const r=await gestion.suivi(id);if(n===revision.current)setSuivi({id,valeur:r,luLe:new Date().toLocaleTimeString('fr-FR'),lecture:++lectures.current});}
  const annulationEnCours=useRef(false);
  async function annulerCommande(id:string){
    if(annulationEnCours.current)return;annulationEnCours.current=true;
    try{
      const n=revision.current;let ref:string;
      try{ref=await gestion.annuler(id);}catch(e){try{await lireSuivi(id);}catch{}throw e;}
      if(n===revision.current)setMessage('Commande '+ref+' annulée.');
      try{await lireCommandes();await lireSuivi(id);}catch{}
    }finally{annulationEnCours.current=false;}
  }
  const suppressionEnCours=useRef(false);
  /** Suppression du compte : UN seul essai, irréversible. Refus = rien supprimé (on reste connecté, le message du serveur est affiché) ; incertain = jamais présenté comme un succès, l'espace est relu pour voir si la session a pris fin. */
  async function supprimerCompte(){
    if(suppressionEnCours.current)return;suppressionEnCours.current=true;
    try{
      const n=revision.current;
      try{await gestion.supprimerCompte(motSuppression);}
      catch(e){
        if(e instanceof ErreurSuppressionCompte){
          if(n===revision.current)setErreur(e.message);
          if(e.genre==='incertain'){try{const p=await gestion.espace();if(n===revision.current)setProfil(p);}catch{}}
          return;
        }
        throw e;
      }
      if(n===revision.current){setMotSuppression('');setSuppressionOuverte(false);setMessage('Votre compte a été supprimé et votre session effacée de cet appareil.');}
    }finally{suppressionEnCours.current=false;}
  }
  const propositionEnCours=useRef(false);
  /** Réponse à la proposition du restaurant : UN seul essai, puis le suivi est relu pour montrer ce que le serveur a vraiment enregistré (même si la réponse s'est perdue en route). */
  async function repondreProposition(id:string,propositionId:string,accepter:boolean){
    if(propositionEnCours.current)return;propositionEnCours.current=true;setConfirmerProposition(null);
    try{
      const n=revision.current;
      try{await gestion.repondreProposition(id,propositionId,accepter);}catch(e){try{await lireSuivi(id);}catch{}throw e;}
      if(n===revision.current)setMessage(accepter?'Proposition acceptée. Le restaurant doit encore confirmer votre commande.':'Proposition refusée : votre commande est annulée.');
      try{await lireCommandes();await lireSuivi(id);}catch{}
    }finally{propositionEnCours.current=false;}
  }
  const declarationEnCours=useRef(false);
  /** Déclaration du règlement : UN seul essai. Ensuite le suivi est relu (sans l'effacer) pour savoir ce que le serveur a vraiment enregistré avant de proposer de réessayer. */
  function declarerReglement(id:string,mode:ModeReglement,reference:string|null):Promise<VerdictDeclaration|null>{
    if(declarationEnCours.current)return Promise.resolve(null);declarationEnCours.current=true;
    // Passe par `executer` comme les autres actions : `attente` bloque actualisation et déconnexion pendant l'envoi.
    return new Promise(resolve=>{let verdict:VerdictDeclaration|null=null;void executer(async()=>{try{verdict=await declarerReglementUnEssai(id,mode,reference);}finally{declarationEnCours.current=false;resolve(verdict);}});});
  }
  async function declarerReglementUnEssai(id:string,mode:ModeReglement,reference:string|null):Promise<VerdictDeclaration>{
    {
      const n=revision.current;let erreur:ErreurReglement|null=null;let session:string|null=null;
      try{await gestion.declarerPaiement(id,mode,reference);}
      catch(e){if(e instanceof ErreurReglement)erreur=e;else session=e instanceof ErreurConnexion?e.message:'Impossible de terminer cette opération. Réessayez.';}
      let relu:ResumeSuivi|undefined;
      if(session===null){try{relu=await gestion.suivi(id);if(n===revision.current)setSuivi({id,valeur:relu,luLe:new Date().toLocaleTimeString('fr-FR'),lecture:++lectures.current});}catch{relu=undefined;}}
      return verdictDeclaration({erreur,sessionTerminee:session,mode,reference,relu:relu?relu.paiement:undefined});
    }
  }
  // Connexions sociales (A4/A5/A6) : boutons seulement si le service d'authentification a activé le fournisseur (Facebook : et l'équipe).
  // Le parcours ouvre le navigateur (PKCE) ; le secret ne vit qu'en mémoire ici, le code du retour est échangé une seule fois.
  const [sociaux,setSociaux]=useState<ReadonlySet<FournisseurSocial>>(new Set());
  const socialEnAttente=useRef<{fournisseur:FournisseurSocial;verificateur:string}|null>(null);
  useEffect(()=>{
    if(!ouvert||connectee)return;let actifSocial=true;
    void gestion.fournisseursActifs().then(s=>{if(actifSocial)setSociaux(s);});
    return()=>{actifSocial=false;};
  },[ouvert,connectee]);
  async function commencerSocial(fournisseur:FournisseurSocial){
    try{
      const verificateur=preparerVerificateur(await Crypto.getRandomBytesAsync(32));
      if(verificateur===null)throw new ErreurConnexion('Connexion sociale indisponible sur cet appareil.');
      const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verificateur,{encoding:Crypto.CryptoEncoding.BASE64});
      socialEnAttente.current={fournisseur,verificateur};
      await Linking.openURL(urlConnexionSociale(URL_AUTH_SOCIALE,SITE_WEB,fournisseur,versBase64Url(digest)));
    }catch(e){socialEnAttente.current=null;setErreur(e instanceof ErreurConnexion?e.message:'Impossible d’ouvrir la connexion sociale. Réessayez.');}
  }
  useEffect(()=>{
    if(!ouvert)return;let actifRetour=true;
    const traiter=(url:string|null)=>{
      if(!actifRetour||!url||socialEnAttente.current===null)return;
      const code=lireCodeRetourSocial(url,SITE_WEB);if(code===null)return;
      const attente=socialEnAttente.current;socialEnAttente.current=null;
      void executer(async()=>{await gestion.connecterAvecCode(code,attente.verificateur);setProfil(await gestion.espace());});
    };
    void Linking.getInitialURL().then(traiter).catch(()=>undefined);
    const abonnement=Linking.addEventListener('url',e=>traiter(e.url));
    return()=>{actifRetour=false;abonnement.remove();};
  },[ouvert]);
  function fermerFormulaire(){setEmail('');setMotDePasse('');fermer();}
  async function executer(f:()=>Promise<void>){
    const n=++revision.current; setAttente(true);setErreur(null);setMessage('');
    try {await f();} catch(e){if(n===revision.current)setErreur(e instanceof ErreurConnexion?e.message:'Impossible de terminer cette opération. Réessayez.');}
    finally {if(n===revision.current){setConnectee(gestion.connectee);if(!gestion.connectee){setProfil(null);effacerLectures();}setAttente(false);}}
  }
  useEffect(()=>{
    let actif=true; restauration??=gestion.restaurer();
    void restauration.then(async()=>{if(!actif)return;if(gestion.connectee){const p=await gestion.espace();if(actif)setProfil(p);}}).catch(e=>{if(actif)setErreur(e instanceof ErreurConnexion?e.message:'Impossible de restaurer votre session.');}).finally(()=>{if(actif){setConnectee(gestion.connectee);setAttente(false);}});
    return()=>{actif=false;revision.current++;};
  },[]);
  const demandeRef=useRef(demande);demandeRef.current=demande;
  // Appui `commande_nouvelle` (à chaud ou à froid) : chaque nouvelle `demande` arme l'ouverture, consommée UNE fois quand l'écran est ouvert, la session active et le rôle lu comme membre (le serveur revalide chaque route).
  // Tant que l'espace est occupé (action en cours), l'ouverture est différée et rejouée à la fin.
  const demandeEspace=useRef(creerDemandeEspace()).current;
  useEffect(()=>{demandeEspace.armer(demande);},[demande]);
  useEffect(()=>{
    if(!ouvert){demandeEspace.fermer();return;}
    if(restaurateurOccupe)return;
    if(demandeEspace.evaluer({ouvert,connectee,restaurateur})){setLivreurOuvert(false);setRestaurateurOuvert(true);}
  },[demande,ouvert,connectee,restaurateur,restaurateurOccupe]);
  useEffect(()=>{
    if(!connectee){setRestaurateur(null);setRestaurateurOuvert(false);setLivreur(false);setLivreurOuvert(false);setEquipe(false);setEquipeOuverte(false);return;}
    let actif=true;
    void gestion.moi().then(r=>{
      if(!actif)return;
      setLivreur(r.livreur);
      setEquipe(r.equipe!==null);
      const estResto=r.restaurateur!==null;
      setRestaurateur(estResto);
      // Choix C (complément UI) : dès que le rôle restaurateur est reconnu (connexion, session rouverte à froid), même déclencheur qu'à la session (drapeau unique + promesse partagée → pas de 2ᵉ boîte).
      if(estResto)void notifications.apresContexteRestaurateur(true).then(e=>{if(actif&&e)setMessage(MESSAGES_ETAT_RESTO[e]);});
    },()=>{if(actif){setRestaurateur(false);setLivreur(false);setEquipe(false);}});
    return()=>{actif=false;};
  },[connectee]);
  const lireOuverture=()=>{void executer(async()=>{const demande=demandeRef.current;
    if(demande&&!demande.espaceRestaurateur){const liste=await lireCommandes();const o=demande.reference?liste.find(x=>x.reference===demande.reference):undefined;
      if(o)await lireSuivi(o.id);else if(demande.reference)setMessage('Commande '+demande.reference+' envoyée. Elle n’apparaît pas encore dans la liste : actualisez vos commandes dans un instant.');}
    setProfil(await gestion.espace());});};
  // Ouvert par une notification appli fermée : la session n'est pas encore restaurée. La lecture des commandes est gardée et jouée UNE fois quand la session devient disponible.
  const lireRef=useRef(lireOuverture);lireRef.current=lireOuverture;
  const lectureDiff=useRef(creerLectureDifferee(()=>lireRef.current())).current;
  useEffect(()=>{if(!ouvert){lectureDiff.fermeture();return;}if(gestion.connectee)lireOuverture();else lectureDiff.ouverture(false,demandeRef.current!==null);},[ouvert]);
  useEffect(()=>{lectureDiff.sessionDisponible(ouvert);},[connectee]);
  if(restaurateurOuvert){
    // Au retour, l'état de la session est relu : une session terminée pendant l'espace restaurateur (401) renvoie au formulaire de connexion.
    const retour=()=>{setRestaurateurOccupe(false);setRestaurateurOuvert(false);setConnectee(gestion.connectee);if(!gestion.connectee){setProfil(null);effacerLectures();}};
    return <Modal visible={ouvert} onRequestClose={restaurateurOccupe?()=>{}:retour} animationType="slide"><SafeAreaView style={{flex:1,backgroundColor:c.fond}}><PorteVerrou retour={restaurateurOccupe?()=>{}:retour}><RestaurateurReel fermer={retour} signalerOccupe={setRestaurateurOccupe}/></PorteVerrou></SafeAreaView></Modal>;
  }
  if(livreurOuvert&&connectee){
    const retour=()=>{setLivreurOuvert(false);setConnectee(gestion.connectee);if(!gestion.connectee){setProfil(null);effacerLectures();}};
    return <Modal visible={ouvert} onRequestClose={retour} animationType="slide"><SafeAreaView style={{flex:1,backgroundColor:c.fond}}><PorteVerrou retour={retour}><LivreurReel session={gestion} fermer={retour}/></PorteVerrou></SafeAreaView></Modal>;
  }
  if(equipeOuverte&&connectee){
    const retour=()=>{setEquipeOuverte(false);setConnectee(gestion.connectee);if(!gestion.connectee){setProfil(null);effacerLectures();}};
    return <PorteVerrou retour={retour}><EquipeReel ouvert={ouvert} fermer={retour}/></PorteVerrou>;
  }
  if(espaceOuvert&&connectee){
    // Au retour (ou si la session prend fin pendant l'espace), l'état de la session est relu : un 401 renvoie au formulaire de connexion.
    const retour=()=>{setEspaceOuvert(false);setConnectee(gestion.connectee);if(!gestion.connectee){setProfil(null);effacerLectures();}else void executer(async()=>{setProfil(await gestion.espace());});};
    const terminee=()=>{setEspaceOuvert(false);setConnectee(gestion.connectee);setProfil(null);effacerLectures();setErreur('Votre session a pris fin. Reconnectez-vous.');};
    return <EspaceClientReel ouvert={ouvert} fermer={retour} sessionTerminee={terminee}/>;
  }
  return <Modal visible={ouvert} onRequestClose={fermerFormulaire} animationType="slide"><SafeAreaView style={{flex:1,backgroundColor:c.fond}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Action titre="Retour au catalogue" agir={fermerFormulaire}/><Text accessibilityRole="header" style={s.titre}>Mon compte</Text>
    <Text style={s.texte}>{Platform.OS==='web'?'Dans cet aperçu web, votre session reste en mémoire : recharger ou fermer la page vous déconnecte.':'Votre session est protégée par le coffre du téléphone. Votre mot de passe n’est pas conservé.'}</Text>
    {attente&&<><ActivityIndicator color={c.action}/><Text accessibilityLiveRegion="polite" style={s.texte}>Connexion à Speedfood…</Text></>}
    {erreur&&<Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}{message!==''&&<Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    {!connectee&&acces==='inscription'?<InscriptionReelle emailInitial={email} retour={e=>{setEmail(e);setAcces('connexion');}} sessionOuverte={()=>{setAcces('connexion');void executer(async()=>{setProfil(await gestion.espace());});}}/>
    :!connectee&&acces==='oubli'?<OubliReel emailInitial={email} retour={e=>{setEmail(e);setAcces('connexion');}}/>
    :!connectee?<>
      <Text style={s.texte}>Connectez-vous avec votre compte Speedfood.</Text>
      <Text style={s.texte}>Adresse e-mail</Text><TextInput accessibilityLabel="Adresse e-mail Speedfood" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!attente} style={s.champ}/>
      <Text style={s.texte}>Mot de passe</Text><TextInput accessibilityLabel="Mot de passe Speedfood" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" editable={!attente} style={s.champ}/>
      <Action titre="Me connecter" disabled={attente||!email.trim()||!motDePasse} agir={()=>{const demande=gestion.connecter(email,motDePasse);setEmail('');setMotDePasse('');void executer(async()=>{await demande;setProfil(await gestion.espace());});}}/>
      {sociaux.has('google')&&<Action titre="Continuer avec Google" disabled={attente} agir={()=>{void commencerSocial('google');}}/>}
      {sociaux.has('facebook')&&<Action titre="Continuer avec Facebook" disabled={attente} agir={()=>{void commencerSocial('facebook');}}/>}
      <Action titre="Mot de passe oublié ?" disabled={attente} agir={()=>{setErreur(null);setAcces('oubli');}}/>
      <Action titre="Créer un compte" disabled={attente} agir={()=>{setErreur(null);setAcces('inscription');}}/>
      {erreur&&<Action titre="Relire la session protégée" disabled={attente} agir={()=>{restauration=null;void executer(async()=>{await gestion.restaurer();if(gestion.connectee)setProfil(await gestion.espace());});}}/>}
    </>:<>
      <Text accessibilityRole="header" style={s.nom}>Compte connecté</Text>
      {profil?<><Text style={s.texte}>{profil.pseudo??'Profil à compléter sur le site'}</Text><Text style={s.texte}>{profil.favoris} favori(s) · {profil.adresses} adresse(s) enregistrée(s)</Text></>:<Text style={s.texte}>Votre espace n’a pas encore pu être lu.</Text>}
      <Action titre="Actualiser mon espace" icone="actualiser" disabled={attente} agir={()=>{void executer(async()=>{setProfil(await gestion.espace());});}}/>
      <Action titre="Mon profil, mes adresses et mes favoris" icone="compte" disabled={attente} agir={()=>setEspaceOuvert(true)}/>
      {livreur&&<Action titre="Espace livreur" icone="eclair" disabled={attente} agir={()=>setLivreurOuvert(true)}/>}
      {restaurateur&&<Action titre="Espace restaurateur" icone="plat" disabled={attente} agir={()=>{
        void notifications.apresContexteRestaurateur(true).then(e=>{if(e)setMessage(MESSAGES_ETAT_RESTO[e]);});
        setRestaurateurOuvert(true);
      }}/>}
      {equipe&&<Action titre="Espace équipe" icone="liste" disabled={attente} agir={()=>setEquipeOuverte(true)}/>}
      {(restaurateur||livreur||equipe)&&<ReglageVerrou/>}
      <Action titre="Voir ou actualiser mes commandes" icone="document" disabled={attente} agir={()=>{void executer(async()=>{await lireCommandes();});}}/>
      {commandes!==null&&<><Text accessibilityRole="header" style={s.nom}>Mes commandes</Text><Text style={s.secondaire}>Les 50 dernières commandes au maximum. Actualisez pour lire leur état courant.</Text>{commandes.length===0&&<Text style={s.texte}>Aucune commande rattachée à ce compte.</Text>}{commandes.map(o=><ScrollView key={o.id} scrollEnabled={false} contentContainerStyle={s.carte}><Text style={s.nom}>{o.reference}{o.estTest?' · TEST':''}</Text><Text style={s.texte}>{o.restaurantNom} · {o.mode==='livraison'?'Livraison':o.mode==='retrait'?'Retrait':'Sur place'}</Text><Text style={s.texte}>{new Date(o.creeLe).toLocaleString('fr-FR')} · {o.totalGnf.toLocaleString('fr-FR')} GNF</Text><Text style={s.texte}>{libelle(o.statut)}</Text><Action titre={'Suivre '+o.reference} disabled={attente} agir={()=>{void executer(()=>lireSuivi(o.id));}}/></ScrollView>)}</>}
      {suivi&&<ScrollView scrollEnabled={false} contentContainerStyle={s.carte}><Text accessibilityRole="header" style={s.nom}>Suivi {suivi.valeur.reference}{suivi.valeur.estTest?' · TEST':''}</Text><Text style={s.texte}>{libelle(suivi.valeur.etatDerive)}</Text><Text style={s.texte}>{suivi.valeur.restaurantNom} · {suivi.valeur.totalGnf.toLocaleString('fr-FR')} GNF</Text>{suivi.valeur.pretEstimeeLe&&<Text style={s.texte}>Préparation estimée : {new Date(suivi.valeur.pretEstimeeLe).toLocaleString('fr-FR')}</Text>}{suivi.valeur.propositionEnAttente&&(suivi.valeur.proposition===null?<Text style={s.texte}>Le restaurant a proposé une modification que l’application ne peut pas afficher. Actualisez ce suivi ou consultez-la sur le site avant de répondre.</Text>:<PropositionCarte proposition={suivi.valeur.proposition} totalActuel={suivi.valeur.totalGnf} confirmation={confirmerProposition} occupe={attente} choisir={setConfirmerProposition} repondre={accepter=>{void executer(()=>repondreProposition(suivi.id,suivi.valeur.proposition!.id,accepter));}}/>)}{suivi.valeur.lignes.map((l,i)=><Text key={i} style={s.texte}>{l.quantite} × {l.nom}{l.options.length>0?' ('+l.options.join(', ')+')':''} · {(l.prixGnf*l.quantite).toLocaleString('fr-FR')} GNF</Text>)}<Text style={s.secondaire}>État lu à {suivi.luLe}.</Text><ReglementReel key={suivi.id} suivi={suivi.valeur} lecture={suivi.lecture} occupe={attente} declarer={(m,ref)=>declarerReglement(suivi.id,m,ref)}/>{suivi.valeur.etatDerive==='en_attente'&&(confirmerAnnulation?<><Text accessibilityRole="alert" style={s.texte}>Annuler définitivement cette commande ?</Text><Action titre="Oui, annuler" disabled={attente} agir={()=>{setConfirmerAnnulation(false);void executer(()=>annulerCommande(suivi.id));}}/><Action titre="Non, garder" disabled={attente} agir={()=>setConfirmerAnnulation(false)}/></>:<Action titre="Annuler cette commande" disabled={attente} agir={()=>setConfirmerAnnulation(true)}/>)}<Action titre="Actualiser ce suivi" disabled={attente} agir={()=>{void executer(()=>lireSuivi(suivi.id));}}/></ScrollView>}
      {suppressionOuverte?<ScrollView scrollEnabled={false} contentContainerStyle={s.carte}>
        <Text accessibilityRole="header" style={s.nom}>Supprimer mon compte</Text>
        <Text accessibilityRole="alert" style={s.texte}>Cette action est définitive : votre compte et vos données personnelles seront effacés et ne pourront pas être récupérés. Un compte professionnel (restaurant, livreur, équipe) ne peut pas être supprimé ici.</Text>
        <Text style={s.texte}>Pour confirmer, écrivez {MOT_CONFIRMATION} ci-dessous.</Text>
        <TextInput accessibilityLabel="Écrire SUPPRIMER pour confirmer" value={motSuppression} onChangeText={setMotSuppression} autoCapitalize="characters" autoCorrect={false} editable={!attente} style={s.champ}/>
        <Action titre="Supprimer définitivement mon compte" disabled={attente||!confirmationSuppressionValide(motSuppression)} agir={()=>{void executer(()=>supprimerCompte());}}/>
        <Action titre="Non, garder mon compte" disabled={attente} agir={()=>{setSuppressionOuverte(false);setMotSuppression('');}}/>
      </ScrollView>:<Action titre="Supprimer mon compte" disabled={attente} agir={()=>setSuppressionOuverte(true)}/>}
      <Action titre="Me déconnecter de cet appareil" icone="deconnexion" disabled={attente} agir={()=>{setProfil(null);effacerLectures();void executer(async()=>{const r=await gestion.deconnecter();setMessage(r.distanteConfirmee?'Vous êtes déconnecté sur cet appareil.':'Session effacée sur cet appareil. La révocation distante n’a pas pu être confirmée.');});}}/>
    </>}
    {erreur&&<Action titre="Effacer la session de cet appareil" disabled={attente} agir={()=>{setProfil(null);void executer(async()=>{const r=await gestion.deconnecter();setMessage(r.distanteConfirmee?'Session locale effacée.':'Session locale effacée ; révocation distante non confirmée.');});}}/>}
    <Text style={s.secondaire}>Vous pouvez commander en retrait ou en livraison depuis le panier lorsque vous êtes connecté.</Text>
  </ScrollView></SafeAreaView></Modal>;
}
/** Proposition révisée du restaurant : nouveaux montants, conditions, échéance, puis accepter ou refuser (avec confirmation, car la réponse est définitive). */
function PropositionCarte({proposition:p,totalActuel,confirmation,occupe,choisir,repondre}:{proposition:PropositionClient;totalActuel:number;confirmation:'acceptee'|'refusee'|null;occupe:boolean;choisir(v:'acceptee'|'refusee'|null):void;repondre(accepter:boolean):void}){
  const echue=p.expireLe!==null&&Date.parse(p.expireLe)<=Date.now();
  return <ScrollView scrollEnabled={false} contentContainerStyle={s.carte}>
    <Text accessibilityRole="header" style={s.nom}>Proposition du restaurant</Text>
    <Text style={s.texte}>Nouveau total : {p.nouveauTotal.toLocaleString('fr-FR')} GNF (au lieu de {totalActuel.toLocaleString('fr-FR')} GNF).</Text>
    <Text style={s.texte}>Plats : {p.nouveauSousTotal.toLocaleString('fr-FR')} GNF · Livraison : {p.nouveauxFraisLivraison.toLocaleString('fr-FR')} GNF</Text>
    {p.conditionsModifiees!==null&&<Text style={s.texte}>Conditions : {p.conditionsModifiees}</Text>}
    {p.expireLe!==null&&<Text style={s.secondaire}>{echue?'Cette proposition a expiré.':'À accepter avant le '+new Date(p.expireLe).toLocaleString('fr-FR')+'.'}</Text>}
    {confirmation===null?<>
      <Action titre="Accepter la proposition" disabled={occupe||echue} agir={()=>choisir('acceptee')}/>
      <Action titre="Refuser la proposition" disabled={occupe||echue} agir={()=>choisir('refusee')}/>
    </>:<>
      <Text accessibilityRole="alert" style={s.texte}>{confirmation==='acceptee'?'Accepter cette proposition ? Les nouveaux montants seront retenus ; le restaurant devra encore confirmer votre commande.':'Refuser cette proposition ? Votre commande sera annulée.'}</Text>
      <Action titre={confirmation==='acceptee'?'Oui, accepter':'Oui, refuser'} disabled={occupe} agir={()=>repondre(confirmation==='acceptee')}/>
      <Action titre="Non, revenir" disabled={occupe} agir={()=>choisir(null)}/>
    </>}
  </ScrollView>;
}
function libelle(v:string){const noms:Record<string,string>={en_attente:'En attente du restaurant',acceptee:'Acceptée',refusee:'Refusée',prete:'Prête',terminee:'Terminée',annulee:'Annulée',expiree:'Expirée'};return noms[v]??'État : '+v.replaceAll('_',' ');}
const s=StyleSheet.create({carte:{gap:12,padding:16,borderWidth:1,borderColor:c.bordure,borderRadius:18,backgroundColor:c.surface},contenu:{padding:22,gap:18,width:'100%',maxWidth:620,alignSelf:'center'},titre:{fontFamily:polices.titre,fontSize:34,color:c.encre},nom:{fontFamily:polices.titre,fontSize:23,color:c.encre},texte:{fontFamily:polices.texte,fontSize:15,lineHeight:23,color:c.encre},secondaire:{fontFamily:polices.texte,fontSize:12,lineHeight:19,color:c.secondaire},champ:{backgroundColor:c.surface,borderWidth:1,borderColor:c.bordure,borderRadius:16,padding:16,minHeight:54,fontFamily:polices.texte,fontSize:16,color:c.encre},bouton:{backgroundColor:c.action,minHeight:48,padding:14,borderRadius:26,alignItems:'center',justifyContent:'center'},boutonTexte:{color:c.surface,fontFamily:polices.texte,fontWeight:'700'}});
