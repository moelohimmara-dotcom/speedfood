import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, Platform } from 'react-native';
import { restaurants, plats } from '../donnees/demo';
import { rechercherRestaurants } from '../domaine/panier';
import { Ecran, Texte, Titre, Bouton, s } from '../design/Composants';
import { CarteRestaurant } from '../design/CarteRestaurant';
import { couleurs as c, polices } from '../design/tokens';
import { Icone } from '../design/Icone';
import { IllustrationPlat } from '../design/IllustrationPlat';
export default function Accueil() {
  const [recherche, setRecherche] = useState('');
  const [zone, setZone] = useState<string | null>(null);
  const [zonesOuvertes, setZonesOuvertes] = useState(false);
  const [categorie, setCategorie] = useState('Tout');
  const visibles = rechercherRestaurants(restaurants, plats, recherche, zone).filter(r => categorie === 'Tout' || r.cuisine.includes(categorie));
  return <Ecran>
    <Pressable style={[s.ligne, { alignSelf: 'flex-start', minHeight: 46 }]} onPress={() => setZonesOuvertes(true)} accessibilityRole="button" accessibilityLabel="Choisir la zone du catalogue de démonstration">
      <View style={{ backgroundColor: c.mangue, padding: 9, borderRadius: 16 }}><Icone nom="position" taille={19} /></View>
      <View><Texte style={{ fontSize: 11, color: c.secondaire }}>CATALOGUE FICTIF · CONAKRY</Texte><Texte style={{ fontWeight: '700' }}>{zone ?? 'Toutes les zones'}</Texte></View><Icone nom="bas" taille={17} />
    </Pressable>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 170 }}>
      <View style={{ flex: 1, zIndex: 1 }}><Texte accessibilityRole="header" style={{ fontFamily: polices.titre, fontSize: 41, lineHeight: 44, fontWeight: '800' }}>Une envie.{ '\n' }<Texte style={{ fontFamily: polices.titre, fontSize: 41, lineHeight: 44, fontWeight: '800', color: c.action }}>Un bon repas.</Texte></Texte></View>
      <View style={{ width: 110, alignItems: 'center', marginRight: 5 }}><IllustrationPlat taille={165} /></View>
    </View>
    <Texte style={{ color: c.secondaire, marginTop: -12 }}>Des saveurs à découvrir, à votre rythme.</Texte>
    <View style={[s.ligne, { backgroundColor: c.surface, borderColor: c.bordure, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16 }]}><Icone nom="recherche" couleur={c.secondaire} />
      <TextInput value={recherche} onChangeText={setRecherche} accessibilityLabel="Rechercher un plat ou un restaurant" placeholder="Un plat, un restaurant…" placeholderTextColor={c.secondaire} returnKeyType="search" style={{ flex: 1, fontFamily: polices.texte, color: c.encre, fontSize: 15, minHeight: 56, paddingVertical: 12 }} />
      {recherche !== '' && <Pressable style={s.touche} accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => setRecherche('')}><Icone nom="fermer" taille={17} /></Pressable>}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
      {['Tout', 'Cuisine guinéenne', 'Grillades', 'Boissons'].map(cat => <Pressable key={cat} onPress={() => setCategorie(cat)} accessibilityRole="button" accessibilityState={{ selected: categorie === cat }} {...(Platform.OS === 'web' ? { 'aria-pressed': categorie === cat } : {})} style={{ minHeight: 46, paddingHorizontal: 17, justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: categorie === cat ? c.encre : c.bordure, backgroundColor: categorie === cat ? c.encre : c.surface }}><Texte style={{ fontSize: 13, color: categorie === cat ? c.surface : c.encre, fontWeight: '600' }}>{cat}</Texte></Pressable>)}
    </ScrollView>
    <View style={[s.ligne, { justifyContent: 'space-between', flexWrap: 'wrap' }]}><Titre petit>À découvrir</Titre><Texte style={{ color: c.secondaire, fontSize: 12 }}>{visibles.length} adresse{visibles.length > 1 ? 's' : ''} fictive{visibles.length > 1 ? 's' : ''}</Texte></View>
    {visibles.map(r => <CarteRestaurant key={r.id} restaurant={r} />)}
    {visibles.length === 0 && <View style={{ gap: 16 }}><Texte>Aucun résultat dans ce catalogue de démonstration.</Texte><Bouton titre="Réinitialiser les filtres" secondaire onPress={() => { setRecherche(''); setZone(null); setCategorie('Tout'); }} /></View>}
    <Modal visible={zonesOuvertes} transparent animationType="slide" onRequestClose={() => setZonesOuvertes(false)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,33,29,0.35)' }}><View accessibilityViewIsModal style={{ backgroundColor: c.fond, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 26, paddingBottom: 40, gap: 16 }}>
      <Titre petit>Choisir une zone</Titre><Texte style={{ color: c.secondaire }}>Zones fictives de ce démonstrateur, sans géolocalisation.</Texte>
      {[null, 'Kipé', 'Nongo'].map(z => <Bouton key={z ?? 'toutes'} titre={z ?? 'Toutes les zones'} secondaire={zone !== z} onPress={() => { setZone(z); setZonesOuvertes(false); }} />)}
      <Bouton titre="Fermer" secondaire onPress={() => setZonesOuvertes(false)} />
    </View></View></Modal>
  </Ecran>;
}
