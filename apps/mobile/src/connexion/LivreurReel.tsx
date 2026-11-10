import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { couleurs as c, dureeMouvement, polices } from '../design/tokens';
import { useMouvementReduit } from '../design/mouvement';
import { Squelette } from '../design/Composants';
import { Action } from './BoutonAction';
import { margeBasseClavier } from './clavier';
import { LIBELLES_CYCLE_LIVREUR, LIBELLES_ETAPE_COURSE, LIBELLES_STATUT_LIVREUR, LIBELLES_VEHICULE_LIVREUR, boutonsCourse, clientAffiche, libelleDistanceLivreur, libelleEcheanceOffre, lireCodeRemiseLivreur, lireRaisonEchecLivreur, MESSAGE_CODE_REMISE_LIVREUR, MESSAGE_RAISON_ECHEC_LIVREUR, type EtapeCourseLivreur, type EtatLivreur } from './livreur';
import { creerControleEtatLivreur, type EtatControleLivreur, type SaisieCourse, type SessionEtatLivreur } from './controle-etat-livreur';

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
  useEffect(() => { void controle.actualiser(); return () => { controle.fermer(); }; }, [controle]);
  useEffect(() => {
    const montre = Keyboard.addListener('keyboardDidShow', e => setHauteurClavier(e.endCoordinates?.height ?? 0));
    const cache = Keyboard.addListener('keyboardDidHide', () => setHauteurClavier(0));
    return () => { montre.remove(); cache.remove(); };
  }, []);
  const actualiser = () => { void controleRef.current.actualiser(); };

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.contenu, { paddingBottom: 20 + margeBasseClavier(hauteurClavier, Platform.OS) }]}>
    <Action titre="Retour au compte" agir={fermer} disabled={affiche.etat === 'lu' && affiche.ecritureEnCours} />
    <Text accessibilityRole="header" style={s.titre}>Espace livreur</Text>
    {affiche.etat === 'chargement' && <><Text style={s.texte}>Lecture de votre état…</Text><Squelette /></>}
    {affiche.etat === 'erreur' && <><Text style={s.erreur}>{affiche.message}</Text><Action titre="Réessayer" agir={actualiser} /></>}
    {affiche.etat === 'lu' && affiche.etatLivreur === null && <><Text style={s.texte}>Ce compte n’est pas un compte livreur.</Text><Action titre="Actualiser mon état" agir={actualiser} /></>}
    {affiche.etat === 'lu' && affiche.etatLivreur !== null && <Etat etat={affiche.etatLivreur} ecritureEnCours={affiche.ecritureEnCours} lectureEnCours={affiche.lectureEnCours} incertain={affiche.incertain} message={affiche.message}
      basculer={(v) => { void controleRef.current.basculer(v); }} repondre={(r) => { void controleRef.current.repondreOffre(r); }} avancer={(vers, saisie) => { void controleRef.current.avancerCourse(vers, saisie); }} actualiser={actualiser} />}
  </ScrollView>;
}

function Etat({ etat, ecritureEnCours, lectureEnCours, incertain, message, basculer, repondre, avancer, actualiser }: {
  etat: EtatLivreur; ecritureEnCours: boolean; lectureEnCours: boolean; incertain: boolean; message: string | null;
  basculer: (enLigne: boolean) => void; repondre: (reponse: 'acceptee' | 'refusee') => void; avancer: (vers: EtapeCourseLivreur, saisie?: SaisieCourse) => void; actualiser: () => void;
}) {
  const { fiche, offre, course } = etat;
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
      <Text accessibilityRole="header" style={s.nom}>{fiche.nom}</Text>
      <Text style={s.ligne}>{LIBELLES_CYCLE_LIVREUR[fiche.cycle]}</Text>
      <Text style={s.ligne}>État : {LIBELLES_STATUT_LIVREUR[fiche.statut]}</Text>
      <Text style={s.ligne}>Déplacement : {LIBELLES_VEHICULE_LIVREUR[fiche.vehicule]}</Text>
      {fiche.restaurantNom ? <Text style={s.ligne}>Restaurant rattaché : {fiche.restaurantNom}</Text> : <Text style={s.secondaire}>Rattachement non renseigné.</Text>}
      {fiche.motifCycle && <Text style={s.secondaire}>Motif : {fiche.motifCycle}</Text>}
      <Text style={s.secondaire}>Pour toute modification de votre fiche, contactez l’équipe Speedfood.</Text>
    </View>
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
            <TextInput accessibilityLabel="Code de remise du client, 4 chiffres" style={s.champ} keyboardType="number-pad" inputMode="numeric" maxLength={4} autoCorrect={false} autoComplete="off" importantForAutofill="no" textContentType="none" value={code} editable={!verrou}
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
            <TextInput accessibilityLabel="Raison de l’échec de la livraison" style={[s.champ, s.champLong]} multiline maxLength={300} value={raison} editable={!verrou} onChangeText={(v) => { setRaison(v); setErreurSaisie(null); }} placeholder="Ex. : client injoignable" />
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
        ? <Text style={s.secondaire}>Votre fiche n’est pas active : la mise en ligne n’est pas possible. Contactez l’équipe Speedfood.</Text>
        : <Action titre={ecritureEnCours ? 'Envoi en cours…' : fiche.statut === 'disponible' ? 'Me mettre hors ligne' : 'Me mettre en ligne'} disabled={!peutBasculer || verrou} agir={() => basculer(fiche.statut !== 'disponible')} />}
    {message !== null && <Text accessibilityLiveRegion="polite" style={s.secondaire}>{message}</Text>}
    <Action titre="Actualiser mon état" disabled={ecritureEnCours} agir={actualiser} />
  </View>;
}

const s = StyleSheet.create({
  contenu: { padding: 20, gap: 14 },
  titre: { fontFamily: polices.titre, fontSize: 30, color: c.encre },
  carteGlobal: { gap: 14 },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, padding: 16, gap: 7 },
  client: { gap: 4, paddingTop: 6 },
  formulaire: { gap: 8, padding: 12, borderWidth: 1, borderColor: c.action, borderRadius: 14 },
  champ: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.bordure, borderRadius: 12, backgroundColor: c.surface, color: c.encre, fontFamily: polices.texte, fontSize: 16 },
  champLong: { minHeight: 90, textAlignVertical: 'top' },
  erreurChamp: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.action, fontWeight: '700' },
  nom: { fontFamily: polices.titre, fontSize: 22, color: c.encre },
  sousTitre: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  ligne: { fontFamily: polices.texte, fontSize: 16, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 16, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 14, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 16, color: c.avertissement, backgroundColor: c.avertissementFond, borderRadius: 10, padding: 10 },
});
