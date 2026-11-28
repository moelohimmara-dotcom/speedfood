import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chiffrer } from './panier-reel';
import type { usePanierReel } from './usePanierReel';
import { couleurs as c, polices } from '../design/tokens';
import { type NomIcone } from '../design/Icone';
import { Bouton, type VarianteBouton } from '../design/Composants';
import { dateLisible } from '../design/format';
import { COMMENTAIRE_PLATS_A_CONFIRMER, commandabilite } from './parcours-client';
import { LIVRAISON_CLIENT_DISPONIBLE } from './commande-reelle';
const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n)+' GNF';
/** Bouton rond à icône seule : le nom accessible dit toujours l'action en toutes lettres. */
function Rond({ nom: titre, icone, onPress, desactive = false, variante = 'texte' }: { nom: string; icone: NomIcone; onPress(): void; desactive?: boolean; variante?: VarianteBouton }) {
  return <Bouton titre={titre} icone={icone} iconeSeule variante={variante} disabled={desactive} onPress={onPress} />;
}
/**
 * Panier. `enModal` faux : l'écran s'affiche DANS la page, sous la barre d'onglets (onglet « Panier ») ; vrai : fenêtre plein écran comme avant.
 */
export function PanierReelVue({ ouvert, fermer, etat, commander, enModal = true, information = '', parcourir }: { ouvert: boolean; fermer(): void; etat: ReturnType<typeof usePanierReel>; commander(): void; enModal?: boolean; information?: string; parcourir?: () => void }) {
  const [confirmation, setConfirmation] = useState(false);
  const bilan = chiffrer(etat.panier, etat.menu?.plats ?? []);
  const dispo = etat.menu ? commandabilite(etat.menu.restaurant) : null;
  const aConfirmer = bilan.lignes.filter(l => l.plat?.disponibilite === 'a_confirmer').length;
  const corps = <View style={{ flex: 1 }}><ScrollView style={{ flex: 1 }} contentContainerStyle={s.contenu}>
    <View style={s.entete}>
      {enModal && <Rond nom="Retour au catalogue" icone="retour" onPress={fermer} />}
      <Text accessibilityRole="header" style={[s.titre, { flex: 1 }]}>Mon panier</Text>
      {!!etat.panier.lignes.length && <Rond nom="Actualiser le panier" icone="actualiser" desactive={etat.lecture} onPress={() => { void etat.recharger(); }} />}
      {!!etat.panier.lignes.length && <Rond nom="Vider le panier" variante="danger" icone="corbeille" onPress={() => setConfirmation(true)} />}
    </View>
    {confirmation && <View accessibilityViewIsModal accessibilityRole="alert" style={s.carte}><Text accessibilityRole="header" style={s.nom}>Vider le panier ?</Text><Text style={s.texte}>Tous les plats de votre panier seront retirés.</Text><Bouton titre="Confirmer le panier vide" variante="danger" onPress={() => { etat.vider(); setConfirmation(false); }} /><Bouton titre="Garder le panier" secondaire onPress={() => setConfirmation(false)} /></View>}
    {!!etat.panier.lignes.length && <><Text style={s.texte}>{etat.menu?.restaurant.nom ?? 'Votre panier'}</Text>
    <Text style={s.texte}>Prix indicatifs. Rien n’est envoyé avant que vous validiez votre commande ; Speedfood recalcule le montant à l’envoi. Les frais de livraison sont calculés à l’étape suivante.</Text></>}
    {dispo && !dispo.commandable && !!etat.panier.lignes.length && <View accessibilityRole="alert" style={s.alerte}><Text style={s.alerteTitre}>{dispo.titre}</Text><Text style={s.alerteTexte}>{dispo.message} Votre panier est gardé.</Text></View>}
    {information !== '' && <Text accessibilityRole="alert" style={s.texte}>{information}</Text>}
    {etat.statut !== '' && <Text accessibilityLiveRegion="polite" style={s.secondaire}>{etat.statut}</Text>}
    {etat.erreur && <><Text accessibilityRole="alert" style={s.texte}>{etat.erreur}</Text><Bouton titre="Réessayer l’enregistrement du panier" secondaire onPress={etat.reessayer} /></>}
    {etat.lecture && <><ActivityIndicator color={c.action} /><Text style={s.texte}>Vérification des prix et disponibilités…</Text></>}
    {etat.erreurLecture && <Text accessibilityRole="alert" style={s.texte}>{etat.erreurLecture}</Text>}
    {etat.prixModifies && <Text accessibilityRole="alert" style={s.texte}>Les prix ont changé depuis votre dernière lecture. Le montant affiché a été actualisé.</Text>}
    {!etat.panier.lignes.length && <Text style={s.texte}>Votre panier est vide. Choisissez un plat dans un menu.</Text>}
    {!etat.panier.lignes.length && parcourir && <Bouton titre="Parcourir les restaurants" icone="restaurant" onPress={parcourir} />}
    {bilan.lignes.map(l => <View key={l.cle} style={s.carte}>
      <Text style={s.nom}>{l.plat?.nom ?? 'Plat à vérifier'}</Text>
      {l.options.length > 0 && <Text style={s.texte}>Avec : {l.options.map(o => o.nom).join(', ')}</Text>}
      {(l.optionIds?.length ?? 0) > l.options.length && <Text accessibilityRole="alert" style={s.texte}>Un supplément choisi ne figure plus au menu. Retirez cette ligne pour revoir le total.</Text>}
      <Text style={s.texte}>{l.prixUnitaire !== null ? `${gnf(l.prixUnitaire)} l’unité` : 'Rechargez le menu pour vérifier ce plat.'}</Text>
      {etat.menu && !l.plat && <Text accessibilityRole="alert" style={s.texte}>Ce plat ne figure plus dans le menu publié. Retirez-le pour revoir le total.</Text>}
      {l.plat?.disponibilite !== 'disponible' && <Text style={[s.secondaire, l.plat?.disponibilite === 'a_confirmer' && { color: c.avertissement }]}>{l.plat?.disponibilite === 'epuise' ? 'Épuisé : retirez ce plat.' : 'Disponibilité à confirmer.'}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <Rond nom={`Retirer une portion de ${l.plat?.nom ?? 'ce plat'}`} variante="contour" icone="moins" onPress={() => etat.quantite(l.cle, l.quantite - 1)} />
        <Text accessibilityLabel={`${l.quantite} portion${l.quantite>1?'s':''}`} style={s.nom}>{l.quantite}</Text>
        <Rond nom={`Ajouter une portion de ${l.plat?.nom ?? 'ce plat'}`} variante="contour" icone="plus" desactive={!l.plat || l.plat.disponibilite === 'epuise' || l.quantite >= 30 || etat.lecture || !!etat.erreurLecture} onPress={() => etat.quantite(l.cle, l.quantite + 1)} />
        <View style={{ flex: 1 }} />
        <Rond nom={`Retirer ${l.plat?.nom ?? 'ce plat'} du panier`} variante="danger" icone="corbeille" onPress={() => etat.quantite(l.cle, 0)} />
      </View>
    </View>)}
  </ScrollView>
  {!!etat.panier.lignes.length && <View style={s.recap}>
      <Text accessibilityRole="header" style={s.nom}>{etat.lecture || etat.erreurLecture || bilan.total === null ? 'Total à vérifier' : `Sous-total indicatif : ${gnf(bilan.total)}`}</Text>
      <Text style={s.secondaire}>{LIVRAISON_CLIENT_DISPONIBLE ? 'Hors frais de livraison, calculés à l’étape suivante.' : 'À emporter : pas de frais de livraison.'}{etat.menu ? ` Menu actualisé le ${dateLisible(etat.menu.luLe)}.` : ''}</Text>
      {aConfirmer > 0 && <Text style={s.secondaire}>{COMMENTAIRE_PLATS_A_CONFIRMER(aConfirmer)}</Text>}
      <Bouton titre="Commander" icone="coche" disabled={etat.lecture || !!etat.erreurLecture || !!etat.erreur || bilan.total === null || (dispo !== null && !dispo.commandable)} onPress={commander} />
    </View>}
  </View>;
  if (enModal) return <Modal visible={ouvert} onRequestClose={fermer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}>{corps}</SafeAreaView></Modal>;
  return ouvert ? <View style={{ flex: 1, backgroundColor: c.fond }}>{corps}</View> : null;
}
const s=StyleSheet.create({entete:{flexDirection:'row',alignItems:'center',gap:10},recap:{gap:8,paddingHorizontal:22,paddingTop:12,paddingBottom:16,borderTopWidth:1,borderTopColor:c.bordure,backgroundColor:c.surface,width:'100%',maxWidth:760,alignSelf:'center'},contenu:{padding:22,gap:18,width:'100%',maxWidth:760,alignSelf:'center'},titre:{fontFamily:polices.titre,fontSize:34,color:c.encre},nom:{fontFamily:polices.titre,fontSize:21,color:c.encre},texte:{fontFamily:polices.texte,fontSize:15,lineHeight:23,color:c.encre},secondaire:{fontFamily:polices.texte,fontSize:12,lineHeight:19,color:c.secondaire},carte:{padding:20,gap:12,backgroundColor:c.surface,borderRadius:22,borderWidth:1,borderColor:c.bordure},alerte:{padding:16,gap:4,backgroundColor:c.avertissementFond,borderRadius:16},alerteTitre:{fontFamily:polices.texte,fontSize:16,fontWeight:'700',color:c.avertissement},alerteTexte:{fontFamily:polices.texte,fontSize:14,lineHeight:20,color:c.avertissement},bouton:{backgroundColor:c.action,minHeight:48,padding:14,borderRadius:26,alignItems:'center',justifyContent:'center'},boutonTexte:{fontFamily:polices.texte,color:c.surface,fontWeight:'700'},inactif:{opacity:.5},touche:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:c.bordure,borderRadius:24,backgroundColor:c.surface}});
