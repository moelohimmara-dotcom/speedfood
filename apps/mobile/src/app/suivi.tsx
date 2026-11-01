import { View } from 'react-native';
import { useApplication } from '../etat/Application';
import { restaurants } from '../donnees/demo';
import { formatGnf } from '../domaine/panier';
import { Ecran, Texte, Titre, Bouton, EtatVide, s } from '../design/Composants';
import { couleurs as c } from '../design/tokens';
import { IllustrationPlat } from '../design/IllustrationPlat';
import { Icone } from '../design/Icone';
export default function Suivi() {
  const { simulation, avancer } = useApplication();
  if (!simulation) return <Ecran retour><EtatVide titre="Aucun suivi fictif" message="Ajoutez un plat puis utilisez « Simuler le suivi » depuis votre panier." /></Ecran>;
  const restaurant = restaurants.find(r => r.id === simulation.restaurantId)!;
  const etapes = ['Envoyée · simulation', 'Acceptée · simulation', 'Prête · simulation'];
  return <Ecran retour>
    <View style={{ alignItems: 'center', backgroundColor: c.mangue, borderRadius: 24, paddingVertical: 16 }}><IllustrationPlat type={restaurant.illustration} taille={195} /></View>
    <View style={{ gap: 8 }}><Texte style={{ color: c.secondaire, fontSize: 12 }}>SUIVI FICTIF · {simulation.reference}</Texte><Titre>{['Votre envie prend forme.', 'Aux fourneaux, pour la démo.', 'La simulation est prête.'][simulation.etape]}</Titre><Texte style={{ color: c.secondaire }}>{restaurant.nom} · {formatGnf(simulation.totalGnf)}</Texte></View>
    <View style={[s.note, { gap: 5 }]}><Texte style={{ fontWeight: '700' }}>Ceci n’est pas une commande.</Texte><Texte>Aucun restaurant contacté. Les étapes avancent uniquement avec le bouton ci-dessous.</Texte></View>
    <View style={[s.carte, { padding: 22, gap: 23 }]}>{etapes.map((e, i) => <View key={e} style={s.ligne}><View style={{ backgroundColor: i <= simulation.etape ? c.succesFond : c.fond, borderRadius: 24, padding: 10 }}><Icone nom={i <= simulation.etape ? 'coche' : 'horloge'} couleur={i <= simulation.etape ? c.succes : c.secondaire} /></View><Texte style={{ flex: 1, color: i <= simulation.etape ? c.encre : c.secondaire, fontWeight: i === simulation.etape ? '700' : '400' }}>{e}</Texte></View>)}</View>
    {simulation.etape < 2 && <Bouton titre="Étape suivante (démo)" onPress={avancer} icone="fleche" />}
    <Texte style={{ color: c.secondaire, fontSize: 13 }}>Pas d’annulation, de notification ou de synchronisation réelle dans ce premier lot.</Texte>
  </Ecran>;
}
