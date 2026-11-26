import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LIBELLE_IMAGE_ILLUSTRATIVE } from '../../../../packages/shared/src/menu/image-illustrative.ts';
import { couleurs as c, polices } from '../design/tokens';
/**
 * Couverture d'une carte de restaurant : la photo d'un de ses plats (choisie par le serveur). Décorative : le nom du restaurant est toujours lu à côté.
 * Quand l'image est générée par ordinateur (le serveur ne le signale que si l'interrupteur « Image illustrative » de la console est allumé), la mention est écrite
 * en toutes lettres sur l'image, et non dans un bouton : la carte entière est déjà un bouton. Une image qui ne se charge pas disparaît : jamais de trou dans la mise en page.
 */
export function CouvertureRestaurant({ url, illustrative = false, hauteur = 120 }: { url: string; illustrative?: boolean; hauteur?: number }) {
  const [echec, setEchec] = useState(false);
  if (echec) return null;
  return <View style={{ height: hauteur }}>
    <Image source={{ uri: url }} accessible={false} accessibilityIgnoresInvertColors resizeMode="cover" onError={() => setEchec(true)} style={[s.image, { height: hauteur }]} />
    {illustrative && <View style={s.mention}><Text style={s.mentionTexte}>{LIBELLE_IMAGE_ILLUSTRATIVE}</Text></View>}
  </View>;
}
const s = StyleSheet.create({
  image: { width: '100%', borderRadius: 14, backgroundColor: c.bordure },
  mention: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(43,33,29,0.72)' },
  mentionTexte: { color: '#FFFEFC', fontFamily: polices.texte, fontSize: 11, lineHeight: 14 },
});
