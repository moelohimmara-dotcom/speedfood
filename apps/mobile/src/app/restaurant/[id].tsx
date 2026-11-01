import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { restaurants, plats, type Plat } from '../../donnees/demo';
import { useApplication } from '../../etat/Application';
import { formatGnf, totalPanier } from '../../domaine/panier';
import { Ecran, Texte, Titre, Bouton, EtatVide, s } from '../../design/Composants';
import { IllustrationPlat } from '../../design/IllustrationPlat';
import { Icone } from '../../design/Icone';
import { couleurs as c } from '../../design/tokens';
export default function Restaurant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const restaurant = restaurants.find(r => r.id === id);
  const { ajouter, panier, vider } = useApplication();
  const [message, setMessage] = useState('');
  const [autreRestaurant, setAutreRestaurant] = useState(false);
  if (!restaurant) return <Ecran retour><EtatVide titre="Adresse introuvable" message="Cette adresse ne fait pas partie du catalogue de démonstration." /></Ecran>;
  function ajout(plat: Plat) {
    try { ajouter(plat); setMessage(`${plat.nom} ajouté au panier.`); setAutreRestaurant(false); }
    catch (e) { setAutreRestaurant(e instanceof Error && e.message === 'AUTRE_RESTAURANT'); setMessage('Votre panier contient les plats d’un autre restaurant. Videz-le avant de changer de restaurant.'); }
  }
  return <Ecran retour>
    <View style={[s.carte, { backgroundColor: c.mangue, alignItems: 'center', padding: 8 }]}><IllustrationPlat type={restaurant.illustration} taille={245} /></View>
    <View style={{ gap: 8 }}><Texte style={{ color: c.secondaire, fontSize: 12 }}>ADRESSE FICTIVE · {restaurant.zone.toUpperCase()}</Texte><Titre>{restaurant.nom}</Titre><Texte style={{ color: c.secondaire }}>{restaurant.description}</Texte></View>
    <View style={[s.ligne, { backgroundColor: c.surface, borderRadius: 14, padding: 14 }]}><Icone nom="position" /><Texte>Retrait · scénario de démonstration</Texte></View>
    <Titre petit>Au menu</Titre>
    {message !== '' && <View style={[s.note, { gap: 12 }]}><Texte accessibilityRole="alert">{message}</Texte>{autreRestaurant && <Bouton titre="Vider le panier actuel" secondaire onPress={() => { vider(); setAutreRestaurant(false); setMessage('Le panier est vidé. Vous pouvez ajouter un plat de ce restaurant.'); }} />}</View>}
    {plats.filter(p => p.restaurantId === restaurant.id).map(p => <View key={p.id} style={[s.carte, { padding: 16, gap: 14 }]}>
      <View style={[s.ligne, { alignItems: 'flex-start' }]}><View style={{ flex: 1, gap: 7 }}><Texte style={{ fontSize: 19, fontWeight: '700' }}>{p.nom}</Texte><Texte style={{ color: c.secondaire, fontSize: 13, lineHeight: 20 }}>{p.description}</Texte><Texte style={{ fontWeight: '700' }}>{formatGnf(p.prixGnf)}</Texte></View><View style={{ backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 3 }}><IllustrationPlat type={p.illustration} taille={92} /></View></View>
      <Bouton titre={p.disponible ? `Ajouter ${p.nom}` : 'Indisponible dans cette démo'} secondaire disabled={!p.disponible} onPress={() => ajout(p)} icone={p.disponible ? 'plus' : undefined} />
    </View>)}
    {panier.lignes.length > 0 && <Bouton titre={`Voir mon panier · ${formatGnf(totalPanier(panier, plats))}`} onPress={() => router.push('/panier')} icone="panier" />}
  </Ecran>;
}
