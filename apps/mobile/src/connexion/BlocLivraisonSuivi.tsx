import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { Pastille } from '../catalogue/FicheRestaurant';
import { Action } from './BoutonAction';
import { couleurs as c, polices } from '../design/tokens';
import { CarteLivraison } from './CarteLivraison';
import { carteVisible, estLivraisonFinale, etapeCouranteLivraison, etapesLivraison, etiquetteCodeRemise, peutSeSituer, phraseLivraison, texteArrivee, texteFraisLivraison, type LivraisonSuivi } from './livraison-suivi';
import { MESSAGE_POSITION_INDISPONIBLE, MESSAGE_POSITION_LOCALE, MESSAGE_POSITION_REFUSEE, phraseDistanceLivreur } from './position-client';
import { usePositionClient } from './usePositionClient';
/**
 * Livraison d'une commande, dans le suivi du client : où en est la course, qui livre, quand elle arrive, la carte, et le CODE DE REMISE à donner au livreur à la porte
 * (il n'est montré que pendant la livraison et n'est jamais conservé sur le téléphone). Même information que le site.
 * Le client peut aussi se situer sur la carte (« Me situer sur la carte ») : sa position reste sur son téléphone, elle n'est envoyée à personne.
 */
export function BlocLivraisonSuivi({ livraison }: { livraison: LivraisonSuivi }) {
  const position = usePositionClient();
  const final = estLivraisonFinale(livraison);
  const etapes = etapesLivraison(livraison);
  const courante = etapeCouranteLivraison(livraison);
  const phrase = phraseLivraison(livraison);
  const arrivee = texteArrivee(livraison);
  const frais = texteFraisLivraison(livraison);
  const ton = livraison.statut === 'livree' ? 'succes' : livraison.statut === 'echec' || livraison.statut === 'annulee' ? 'danger' : 'neutre';
  const vous = final ? null : position.vous;
  const montrerCarte = carteVisible(livraison, vous);
  const distance = phraseDistanceLivreur(vous, livraison.livreurPoint);
  const descriptionCarte = 'Carte de la livraison : le restaurant' + (livraison.arriveePoint !== null ? ', l’adresse de livraison' : '') + (vous !== null ? ', votre position' : '') + (livraison.livreurPoint !== null ? ' et la position du livreur.' : '.');
  return <View style={s.carte}>
    <View style={s.entete}>
      <Text accessibilityRole="header" style={s.titre}>Livraison</Text>
      <Pastille texte={livraison.libelle} ton={ton} />
    </View>
    {livraison.livreurNom !== null && <Text style={s.texte}>Votre livreur : <Text style={s.gras}>{livraison.livreurNom}</Text></Text>}
    {phrase !== null && <Text accessibilityLiveRegion="polite" style={s.gras}>{phrase}</Text>}
    {!final && <View accessibilityLabel={`Avancement de la livraison : étape ${Math.min(Math.max(courante, 0), etapes.length)} sur ${etapes.length}`} style={s.etapes}>
      {etapes.map((nom, i) => <View key={nom} style={s.etape}>
        <View style={[s.puce, i + 1 <= courante && s.puceFaite]} />
        <Text style={[s.etapeTexte, i + 1 === courante && s.gras]}>{nom}</Text>
      </View>)}
    </View>}
    {arrivee !== null && <Text accessibilityLiveRegion="polite" style={s.texte}>{arrivee}</Text>}
    {montrerCarte && <CarteLivraison points={{ restaurant: livraison.restaurantPoint, destination: livraison.arriveePoint, livreur: livraison.livreurPoint, vous }} description={descriptionCarte} />}
    {peutSeSituer(livraison) && <View style={s.position}>
      {position.etat === 'eteinte' && <Action titre="Me situer sur la carte" secondaire agir={position.activer} />}
      {position.etat === 'recherche' && <View accessibilityLiveRegion="polite" style={s.recherche}><ActivityIndicator color={c.action} /><Text style={s.texte}>Recherche de votre position…</Text></View>}
      {position.etat === 'active' && <>
        <Text accessibilityLiveRegion="polite" style={s.texte}>Votre position (V) est affichée sur la carte.{distance !== null ? ' ' + distance : ''}</Text>
        <Action titre="Masquer ma position" variante="texte" agir={position.desactiver} />
      </>}
      {(position.etat === 'refusee' || position.etat === 'indisponible') && <>
        <Text accessibilityRole="alert" style={s.texte}>{position.etat === 'refusee' ? MESSAGE_POSITION_REFUSEE : MESSAGE_POSITION_INDISPONIBLE}</Text>
        {position.etat === 'refusee' && <Action titre="Ouvrir les réglages" secondaire agir={() => { void Linking.openSettings().catch(() => {}); }} />}
        <Action titre="Réessayer" variante="texte" agir={position.activer} />
      </>}
      <Text style={s.secondaire}>{MESSAGE_POSITION_LOCALE}</Text>
    </View>}
    {livraison.code !== null && <View accessible accessibilityLabel={`Donnez ce code au livreur quand il vous remet la commande. ${etiquetteCodeRemise(livraison.code)}`} style={s.code}>
      <Text style={s.texte}>Donnez ce code au livreur quand il vous remet la commande :</Text>
      <Text style={s.codeValeur}>{livraison.code}</Text>
    </View>}
    {frais !== null && <Text style={s.secondaire}>{frais}</Text>}
  </View>;
}
const s = StyleSheet.create({
  carte: { gap: 10, padding: 14, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, backgroundColor: c.surface },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  titre: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, color: c.encre },
  gras: { fontFamily: polices.texte, fontSize: 15, fontWeight: '700', color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 13, color: c.secondaire },
  etapes: { gap: 6 },
  etape: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  puce: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: c.bordure, backgroundColor: c.surface },
  puceFaite: { borderColor: c.action, backgroundColor: c.action },
  etapeTexte: { fontFamily: polices.texte, fontSize: 14, color: c.secondaire },
  position: { gap: 8 },
  recherche: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.action, backgroundColor: c.surfaceAlt, alignItems: 'center' },
  codeValeur: { fontFamily: polices.titre, fontSize: 40, letterSpacing: 10, color: c.action },
});
