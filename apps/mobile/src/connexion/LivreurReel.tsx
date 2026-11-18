import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { brancherSuiviLivreur } from './suivi-livreur';
import { veilleNative } from '../../modules/speedfood-veille/src/index';
import { ReglagesTelephone } from './ReglagesTelephone';
import { messageCycleLivreur } from './message-cycle-livreur';
import { stockagePreferences } from './stockage-preferences';
import {
  AIDE_SUIVI_ECRAN_ETEINT, BOUTON_AUTORISER_POSITION, BOUTON_SUIVI_NON, BOUTON_SUIVI_OUI, LIBELLE_SUIVI_ECRAN_ETEINT, MESSAGE_POSITION_ABSENTE, MESSAGE_POSITION_RECHERCHE, MESSAGE_POSITION_REFUSEE, TEXTE_CHOIX_SUIVI, TITRE_CHOIX_SUIVI,
  doitDemanderChoix, ecrireChoixSuivi, lireChoixSuivi, type EtatPositionLivreur,
} from './consentement-position';
import { AIDE_POSTE_FIXE_LIVREUR, CLE_POSTE_FIXE_LIVREUR, LIBELLE_POSTE_FIXE_LIVREUR, ecranLivreurAllume, ecrirePreference, lireInactifParDefaut } from './preferences-poste';
import { couleurs as c, dureeMouvement, polices } from '../design/tokens';
import { useMouvementReduit } from '../design/mouvement';
import { GroupeLignes, LigneNavigation, Squelette } from '../design/Composants';
import { Action } from './BoutonAction';
import { cibleDefilement, margeBasseClavier } from './clavier';
import { LIBELLES_CYCLE_LIVREUR, LIBELLES_ETAPE_COURSE, LIBELLES_STATUT_LIVREUR, LIBELLES_VEHICULE_LIVREUR, boutonsCourse, clientAffiche, libelleDistanceLivreur, libelleEcheanceOffre, lireCodeRemiseLivreur, lireRaisonEchecLivreur, MESSAGE_CODE_REMISE_LIVREUR, MESSAGE_RAISON_ECHEC_LIVREUR, type EtapeCourseLivreur, type EtatLivreur } from './livreur';
import { creerControleEtatLivreur, type EtatControleLivreur, type SaisieCourse, type SessionEtatLivreur } from './controle-etat-livreur';
import { CoursesLivreurReel } from './CoursesLivreurReel';
import { AssistanceLivreur } from './AssistanceLivreur';
import { DossierLivreurReel } from './DossierLivreurReel';
import { ErreurConnexion } from './client';
import { coursesSuivantes, type FileLivreur } from './file-livreur';
import { ErreurLivreur, type CourseLivreur } from './livreur';

/**
 * Espace livreur : fiche du compte, état (G2), offre en attente (G3 : Accepter / Refuser), course en cours (G3 : étapes autorisées par le serveur, code de remise,
 * échec confirmé) et bascule de disponibilité. Lecture et écriture manuelles seulement ; aucune minuterie, aucune permission nouvelle. Toute écriture est un envoi unique :
 * un résultat incertain verrouille les boutons jusqu'à une relecture réussie, qui affiche la vérité du serveur. Le client (nom, téléphone, adresse) n'est montré que si le
 * serveur le fournit, après la récupération ; le code de remise reste dans le champ le temps de la saisie et est effacé dès l'envoi.
 */
