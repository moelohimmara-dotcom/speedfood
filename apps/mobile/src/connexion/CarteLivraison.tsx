import { useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { couleurs as c, polices } from '../design/tokens';
import { TAILLE_TUILE, composerCarte, type CleRepere, type PointsCarte } from './carte-tuiles';
/**
 * Carte de la livraison : restaurant, adresse de livraison, livreur (et le client lui-même s'il a choisi de se localiser). Tuiles OpenStreetMap posées par `composerCarte`, repères en vues
 * (aucune image de repère). Décorative pour un lecteur d'écran : `description` en dit l'essentiel. Si les tuiles ne se chargent pas (réseau), les repères restent affichés sur un fond uni.
 * Les tuiles publiques d'OpenStreetMap conviennent à un petit volume ; au-delà, prévoir un fournisseur de tuiles.
 */
const HAUTEUR = 220;
const AGENT = 'Speedfood/3 (+https://speedfood-app.moelohimmara.workers.dev)';
const REPERES: Record<CleRepere, { lettre: string; nom: string; fond: string }> = {
  restaurant: { lettre: 'R', nom: 'restaurant', fond: c.encre },
  destination: { lettre: 'A', nom: 'adresse de livraison', fond: c.action },
  livreur: { lettre: 'L', nom: 'livreur', fond: c.succes },
  vous: { lettre: 'V', nom: 'vous', fond: c.orange },
};
const ORDRE: readonly CleRepere[] = ['restaurant', 'destination', 'vous', 'livreur'];
export function CarteLivraison({ points, description }: { points: PointsCarte; description: string }) {
  const [largeur, setLargeur] = useState(0);
  const vue = largeur > 0 ? composerCarte(points, largeur, HAUTEUR) : null;
  const mesurer = (e: LayoutChangeEvent) => { const l = Math.floor(e.nativeEvent.layout.width); if (l !== largeur) setLargeur(l); };
  const presents = ORDRE.filter(cle => !!points[cle]);
  return <View style={{ gap: 6 }}>
    <View onLayout={mesurer} accessible accessibilityRole="image" accessibilityLabel={description} style={s.cadre}>
      {vue !== null && <View importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        {vue.tuiles.map(t => <Image key={`${t.gauche}:${t.haut}`} accessible={false} source={{ uri: t.url, headers: { 'User-Agent': AGENT } }} style={{ position: 'absolute', left: t.gauche, top: t.haut, width: TAILLE_TUILE, height: TAILLE_TUILE }} />)}
        {vue.reperes.map(r => <View key={r.cle} style={[s.repere, { left: r.gauche - 13, top: r.haut - 13, backgroundColor: REPERES[r.cle].fond }]}><Text style={s.lettre}>{REPERES[r.cle].lettre}</Text></View>)}
        <Text style={s.attribution}>© OpenStreetMap</Text>
      </View>}
    </View>
    <Text style={s.legende}>{presents.map(cle => `${REPERES[cle].lettre} ${REPERES[cle].nom}`).join(' · ')}</Text>
  </View>;
}
const s = StyleSheet.create({
  cadre: { height: HAUTEUR, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.bordure, backgroundColor: c.surfaceAlt },
  repere: { position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  lettre: { fontFamily: polices.texte, fontSize: 13, fontWeight: '700', color: c.surface },
  attribution: { position: 'absolute', right: 4, bottom: 2, fontFamily: polices.texte, fontSize: 10, color: c.encre, backgroundColor: 'rgba(255,254,252,0.8)', paddingHorizontal: 3 },
  legende: { fontFamily: polices.texte, fontSize: 12, color: c.secondaire },
});
