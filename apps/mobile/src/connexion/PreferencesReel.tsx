import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { gestion } from './gestion';
import { ErreurConnexion } from './client';
import { CUISINES_PROPOSEES, ErreurPreferences, FORMULAIRE_VIDE, LIBELLES_PIMENT, LIBELLES_REGIMES, LISTE_ALLERGENES, MESSAGE_AVERTISSEMENT_ALLERGIES, TEXTE_CONSENTEMENT_SANTE, basculer, corpsDepuisFormulaire, formulaireDepuis, type FormulairePreferences } from './preferences-client';
import { REGIMES, type NiveauPiment } from '../../../../packages/shared/src/menu/classement-personnalise';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';

/**
 * « Mes préférences et allergies » : goûts, régimes, piment, budget, notes, mots à éviter et ALLERGIES. Elles servent à classer les restaurants qui proposent le plat recherché ;
 * le classement se fait sur le téléphone. Les allergies exigent un consentement explicite et se suppriment à tout moment (« Tout effacer »). Chaque écriture : un seul essai,
 * jamais rejouée toute seule ; après un refus ou un résultat incertain, l'état réel est relu.
 */
export function PreferencesReel({ ouvert, fermer, sessionTerminee }: { ouvert: boolean; fermer(): void; sessionTerminee(): void }) {
  const [form, setForm] = useState<FormulairePreferences>(FORMULAIRE_VIDE);
  const [attente, setAttente] = useState(false); const [erreur, setErreur] = useState<string | null>(null); const [message, setMessage] = useState('');
  const [confirmerEffacement, setConfirmerEffacement] = useState(false); const [mot, setMot] = useState('');
  const enCours = useRef(false); const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  function traiter(e: unknown) {
    if (e instanceof ErreurConnexion && e.definitive) { sessionTerminee(); return; }
    if (e instanceof ErreurPreferences && e.genre === 'session') { sessionTerminee(); return; }
    setErreur(e instanceof ErreurPreferences || e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.');
  }
  async function relire() { const p = await gestion.preferencesClient(); if (actif.current) setForm(formulaireDepuis(p)); }
  async function seul(tache: () => Promise<void>) {
    if (enCours.current) return;
    enCours.current = true; setAttente(true); setErreur(null); setMessage('');
    try { await tache(); } catch (e) { if (actif.current) traiter(e); } finally { enCours.current = false; if (actif.current) setAttente(false); }
  }
  useEffect(() => {
    if (!ouvert) return;
    setErreur(null); setMessage(''); setConfirmerEffacement(false); setMot('');
    void seul(relire);
  }, [ouvert]);

  const enregistrer = () => seul(async () => {
    const r = corpsDepuisFormulaire(form);
    if (!r.ok) { setErreur(r.erreur); return; }
    try { await gestion.enregistrerPreferences(r.corps); if (actif.current) setMessage('Préférences enregistrées.'); }
    catch (e) { if (e instanceof ErreurPreferences && e.genre !== 'session') { try { await relire(); } catch { /* l'erreur d'origine suffit */ } } throw e; }
    await relire();
  });
  const effacer = () => seul(async () => { setConfirmerEffacement(false); try { await gestion.effacerPreferences(); setMessage('Toutes vos préférences, allergies comprises, ont été effacées.'); } finally { try { await relire(); } catch { /* relecture facultative */ } } });
  function ajouterMot() { const t = mot.trim(); if (t === '' || t.length > 40 || form.evitements.length >= 20 || form.evitements.some(x => x.toLowerCase() === t.toLowerCase())) return; setForm({ ...form, evitements: [...form.evitements, t] }); setMot(''); }

  const Puce = ({ libelle, choisi, onPress }: { libelle: string; choisi: boolean; onPress(): void }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: choisi }} onPress={onPress} style={[s.puce, choisi && s.puceChoisie]}><Text style={[s.puceTexte, choisi && { fontWeight: '700' }]}>{libelle}</Text></Pressable>;
  return <Modal visible={ouvert} animationType="slide" onRequestClose={fermer}><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}><ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
    <Bouton titre="Fermer" icone="retour" iconeSeule secondaire onPress={fermer} />
    <Text accessibilityRole="header" style={s.titre}>Mes préférences et allergies</Text>
    <Text style={s.secondaire}>Elles servent à classer les restaurants qui proposent le plat que vous cherchez. Le classement se fait sur votre téléphone.</Text>
    {attente && <View accessibilityLiveRegion="polite" style={s.ligne}><ActivityIndicator color={c.action} /><Text style={s.secondaire}>Un instant…</Text></View>}
    {erreur && <Text accessibilityRole="alert" style={s.erreur}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.succes}>{message}</Text>}

    <Text accessibilityRole="header" style={s.nom}>Allergies</Text>
    <Text style={s.secondaire}>{MESSAGE_AVERTISSEMENT_ALLERGIES}</Text>
    <View style={s.puces}>{LISTE_ALLERGENES.map(a => <Puce key={a.id} libelle={a.libelle} choisi={form.allergies.includes(a.id)} onPress={() => setForm({ ...form, allergies: basculer(form.allergies, a.id) })} />)}</View>
    {form.allergies.length > 0 && <View style={s.consentement}>
      <Switch accessibilityLabel="Consentement à l’enregistrement des allergies" value={form.consentement} onValueChange={v => setForm({ ...form, consentement: v })} trackColor={{ true: c.action, false: c.bordure }} />
      <Text style={[s.texte, { flex: 1 }]}>{TEXTE_CONSENTEMENT_SANTE}</Text>
    </View>}

    <Text accessibilityRole="header" style={s.nom}>Régime</Text>
    <View style={s.puces}>{REGIMES.map(r => <Puce key={r} libelle={LIBELLES_REGIMES[r]} choisi={form.regimes.includes(r)} onPress={() => setForm({ ...form, regimes: basculer(form.regimes, r) })} />)}</View>

    <Text accessibilityRole="header" style={s.nom}>Cuisines que j’aime</Text>
    <View style={s.puces}>{CUISINES_PROPOSEES.map(x => <Puce key={x} libelle={x} choisi={form.cuisines.includes(x)} onPress={() => setForm({ ...form, cuisines: form.cuisines.includes(x) ? form.cuisines.filter(y => y !== x) : form.cuisines.length >= 12 ? form.cuisines : [...form.cuisines, x] })} />)}</View>

    <Text accessibilityRole="header" style={s.nom}>Piment</Text>
    <View style={s.puces}>{(['aucun', 'doux', 'fort'] as NiveauPiment[]).map(p => <Puce key={p} libelle={LIBELLES_PIMENT[p]} choisi={form.piment === p} onPress={() => setForm({ ...form, piment: form.piment === p ? null : p })} />)}</View>

    <Text accessibilityRole="header" style={s.nom}>Budget maximum par plat (GNF)</Text>
    <TextInput accessibilityLabel="Budget maximum par plat en GNF" keyboardType="number-pad" placeholder="Par exemple 60 000" placeholderTextColor={c.secondaire} value={form.budget} onChangeText={t => setForm({ ...form, budget: t })} style={s.champ} />

    <Text accessibilityRole="header" style={s.nom}>Ce que j’évite</Text>
    <View style={s.puces}>{form.evitements.map(x => <Puce key={x} libelle={x + '  ×'} choisi onPress={() => setForm({ ...form, evitements: form.evitements.filter(y => y !== x) })} />)}</View>
    <View style={s.ligne}><TextInput accessibilityLabel="Ajouter un ingrédient à éviter" placeholder="Par exemple oignon" placeholderTextColor={c.secondaire} value={mot} onChangeText={setMot} onSubmitEditing={ajouterMot} maxLength={40} style={[s.champ, { flex: 1 }]} /><Bouton titre="Ajouter" secondaire icone="plus" onPress={ajouterMot} /></View>

    <Text accessibilityRole="header" style={s.nom}>Notes spéciales</Text>
    <TextInput accessibilityLabel="Notes spéciales" multiline maxLength={500} placeholder="Par exemple : sans coriandre, plat bien cuit…" placeholderTextColor={c.secondaire} value={form.notes} onChangeText={t => setForm({ ...form, notes: t })} style={[s.champ, { minHeight: 90, textAlignVertical: 'top' }]} />
    <Text style={s.secondaire}>« sans oignon », « pas de coriandre » ou « j’évite le piment » sont compris et signalés à côté des plats.</Text>

    <Bouton titre="Enregistrer" icone="coche" disabled={attente} onPress={() => { void enregistrer(); }} />
    {confirmerEffacement
      ? <><Text accessibilityRole="alert" style={s.texte}>Tout effacer ? Vos allergies et toutes vos préférences seront supprimées de votre compte.</Text>
        <Bouton titre="Tout effacer" variante="danger" icone="corbeille" disabled={attente} onPress={() => { void effacer(); }} /><Bouton titre="Retour" secondaire disabled={attente} onPress={() => setConfirmerEffacement(false)} /></>
      : <Bouton titre="Tout effacer" variante="danger" icone="corbeille" disabled={attente} onPress={() => setConfirmerEffacement(true)} />}
  </ScrollView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({
  contenu: { padding: 22, gap: 14, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 48 },
  titre: { fontFamily: polices.titre, fontSize: 30, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre, marginTop: 8 },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: c.danger, backgroundColor: c.dangerFond, padding: 12, borderRadius: 12 },
  succes: { fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: c.succes, backgroundColor: c.succesFond, padding: 12, borderRadius: 12 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: c.contour, backgroundColor: c.surface, justifyContent: 'center' },
  puceChoisie: { backgroundColor: c.mangue, borderColor: c.encre },
  puceTexte: { fontFamily: polices.texte, fontSize: 14, color: c.encre },
  consentement: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.avertissementFond, borderRadius: 14, padding: 12 },
  champ: { minHeight: 50, borderWidth: 1, borderColor: c.champBordure, borderRadius: 14, backgroundColor: c.surface, paddingHorizontal: 14, fontFamily: polices.texte, fontSize: 15, color: c.encre },
});
