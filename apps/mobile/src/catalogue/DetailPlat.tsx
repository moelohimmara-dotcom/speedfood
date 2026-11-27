import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { Pastille } from './FicheRestaurant';
import { enPromo, libelleAllergenesPlat } from './menu-groupes';
import { etatPlat } from './parcours-client';
import { ZoomImage } from './ZoomImage';
import { DETAIL_IMAGE_ILLUSTRATIVE, LIBELLE_IMAGE_ILLUSTRATIVE } from '../../../../packages/shared/src/menu/image-illustrative.ts';

const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';

/**
 * Fiche complète d'un plat, ouverte en touchant sa carte : grande photo cliquable (zoom plein écran quand une photo existe),
 * description entière, prix et promotion, allergènes, suppléments avec prix, disponibilité et ajout au panier.
 * Sans photo, la fiche reste complète et aucun zoom n'est proposé.
 */
export function DetailPlat({ plat: p, fermer, ajouter, desactive, maintenant = new Date(), commandable = true }: { plat: PlatCataloguePublic | null; fermer(): void; ajouter(plat: PlatCataloguePublic): void; desactive: boolean; maintenant?: Date; commandable?: boolean }) {
  const [zoom, setZoom] = useState(false);
  const [photoEchouee, setPhotoEchouee] = useState<string | null>(null);
  // À chaque plat, zoom et échec de photo repartent de zéro : rien ne fuit d'une fiche à l'autre.
  useEffect(() => { setZoom(false); setPhotoEchouee(null); }, [p?.id]);
  if (!p) return null;
  const promo = enPromo(p);
  const { detail, ...etat } = etatPlat(p, maintenant);
  const aPhoto = !!p.photoUrl && photoEchouee !== p.photoUrl;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={fermer} accessibilityViewIsModal>
      <View style={s.fond}>
        <View style={s.feuille}>
          <View style={s.barre}>
            <Text style={s.titreBarre} numberOfLines={1}>Détail du plat</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer le détail" onPress={fermer} style={s.fermer}><Text style={s.fermerTexte}>×</Text></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, gap: 12 }}>
            {aPhoto ? (
              <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Photo de ${p.nom}. Touchez pour agrandir.`} onPress={() => setZoom(true)}>
                <Image source={{ uri: p.photoUrl! }} accessible={false} resizeMode="cover" onError={() => setPhotoEchouee(p.photoUrl ?? null)} style={s.grandePhoto} />
                <Text style={s.indiceZoom}>Touchez la photo pour l’agrandir</Text>
                {p.imageIllustrative === true && <Text style={s.secondaire}>{LIBELLE_IMAGE_ILLUSTRATIVE} : {DETAIL_IMAGE_ILLUSTRATIVE}</Text>}
              </Pressable>
            ) : (
              <View style={s.sansPhoto}><Text style={s.sansPhotoTexte}>Aucune photo pour ce plat</Text></View>
            )}
            <Text accessibilityRole="header" style={s.nom}>{p.nom}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[s.prix, promo && { color: c.action }]}>{gnf(p.prixGnf)}</Text>
              {promo && <Text accessibilityLabel={`au lieu de ${gnf(p.prixNormalGnf!)}`} style={s.barrePrix}>{gnf(p.prixNormalGnf!)}</Text>}
            </View>
            {p.description !== '' && <Text style={s.texte}>{p.description}</Text>}
            <Text style={s.texte}>{libelleAllergenesPlat(p.allergenes)}</Text>
            {(p.options?.length ?? 0) > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={s.sousTitre}>Suppléments disponibles</Text>
                {(p.options ?? []).map((o) => (
                  <View key={o.id} style={s.ligneOption}>
                    <Text style={s.texte}>{o.nom}</Text>
                    <Text style={s.texte}>{o.prixGnf > 0 ? `+ ${gnf(o.prixGnf)}` : 'Gratuit'}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Pastille texte={etat.texte} ton={etat.ton} />{detail && <Text style={s.secondaire}>{detail}</Text>}</View>
            <Bouton titre={p.disponibilite === 'epuise' ? `${p.nom} épuisé` : !commandable ? 'Commande indisponible' : `Ajouter ${p.nom} au panier`} disabled={desactive || !commandable || p.disponibilite === 'epuise'} onPress={() => { fermer(); ajouter(p); }} />
          </ScrollView>
        </View>
      </View>
      <ZoomImage url={p.photoUrl} nom={p.nom} illustrative={p.imageIllustrative === true} visible={zoom} fermer={() => setZoom(false)} onErreur={() => setPhotoEchouee(p.photoUrl ?? null)} />
    </Modal>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(43,33,29,0.45)', justifyContent: 'flex-end' },
  feuille: { backgroundColor: c.fond, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  barre: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 14 },
  titreBarre: { flex: 1, color: c.encre, fontFamily: polices.titre, fontSize: 17 },
  fermer: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, alignItems: 'center', justifyContent: 'center' },
  fermerTexte: { color: c.encre, fontFamily: polices.texte, fontSize: 17, fontWeight: '700' },
  grandePhoto: { width: '100%', height: 260, borderRadius: 18, backgroundColor: c.bordure },
  indiceZoom: { color: c.action, fontFamily: polices.texte, fontSize: 13, fontWeight: '700', paddingTop: 8 },
  sansPhoto: { height: 120, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, alignItems: 'center', justifyContent: 'center' },
  sansPhotoTexte: { color: c.secondaire, fontFamily: polices.texte, fontSize: 14 },
  nom: { color: c.encre, fontFamily: polices.titre, fontSize: 24 },
  prix: { color: c.encre, fontFamily: polices.texte, fontSize: 19, fontWeight: '700' },
  barrePrix: { color: c.secondaire, fontFamily: polices.texte, fontSize: 14, textDecorationLine: 'line-through' },
  texte: { color: c.encre, fontFamily: polices.texte, fontSize: 15, lineHeight: 22 },
  secondaire: { color: c.secondaire, fontFamily: polices.texte, fontSize: 12, lineHeight: 19 },
  sousTitre: { color: c.encre, fontFamily: polices.titre, fontSize: 16 },
  ligneOption: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
