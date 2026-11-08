import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { creerLectureFicheLivreur, type EtatLectureFicheLivreur, type SessionFicheLivreur } from './lecture-fiche-livreur';
import { LIBELLES_CYCLE_LIVREUR, LIBELLES_STATUT_LIVREUR, LIBELLES_VEHICULE_LIVREUR } from './livreur';
import { couleurs as c, polices } from '../design/tokens';

/** Dépendance explicite : le banc local n'importe jamais la session/coffre de production. */
export function LivreurReel({ session, fermer }: { session: SessionFicheLivreur; fermer(): void }) {
  const [etat, setEtat] = useState<EtatLectureFicheLivreur>({ etat: 'chargement' });
  const lecture = useRef<ReturnType<typeof creerLectureFicheLivreur> | null>(null);
  useEffect(() => {
    const nouvelle = creerLectureFicheLivreur(session, setEtat); lecture.current = nouvelle;
    void nouvelle.actualiser();
    return () => { nouvelle.fermer(); if (lecture.current === nouvelle) lecture.current = null; };
  }, [session]);
  const fiche = etat.etat === 'lu' ? etat.fiche : null;
  return <ScrollView contentContainerStyle={s.contenu}>
    <Action titre="Retour au compte" agir={fermer}/>
    <Text accessibilityRole="header" style={s.titre}>Espace livreur</Text>
    {etat.etat === 'chargement' && <View accessibilityLiveRegion="polite"><ActivityIndicator color={c.action}/><Text style={s.texte}>Lecture de votre fiche…</Text></View>}
    {etat.etat === 'erreur' && <Text accessibilityRole="alert" style={s.erreur}>{etat.message}</Text>}
    {etat.etat === 'lu' && !fiche && <Text style={s.texte}>Aucune fiche livreur n’est liée à ce compte. Contactez l’équipe Speedfood.</Text>}
    {fiche && <View style={s.carte}>
      <Text accessibilityRole="header" style={s.nom}>{fiche.nom}</Text>
      <Text style={s.texte}>{LIBELLES_CYCLE_LIVREUR[fiche.cycle]}</Text>
      {fiche.motifCycle && <Text style={s.texte}>{fiche.motifCycle}</Text>}
      <Text style={s.texte}>État : {LIBELLES_STATUT_LIVREUR[fiche.statut]}</Text>
      <Text style={s.texte}>Déplacement : {LIBELLES_VEHICULE_LIVREUR[fiche.vehicule]}</Text>
      <Text style={s.secondaire}>{fiche.restaurantNom ? 'Restaurant : ' + fiche.restaurantNom : 'Rattachement non renseigné.'}</Text>
      <Text style={s.secondaire}>Pour toute modification de votre fiche, contactez l’équipe Speedfood.</Text>
    </View>}
    <Action titre="Actualiser ma fiche" disabled={etat.etat === 'chargement'} agir={() => { void lecture.current?.actualiser(); }}/>
  </ScrollView>;
}
const s = StyleSheet.create({
  contenu: { padding: 20, gap: 18, paddingBottom: 48, backgroundColor: c.fond, flexGrow: 1 },
  titre: { fontFamily: polices.titre, fontSize: 30, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 24, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 16, lineHeight: 25, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 14, lineHeight: 23, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 16, lineHeight: 25, color: c.action },
  carte: { padding: 20, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, backgroundColor: c.surface, gap: 12 },
});
