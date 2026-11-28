import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { couleurs as c, polices } from '../design/tokens';
import { Icone, type NomIcone } from '../design/Icone';
import { CHOIX_ESPACES, LIBELLE_MENU_ESPACE, QUESTION_ESPACE, choixEspace, libelleMenuEspace, type EspaceVisiteur } from './espace-visiteur';

const ICONES: Record<EspaceVisiteur, NomIcone> = { client: 'panier', restaurateur: 'restaurateur', livreur: 'livreur' };

/**
 * Question et menu déroulant « Choisir mon espace » en tête de « Mon compte » (visiteur). Aucun choix d'avance ; les trois options tiennent sans défiler.
 * TalkBack annonce le nom du menu, son état (développé ou réduit) et l'espace sélectionné ; chaque option est un bouton radio.
 */
export function SelecteurEspace({ espace, choisir }: { espace: EspaceVisiteur | null; choisir(e: EspaceVisiteur): void }) {
  const [ouvert, setOuvert] = useState(espace === null);
  const choisi = choixEspace(espace);
  return <View style={st.bloc}>
    <Text accessibilityRole="header" style={st.question}>{QUESTION_ESPACE}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={libelleMenuEspace(espace)} accessibilityHint={ouvert ? 'Touchez pour replier la liste.' : 'Touchez pour afficher les trois espaces.'}
      accessibilityState={{ expanded: ouvert }} onPress={() => setOuvert(o => !o)} style={[st.menu, ouvert && st.menuOuvert]}>
      {choisi && <Icone nom={ICONES[choisi.espace]} couleur={c.action} />}
      <Text style={[st.menuTexte, !choisi && st.menuVide]}>{choisi ? `${choisi.titre} · ${choisi.texte}` : LIBELLE_MENU_ESPACE}</Text>
      <Icone nom={ouvert ? 'bas' : 'chevron'} couleur={c.secondaire} taille={20} />
    </Pressable>
    {ouvert && <View accessibilityRole="radiogroup" accessibilityLabel={LIBELLE_MENU_ESPACE} style={st.liste}>
      {CHOIX_ESPACES.map(o => {
        const actif = o.espace === espace;
        return <Pressable key={o.espace} accessibilityRole="radio" accessibilityState={{ checked: actif }} accessibilityLabel={`${o.titre}, ${o.texte}`}
          onPress={() => { setOuvert(false); choisir(o.espace); }} style={[st.option, actif && st.optionActive]}>
          <View style={[st.pastille, actif && st.pastilleActive]}><Icone nom={ICONES[o.espace]} couleur={actif ? c.surface : c.action} taille={20} /></View>
          <View style={{ flex: 1 }}><Text style={st.optionTitre}>{o.titre}</Text><Text style={st.optionTexte}>{o.texte}</Text></View>
        </Pressable>;
      })}
    </View>}
  </View>;
}

const st = StyleSheet.create({
  bloc: { gap: 10 },
  question: { fontFamily: polices.titre, fontSize: 21, lineHeight: 27, color: c.encre },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, borderColor: c.champBordure, backgroundColor: c.surface },
  menuOuvert: { borderColor: c.action },
  menuTexte: { flex: 1, fontFamily: polices.texte, fontSize: 16, color: c.encre, fontWeight: '700' },
  menuVide: { color: c.secondaire, fontWeight: '400' },
  liste: { gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: c.bordure, backgroundColor: c.surface },
  optionActive: { borderColor: c.action, backgroundColor: c.actionTeinte },
  pastille: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.actionTeinte, alignItems: 'center', justifyContent: 'center' },
  pastilleActive: { backgroundColor: c.action },
  optionTitre: { fontFamily: polices.texte, fontSize: 16, fontWeight: '700', color: c.encre },
  optionTexte: { fontFamily: polices.texte, fontSize: 14, color: c.secondaire },
});
