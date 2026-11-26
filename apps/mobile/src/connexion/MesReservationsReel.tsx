import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { creerControleListeReservations, type EtatControleListe, type SessionReservationClient } from './controle-reservation-client';
import { libelleStatutReservation, peutAnnulerReservation, type ReservationClient } from './reservation';
import { libelleCreneau } from '../domaine/creneaux-reservation';
import { couleurs as c, polices } from '../design/tokens';

/**
 * « Mes réservations » dans le compte (lot M4a) : la liste se lit sur demande (jamais par minuterie), chaque réservation s'ouvre en détail, et « Annuler la réservation » exige une
 * confirmation explicite. L'annulation n'est proposée que pour une réservation « demandée » ou « confirmée » à venir ; le serveur reste juge. Un seul envoi à la fois, jamais rejoué ;
 * un résultat incertain bloque l'annulation jusqu'à une relecture réussie (voir `controle-reservation-client.ts`).
 */
export function MesReservationsReel({ session, maintenant = Date.now }: { session: SessionReservationClient; maintenant?: () => number }) {
  const [etat, setEtat] = useState<EtatControleListe | null>(null);
  const controle = useRef<ReturnType<typeof creerControleListeReservations> | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<string | null>(null);

  useEffect(() => { const ctl = creerControleListeReservations(session, setEtat); controle.current = ctl; return () => ctl.fermer(); }, [session]);
  // Une réservation qui n'est plus annulable (relecture) ne garde ni confirmation ni détail ouvert à tort.
  useEffect(() => {
    if (etat?.etat !== 'lu') { setConfirmer(null); return; }
    setConfirmer(id => (id !== null && etat.reservations.some(r => r.id === id && peutAnnulerReservation(r, maintenant())) ? id : null));
    setDetail(id => (id !== null && etat.reservations.some(r => r.id === id) ? id : null));
  }, [etat]);

  const lu = etat?.etat === 'lu' ? etat : null;
  const occupe = etat?.etat === 'chargement' || (lu !== null && (lu.lectureEnCours || lu.ecritureEnCours));
  const verrou = lu?.incertain === true;

  return <View style={s.bloc}>
    <Text accessibilityRole="header" style={s.titre}>Mes réservations de table</Text>
    {etat === null && <Text style={s.secondaire}>Les réservations ne se mettent pas à jour toutes seules : appuyez pour les lire.</Text>}
    {etat?.etat === 'chargement' && <Text accessibilityLiveRegion="polite" style={s.texte}>Lecture de vos réservations…</Text>}
    {etat?.etat === 'erreur' && <Text accessibilityRole="alert" style={s.texte}>{etat.message}</Text>}
    {lu?.message && <Text accessibilityRole={verrou ? 'alert' : undefined} accessibilityLiveRegion="polite" style={s.texte}>{lu.message}</Text>}
    {lu?.ecritureEnCours && <Text accessibilityLiveRegion="polite" style={s.texte}>Envoi de votre annulation…</Text>}
    <Action titre={etat === null ? 'Voir mes réservations de table' : 'Actualiser mes réservations'} disabled={occupe} agir={() => { void controle.current?.actualiser(); }} />
    {lu && lu.reservations.length === 0 && <Text style={s.texte}>Aucune réservation de table.</Text>}
    {lu?.reservations.map((r: ReservationClient) => {
      const ouverte = detail === r.id;
      const annulable = peutAnnulerReservation(r, maintenant());
      return <View key={r.id} style={s.carte}>
        <Text style={s.nom}>{r.restaurantNom}</Text>
        <Text style={s.texte}>{libelleCreneau(r.creneau)} · {r.nbPersonnes} personne{r.nbPersonnes > 1 ? 's' : ''}</Text>
        <Text style={s.texte}>{libelleStatutReservation(r.statut)}</Text>
        {r.motif && <Text style={s.texte}>Motif donné par le restaurant : {r.motif}</Text>}
        {ouverte && <>
          <Text style={s.texte}>Référence : {r.reference}</Text>
          <Text style={s.texte}>Au nom de : {r.nom}</Text>
          {r.note && <Text style={s.texte}>Votre précision : {r.note}</Text>}
          <Text style={s.secondaire}>Demande faite le {libelleCreneau(r.creeLe)} (heure de Conakry). Aucun paiement.</Text>
        </>}
        <Action titre={ouverte ? 'Masquer le détail ' + r.reference : 'Voir le détail ' + r.reference} secondaire agir={() => setDetail(ouverte ? null : r.id)} disabled={lu.ecritureEnCours} />
        {ouverte && annulable && confirmer !== r.id && <Action titre="Annuler la réservation" secondaire agir={() => setConfirmer(r.id)} disabled={occupe || verrou} />}
        {ouverte && annulable && confirmer === r.id && <>
          <Text accessibilityRole="alert" style={s.texte}>Annuler cette réservation ? Cette action ne peut pas être annulée.</Text>
          <Action titre="Oui, annuler la réservation" agir={() => { setConfirmer(null); void controle.current?.annuler(r.id, true); }} disabled={occupe || verrou} />
          <Action titre="Non, la garder" secondaire agir={() => setConfirmer(null)} disabled={lu.ecritureEnCours} />
        </>}
      </View>;
    })}
    {verrou && <Text accessibilityRole="alert" style={s.secondaire}>Une annulation est à vérifier : actualisez vos réservations avant de continuer.</Text>}
  </View>;
}

const s = StyleSheet.create({
  bloc: { gap: 12 },
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  titre: { fontFamily: polices.titre, fontSize: 23, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
});
