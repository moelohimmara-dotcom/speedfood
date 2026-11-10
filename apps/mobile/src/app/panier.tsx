import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { plats, restaurants } from '../donnees/demo';
import { useApplication } from '../etat/Application';
import { formatGnf, totalPanier } from '../domaine/panier';
import { Ecran, Texte, Titre, Bouton, EtatVide, s } from '../design/Composants';
import { Icone } from '../design/Icone';
import { IllustrationPlat } from '../design/IllustrationPlat';
import { couleurs as c } from '../design/tokens';
export default function Panier() {
  const { panier, quantite, simuler } = useApplication();
  const restaurant = restaurants.find(r => r.id === panier.restaurantId);
  if (!panier.lignes.length || !restaurant) return <Ecran retour><EtatVide titre="Une petite faim ?" message="Votre panier est vide. Découvrez les menus fictifs et choisissez ce qui vous ferait plaisir." /></Ecran>;
  const total = totalPanier(panier, plats);
  return <Ecran retour>
    <View style={{ gap: 6 }}><Texte style={{ color: c.secondaire, fontSize: 12 }}>VOTRE SÉLECTION</Texte><Titre>Mon panier</Titre><Texte>{restaurant.nom} · à emporter</Texte></View>
    {panier.lignes.map(l => { const p = plats.find(p => p.id === l.platId)!; return <View key={l.platId} style={[s.carte, { padding: 17, gap: 16 }]}>
      <View style={s.ligne}><IllustrationPlat type={p.illustration} taille={80} /><View style={{ flex: 1 }}><Texte style={{ fontWeight: '700', fontSize: 17 }}>{p.nom}</Texte><Texte style={{ color: c.secondaire }}>{formatGnf(p.prixGnf)}</Texte></View></View>
      <View style={[s.ligne, { justifyContent: 'space-between' }]}><View style={[s.ligne, { backgroundColor: c.fond, borderRadius: 24, gap: 4 }]}>
        <Pressable onPress={() => quantite(p.id, l.quantite - 1)} accessibilityRole="button" accessibilityLabel={`Retirer une portion de ${p.nom}`} style={s.touche}><Icone nom="moins" taille={19} /></Pressable>
        <Texte accessibilityLabel={`${l.quantite} portion${l.quantite > 1 ? 's' : ''}`} style={{ minWidth: 24, textAlign: 'center', fontWeight: '700' }}>{l.quantite}</Texte>
        <Pressable onPress={() => quantite(p.id, l.quantite + 1)} accessibilityRole="button" accessibilityLabel={`Ajouter une portion de ${p.nom}`} style={s.touche}><Icone nom="plus" taille={19} /></Pressable>
      </View><Texte style={{ fontWeight: '700' }}>{formatGnf(p.prixGnf * l.quantite)}</Texte></View>
    </View>; })}
    <View style={[s.carte, { padding: 20, gap: 14 }]}><View style={[s.ligne, { justifyContent: 'space-between' }]}><Texte>Sous-total fictif</Texte><Texte>{formatGnf(total)}</Texte></View><Texte style={{ color: c.secondaire, fontSize: 13 }}>À emporter simulé. Aucun frais de livraison ni paiement.</Texte><View style={{ borderTopColor: c.bordure, borderTopWidth: 1, paddingTop: 15, gap: 4 }}><Texte style={{ fontSize: 13, color: c.secondaire }}>Total de démonstration</Texte><Titre>{formatGnf(total)}</Titre></View></View>
    <View style={s.note}><Texte style={{ color: c.avertissement }}>Aucun restaurant ne sera contacté. Cette action ouvre seulement un suivi fictif.</Texte></View>
    <Bouton titre="Simuler le suivi" onPress={() => { simuler(); router.push('/suivi'); }} icone="fleche" />
  </Ecran>;
}
