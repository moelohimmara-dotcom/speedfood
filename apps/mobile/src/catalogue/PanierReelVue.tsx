import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chiffrer } from './panier-reel';
import type { usePanierReel } from './usePanierReel';
import { couleurs as c, polices } from '../design/tokens';
import { Icone, type NomIcone } from '../design/Icone';
const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n)+' GNF';
/** Bouton rond à icône seule : le nom accessible dit toujours l'action en toutes lettres. */
function Rond({ nom, icone, onPress, desactive = false }: { nom: string; icone: NomIcone; onPress(): void; desactive?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={nom} accessibilityState={{ disabled: desactive }} disabled={desactive} onPress={onPress} style={[s.touche, desactive && { opacity: .4 }]}><Icone nom={icone} taille={22} couleur={c.encre} /></Pressable>;
}
/**
 * Panier. `enModal` faux : l'écran s'affiche DANS la page, sous la barre d'onglets (onglet « Panier ») ; vrai : fenêtre plein écran comme avant.
 */
export function PanierReelVue({ ouvert, fermer, etat, commander, enModal = true }: { ouvert: boolean; fermer(): void; etat: ReturnType<typeof usePanierReel>; commander(): void; enModal?: boolean }) {
  const [confirmation, setConfirmation] = useState(false);
  const bilan = chiffrer(etat.panier, etat.menu?.plats ?? []);
  const corps = <ScrollView contentContainerStyle={s.contenu}>
    <View style={s.entete}>
      {enModal && <Rond nom="Retour au catalogue" icone="retour" onPress={fermer} />}
      <Text accessibilityRole="header" style={[s.titre, { flex: 1 }]}>Mon panier</Text>
      {!!etat.panier.lignes.length && <Rond nom="Actualiser le panier" icone="actualiser" desactive={etat.lecture} onPress={() => { void etat.recharger(); }} />}
      {!!etat.panier.lignes.length && <Rond nom="Vider le panier" icone="corbeille" onPress={() => setConfirmation(true)} />}
    </View>
    {!!etat.panier.lignes.length && <><Text style={s.texte}>{etat.menu?.restaurant.nom ?? 'Votre sélection'}</Text>
    <Text style={s.texte}>Prix indicatifs, suppléments compris. Rien n’est envoyé tant que vous n’avez pas validé votre commande (retrait ou livraison) ; le serveur recalcule le montant à l’envoi. Les frais de livraison sont calculés à l’étape suivante.</Text></>}
    <Text accessibilityLiveRegion="polite" style={s.secondaire}>{etat.statut}</Text>
    {etat.erreur && <><Text accessibilityRole="alert" style={s.texte}>{etat.erreur}</Text><Pressable accessibilityRole="button" accessibilityLabel="Réessayer le stockage du panier" onPress={etat.reessayer} style={s.bouton}><Text style={s.boutonTexte}>Réessayer le stockage du panier</Text></Pressable></>}
    {etat.lecture && <><ActivityIndicator color={c.action} /><Text style={s.texte}>Vérification des prix et disponibilités…</Text></>}
    {etat.erreurLecture && <Text accessibilityRole="alert" style={s.texte}>{etat.erreurLecture}</Text>}
    {etat.prixModifies && <Text accessibilityRole="alert" style={s.texte}>Les prix ont changé depuis votre dernière lecture. Le montant affiché a été actualisé.</Text>}
    {!etat.panier.lignes.length && <Text style={s.texte}>Votre panier est vide. Choisissez un plat dans un menu.</Text>}
    {bilan.lignes.map(l => <View key={l.cle} style={s.carte}>
      <Text style={s.nom}>{l.plat?.nom ?? 'Plat à vérifier'}</Text>
      {l.options.length > 0 && <Text style={s.texte}>Avec : {l.options.map(o => o.nom).join(', ')}</Text>}
      {(l.optionIds?.length ?? 0) > l.options.length && <Text accessibilityRole="alert" style={s.texte}>Un supplément choisi ne figure plus au menu. Retirez cette ligne pour revoir le total.</Text>}
      <Text style={s.texte}>{l.prixUnitaire !== null ? `${gnf(l.prixUnitaire)} l’unité` : 'Rechargez le menu pour vérifier ce plat.'}</Text>
      {etat.menu && !l.plat && <Text accessibilityRole="alert" style={s.texte}>Ce plat ne figure plus dans le menu publié. Retirez-le pour revoir le total.</Text>}
      {l.plat?.disponibilite !== 'disponible' && <Text style={s.secondaire}>{l.plat?.disponibilite === 'epuise' ? 'Épuisé : retirez ce plat.' : 'Disponibilité à confirmer.'}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <Rond nom={`Retirer une portion de ${l.plat?.nom ?? 'ce plat'}`} icone="moins" onPress={() => etat.quantite(l.cle, l.quantite - 1)} />
        <Text accessibilityLabel={`${l.quantite} portion${l.quantite>1?'s':''}`} style={s.nom}>{l.quantite}</Text>
        <Rond nom={`Ajouter une portion de ${l.plat?.nom ?? 'ce plat'}`} icone="plus" desactive={!l.plat || l.plat.disponibilite === 'epuise' || l.quantite >= 30 || etat.lecture || !!etat.erreurLecture} onPress={() => etat.quantite(l.cle, l.quantite + 1)} />
        <View style={{ flex: 1 }} />
        <Rond nom={`Retirer ${l.plat?.nom ?? 'ce plat'} du panier`} icone="corbeille" onPress={() => etat.quantite(l.cle, 0)} />
      </View>
    </View>)}
    {!!etat.panier.lignes.length && <>
      <Text accessibilityRole="header" style={s.nom}>{etat.lecture || etat.erreurLecture || bilan.total === null ? 'Total à vérifier' : `Sous-total indicatif : ${gnf(bilan.total)}`}</Text>
      {etat.menu && <Text style={s.secondaire}>Menu relu le {new Date(etat.menu.luLe).toLocaleString('fr-FR')}.</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Commander" disabled={etat.lecture || !!etat.erreurLecture || !!etat.erreur || bilan.total === null} accessibilityState={{ disabled: etat.lecture || !!etat.erreurLecture || !!etat.erreur || bilan.total === null }} onPress={commander} style={[s.bouton, (etat.lecture || !!etat.erreurLecture || !!etat.erreur || bilan.total === null) && s.inactif]}><Text style={s.boutonTexte}>Commander</Text></Pressable>
    </>}
    {confirmation && <View style={s.carte}><Text accessibilityRole="header" style={s.nom}>Vider votre sélection ?</Text><Pressable accessibilityRole="button" onPress={() => { etat.vider(); setConfirmation(false); }} style={s.bouton}><Text style={s.boutonTexte}>Confirmer le panier vide</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setConfirmation(false)} style={s.bouton}><Text style={s.boutonTexte}>Garder le panier</Text></Pressable></View>}
  </ScrollView>;
  if (enModal) return <Modal visible={ouvert} onRequestClose={fermer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}>{corps}</SafeAreaView></Modal>;
  return ouvert ? <View style={{ flex: 1, backgroundColor: c.fond }}>{corps}</View> : null;
}
const s=StyleSheet.create({entete:{flexDirection:'row',alignItems:'center',gap:10},contenu:{padding:22,gap:18,width:'100%',maxWidth:760,alignSelf:'center'},titre:{fontFamily:polices.titre,fontSize:34,color:c.encre},nom:{fontFamily:polices.titre,fontSize:21,color:c.encre},texte:{fontFamily:polices.texte,fontSize:15,lineHeight:23,color:c.encre},secondaire:{fontFamily:polices.texte,fontSize:12,lineHeight:19,color:c.secondaire},carte:{padding:20,gap:12,backgroundColor:c.surface,borderRadius:22,borderWidth:1,borderColor:c.bordure},bouton:{backgroundColor:c.action,minHeight:48,padding:14,borderRadius:26,alignItems:'center',justifyContent:'center'},boutonTexte:{fontFamily:polices.texte,color:c.surface,fontWeight:'700'},inactif:{opacity:.5},touche:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:c.bordure,borderRadius:24,backgroundColor:c.surface}});
