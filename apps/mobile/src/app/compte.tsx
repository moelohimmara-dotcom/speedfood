import { View } from 'react-native';
import { router } from 'expo-router';
import { useApplication } from '../etat/Application';
import { Ecran, Titre, Texte, Bouton, s } from '../design/Composants';
import { couleurs as c } from '../design/tokens';
import { Icone } from '../design/Icone';
export default function Compte() {
  const { simulation } = useApplication();
  return <Ecran><View style={s.pastille}><Icone nom="compte" taille={32} /></View><Titre>Bienvenue chez vous.</Titre>
    <Texte style={{ color: c.secondaire }}>Découvrez la nouvelle application Speedfood. Pour ce premier aperçu, tout se passe sur votre appareil, sans inscription.</Texte>
    <View style={[s.carte, { padding: 20, gap: 12 }]}><Titre petit>Un aperçu, en toute clarté</Titre><Texte>Restaurants, menus, prix et suivi sont fictifs. Le panier et les favoris s’effacent au rechargement.</Texte><Texte>Aucun mot de passe, aucune donnée personnelle et aucun paiement ne sont demandés.</Texte></View>
    {simulation && <Bouton titre="Retrouver mon suivi fictif" onPress={() => router.push('/suivi')} />}
    <Bouton titre="Découvrir les restaurants" secondaire onPress={() => router.push('/')} />
  </Ecran>;
}
