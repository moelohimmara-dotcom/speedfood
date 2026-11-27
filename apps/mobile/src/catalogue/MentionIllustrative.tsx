import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { DETAIL_IMAGE_ILLUSTRATIVE, LIBELLE_IMAGE_ILLUSTRATIVE } from '../../../../packages/shared/src/menu/image-illustrative.ts';
import { polices } from '../design/tokens';
import { Vignette } from './Vignette';

/**
 * Vignette d'un plat avec, quand son image est générée par ordinateur, un petit repère « i » discret dans l'angle (le serveur ne le signale que si l'interrupteur
 * « Image illustrative » de la console est allumé). Un appui affiche « Image illustrative » et sa précision : l'appli n'a pas de survol, l'appui est son équivalent.
 */
export function VignettePlat({ url, nom, taille, illustrative = false, repereInteractif = true }: { url?: string | null; nom: string; taille: number; illustrative?: boolean; repereInteractif?: boolean }) {
  const visible = illustrative && !!url;
  return <View style={{ width: taille, height: taille }}>
    <Vignette url={url} nom={nom} taille={taille} />
    {visible && (repereInteractif ? <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LIBELLE_IMAGE_ILLUSTRATIVE}. Appuyez pour en savoir plus.`}
      hitSlop={12}
      onPress={() => Alert.alert(LIBELLE_IMAGE_ILLUSTRATIVE, DETAIL_IMAGE_ILLUSTRATIVE)}
      style={s.repere}
    ><Text accessible={false} style={s.lettre}>i</Text></Pressable> : <View accessible={false} style={s.repere}><Text accessible={false} style={s.lettre}>i</Text></View>)}
  </View>;
}
const s = StyleSheet.create({
  repere: { position: 'absolute', right: 3, bottom: 3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(43,33,29,0.62)' },
  lettre: { color: '#FFFEFC', fontFamily: polices.texte, fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
