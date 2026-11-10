import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action } from './BoutonAction';
import { creerControleDemandeReservation, type EtatControleDemande, type SessionReservationClient } from './controle-reservation-client';
import { NOTE_RESERVATION_MAX, NB_PERSONNES_MIN, libelleStatutReservation, preparerCreation } from './reservation';
import { heuresDuJour, joursProposes, libelleCreneau, libelleHeure, libelleJour, libelleJourProche, quartsDeLHeure } from '../domaine/creneaux-reservation';
import { couleurs as c, polices } from '../design/tokens';

/**
 * « Réserver une table » sur l'écran d'un restaurant (lot M4a). Le bouton n'apparaît que si le serveur dit que ce restaurant accepte les réservations ; si la lecture échoue, rien ne
 * s'affiche et le reste de l'écran n'est pas touché. Jours, heures et quarts d'heure se choisissent par boutons (heure de Conakry, jamais celle du téléphone). Un récapitulatif précède
 * l'envoi, qui est UNIQUE : un résultat incertain verrouille l'envoi jusqu'à la relecture de « Mes réservations » (voir `controle-reservation-client.ts`). Aucune règle n'est dans cet écran.
 */
export function ReserverTableReel({ session, restaurantId, restaurantNom, relireQuand = '' }: { session: SessionReservationClient; restaurantId: string; restaurantNom: string; relireQuand?: string }) {
  const [etat, setEtat] = useState<EtatControleDemande | null>(null);
  const controle = useRef<ReturnType<typeof creerControleDemandeReservation> | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [recapitulatif, setRecapitulatif] = useState(false);
  const [instant, setInstant] = useState(() => Date.now());
  const [jour, setJour] = useState<string | null>(null);
  const [heure, setHeure] = useState<number | null>(null);
  const [creneau, setCreneau] = useState<string | null>(null);
  const [nbPersonnes, setNbPersonnes] = useState(2);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [note, setNote] = useState('');
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);

  useEffect(() => { const ctl = creerControleDemandeReservation(session, setEtat); controle.current = ctl; return () => ctl.fermer(); }, [session]);
  // Lecture de la disponibilité : à l'ouverture de l'écran et quand l'utilisateur revient de son compte ou actualise le menu (jamais par minuterie).
  useEffect(() => { void controle.current?.lireDisponibilite(restaurantId); }, [restaurantId, relireQuand]);
  // Une demande enregistrée vide le formulaire : ni le nom, ni le téléphone, ni la note ne restent à l'écran.
  useEffect(() => {
    if (etat?.confirmee) { setOuvert(false); setRecapitulatif(false); setJour(null); setHeure(null); setCreneau(null); setNom(''); setTelephone(''); setNote(''); setNbPersonnes(2); }
  }, [etat?.confirmee?.id]);

  if (!etat) return null;
  const visible = etat.disponibilite === 'oui' || etat.incertain || etat.confirmee !== null;
  if (!visible) return null;
  const occupe = etat.lectureEnCours || etat.envoiEnCours || etat.relectureEnCours;
  const verrou = etat.incertain;
  const max = etat.nbPersonnesMax;
  const jours = joursProposes(instant);
  const heures = jour ? heuresDuJour(jour, instant) : [];
  const quarts = jour && heure !== null ? quartsDeLHeure(jour, heure, instant) : [];

  function ouvrirFormulaire() { setInstant(Date.now()); setOuvert(true); setRecapitulatif(false); setErreurLocale(null); controle.current?.nouvelleDemande(); }
  function continuer() {
    if (!creneau) { setErreurLocale('Choisissez un jour et une heure.'); return; }
    const p = preparerCreation({ restaurantId, creneau, nbPersonnes, nom, telephone, note });
    if (!p.ok) { setErreurLocale(p.message); return; }
    setErreurLocale(null); setRecapitulatif(true);
  }
  function envoyer() { void controle.current?.envoyer({ restaurantId, creneau, nbPersonnes, nom, telephone, note }); }

  return <View style={s.bloc}>
    <Text accessibilityRole="header" style={s.titre}>Réserver une table</Text>
    {etat.message && <Text accessibilityRole={verrou ? 'alert' : undefined} accessibilityLiveRegion="polite" style={s.texte}>{etat.message}</Text>}
    {etat.confirmee && <View style={s.carte}>
      <Text style={s.nom}>{etat.confirmee.reference}</Text>
      <Text style={s.texte}>{etat.confirmee.restaurantNom} · {libelleCreneau(etat.confirmee.creneau)} · {etat.confirmee.nbPersonnes} personne{etat.confirmee.nbPersonnes > 1 ? 's' : ''}</Text>
      <Text style={s.texte}>{libelleStatutReservation(etat.confirmee.statut)}</Text>
      <Text style={s.secondaire}>Retrouvez-la dans « Mes réservations » de votre compte.</Text>
    </View>}
    {verrou && <>
      <Text accessibilityRole="alert" style={s.texte}>Résultat à vérifier : l’envoi est bloqué tant que vos réservations n’ont pas été relues.</Text>
      <Action titre="Vérifier mes réservations" agir={() => { void controle.current?.relire(); }} disabled={etat.relectureEnCours || etat.envoiEnCours} />
    </>}
    {!ouvert && !verrou && <Action titre="Réserver une table" agir={ouvrirFormulaire} disabled={occupe} />}
    {ouvert && !recapitulatif && <View style={s.formulaire}>
      <Text style={s.etiquette}>Jour</Text>
      <View style={s.rangee}>{jours.map(j => <Pressable key={j} accessibilityRole="button" accessibilityLabel={libelleJourProche(j, instant)} accessibilityState={{ selected: jour === j }} disabled={verrou} onPress={() => { setJour(j); setHeure(null); setCreneau(null); }} style={[s.choix, jour === j && s.choixActif]}><Text style={[s.choixTexte, jour === j && s.choixTexteActif]}>{libelleJourProche(j, instant)}</Text></Pressable>)}</View>
      {jour && heures.length === 0 && <Text style={s.texte}>Plus de créneau ce jour-là. Choisissez un autre jour.</Text>}
      {jour && heures.length > 0 && <>
        <Text style={s.etiquette}>Heure ({libelleJour(jour)})</Text>
        <View style={s.rangee}>{heures.map(h => <Pressable key={h} accessibilityRole="button" accessibilityLabel={h + ' heures'} accessibilityState={{ selected: heure === h }} disabled={verrou} onPress={() => { setHeure(h); setCreneau(null); }} style={[s.choix, s.choixPetit, heure === h && s.choixActif]}><Text style={[s.choixTexte, heure === h && s.choixTexteActif]}>{h} h</Text></Pressable>)}</View>
      </>}
      {heure !== null && quarts.length > 0 && <>
        <Text style={s.etiquette}>Minutes</Text>
        <View style={s.rangee}>{quarts.map(q => <Pressable key={q} accessibilityRole="button" accessibilityLabel={libelleHeure(q)} accessibilityState={{ selected: creneau === q }} disabled={verrou} onPress={() => setCreneau(q)} style={[s.choix, s.choixPetit, creneau === q && s.choixActif]}><Text style={[s.choixTexte, creneau === q && s.choixTexteActif]}>{libelleHeure(q)}</Text></Pressable>)}</View>
      </>}
      <Text style={s.etiquette}>Nombre de personnes</Text>
      <View style={s.rangee}>
        <Pressable accessibilityRole="button" accessibilityLabel="Une personne de moins" disabled={nbPersonnes <= NB_PERSONNES_MIN} onPress={() => setNbPersonnes(n => Math.max(NB_PERSONNES_MIN, n - 1))} style={[s.choix, s.choixPetit]}><Text style={s.choixTexte}>−</Text></Pressable>
        <Text accessibilityLiveRegion="polite" style={s.nombre}>{nbPersonnes}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Une personne de plus" disabled={nbPersonnes >= max} onPress={() => setNbPersonnes(n => Math.min(max, n + 1))} style={[s.choix, s.choixPetit]}><Text style={s.choixTexte}>+</Text></Pressable>
      </View>
      <Text style={s.etiquette}>Votre nom</Text>
      <TextInput accessibilityLabel="Votre nom pour la réservation" style={s.champ} value={nom} onChangeText={setNom} maxLength={60} autoCorrect={false} autoComplete="name" />
      <Text style={s.etiquette}>Votre téléphone</Text>
      <TextInput accessibilityLabel="Votre numéro de téléphone" style={s.champ} value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" maxLength={20} autoCorrect={false} autoComplete="tel" placeholder="620 00 00 00" placeholderTextColor={c.secondaire} />
      <Text style={s.etiquette}>Une précision ? (facultatif)</Text>
      <TextInput accessibilityLabel="Une précision pour le restaurant, facultatif" style={[s.champ, s.champLong]} value={note} onChangeText={setNote} multiline maxLength={NOTE_RESERVATION_MAX} />
      <Text style={s.secondaire}>{note.length} / {NOTE_RESERVATION_MAX} caractères</Text>
      {erreurLocale && <Text accessibilityRole="alert" style={s.erreur}>{erreurLocale}</Text>}
      <Action titre="Continuer" agir={continuer} disabled={occupe || verrou} />
      <Action titre="Fermer" secondaire agir={() => setOuvert(false)} disabled={etat.envoiEnCours} />
    </View>}
    {ouvert && recapitulatif && creneau && <View style={s.formulaire}>
      <Text accessibilityRole="header" style={s.nom}>Vérifiez votre demande</Text>
      <Text style={s.texte}>Demande de réservation : table pour {nbPersonnes} personne{nbPersonnes > 1 ? 's' : ''}, {libelleJour(creneau.slice(0, 10))}, {libelleHeure(creneau)}, {restaurantNom}. Le restaurant doit la confirmer. Aucun paiement.</Text>
      {etat.envoiEnCours && <Text accessibilityLiveRegion="polite" style={s.texte}>Envoi de votre demande…</Text>}
      <Action titre="Envoyer ma demande" agir={envoyer} disabled={occupe || verrou} />
      <Action titre="Modifier" secondaire agir={() => setRecapitulatif(false)} disabled={occupe} />
    </View>}
  </View>;
}

const s = StyleSheet.create({
  bloc: { gap: 12, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  formulaire: { gap: 10 },
  carte: { gap: 6, padding: 12, borderWidth: 1, borderColor: c.bordure, borderRadius: 14, backgroundColor: c.surfaceAlt },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  choix: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.action, borderRadius: 22, backgroundColor: c.surface },
  choixPetit: { minWidth: 56, paddingHorizontal: 10 },
  choixActif: { backgroundColor: c.action },
  choixTexte: { fontFamily: polices.texte, fontWeight: '700', fontSize: 13, color: c.action },
  choixTexteActif: { color: c.surface },
  nombre: { fontFamily: polices.titre, fontSize: 24, color: c.encre, minWidth: 40, textAlign: 'center' },
  champ: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.bordure, borderRadius: 12, backgroundColor: c.surface, color: c.encre, fontFamily: polices.texte, fontSize: 16 },
  champLong: { minHeight: 80, textAlignVertical: 'top' },
  titre: { fontFamily: polices.titre, fontSize: 22, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  etiquette: { fontFamily: polices.texte, fontSize: 14, fontWeight: '700', color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.action, fontWeight: '700' },
});
