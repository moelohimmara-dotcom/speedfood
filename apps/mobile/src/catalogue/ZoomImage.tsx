import { useEffect, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { couleurs as c, polices } from '../design/tokens';
import { LIBELLE_IMAGE_ILLUSTRATIVE, DETAIL_IMAGE_ILLUSTRATIVE } from '../../../../packages/shared/src/menu/image-illustrative.ts';

const ECHELLES = [1, 1.5, 2, 3] as const;

/**
 * Photo d'un plat en plein écran, avec zoom quand une photo existe : boutons + et − (48 px), double appui pour basculer
 * entre 1× et 2× (un simple appui ne zoome jamais), déplacement au doigt dans l'image agrandie, réinitialisation.
 * L'échelle et le déplacement repartent de zéro à chaque photo et à chaque ouverture. Une photo qui ne charge pas
 * signale l'échec à l'appelant au lieu d'ouvrir un écran noir vide.
 */
export function ZoomImage({ url, nom, illustrative = false, visible, fermer, onErreur }: { url?: string | null; nom: string; illustrative?: boolean; visible: boolean; fermer(): void; onErreur?(): void }) {
  const { width } = useWindowDimensions();
  const [indexEchelle, setIndexEchelle] = useState(0);
  const [decalage, setDecalage] = useState({ x: 0, y: 0 });
  const depart = useRef({ x: 0, y: 0 });
  const dernierAppui = useRef(0);
  const echelle = ECHELLES[indexEchelle];

  useEffect(() => { setIndexEchelle(0); setDecalage({ x: 0, y: 0 }); }, [url, visible]);
  if (!url) return null;

  const fermerEtRemettre = () => { setIndexEchelle(0); setDecalage({ x: 0, y: 0 }); fermer(); };
  const changerEchelle = (index: number) => {
    const borne = Math.max(0, Math.min(ECHELLES.length - 1, index));
    setIndexEchelle(borne);
    if (borne === 0) setDecalage({ x: 0, y: 0 });
  };
  const appuiImage = () => {
    const maintenant = Date.now();
    if (maintenant - dernierAppui.current < 350) {
      dernierAppui.current = 0;
      changerEchelle(indexEchelle === 0 ? 2 : 0);
    } else {
      dernierAppui.current = maintenant;
    }
  };
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => echelle > 1,
    onMoveShouldSetPanResponder: () => echelle > 1,
    onPanResponderGrant: () => { depart.current = decalage; },
    onPanResponderMove: (_e, geste) => {
      const limite = width * (echelle - 1) / 2;
      setDecalage({
        x: Math.max(-limite, Math.min(limite, depart.current.x + geste.dx)),
        y: Math.max(-limite, Math.min(limite, depart.current.y + geste.dy)),
      });
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={fermerEtRemettre} accessibilityViewIsModal>
      <View style={s.fond}>
        <View style={s.barre}>
          <Text style={s.titre} numberOfLines={1}>{nom}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer le zoom" onPress={fermerEtRemettre} style={s.boutonRond}><Text style={s.boutonTexte}>×</Text></Pressable>
        </View>
        {illustrative && <Text style={s.mention}>{LIBELLE_IMAGE_ILLUSTRATIVE} : {DETAIL_IMAGE_ILLUSTRATIVE}</Text>}
        <View style={s.zone} {...pan.panHandlers}>
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Photo de ${nom}. Double appui pour ${echelle === 1 ? 'zoomer' : 'revenir à la taille normale'}.`} onPress={appuiImage}>
            <Image source={{ uri: url }} accessible={false} resizeMode="contain" onError={() => { fermerEtRemettre(); onErreur?.(); }} style={{ width: width - 24, height: width - 24, transform: [{ scale: echelle }, { translateX: decalage.x / Math.max(echelle, 1) }, { translateY: decalage.y / Math.max(echelle, 1) }] }} />
          </Pressable>
        </View>
        <View style={s.commandes}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoomer" accessibilityState={{ disabled: indexEchelle === ECHELLES.length - 1 }} disabled={indexEchelle === ECHELLES.length - 1} onPress={() => changerEchelle(indexEchelle + 1)} style={[s.bouton, indexEchelle === ECHELLES.length - 1 && s.boutonInactif]}><Text style={s.boutonTexte}>+</Text></Pressable>
          <Text style={s.echelle}>{echelle}×</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Dézoomer" accessibilityState={{ disabled: indexEchelle === 0 }} disabled={indexEchelle === 0} onPress={() => changerEchelle(indexEchelle - 1)} style={[s.bouton, indexEchelle === 0 && s.boutonInactif]}><Text style={s.boutonTexte}>−</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Réinitialiser le zoom" accessibilityState={{ disabled: indexEchelle === 0 }} disabled={indexEchelle === 0} onPress={() => changerEchelle(0)} style={[s.boutonLarge, indexEchelle === 0 && s.boutonInactif]}><Text style={s.boutonTexte}>Réinitialiser</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(20,14,10,0.96)' },
  barre: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 52, paddingHorizontal: 16 },
  titre: { flex: 1, color: '#FFFEFC', fontFamily: polices.titre, fontSize: 18 },
  mention: { color: '#E8DCC8', fontFamily: polices.texte, fontSize: 12, paddingHorizontal: 16, paddingTop: 6 },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  commandes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 34, paddingTop: 8 },
  bouton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,254,252,0.16)', alignItems: 'center', justifyContent: 'center' },
  boutonLarge: { height: 48, borderRadius: 24, paddingHorizontal: 16, backgroundColor: 'rgba(255,254,252,0.16)', alignItems: 'center', justifyContent: 'center' },
  boutonRond: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,254,252,0.16)', alignItems: 'center', justifyContent: 'center' },
  boutonInactif: { opacity: 0.35 },
  boutonTexte: { color: '#FFFEFC', fontFamily: polices.texte, fontSize: 16, fontWeight: '700' },
  echelle: { color: '#FFFEFC', fontFamily: polices.texte, fontSize: 15, fontWeight: '700', minWidth: 34, textAlign: 'center' },
});
