import { Pressable, View, Platform } from 'react-native';
import { router } from 'expo-router';
import type { Restaurant } from '../donnees/demo';
import { useApplication } from '../etat/Application';
import { couleurs as c } from './tokens';
import { Icone } from './Icone';
import { IllustrationPlat } from './IllustrationPlat';
import { Texte, s } from './Composants';
export function CarteRestaurant({ restaurant: r }: { restaurant: Restaurant }) {
  const { favoris, favori } = useApplication();
  const selectionne = favoris.includes(r.id);
  return <View style={s.carte}>
    <Pressable onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: r.id } })} accessibilityRole="button" accessibilityLabel={`Voir le menu de ${r.nom}`}>
      <View style={{ backgroundColor: r.illustration === 'grillade' ? c.avertissementFond : c.mangue, minHeight: 155, alignItems: 'center', justifyContent: 'center' }}>
        <IllustrationPlat type={r.illustration} taille={200} />
        <View style={{ position: 'absolute', left: 14, top: 14, backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}><Texte style={{ fontSize: 11 }}>Illustration · démo</Texte></View>
      </View>
      <View style={{ padding: 18, gap: 5 }}><Texte style={{ fontSize: 21, fontWeight: '700' }}>{r.nom}</Texte><Texte style={{ color: c.secondaire }}>{r.cuisine}</Texte>
        <View style={[s.ligne, { justifyContent: 'space-between', marginTop: 8 }]}><View style={[s.ligne, { gap: 5 }]}><Icone nom="position" taille={16} couleur={c.secondaire} /><Texte style={{ color: c.secondaire, fontSize: 13 }}>{r.zone} · Conakry</Texte></View><Icone nom="fleche" taille={20} /></View>
      </View>
    </Pressable>
    <Pressable onPress={() => favori(r.id)} accessibilityRole="button" accessibilityLabel={`${selectionne ? 'Retirer' : 'Ajouter'} ${r.nom} ${selectionne ? 'des' : 'aux'} favoris`} accessibilityState={{ selected: selectionne }} {...(Platform.OS === 'web' ? { 'aria-pressed': selectionne } : {})} style={[s.touche, { position: 'absolute', right: 12, top: 12, backgroundColor: c.surface }]}>
      <Icone nom="coeur" couleur={selectionne ? c.action : c.encre} rempli={selectionne} taille={21} />
    </Pressable>
  </View>;
}
