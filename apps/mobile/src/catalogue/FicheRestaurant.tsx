import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ZoomImage } from './ZoomImage';
import type { PlatCataloguePublic, RestaurantPublic } from '../../../../packages/shared/src/contracts/catalogue';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { Vignette } from './Vignette';
import { VignettePlat } from './MentionIllustrative';
import { badgesAffichables, enPromo, libelleAllergenesPlat, libelleCoteRestaurant, libelleHoraire, libelleStatut, libelleSupplements, titreEtatRestaurant } from './menu-groupes';
import { commandabilite, etatPlat, moyensAffichables } from './parcours-client';
import { PHRASE_MODES_COMMANDE } from './commande-reelle';
/** Affichage riche du catalogue (parité Kotlin, tranche 10.1) : en-tête de la fiche et carte d'un plat. Les montants affichés sont indicatifs : le serveur recalcule tout à la commande. */
const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
const COULEUR_TON = { succes: '#1E7A46', neutre: c.secondaire, danger: '#B3261E', attention: c.avertissement } as const;

export function Pastille({ texte, ton }: { texte: string; ton: 'succes' | 'neutre' | 'danger' | 'attention' }) {
  return <View style={[s.pastille, { borderColor: COULEUR_TON[ton] }]}><Text style={[s.pastilleTexte, { color: COULEUR_TON[ton] }]}>{texte}</Text></View>;
}

/** Badge du score qualité : seulement le palier excellent, pour ne pas transformer chaque carte en tableau de bord. */
export function BadgeScore({ palier }: { palier?: string }) {
  if (palier !== 'excellent') return null;
  return <Pastille texte="Excellent" ton="succes" />;
}

