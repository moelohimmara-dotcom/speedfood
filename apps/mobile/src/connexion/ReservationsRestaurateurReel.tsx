import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Action } from './BoutonAction';
import { creerControleReservationRestaurateur, type EtatControleRestaurateur, type SessionReservationRestaurateur } from './controle-reservation-restaurateur';
import { CAPACITE_COUVERTS_MAX, CAPACITE_COUVERTS_MIN, MOTIF_RESERVATION_MAX, libelleStatutReservation, type ActionReservationRestaurant, type ReservationRestaurant } from './reservation';
import { joursProposes, libelleHeure, libelleJourProche } from '../domaine/creneaux-reservation';
import { couleurs as c, polices } from '../design/tokens';

/** Le défilement vers le champ actif du parent (clavier ouvert) : même mécanisme que les autres sections de l'espace restaurateur. */
export interface ClavierEcran { reference(nom: string): (t: TextInput | null) => void; auFocus(nom: string): () => void; auBlur(): void }

/** Libellés des boutons : l'application affiche CE QUE LE SERVEUR PROPOSE (`actionsPossibles`), elle ne le déduit jamais. */
const LIBELLES_ACTION: Record<ActionReservationRestaurant, string> = { confirmer: 'Confirmer', refuser: 'Refuser', annuler: 'Annuler', honoree: 'Le client est venu', non_honoree: 'Le client n’est pas venu' };
const CONFIRMER_AVEC_MOTIF: Partial<Record<ActionReservationRestaurant, { question: string; oui: string }>> = {
  refuser: { question: 'Refuser cette réservation ? Le client lira votre motif. Cette action ne peut pas être annulée.', oui: 'Oui, refuser la réservation' },
  annuler: { question: 'Annuler cette réservation ? Le client lira votre motif. Cette action ne peut pas être annulée.', oui: 'Oui, annuler la réservation' },
};

/**
 * Section « Réservations » de l'espace restaurateur (lot M4a). La lecture est manuelle (ouverture de la section, choix du jour, bouton). Refuser et annuler demandent un motif de 3 à 200 caractères
 * et une confirmation. Le réglage (accepter les réservations, capacité par créneau) est relu après chaque écriture. Aucune règle ici : tout est dans `controle-reservation-restaurateur.ts`.
 */
