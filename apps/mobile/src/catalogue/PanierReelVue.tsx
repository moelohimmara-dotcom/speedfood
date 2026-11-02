import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chiffrer } from './panier-reel';
import type { usePanierReel } from './usePanierReel';
import { couleurs as c, polices } from '../design/tokens';
const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n)+' GNF';
export function PanierReelVue({ ouvert, fermer, etat, commander }: { ouvert: boolean; fermer(): void; etat: ReturnType<typeof usePanierReel>; commander(): void }) {
  const [confirmation, setConfirmation] = useState(false);
  const bilan = chiffrer(etat.panier, etat.menu?.plats ?? []);
  return <Modal visible={ouvert} onRequestClose={fermer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}><ScrollView contentContainerStyle={s.contenu}>
    <Pressable accessibilityRole="button" onPress={fermer} style={s.bouton}><Text style={s.boutonTexte}>Retour au catalogue</Text></Pressable>
    <Text accessibilityRole="header" style={s.titre}>Mon panier</Text><Text style={s.texte}>{etat.menu?.restaurant.nom ?? 'Votre sélection'}</Text>
    <Text style={s.texte}>Prix indicatifs hors options. Rien n’est envoyé tant que vous n’avez pas validé votre commande (retrait ou livraison) ; le serveur recalcule le montant à l’envoi. Les frais de livraison sont calculés à l’étape suivante.</Text>
    <Text accessibilityLiveRegion="polite" style={s.secondaire}>{etat.statut}</Text>
    {etat.erreur && <><Text accessibilityRole="alert" style={s.texte}>{etat.erreur}</Text><Pressable accessibilityRole="button" accessibilityLabel="Réessayer le stockage du panier" onPress={etat.reessayer} style={s.bouton}><Text style={s.boutonTexte}>Réessayer le stockage du panier</Text></Pressable></>}
    {etat.lecture && <><ActivityIndicator color={c.action} /><Text style={s.texte}>Vérification des prix et disponibilités…</Text></>}
    {etat.erreurLecture && <Text accessibilityRole="alert" style={s.texte}>{etat.erreurLecture}</Text>}
    {etat.prixModifies && <Text accessibilityRole="alert" style={s.texte}>Les prix ont changé depuis votre dernière lecture. Le montant affiché a été actualisé.</Text>}
    {!etat.panier.lignes.length && <Text style={s.texte}>Votre panier est vide. Choisissez un plat dans un menu.</Text>}
    {bilan.lignes.map(l => <View key={l.platId} style={s.carte}>
      <Text style={s.nom}>{l.plat?.nom ?? 'Plat à vérifier'}</Text>
      <Text style={s.texte}>{l.plat ? gnf(l.plat.prixGnf) : 'Rechargez le menu pour vérifier ce plat.'}</Text>
      {etat.menu && !l.plat && <Text accessibilityRole="alert" style={s.texte}>Ce plat ne figure plus dans le menu publié. Retirez-le pour revoir le total.</Text>}
      {l.plat?.disponibilite !== 'disponible' && <Text style={s.secondaire}>{l.plat?.disponibilite === 'epuise' ? 'Épuisé : retirez ce plat.' : 'Disponibilité à confirmer.'}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Retirer une portion de ${l.plat?.nom ?? 'ce plat'}`} onPress={() => etat.quantite(l.platId, l.quantite-1)} style={s.touche}><Text style={s.nom}>−</Text></Pressable>
        <Text accessibilityLabel={`${l.quantite} portion${l.quantite>1?'s':''}`} style={s.nom}>{l.quantite}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter une portion de ${l.plat?.nom ?? 'ce plat'}`} disabled={!l.plat || l.plat.disponibilite === 'epuise' || l.quantite >= 30 || etat.lecture || !!etat.erreurLecture} onPress={() => etat.quantite(l.platId, l.quantite+1)} style={s.touche}><Text style={s.nom}>+</Text></Pressable>
      </View>
    </View>)}
    {!!etat.panier.lignes.length && <>
      <Text accessibilityRole="header" style={s.nom}>{etat.lecture || etat.erreurLecture || bilan.total === null ? 'Total à vérifier' : `Sous-total indicatif : ${gnf(bilan.total)}`}</Text>
      {etat.menu && <Text style={s.secondaire}>Menu relu le {new Date(etat.menu.luLe).toLocaleString('fr-FR')}.</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Commander" disabled={etat.lecture || !!etat.erreurLecture || !!etat.erreur || bilan.total === null} accessibilityState={{ disabled: etat.lecture || !!etat.erreurLecture || !!etat.erreur || bilan.total === null }} onPress={commander} style={[s.bouton, (etat.lecture || !!etat.erreurLecture || !!etat.erreur || bilan.total === null) && s.inactif]}><Text style={s.boutonTexte}>Commander</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Actualiser le panier" disabled={etat.lecture} onPress={() => { void etat.recharger(); }} style={s.bouton}><Text style={s.boutonTexte}>Actualiser le panier</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setConfirmation(true)} style={s.bouton}><Text style={s.boutonTexte}>Vider le panier</Text></Pressable>
    </>}
    {confirmation && <View style={s.carte}><Text accessibilityRole="header" style={s.nom}>Vider votre sélection ?</Text><Pressable accessibilityRole="button" onPress={() => { etat.vider(); setConfirmation(false); }} style={s.bouton}><Text style={s.boutonTexte}>Confirmer le panier vide</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setConfirmation(false)} style={s.bouton}><Text style={s.boutonTexte}>Garder le panier</Text></Pressable></View>}
  </ScrollView></SafeAreaView></Modal>;
}
const s=StyleSheet.create({contenu:{padding:22,gap:18,width:'100%',maxWidth:760,alignSelf:'center'},titre:{fontFamily:polices.titre,fontSize:34,color:c.encre},nom:{fontFamily:polices.titre,fontSize:21,color:c.encre},texte:{fontFamily:polices.texte,fontSize:15,lineHeight:23,color:c.encre},secondaire:{fontFamily:polices.texte,fontSize:12,lineHeight:19,color:c.secondaire},carte:{padding:20,gap:12,backgroundColor:c.surface,borderRadius:22,borderWidth:1,borderColor:c.bordure},bouton:{backgroundColor:c.action,minHeight:48,padding:14,borderRadius:26,alignItems:'center',justifyContent:'center'},boutonTexte:{fontFamily:polices.texte,color:c.surface,fontWeight:'700'},inactif:{opacity:.5},touche:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:c.bordure,borderRadius:24}});