/** En-tête de la fiche : logo ou photo, lieu, état, note, fraîcheur du statut, horaires, consignes et moyens de paiement (seulement ceux que le serveur a transmis). */
export function EnteteFiche({ restaurant: r }: { restaurant: RestaurantPublic }) {
  const [photoEchouee, setPhotoEchouee] = useState<string | null>(null);
  const [zoomCouverture, setZoomCouverture] = useState(false);
  const etat = titreEtatRestaurant(r); const note = libelleCoteRestaurant(r); const horaire = libelleHoraire(r, new Date()); const statut = libelleStatut(r); const dispo = commandabilite(r); const moyens = moyensAffichables(r.moyensPaiement);
  return <View style={s.carte}>
    {r.photoUrl && photoEchouee !== r.photoUrl ? <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Photo de ${r.nom}. Touchez pour agrandir.`} onPress={() => setZoomCouverture(true)}><Image source={{ uri: r.photoUrl }} accessible={false} accessibilityIgnoresInvertColors resizeMode="cover" onError={() => setPhotoEchouee(r.photoUrl ?? null)} style={s.photo} /></Pressable> : null}
    <ZoomImage url={r.photoUrl} nom={r.nom} visible={zoomCouverture} fermer={() => setZoomCouverture(false)} onErreur={() => setPhotoEchouee(r.photoUrl ?? null)} />
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <Vignette url={r.logoUrl ?? r.photoUrl} nom={r.nom} taille={84} />
      <View style={{ flex: 1, gap: 6 }}>
        {[r.categorie, r.lieu].filter(Boolean).length > 0 && <Text style={s.texte}>{[r.categorie, r.lieu].filter(Boolean).join(' · ')}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Pastille texte={etat.texte} ton={etat.ton} />{note && <Text accessibilityLabel={`Note ${note.replace('★', '').trim()}`} style={s.secondaire}>{note}</Text>}</View>
        {badgesAffichables(r.badges).length > 0 && <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{badgesAffichables(r.badges).map(b => <Pastille key={b} texte={b} ton="neutre" />)}</View>}
        {horaire && <Text style={s.texte}>{horaire}</Text>}
        {statut && <Text style={s.secondaire}>{statut}</Text>}
      </View>
    </View>
    {dispo.commandable && <Text style={s.texte}>Commande {PHRASE_MODES_COMMANDE}.</Text>}
    {!dispo.commandable && <View accessibilityRole="alert" style={s.bandeau}><Text style={s.bandeauTitre}>{dispo.titre}</Text><Text style={s.bandeauTexte}>{dispo.message}</Text></View>}
    {r.horaires && dispo.raison !== 'ferme' ? <Text style={s.texte}>Horaires : {r.horaires}</Text> : null}
    {r.consignes ? <Text style={s.secondaire}>{r.consignes}</Text> : null}
    {moyens.length > 0 ? <Text style={s.secondaire}>Paiement accepté : {moyens.join(', ')}</Text> : null}
  </View>;
}

/** Carte d'un plat : photo, nom, description, prix payé (rouge et prix normal barré en promo), suppléments, disponibilité et ancienneté de la confirmation. */
export function CartePlat({ plat: p, ajouter, desactive, maintenant = new Date(), commandable = true, ouvrirDetail }: { plat: PlatCataloguePublic; ajouter(): void; desactive: boolean; maintenant?: Date; commandable?: boolean; ouvrirDetail?: () => void }) {
  const promo = enPromo(p); const supp = libelleSupplements(p.options);
  const { detail, ...etat } = etatPlat(p, maintenant);
  return <View style={s.carte}>
    <View style={{ flexDirection: 'row', gap: 12 }}>
    <Pressable accessibilityRole={ouvrirDetail ? 'button' : undefined} accessibilityLabel={ouvrirDetail ? `Voir le détail de ${p.nom}${p.photoUrl ? ', photo agrandissable' : ''}` : undefined} disabled={!ouvrirDetail} onPress={ouvrirDetail} style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <VignettePlat url={p.photoUrl} nom={p.nom} taille={64} illustrative={p.imageIllustrative === true} repereInteractif={!ouvrirDetail} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.nom}>{p.nom}</Text>
        {p.description !== '' && <Text style={s.texte} numberOfLines={3}>{p.description}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[s.prix, promo && { color: c.action }]}>{gnf(p.prixGnf)}</Text>
          {promo && <Text accessibilityLabel={`au lieu de ${gnf(p.prixNormalGnf!)}`} style={s.barre}>{gnf(p.prixNormalGnf!)}</Text>}
        </View>
        {supp && <Text style={s.secondaire}>{supp}</Text>}
        <Text style={s.secondaire}>{libelleAllergenesPlat(p.allergenes)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Pastille texte={etat.texte} ton={etat.ton} />{detail && <Text style={s.secondaire}>{detail}</Text>}</View>
      </View>
    </View>
    </Pressable>
      {/* « + » rond à droite de la ligne, comme dans les applis de commande : le nom accessible dit « Ajouter X au panier » ; un plat épuisé est grisé. Il est HORS de la zone cliquable du détail pour ne jamais être confondu avec elle. */}
      <View style={{ alignSelf: 'center' }}><Bouton titre={p.disponibilite === 'epuise' ? `${p.nom} épuisé` : !commandable ? `${p.nom} : commande indisponible` : `Ajouter ${p.nom} au panier`} icone="plus" iconeSeule disabled={desactive || !commandable || p.disponibilite === 'epuise'} onPress={ajouter} /></View>
    </View>
  </View>;
}
const s = StyleSheet.create({
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, padding: 16, gap: 12 },
  photo: { width: '100%', height: 168, borderRadius: 16, backgroundColor: c.bordure },
  nom: { color: c.encre, fontFamily: polices.titre, fontSize: 19 }, prix: { color: c.encre, fontFamily: polices.texte, fontSize: 15, fontWeight: '700' },
  barre: { color: c.secondaire, fontFamily: polices.texte, fontSize: 13, textDecorationLine: 'line-through' },
  texte: { color: c.encre, fontFamily: polices.texte, fontSize: 15, lineHeight: 22 }, secondaire: { color: c.secondaire, fontFamily: polices.texte, fontSize: 12, lineHeight: 19 },
  bandeau: { backgroundColor: c.avertissementFond, borderRadius: 14, padding: 12, gap: 4 }, bandeauTitre: { color: c.avertissement, fontFamily: polices.texte, fontSize: 15, fontWeight: '700' }, bandeauTexte: { color: c.avertissement, fontFamily: polices.texte, fontSize: 14, lineHeight: 20 },
  pastille: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 , alignSelf: 'flex-start' }, pastilleTexte: { fontFamily: polices.texte, fontSize: 12, fontWeight: '700' },
});
