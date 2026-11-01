import { useState } from 'react';
import { Modal, View } from 'react-native';
import { router } from 'expo-router';
import { useApplication } from '../etat/Application';
import { Ecran, Titre, Texte, Bouton, s } from '../design/Composants';
import { couleurs as c } from '../design/tokens';
import { Icone } from '../design/Icone';
export default function Compte() {
  const { simulation, effacerDonnees } = useApplication();
  const [confirmation, setConfirmation] = useState(false);
  return <Ecran><View style={s.pastille}><Icone nom="compte" taille={32} /></View><Titre>Bienvenue chez vous.</Titre>
    <Texte style={{ color: c.secondaire }}>Découvrez la nouvelle application Speedfood. Pour ce premier aperçu, tout se passe sur votre appareil, sans inscription.</Texte>
    <View style={[s.carte, { padding: 20, gap: 12 }]}><Titre petit>Vos envies restent ici</Titre><Texte>Votre panier et vos favoris sont conservés sur cet appareil, même après fermeture de l’application.</Texte><Texte>Restaurants, menus et prix restent fictifs. Le suivi simulé est temporaire : ce n’est pas une commande.</Texte><Texte>Aucun mot de passe, aucune donnée personnelle et aucun paiement ne sont demandés.</Texte></View>
    {simulation && <Bouton titre="Retrouver mon suivi fictif" onPress={() => router.push('/suivi')} />}
    <Bouton titre="Découvrir les restaurants" secondaire onPress={() => router.push('/')} />
    <Bouton titre="Effacer mes données de démonstration" secondaire onPress={() => setConfirmation(true)} />
    <Modal visible={confirmation} transparent animationType="fade" onRequestClose={() => setConfirmation(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(43,33,29,0.35)' }}><View accessibilityViewIsModal style={{ backgroundColor: c.fond, padding: 24, borderRadius: 22, gap: 18 }}>
        <Titre petit>Repartir à zéro ?</Titre><Texte>Le panier, les favoris et le suivi fictif de cette démonstration seront effacés sur cet appareil. Aucun compte ni commande réelle n’est concerné.</Texte>
        <Bouton titre="Garder mes données" secondaire onPress={() => setConfirmation(false)} />
        <Bouton titre="Effacer maintenant" onPress={() => { effacerDonnees(); setConfirmation(false); }} />
      </View></View>
    </Modal>
  </Ecran>;
}
