import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { actionReglement, preparerDeclaration, type ModeReglement, type VerdictDeclaration } from './reglement';
import type { ResumeSuivi } from './commandes';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Bloc « Régler le restaurant » du suivi (lot C). Speedfood ne reçoit pas l'argent : le client règle le restaurant avec son code marchand (ou en espèces), puis le DÉCLARE ;
 * le restaurateur confirme. Rien n'est proposé avant l'acceptation. Aucun paiement en ligne. Le parent fournit `declarer` (un seul essai, relecture du suivi ensuite).
 */
export function ReglementReel({ suivi, occupe, declarer }: { suivi: ResumeSuivi; occupe: boolean; declarer(mode: ModeReglement, reference: string | null): Promise<VerdictDeclaration | null> }) {
  const action = actionReglement({ statutCommande: suivi.statut, propositionActive: suivi.propositionEnAttente, paiement: suivi.paiement });
  const [choix, setChoix] = useState<ModeReglement | null>(null);
  const [reference, setReference] = useState('');
  const [verdict, setVerdict] = useState<VerdictDeclaration | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);

  if (action.genre === 'rien' && action.message === null) return null;
  const bloque = occupe || envoi;
  const mobile = choix !== null && choix !== 'especes';
  const options = action.genre === 'declarer' || action.genre === 'modifier' ? action.options : [];

  async function envoyer() {
    if (verrou.current || choix === null || action.genre === 'rien' || action.genre === 'indisponible') return;
    const prep = preparerDeclaration(choix, reference, options);
    if (!prep.ok) { setErreur(prep.message); return; }
    verrou.current = true; setEnvoi(true); setErreur(null); setVerdict(null);
    try { const v = await declarer(prep.mode, prep.reference); if (v) setVerdict(v); }
    finally { verrou.current = false; setEnvoi(false); }
  }

  return <View style={s.carte}>
    <Text accessibilityRole="header" style={s.nom}>Régler le restaurant</Text>
    <Text style={s.texte}>{action.message}</Text>
    {(action.genre === 'declarer' || action.genre === 'modifier') && <>
      <Text style={s.secondaire}>Speedfood ne reçoit pas votre argent : vous réglez directement le restaurant, qui confirme ensuite l’avoir reçu. Le paiement en ligne n’est pas encore disponible.</Text>
      {options.map(o => <Pressable key={o.mode} accessibilityRole="radio" accessibilityLabel={o.libelle} accessibilityState={{ selected: choix === o.mode, disabled: bloque }} disabled={bloque} onPress={() => { setChoix(o.mode); setErreur(null); setVerdict(null); }} style={[s.option, choix === o.mode && s.optionChoisie]}>
        <Text style={s.nom}>{o.libelle}</Text>
        {o.code !== null ? <Text selectable style={s.texte}>Code marchand : {o.code}</Text> : <Text style={s.texte}>Vous réglez en espèces au restaurant.</Text>}
      </Pressable>)}
      {mobile && <>
        <Text style={s.texte}>Référence de la transaction (facultatif)</Text>
        <TextInput accessibilityLabel="Référence de la transaction" value={reference} onChangeText={setReference} maxLength={40} autoCapitalize="none" autoCorrect={false} editable={!bloque} style={s.champ} />
        <Text style={s.secondaire}>4 à 40 lettres, chiffres, points ou tirets.</Text>
      </>}
      {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={choix === 'especes' ? 'Je paierai en espèces' : 'J’ai payé'} disabled={bloque || choix === null} accessibilityState={{ disabled: bloque || choix === null }} onPress={() => { void envoyer(); }} style={[s.bouton, (bloque || choix === null) && s.inactif]}>
        <Text style={s.boutonTexte}>{envoi ? 'Envoi…' : choix === 'especes' ? 'Je paierai en espèces' : 'J’ai payé'}</Text>
      </Pressable>
    </>}
    {verdict && <Text accessibilityRole={verdict.genre === 'confirme' ? undefined : 'alert'} accessibilityLiveRegion="polite" style={s.texte}>{verdict.message}</Text>}
  </View>;
}

const s = StyleSheet.create({
  carte: { gap: 12, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surfaceAlt },
  option: { gap: 6, padding: 14, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, backgroundColor: c.surface },
  optionChoisie: { borderColor: c.action, borderWidth: 2 },
  nom: { fontFamily: polices.titre, fontSize: 19, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  champ: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, padding: 16, minHeight: 54, fontFamily: polices.texte, fontSize: 16, color: c.encre },
  bouton: { backgroundColor: c.action, minHeight: 48, padding: 14, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  inactif: { opacity: 0.5 },
  boutonTexte: { color: c.surface, fontFamily: polices.texte, fontWeight: '700' },
});