export function ReservationsRestaurateurReel({ session, clavier, signalerOccupe }: { session: SessionReservationRestaurateur; clavier: ClavierEcran; signalerOccupe?(occupe: boolean): void }) {
  const [etat, setEtat] = useState<EtatControleRestaurateur>({ etat: 'chargement' });
  const controle = useRef<ReturnType<typeof creerControleReservationRestaurateur> | null>(null);
  const [motifPour, setMotifPour] = useState<{ id: string; action: ActionReservationRestaurant } | null>(null);
  const [motif, setMotif] = useState('');
  const [capacite, setCapacite] = useState('');
  const [erreurCapacite, setErreurCapacite] = useState<string | null>(null);

  useEffect(() => { const ctl = creerControleReservationRestaurateur(session, setEtat); controle.current = ctl; void ctl.actualiser(); return () => ctl.fermer(); }, [session]);
  const lu = etat.etat === 'lu' ? etat : null;
  const occupe = etat.etat === 'chargement' || (lu !== null && (lu.lectureEnCours || lu.ecritureEnCours));
  const verrou = lu?.incertain === true;
  const occupeSignal = lu !== null && lu.ecritureEnCours;
  useEffect(() => { signalerOccupe?.(occupeSignal); return () => signalerOccupe?.(false); }, [occupeSignal]);
  // La capacité affichée suit le réglage lu sur le serveur ; la demande d'un motif disparaît si l'action n'est plus proposée.
  const capaciteLue = lu ? lu.reglage.capaciteCouverts : undefined;
  useEffect(() => { if (capaciteLue !== undefined) { setCapacite(capaciteLue === null ? '' : String(capaciteLue)); setErreurCapacite(null); } }, [capaciteLue]);
  useEffect(() => {
    if (!lu) { setMotifPour(null); setMotif(''); return; }
    if (motifPour && !lu.reservations.some(r => r.id === motifPour.id && r.actionsPossibles.includes(motifPour.action))) { setMotifPour(null); setMotif(''); }
  }, [etat]);

  function enregistrerCapacite() {
    const texte = capacite.trim();
    if (texte === '') { setErreurCapacite(null); void controle.current?.ecrireReglage({ capaciteCouverts: null }); return; }
    if (!/^\d{1,3}$/.test(texte)) { setErreurCapacite('Indiquez un nombre entier de ' + CAPACITE_COUVERTS_MIN + ' à ' + CAPACITE_COUVERTS_MAX + ', ou laissez vide.'); return; }
    setErreurCapacite(null);
    void controle.current?.ecrireReglage({ capaciteCouverts: Number(texte) });
  }
  function agir(r: ReservationRestaurant, action: ActionReservationRestaurant) {
    if (CONFIRMER_AVEC_MOTIF[action]) { setMotifPour({ id: r.id, action }); setMotif(''); return; }
    void controle.current?.decider(r.id, action, {});
  }
  const jours = joursProposes(Date.now(), 8);

  return <View style={s.bloc}>
    <Text accessibilityRole="header" style={s.titre}>Réservations de table</Text>
    {etat.etat === 'chargement' && <Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des réservations…</Text>}
    {etat.etat === 'erreur' && <>
      <Text accessibilityRole="alert" style={s.texte}>{etat.message}</Text>
      <Action titre="Réessayer" agir={() => { void controle.current?.actualiser(); }} disabled={occupe} />
    </>}
    {lu && <>
      {lu.message && <Text accessibilityRole={verrou ? 'alert' : undefined} accessibilityLiveRegion="polite" style={s.texte}>{lu.message}</Text>}
      {lu.ecritureEnCours && <Text accessibilityLiveRegion="polite" style={s.texte}>Envoi en cours…</Text>}
      {verrou && <Text accessibilityRole="alert" style={s.texte}>Un résultat est à vérifier : actualisez la liste avant toute autre action.</Text>}

      <View style={s.carte}>
        <Text style={s.nom}>Réglage</Text>
        <View style={s.ligne}>
          <Text style={[s.texte, { flex: 1 }]}>Accepter les réservations</Text>
          <Switch accessibilityLabel="Accepter les réservations" value={lu.reglage.accepteReservation} disabled={occupe || verrou} onValueChange={v => { void controle.current?.ecrireReglage({ accepteReservation: v }); }} />
        </View>
        <Text style={s.secondaire}>{lu.reglage.accepteReservation ? 'Les clients peuvent demander une table.' : 'Les clients ne voient pas le bouton « Réserver une table ».'}</Text>
        <Text style={s.texte}>Couverts par créneau (vide : sans plafond)</Text>
        <TextInput ref={clavier.reference('reservation-capacite')} onFocus={clavier.auFocus('reservation-capacite')} onBlur={clavier.auBlur} accessibilityLabel="Nombre de couverts acceptés par créneau" style={s.champ} keyboardType="number-pad" maxLength={3} autoCorrect={false} value={capacite} onChangeText={t => setCapacite(t.replace(/\D/g, ''))} editable={!occupe && !verrou} />
        {erreurCapacite && <Text accessibilityRole="alert" style={s.erreur}>{erreurCapacite}</Text>}
        <Action titre="Enregistrer la capacité" agir={enregistrerCapacite} disabled={occupe || verrou} />
      </View>

      <Text style={s.nom}>{libelleJourProche(lu.jour, Date.now())}</Text>
      <View style={s.rangee}>{jours.map(j => <Pressable key={j} accessibilityRole="button" accessibilityLabel={'Voir ' + libelleJourProche(j, Date.now())} accessibilityState={{ selected: lu.jour === j, disabled: occupe || verrou }} disabled={occupe || verrou} onPress={() => { void controle.current?.choisirJour(j); }} style={[s.choix, lu.jour === j && s.choixActif]}><Text style={[s.choixTexte, lu.jour === j && s.choixTexteActif]}>{libelleJourProche(j, Date.now())}</Text></Pressable>)}</View>
      <Action titre="Actualiser les réservations" agir={() => { void controle.current?.actualiser(); }} disabled={lu.ecritureEnCours || lu.lectureEnCours} />
      {lu.reservations.length === 0 && <Text style={s.texte}>Aucune réservation ce jour-là.</Text>}
      {lu.reservations.map(r => {
        const demande = motifPour?.id === r.id ? CONFIRMER_AVEC_MOTIF[motifPour.action] : undefined;
        return <View key={r.id} style={s.carte}>
          <Text style={s.nom}>{libelleHeure(r.creneau)} · {r.nbPersonnes} personne{r.nbPersonnes > 1 ? 's' : ''}</Text>
          <Text style={s.texte}>{r.nom}</Text>
          <Text selectable style={s.texte}>{r.telephone}</Text>
          {r.note && <Text style={s.texte}>Précision : {r.note}</Text>}
          <Text style={s.texte}>{libelleStatutReservation(r.statut)} · {r.reference}</Text>
          {r.motif && <Text style={s.texte}>Motif : {r.motif}</Text>}
          {!demande && r.actionsPossibles.map(a => <Action key={a} titre={LIBELLES_ACTION[a] + ' ' + r.reference} secondaire={a !== 'confirmer'} disabled={occupe || verrou} agir={() => agir(r, a)} />)}
          {demande && motifPour && <>
            <Text accessibilityRole="alert" style={s.texte}>{demande.question}</Text>
            <Text style={s.texte}>Motif (3 à {MOTIF_RESERVATION_MAX} caractères)</Text>
            <TextInput ref={clavier.reference('reservation-motif-' + r.id)} onFocus={clavier.auFocus('reservation-motif-' + r.id)} onBlur={clavier.auBlur} accessibilityLabel={'Motif, réservation ' + r.reference} style={[s.champ, s.champLong]} multiline maxLength={MOTIF_RESERVATION_MAX} value={motif} onChangeText={setMotif} editable={!occupe} />
            <Text style={s.secondaire}>{motif.length} / {MOTIF_RESERVATION_MAX} caractères</Text>
            <Action titre={demande.oui} disabled={occupe || verrou} agir={() => { void controle.current?.decider(r.id, motifPour.action, { motif, confirme: true }); }} />
            <Action titre="Non, ne rien faire" secondaire disabled={occupe} agir={() => { setMotifPour(null); setMotif(''); }} />
          </>}
        </View>;
      })}
    </>}
  </View>;
}

const s = StyleSheet.create({
  bloc: { gap: 14 },
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choix: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.action, borderRadius: 22, backgroundColor: c.surface },
  choixActif: { backgroundColor: c.action },
  choixTexte: { fontFamily: polices.texte, fontWeight: '700', fontSize: 12, color: c.action },
  choixTexteActif: { color: c.surface },
  champ: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.bordure, borderRadius: 12, backgroundColor: c.surface, color: c.encre, fontFamily: polices.texte, fontSize: 16 },
  champLong: { minHeight: 90, textAlignVertical: 'top' },
  titre: { fontFamily: polices.titre, fontSize: 24, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.action, fontWeight: '700' },
});
