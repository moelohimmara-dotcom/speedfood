import { StyleSheet, Text, View } from 'react-native';
import type { PlatCataloguePublic, RestaurantPublic } from '../../../../packages/shared/src/contracts/catalogue';
import { ancienneteLisible } from '../../../../packages/shared/src/disponibilite/etat';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { Vignette } from './Vignette';
import { enPromo, libelleNote, libelleStatut, libelleSupplements, titreEtatRestaurant } from './menu-groupes';
/** Affichage riche du catalogue (parité Kotlin, tranche 10.1) : en-tête de la fiche et carte d'un plat. Les montants affichés sont indicatifs : le serveur recalcule tout à la commande. */
const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
const COULEUR_TON = { succes: '#1E7A46', neutre: c.secondaire, danger: '#B3261E' } as const;

export function Pastille({ texte, ton }: { texte: string; ton: 'succes' | 'neutre' | 'danger' }) {
  return <View style={[s.pastille, { borderColor: COULEUR_TON[ton] }]}><Text style={[s.pastilleTexte, { color: COULEUR_TON[ton] }]}>{texte}</Text></View>;
}

/** En-tête de la fiche : logo ou photo, lieu, état, note, fraîcheur du statut, horaires, consignes et moyens de paiement (seulement ceux que le serveur a transmis). */
export function EnteteFiche({ restaurant: r }: { restaurant: RestaurantPublic }) {
  const etat = titreEtatRestaurant(r); const note = libelleNote(r); const statut = libelleStatut(r);
  return <View style={s.carte}>
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <Vignette url={r.logoUrl ?? r.photoUrl} nom={r.nom} taille={84} />
      <View style={{ flex: 1, gap: 6 }}>
        {[r.categorie, r.lieu].filter(Boolean).length > 0 && <Text style={s.texte}>{[r.categorie, r.lieu].filter(Boolean).join(' · ')}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Pastille texte={etat.texte} ton={etat.ton} />{note && <Text accessibilityLabel={`Note ${note.slice(2)}`} style={s.secondaire}>{note}</Text>}</View>
        {statut && <Text style={s.secondaire}>{statut}</Text>}
      </View>
    </View>
    {r.horaires ? <Text style={s.texte}>Horaires : {r.horaires}</Text> : null}
    {r.consignes ? <Text style={s.secondaire}>{r.consignes}</Text> : null}
    {r.moyensPaiement && r.moyensPaiement.length > 0 ? <Text style={s.secondaire}>Paiement accepté : {r.moyensPaiement.join(', ')}</Text> : null}
  </View>;
}

/** Carte d'un plat : photo, nom, description, prix payé (rouge et prix normal barré en promo), suppléments, disponibilité et ancienneté de la confirmation. */
export function CartePlat({ plat: p, ajouter, desactive, maintenant = new Date() }: { plat: PlatCataloguePublic; ajouter(): void; desactive: boolean; maintenant?: Date }) {
  const promo = enPromo(p); const supp = libelleSupplements(p.options);
  const confirme = p.confirmeLe ? new Date(p.confirmeLe) : null;
  const age = confirme && !Number.isNaN(confirme.getTime()) ? ancienneteLisible(confirme, maintenant) : null;
  const etat = { disponible: { texte: 'Disponible', ton: 'succes' as const }, a_confirmer: { texte: 'À confirmer', ton: 'neutre' as const }, epuise: { texte: 'Épuisé', ton: 'neutre' as const } }[p.disponibilite];
  const detail = p.disponibilite === 'disponible' ? (age ? `confirmé ${age}` : null) : p.disponibilite === 'a_confirmer' ? (age ? `dernière confirmation ${age}` : 'pas encore confirmé') : null;
  return <View style={s.carte}>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Vignette url={p.photoUrl} nom={p.nom} taille={64} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.nom}>{p.nom}</Text>
        {p.description !== '' && <Text style={s.texte} numberOfLines={3}>{p.description}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[s.prix, promo && { color: c.action }]}>{gnf(p.prixGnf)}</Text>
          {promo && <Text accessibilityLabel={`au lieu de ${gnf(p.prixNormalGnf!)}`} style={s.barre}>{gnf(p.prixNormalGnf!)}</Text>}
        </View>
        {supp && <Text style={s.secondaire}>{supp}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Pastille texte={etat.texte} ton={etat.ton} />{detail && <Text style={s.secondaire}>{detail}</Text>}</View>
      </View>
    </View>
    {/* « + » rond à droite, comme dans les applis de commande : le nom accessible dit « Ajouter X au panier » ; un plat épuisé est grisé. */}
    <View style={{ alignItems: 'flex-end' }}><Bouton titre={p.disponibilite === 'epuise' ? `${p.nom} épuisé` : `Ajouter ${p.nom} au panier`} icone="plus" iconeSeule disabled={desactive || p.disponibilite === 'epuise'} onPress={ajouter} /></View>
  </View>;
}
const s = StyleSheet.create({
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, padding: 16, gap: 12 },
  nom: { color: c.encre, fontFamily: polices.titre, fontSize: 19 }, prix: { color: c.encre, fontFamily: polices.texte, fontSize: 15, fontWeight: '700' },
  barre: { color: c.secondaire, fontFamily: polices.texte, fontSize: 13, textDecorationLine: 'line-through' },
  texte: { color: c.encre, fontFamily: polices.texte, fontSize: 15, lineHeight: 22 }, secondaire: { color: c.secondaire, fontFamily: polices.texte, fontSize: 12, lineHeight: 19 },
  pastille: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }, pastilleTexte: { fontFamily: polices.texte, fontSize: 12, fontWeight: '700' },
});