export function LivreurReel({ session, fermer }: { session: SessionEtatLivreur; fermer: () => void }) {
  const [affiche, setAffiche] = useState<EtatControleLivreur>({ etat: 'chargement' });
  const controle = useMemo(() => creerControleEtatLivreur(session, setAffiche), [session]);
  const controleRef = useRef(controle); controleRef.current = controle;
  const [hauteurClavier, setHauteurClavier] = useState(0);
  const defilement = useRef<ScrollView>(null);
  const champActif = useRef<TextInput | null>(null);
  const champs = useRef<Record<string, TextInput | null>>({});
  function defilerVersChampActif() {
    const champ = champActif.current; const zone = defilement.current;
    const contenu = zone && (zone as unknown as { getInnerViewRef?: () => unknown }).getInnerViewRef?.();
    if (!champ || !zone || !contenu) return;
    try { champ.measureLayout(contenu as never, (_x, y) => {
      if (champActif.current === champ && defilement.current === zone) zone.scrollTo({ y: cibleDefilement(y), animated: true });
    }, () => {}); } catch { /* Défilement manuel disponible si la mesure échoue. */ }
  }
  const clavier = {
    reference: (nom: string) => (champ: TextInput | null) => { champs.current[nom] = champ; },
    auFocus: (nom: string) => () => { champActif.current = champs.current[nom] ?? null; defilerVersChampActif(); },
    auBlur: () => { champActif.current = null; },
  };
  useEffect(() => { void controle.actualiser(); return () => { controle.fermer(); }; }, [controle]);
  useEffect(() => {
    const montre = Keyboard.addListener('keyboardDidShow', e => setHauteurClavier(e.endCoordinates?.height ?? 0));
    const cache = Keyboard.addListener('keyboardDidHide', () => setHauteurClavier(0));
    return () => { montre.remove(); cache.remove(); };
  }, []);
  const actualiser = () => { void controleRef.current.actualiser(); };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={defilement} onContentSizeChange={defilerVersChampActif} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.contenu, { paddingBottom: 20 + margeBasseClavier(hauteurClavier, Platform.OS) }]}>
    <Action titre="Retour au compte" variante="texte" icone="retour" iconeSeule agir={fermer} disabled={affiche.etat === 'lu' && affiche.ecritureEnCours} />
    <Text accessibilityRole="header" style={s.titre}>Espace livreur</Text>
    {affiche.etat === 'chargement' && <><Text style={s.texte}>Lecture de votre état…</Text><Squelette /></>}
    {affiche.etat === 'erreur' && <><Text style={s.erreur}>{affiche.message}</Text><Action titre="Réessayer" agir={actualiser} /></>}
    {affiche.etat === 'lu' && affiche.etatLivreur === null && <><Text style={s.texte}>Ce compte n’est pas un compte livreur.</Text><Action titre="Actualiser mon état" variante="texte" icone="actualiser" iconeSeule agir={actualiser} /></>}
    {affiche.etat === 'lu' && affiche.etatLivreur !== null && <Etat session={session} etat={affiche.etatLivreur} ecritureEnCours={affiche.ecritureEnCours} lectureEnCours={affiche.lectureEnCours} incertain={affiche.incertain} message={affiche.message}
      basculer={(v) => { void controleRef.current.basculer(v); }} repondre={(r) => { void controleRef.current.repondreOffre(r); }} avancer={(vers, saisie) => { void controleRef.current.avancerCourse(vers, saisie); }} actualiser={actualiser} clavier={clavier} />}
  </ScrollView></KeyboardAvoidingView>;
}

