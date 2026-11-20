import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone } from '../design/Icone';
import { couleurs as c, polices } from '../design/tokens';
import { ONGLETS, libelleBadge, libelleOnglet, type IdOnglet } from './onglets';
/** Barre d'onglets fixe du client (parité Kotlin, G18) : icône et mot court, onglet actif marqué, pastille du nombre d'articles sur « Panier ». Zones tactiles de 56 px au moins. */
export function BarreOnglets({ actif, articles, commandeEnCours = false, choisir }: { actif: IdOnglet; articles: number; commandeEnCours?: boolean; choisir(id: IdOnglet): void }) {
  const insets = useSafeAreaInsets();
  return <View accessibilityRole="tablist" style={[s.barre, { paddingBottom: Math.max(insets.bottom, 6) }]}>
    {ONGLETS.map(o => {
      const choisi = o.id === actif; const badge = o.id === 'panier' ? libelleBadge(articles) : null;
      return <Pressable key={o.id} accessibilityRole="tab" accessibilityState={{ selected: choisi }} accessibilityLabel={o.id === 'commandes' && commandeEnCours ? 'Commandes, une commande en cours' : libelleOnglet(o.id, articles)} onPress={() => choisir(o.id)} style={s.onglet}>
        <View style={s.icone}>
          <View collapsable={false} style={[s.pastille, choisi && s.pastilleActive]} />
          <Icone nom={o.icone} taille={24} couleur={choisi ? c.encre : c.secondaire} />
          {o.id === 'commandes' && commandeEnCours && <View style={s.point} />}
          {badge && <View style={s.badge}><Text maxFontSizeMultiplier={1.2} style={s.badgeTexte}>{badge}</Text></View>}
        </View>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[s.libelle, choisi && s.libelleActif]}>{o.libelle}</Text>
      </Pressable>;
    })}
  </View>;
}
const s = StyleSheet.create({
  barre: { flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.bordure, paddingTop: 6, paddingHorizontal: 4 },
  onglet: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icone: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center' },
  // Fond de la pastille : vue à part, découpée en arrondi (overflow hidden) ; un rayon porté par la vue qui change de fond n'était pas appliqué sur Android pour Commandes, Panier et Compte.
  pastille: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 15, overflow: 'hidden', backgroundColor: 'transparent' },
  pastilleActive: { backgroundColor: c.mangue },
  badge: { position: 'absolute', top: -4, right: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' },
  point: { position: 'absolute', top: 0, right: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: c.action, borderWidth: 1.5, borderColor: c.surface },
  badgeTexte: { color: c.surface, fontFamily: polices.texte, fontSize: 11, fontWeight: '700' },
  libelle: { fontFamily: polices.texte, fontSize: 12, color: c.secondaire },
  libelleActif: { color: c.encre, fontWeight: '700' },
});
