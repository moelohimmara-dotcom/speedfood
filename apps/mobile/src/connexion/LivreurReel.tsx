import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { couleurs as c, polices } from '../design/tokens';
import { Action } from './BoutonAction';
import { LIBELLES_CYCLE_LIVREUR, LIBELLES_STATUT_LIVREUR, LIBELLES_VEHICULE_LIVREUR, libelleDistanceLivreur, libelleEcheanceOffre, type EtatLivreur } from './livreur';
import { creerControleEtatLivreur, type EtatControleLivreur, type SessionEtatLivreur } from './controle-etat-livreur';

/**
 * Espace livreur : fiche du compte, état (G2), offre en attente et bascule de disponibilité. Lecture et écriture
 * manuelles seulement ; aucune minuterie, aucune permission nouvelle. La bascule est un envoi unique : un résultat
 * incertain verrouille le bouton jusqu'à une relecture réussie, qui affiche la vérité du serveur.
 */
export function LivreurReel({ session, fermer }: { session: SessionEtatLivreur; fermer: () => void }) {
  const [affiche, setAffiche] = useState<EtatControleLivreur>({ etat: 'chargement' });
  const controle = useMemo(() => creerControleEtatLivreur(session, setAffiche), [session]);
  const controleRef = useRef(controle); controleRef.current = controle;
  useEffect(() => { void controle.actualiser(); return () => { controle.fermer(); }; }, [controle]);
  const actualiser = () => { void controleRef.current.actualiser(); };

  return <ScrollView contentContainerStyle={s.contenu}>
    <Action titre="Retour au compte" agir={fermer} />
    <Text accessibilityRole="header" style={s.titre}>Espace livreur</Text>
    {affiche.etat === 'chargement' && <Text style={s.texte}>Lecture de votre état…</Text>}
    {affiche.etat === 'erreur' && <><Text style={s.erreur}>{affiche.message}</Text><Action titre="Réessayer" agir={actualiser} /></>}
    {affiche.etat === 'lu' && affiche.etatLivreur === null && <><Text style={s.texte}>Ce compte n’est pas un compte livreur.</Text><Action titre="Actualiser mon état" agir={actualiser} /></>}
    {affiche.etat === 'lu' && affiche.etatLivreur !== null && <Etat etat={affiche.etatLivreur} basculeEnCours={affiche.basculeEnCours} incertain={affiche.incertain} message={affiche.message} basculer={(v) => { void controleRef.current.basculer(v); }} actualiser={actualiser} />}
  </ScrollView>;
}

function Etat({ etat, basculeEnCours, incertain, message, basculer, actualiser }: { etat: EtatLivreur; basculeEnCours: boolean; incertain: boolean; message: string | null; basculer: (enLigne: boolean) => void; actualiser: () => void }) {
  const { fiche, offre } = etat;
  const peutBasculer = fiche.cycle === 'actif' && fiche.statut !== 'en_course';
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
    {offre ? <View style={s.carte}>
      <Text accessibilityRole="header" style={s.nom}>Offre en attente</Text>
      <Text style={s.ligne}>{offre.restaurantNom}</Text>
      <Text style={s.ligne}>Course : {libelleDistanceLivreur(offre.distanceCourseKm)} · Vous êtes à {libelleDistanceLivreur(offre.distanceRestaurantKm)} du restaurant</Text>
      <Text style={s.ligne}>Frais de livraison : {offre.fraisGnf.toLocaleString('fr-FR')} GNF</Text>
      <Text style={s.secondaire}>À répondre avant le {libelleEcheanceOffre(offre.expireLe)}. L’acceptation arrive dans un prochain lot ; cette offre peut aussi expirer et être proposée à un autre livreur.</Text>
    </View> : <Text style={s.texte}>Aucune offre pour le moment.</Text>}
    {fiche.statut === 'en_course'
      ? <Text style={s.secondaire}>Course en cours : votre disponibilité reprendra à la fin de la course.</Text>
      : fiche.cycle !== 'actif'
        ? <Text style={s.secondaire}>Votre fiche n’est pas active : la mise en ligne n’est pas possible. Contactez l’équipe Speedfood.</Text>
        : <Action titre={basculeEnCours ? 'Envoi en cours…' : fiche.statut === 'disponible' ? 'Me mettre hors ligne' : 'Me mettre en ligne'} disabled={basculeEnCours || incertain} agir={() => basculer(fiche.statut !== 'disponible')} />}
    {message !== null && <Text style={s.secondaire}>{message}</Text>}
    <Action titre="Actualiser mon état" agir={actualiser} />
  </View>;
}

const s = StyleSheet.create({
  contenu: { padding: 20, gap: 14 },
  titre: { fontFamily: polices.titre, fontSize: 30, color: c.encre },
  carteGlobal: { gap: 14 },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, padding: 16, gap: 7 },
  nom: { fontFamily: polices.titre, fontSize: 22, color: c.encre },
  ligne: { fontFamily: polices.texte, fontSize: 16, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 16, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 14, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 16, color: c.avertissement, backgroundColor: c.avertissementFond, borderRadius: 10, padding: 10 },
});