function Etat({ session, etat, ecritureEnCours, lectureEnCours, incertain, message, basculer, repondre, avancer, actualiser, clavier }: {
  clavier: { reference(nom: string): (champ: TextInput | null) => void; auFocus(nom: string): () => void; auBlur(): void };
  session: SessionEtatLivreur;
  etat: EtatLivreur; ecritureEnCours: boolean; lectureEnCours: boolean; incertain: boolean; message: string | null;
  basculer: (enLigne: boolean) => void; repondre: (reponse: 'acceptee' | 'refusee') => void; avancer: (vers: EtapeCourseLivreur, saisie?: SaisieCourse) => void; actualiser: () => void;
}) {
  const { fiche, offre, course } = etat;
  // Suivi de position (D9, prototype) : branché seulement en ligne ; tout le détail vit dans `suivi-livreur` (permission, service, envoi par la session).
  const enLigne = fiche.statut !== 'hors_ligne';
  // Consentement au suivi écran éteint (G20) : demandé une fois en passant en ligne, gardé sur l'appareil ; aucun suivi ne démarre avant le choix.
  const [arrierePlan, setArrierePlan] = useState<boolean | null>(null);
  const [choixLu, setChoixLu] = useState(false);
  const [consentement, setConsentement] = useState(false);
  const [etatPosition, setEtatPosition] = useState<EtatPositionLivreur | null>(null);
  const [essaiPosition, setEssaiPosition] = useState(0);
  useEffect(() => { let vivant = true; void lireChoixSuivi(stockagePreferences).then(v => { if (vivant) { setArrierePlan(v); setChoixLu(true); } }); return () => { vivant = false; }; }, []);
  useEffect(() => {
    setEtatPosition(null);
    return brancherSuiviLivreur(session, enLigne && arrierePlan !== null, { arrierePlan: arrierePlan === true, surEtat: setEtatPosition });
  }, [enLigne, arrierePlan, session, essaiPosition]);
  function choisirSuivi(autorise: boolean, metEnLigne: boolean) {
    setArrierePlan(autorise); setConsentement(false);
    void ecrireChoixSuivi(stockagePreferences, autorise);
    if (metEnLigne) basculer(true);
  }
  const demanderChoix = consentement || doitDemanderChoix(arrierePlan, choixLu, enLigne, false);
  // Mode poste fixe (G19) : choix gardé sur l'appareil, absent = non. L'écran reste allumé seulement pendant une course, et il est relâché ensuite ou à la fermeture.
  const [posteFixe, setPosteFixe] = useState(false);
  useEffect(() => { let vivant = true; void lireInactifParDefaut(stockagePreferences, CLE_POSTE_FIXE_LIVREUR).then(v => { if (vivant) setPosteFixe(v); }); return () => { vivant = false; }; }, []);
  const enCourse = course !== null;
  useEffect(() => {
    void veilleNative.garderEcranAllume(ecranLivreurAllume(posteFixe, enCourse));
    return () => { void veilleNative.garderEcranAllume(false); };
  }, [posteFixe, enCourse]);
  function changerPosteFixe(v: boolean) { setPosteFixe(v); void ecrirePreference(stockagePreferences, CLE_POSTE_FIXE_LIVREUR, v); }
  // Entrée de la carte d'offre : un glissement unique à l'arrivée d'une offre (charte animations) ; aucun mouvement
  // en mouvement réduit, aucune boucle, et l'état final est posé d'emblée si le réglage système l'exige.
  const reduit = useMouvementReduit();
  const entree = useRef(new Animated.Value(0)).current;
  const offreId = offre?.offreId ?? null;
  useEffect(() => {
    if (offreId === null) return;
    const duree = dureeMouvement(reduit, 300);
    if (duree === 0) { entree.setValue(1); return; }
    entree.setValue(0);
    const animation = Animated.timing(entree, { toValue: 1, duration: duree, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [offreId, reduit, entree]);
  // Saisies locales de la course : le code et la raison restent ici le temps de la saisie, et sont effacés quand la course change, se termine, ou à l'envoi.
  const [fileOuverte, setFileOuverte] = useState(false);
  const [coursesOuvertes, setCoursesOuvertes] = useState(false);
  const [dossierOuvert, setDossierOuvert] = useState(false);
  const [assistanceOuverte, setAssistanceOuverte] = useState(false);
  const [code, setCode] = useState('');
  const [raison, setRaison] = useState('');
  const [confirmerEchec, setConfirmerEchec] = useState(false);
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);
  const livraisonId = course?.livraisonId ?? null;
  useEffect(() => { setCode(''); setRaison(''); setConfirmerEchec(false); setErreurSaisie(null); }, [livraisonId]);
  const peutBasculer = fiche.cycle === 'actif' && fiche.statut !== 'en_course';
  const verrou = ecritureEnCours || lectureEnCours || incertain;
  const client = course ? clientAffiche(course, incertain) : null;
  const apresRecuperation = course !== null && (course.statut === 'recuperee' || course.statut === 'vers_client');
  const etapes = course ? boutonsCourse(course) : [];
  return <View style={s.carteGlobal}>
    <View style={s.carte}>
      <View style={s.ligneTitre}>
        <Text accessibilityRole="header" style={[s.nom, { flex: 1 }]}>{fiche.nom}</Text>
        <Action titre="Actualiser mon état" variante="texte" icone="actualiser" iconeSeule disabled={ecritureEnCours} agir={actualiser} />
      </View>
      <Text style={s.ligne}>{LIBELLES_CYCLE_LIVREUR[fiche.cycle]}</Text>
      <Text style={s.ligne}>État : {LIBELLES_STATUT_LIVREUR[fiche.statut]}</Text>
      <Text style={s.ligne}>Déplacement : {LIBELLES_VEHICULE_LIVREUR[fiche.vehicule]}</Text>
      {fiche.restaurantNom ? <Text style={s.ligne}>Restaurant rattaché : {fiche.restaurantNom}</Text> : <Text style={s.secondaire}>Rattachement non renseigné.</Text>}
      {fiche.motifCycle && fiche.cycle !== 'suspendu' && <Text style={s.secondaire}>Motif : {fiche.motifCycle}</Text>}
      <Text style={s.secondaire}>Pour toute modification de votre fiche, contactez l’équipe Speedfood.</Text>
    </View>
    <ReglagesTelephone titre="Réglages de ce téléphone" lignes={[
      { cle: 'poste-fixe', libelle: LIBELLE_POSTE_FIXE_LIVREUR, aide: AIDE_POSTE_FIXE_LIVREUR, actif: posteFixe, changer: changerPosteFixe },
      { cle: 'suivi-ecran-eteint', libelle: LIBELLE_SUIVI_ECRAN_ETEINT, aide: AIDE_SUIVI_ECRAN_ETEINT, actif: arrierePlan === true, changer: v => choisirSuivi(v, false) },
    ]} />
    {incertain && <Text accessibilityRole="alert" style={s.erreur}>À vérifier : le résultat de votre dernière action est inconnu. Actualisez votre état avant toute autre action.</Text>}
    {offre ? <Animated.View style={[s.carte, { opacity: entree, transform: [{ translateY: entree.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <Text accessibilityRole="header" style={s.nom}>Offre en attente</Text>
      <Text style={s.ligne}>{offre.restaurantNom}</Text>
      <Text style={s.ligne}>Course : {libelleDistanceLivreur(offre.distanceCourseKm)} · Vous êtes à {libelleDistanceLivreur(offre.distanceRestaurantKm)} du restaurant</Text>
      <Text style={s.ligne}>Frais de livraison : {offre.fraisGnf.toLocaleString('fr-FR')} GNF</Text>
      <Text style={s.secondaire}>À répondre avant le {libelleEcheanceOffre(offre.expireLe)}. Cette offre peut aussi expirer et être proposée à un autre livreur ; votre réponse est vérifiée auprès de Speedfood.</Text>
      <Action titre={ecritureEnCours ? 'Envoi en cours…' : 'Accepter'} disabled={verrou} agir={() => repondre('acceptee')} />
      <Action titre="Refuser" secondaire disabled={verrou} agir={() => repondre('refusee')} />
    </Animated.View> : <Text style={s.texte}>Aucune offre pour le moment.</Text>}
    {course && <View style={s.carte}>
      <Text accessibilityRole="header" style={s.nom}>Ma course</Text>
      <Text style={s.ligne}>{course.restaurantNom}</Text>
      <Text style={s.ligne}>{course.libelle}</Text>
      <Text style={s.secondaire}>Commande {course.commandeReference}</Text>
      <Text style={s.ligne}>Frais de livraison : {course.fraisGnf.toLocaleString('fr-FR')} GNF</Text>
      {client
        ? <View style={s.client}>
          <Text accessibilityRole="header" style={s.sousTitre}>Client</Text>
          <Text style={s.ligne}>{client.nom}</Text>
          <Text selectable style={s.ligne}>Téléphone : {client.telephone}</Text>
          {client.adresse !== null && <Text style={s.ligne}>Adresse : {client.adresse}</Text>}
        </View>
        : <Text style={s.secondaire}>{apresRecuperation ? 'Les coordonnées du client ne sont pas disponibles. Actualisez votre état.' : 'Les coordonnées du client s’affichent après la récupération de la commande.'}</Text>}
      {etapes.length === 0 && <Text style={s.secondaire}>Aucune étape à faire pour le moment.</Text>}
      {etapes.map(e => {
        if (e === 'livree') {
          return <View key={e} style={s.formulaire}>
            <Text style={s.ligne}>Code de remise du client (4 chiffres)</Text>
            <Text style={s.secondaire}>Demandez ce code au client à la porte. Il n’est pas conservé et n’est jamais renvoyé automatiquement.</Text>
            <TextInput ref={clavier.reference('code-remise')} onFocus={clavier.auFocus('code-remise')} onBlur={clavier.auBlur} accessibilityLabel="Code de remise du client, 4 chiffres" style={s.champ} keyboardType="number-pad" inputMode="numeric" maxLength={4} autoCorrect={false} autoComplete="off" importantForAutofill="no" textContentType="none" value={code} editable={!verrou}
              onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 4)); setErreurSaisie(null); }} />
            {erreurSaisie !== null && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreurSaisie}</Text>}
            <Action titre="Livrée" disabled={verrou} agir={() => {
              // Validation locale avant tout envoi : un code qui n'a pas 4 chiffres ne part jamais ; le champ est vidé dès que l'envoi part.
              const valide = lireCodeRemiseLivreur(code);
              if (valide === null) { setErreurSaisie(MESSAGE_CODE_REMISE_LIVREUR); return; }
              setCode(''); setErreurSaisie(null);
              avancer('livree', { code: valide });
            }} />
          </View>;
        }
        if (e === 'echec') {
          if (!confirmerEchec) return <Action key={e} titre={LIBELLES_ETAPE_COURSE[e]} secondaire disabled={verrou} agir={() => setConfirmerEchec(true)} />;
          return <View key={e} style={s.formulaire}>
            <Text accessibilityRole="alert" style={s.ligne}>Signaler l’échec de la livraison ? Cette action ne peut pas être annulée.</Text>
            <Text style={s.ligne}>Raison</Text>
            <TextInput ref={clavier.reference('raison-echec')} onFocus={clavier.auFocus('raison-echec')} onBlur={clavier.auBlur} accessibilityLabel="Raison de l’échec de la livraison" style={[s.champ, s.champLong]} multiline maxLength={300} value={raison} editable={!verrou} onChangeText={(v) => { setRaison(v); setErreurSaisie(null); }} placeholder="Ex. : client injoignable" />
            {erreurSaisie !== null && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreurSaisie}</Text>}
            <Action titre="Confirmer l’échec" disabled={verrou} agir={() => {
              const valide = lireRaisonEchecLivreur(raison);
              if (valide === null) { setErreurSaisie(MESSAGE_RAISON_ECHEC_LIVREUR); return; }
              setConfirmerEchec(false); setRaison(''); setErreurSaisie(null);
              avancer('echec', { raison: valide, confirme: true });
            }} />
            <Action titre="Annuler" secondaire disabled={ecritureEnCours} agir={() => { setConfirmerEchec(false); setErreurSaisie(null); }} />
          </View>;
        }
        return <Action key={e} titre={ecritureEnCours ? 'Envoi en cours…' : LIBELLES_ETAPE_COURSE[e]} disabled={verrou} agir={() => avancer(e)} />;
      })}
    </View>}
    {fiche.statut === 'en_course'
      ? <Text style={s.secondaire}>Course en cours : votre disponibilité reprendra à la fin de la course.</Text>
      : fiche.cycle !== 'actif'
        ? <Text accessibilityRole={messageCycleLivreur(fiche.cycle, fiche.motifCycle)?.erreur ? 'alert' : undefined} style={messageCycleLivreur(fiche.cycle, fiche.motifCycle)?.erreur ? s.erreur : s.secondaire}>{messageCycleLivreur(fiche.cycle, fiche.motifCycle)?.texte}</Text>
        : <Action titre={ecritureEnCours ? 'Envoi en cours…' : fiche.statut === 'disponible' ? 'Me mettre hors ligne' : 'Me mettre en ligne'} icone="eclair" disabled={!peutBasculer || verrou} agir={() => { const vers = fiche.statut !== 'disponible'; if (doitDemanderChoix(arrierePlan, choixLu, false, vers)) setConsentement(true); else basculer(vers); }} />}
    {demanderChoix && <View style={s.carte}>
      <Text accessibilityRole="header" style={s.nom}>{TITRE_CHOIX_SUIVI}</Text>
      <Text style={s.ligne}>{TEXTE_CHOIX_SUIVI}</Text>
      <Action titre={BOUTON_SUIVI_OUI} agir={() => choisirSuivi(true, !enLigne)} />
      <Action titre={BOUTON_SUIVI_NON} secondaire agir={() => choisirSuivi(false, !enLigne)} />
    </View>}
    {enLigne && etatPosition === 'refusee' && <View style={s.carte}>
      <Text style={s.ligne}>{MESSAGE_POSITION_REFUSEE}</Text>
      <Action titre={BOUTON_AUTORISER_POSITION} agir={() => setEssaiPosition(n => n + 1)} />
    </View>}
    {enLigne && etatPosition === 'indisponible' && <Text style={s.secondaire}>{MESSAGE_POSITION_ABSENTE}</Text>}
    {enLigne && etatPosition === 'recherche' && <Text accessibilityLiveRegion="polite" style={s.secondaire}>{MESSAGE_POSITION_RECHERCHE}</Text>}
    {message !== null && <Text accessibilityLiveRegion="polite" style={s.secondaire}>{message}</Text>}
    <GroupeLignes>
      <LigneNavigation premiere actif={fileOuverte} titre="File des courses" sousTitre="Les courses qui vous attendent" icone="liste" disabled={ecritureEnCours} onPress={() => setFileOuverte(v => !v)} />
      <LigneNavigation actif={coursesOuvertes} titre="Mes courses livrées et leurs frais" sousTitre="Historique et frais de course" icone="document" disabled={ecritureEnCours} onPress={() => setCoursesOuvertes(v => !v)} />
      <LigneNavigation actif={dossierOuvert} titre="Mon dossier" sousTitre="Ce qui manque à votre dossier" icone="recu" disabled={ecritureEnCours} onPress={() => setDossierOuvert(v => !v)} />
      <LigneNavigation titre="Assistance conducteur" sousTitre="Écrire à l’équipe Speedfood" icone="aide" disabled={ecritureEnCours} onPress={() => setAssistanceOuverte(true)} />
    </GroupeLignes>
    {fileOuverte && <FileCourses session={session} courseActuelle={course} />}
    {coursesOuvertes && <CoursesLivreurReel />}
    {dossierOuvert && <DossierLivreurReel />}
    <AssistanceLivreur ouvert={assistanceOuverte} fermer={() => setAssistanceOuverte(false)} referenceCourse={course?.commandeReference ?? null} />
  </View>;
}

/** File des courses (D5) : les courses qui viennent après celle en cours (déjà montrée par « Ma course »). Lecture manuelle, un seul essai, par la session injectée. */
function FileCourses({ session, courseActuelle }: { session: SessionEtatLivreur; courseActuelle: CourseLivreur | null }) {
  const [file, setFile] = useState<FileLivreur | null | undefined>(undefined);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);
  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { if (!session.fileLivreur) throw new ErreurConnexion('File des courses indisponible.'); const f = await session.fileLivreur(); if (actif.current) setFile(f); }
    catch (e) { if (actif.current) setErreur(e instanceof ErreurLivreur || e instanceof ErreurConnexion ? e.message : 'Impossible de lire votre file de courses. Réessayez.'); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lire(); }, []);
  const suivantes = file ? coursesSuivantes(file, courseActuelle) : [];
  return <View style={s.carte}>
    <Text accessibilityRole="header" style={s.sousTitre}>File des courses</Text>
    {chargement && <Text accessibilityLiveRegion="polite" style={s.secondaire}>Lecture de votre file…</Text>}
    {erreur && <Text accessibilityRole="alert" style={s.erreur}>{erreur}</Text>}
    <Action titre="Actualiser la file" variante="texte" icone="actualiser" iconeSeule disabled={chargement} agir={() => { void lire(); }} />
    {file === null && <Text style={s.secondaire}>Ce compte n’est pas un compte livreur.</Text>}
    {file && suivantes.length === 0 && <Text style={s.secondaire}>Aucune autre course en file.</Text>}
    {suivantes.map(x => <View key={x.livraisonId} style={{ gap: 4 }}>
      <Text style={s.ligne}>{x.commandeReference} · {x.restaurantNom}</Text>
      <Text style={s.secondaire}>{x.libelle} · {x.fraisGnf.toLocaleString('fr-FR')} GNF de frais de course</Text>
    </View>)}
  </View>;
}

const s = StyleSheet.create({
  contenu: { padding: 20, gap: 14 },
  titre: { fontFamily: polices.titre, fontSize: 30, color: c.encre },
  carteGlobal: { gap: 14 },
  ligneTitre: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, padding: 16, gap: 7 },
  client: { gap: 4, paddingTop: 6 },
  formulaire: { gap: 8, padding: 12, borderWidth: 1, borderColor: c.action, borderRadius: 14 },
  champ: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.champBordure, borderRadius: 12, backgroundColor: c.surface, color: c.encre, fontFamily: polices.texte, fontSize: 16 },
  champLong: { minHeight: 90, textAlignVertical: 'top' },
  erreurChamp: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.action, fontWeight: '700' },
  nom: { fontFamily: polices.titre, fontSize: 22, color: c.encre },
  sousTitre: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  ligne: { fontFamily: polices.texte, fontSize: 16, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 16, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 14, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 16, color: c.avertissement, backgroundColor: c.avertissementFond, borderRadius: 10, padding: 10 },
});
