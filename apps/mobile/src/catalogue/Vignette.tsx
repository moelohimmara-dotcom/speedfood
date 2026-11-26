import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { couleurs as c, polices } from '../design/tokens';
/**
 * Vignette d'un restaurant ou d'un plat (parité Kotlin, tranche 10.1). L'adresse arrive déjà filtrée en HTTPS ; une image absente ou qui ne se charge pas laisse une pastille
 * avec l'initiale du nom : jamais de trou dans la mise en page. Décorative : le nom est toujours lu à côté.
 */
export function Vignette({ url, nom, taille }: { url?: string | null; nom: string; taille: number }) {
  const [echec, setEchec] = useState(false);
  const rayon = Math.round(taille / 5);
  if (!url || echec) {
    const initiale = nom.trim().charAt(0).toUpperCase() || '•';
    return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.vide, { width: taille, height: taille, borderRadius: rayon }]}><Text style={{ fontFamily: polices.titre, fontSize: Math.round(taille / 2.4), color: c.secondaire }}>{initiale}</Text></View>;
  }
  return <Image source={{ uri: url }} accessible={false} accessibilityIgnoresInvertColors resizeMode="cover" onError={() => setEchec(true)} style={{ width: taille, height: taille, borderRadius: rayon, backgroundColor: c.bordure }} />;
}
const s = StyleSheet.create({ vide: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.fond, borderWidth: 1, borderColor: c.bordure } });
