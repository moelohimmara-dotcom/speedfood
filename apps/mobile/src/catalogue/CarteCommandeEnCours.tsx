import { StyleSheet, Text, View } from 'react-native';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import type { CommandeEnCoursVue } from './useCommandeEnCours';
/**
 * « Commande en cours » : une commande envoyée depuis ce téléphone et pas encore terminée reste visible sur l'accueil, avec son état et celui dont on attend l'action.
 * Un seul bouton, qui ouvre le suivi (onglet Commandes).
 */
export const TITRE_COMMANDE_EN_COURS = 'Commande en cours';
export function CarteCommandeEnCours({ commande, suivre }: { commande: CommandeEnCoursVue; suivre(): void }) {
  return <View accessibilityLabel={`${TITRE_COMMANDE_EN_COURS} : ${commande.restaurantNom}, ${commande.libelle}`} style={s.carte}>
    <Text style={s.surtitre}>{TITRE_COMMANDE_EN_COURS}</Text>
    <Text accessibilityRole="header" style={s.nom}>{commande.restaurantNom}</Text>
    <Text style={s.statut}>{commande.libelle}</Text>
    {commande.phrase !== null && <Text style={s.phrase}>{commande.phrase}</Text>}
    <Bouton titre="Suivre ma commande" onPress={suivre} />
  </View>;
}
const s = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderLeftWidth: 6, borderLeftColor: c.action, borderRadius: 18, backgroundColor: c.surface },
  surtitre: { fontFamily: polices.texte, fontSize: 13, fontWeight: '700', color: c.action, textTransform: 'uppercase' },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  statut: { fontFamily: polices.texte, fontSize: 16, fontWeight: '700', color: c.encre },
  phrase: { fontFamily: polices.texte, fontSize: 15, color: c.secondaire },
});
