import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PlatCataloguePublic } from '../../../../packages/shared/src/contracts/catalogue';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { prixAvecSupplements } from './menu-groupes';
import { OPTIONS_MAX_PAR_LIGNE } from './panier-reel';
const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
/**
 * Choix des suppléments d'un plat avant l'ajout au panier (parité Kotlin, tranche 10.2) : suppléments facultatifs, prix mis à jour au fil des coches.
 * Seuls les suppléments disponibles arrivent ici (le serveur ne transmet pas les autres). Le prix est indicatif : le serveur recalcule à la commande.
 */
export function ChoixSupplements({ plat, annuler, confirmer, selectionInitiale = [] }: { plat: PlatCataloguePublic | null; annuler(): void; confirmer(optionIds: string[]): void; selectionInitiale?: string[] }) {
  const [choisis, setChoisis] = useState<string[]>(() => selectionInitiale.filter((id) => (plat?.options ?? []).some((o) => o.id === id)));
  const options = plat?.options ?? [];
  const selection = options.filter(o => choisis.includes(o.id));
  function basculer(id: string) { setChoisis(a => a.includes(id) ? a.filter(x => x !== id) : a.length >= OPTIONS_MAX_PAR_LIGNE ? a : [...a, id]); }
  function fermer() { setChoisis([]); annuler(); }
  return <Modal visible={plat !== null} transparent animationType="slide" onRequestClose={fermer}><View style={s.fond}><SafeAreaView style={s.feuille}><ScrollView contentContainerStyle={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.titre}>{plat?.nom}</Text>
    <Text style={s.secondaire}>Suppléments (facultatifs)</Text>
    {options.map(o => { const coche = choisis.includes(o.id); return <Pressable key={o.id} accessibilityRole="checkbox" accessibilityState={{ checked: coche }} accessibilityLabel={o.prixGnf > 0 ? `${o.nom}, plus ${gnf(o.prixGnf)}` : o.nom} onPress={() => basculer(o.id)} style={[s.ligne, coche && s.ligneActive]}>
      <View style={[s.case, coche && s.caseActive]}>{coche && <Text style={s.coche}>✓</Text>}</View>
      <Text style={[s.texte, { flex: 1 }]}>{o.nom}</Text>
      <Text style={s.secondaire}>{o.prixGnf > 0 ? `+${gnf(o.prixGnf)}` : 'Gratuit'}</Text>
    </Pressable>; })}
    <Bouton titre={`Ajouter · ${gnf(prixAvecSupplements(plat?.prixGnf ?? 0, selection))}`} icone="panier" onPress={() => { const ids = choisis; setChoisis([]); confirmer(ids); }} />
    <Bouton titre="Annuler" secondaire onPress={fermer} />
  </ScrollView></SafeAreaView></View></Modal>;
}

/** « Changer de restaurant ? » : une commande concerne un seul restaurant ; la personne choisit de vider le panier ou de le garder. */
export function ChangerRestaurant({ visible, nomPanier, vider, garder, titreAction = 'Vider et ajouter' }: { visible: boolean; nomPanier: string | null; vider(): void; garder(): void; titreAction?: string }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={garder}><View style={s.fond}><SafeAreaView style={s.feuille}>
    <Text accessibilityRole="header" style={s.titre}>Changer de restaurant ?</Text>
    <Text style={s.texte}>Votre panier contient des plats de {nomPanier ?? 'un autre restaurant'}. Une commande concerne un seul restaurant : voulez-vous vider le panier et commencer ici ?</Text>
    <Bouton titre={titreAction} onPress={vider} />
    <Bouton titre="Garder mon panier" secondaire onPress={garder} />
  </SafeAreaView></View></Modal>;
}
const s = StyleSheet.create({
  fond: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: { backgroundColor: c.fond, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 14, maxHeight: '85%' },
  titre: { fontFamily: polices.titre, fontSize: 24, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 22, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 13, color: c.secondaire },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: c.bordure, backgroundColor: c.surface },
  ligneActive: { borderColor: c.action, borderWidth: 2 },
  case: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: c.champBordure, alignItems: 'center', justifyContent: 'center' },
  caseActive: { backgroundColor: c.action, borderColor: c.action },
  coche: { color: c.surface, fontWeight: '700' },
});
