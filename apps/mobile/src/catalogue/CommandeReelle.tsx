import { useReducer, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chiffrer } from './panier-reel';
import { validerSaisie } from './commande-reelle';
import { EnvoiCommande } from './envoi-commande';
import type { usePanierReel } from './usePanierReel';
import { gestion } from '../connexion/gestion';
import { couleurs as c, polices } from '../design/tokens';
const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
function Action({ titre, agir, disabled = false }: { titre: string; agir(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={titre} disabled={disabled} accessibilityState={{ disabled }} onPress={agir} style={[s.bouton, disabled && s.inactif]}><Text style={s.boutonTexte}>{titre}</Text></Pressable>;
}
/**
 * Validation d'une commande en RETRAIT (lot A). Fenêtre du même type que le panier et le compte : l'application réelle ne monte pas de routeur.
 * Composant mince : toute la logique (clé d'idempotence, rejeu à l'identique, verrous, remise à zéro par compte) est dans `EnvoiCommande`.
 */
export function CommandeReelle({ ouvert, fermer, etat, ouvrirCompte, verifierCommandes, apresSucces }: {
  ouvert: boolean; fermer(): void; etat: ReturnType<typeof usePanierReel>;
  ouvrirCompte(): void; verifierCommandes(): void; apresSucces(reference: string): void;
}) {
  const [, redessiner] = useReducer((n: number) => n + 1, 0);
  const machine = useRef<EnvoiCommande | null>(null);
  if (!machine.current) { machine.current = new EnvoiCommande({ envoyer: p => gestion.creerCommande(p) }); machine.current.surChangement = redessiner; }
  const m = machine.current;
  m.lierCompte(gestion.identifiant);
  const plats = etat.menu?.plats ?? [];
  const bilan = chiffrer(etat.panier, plats);
  const connectee = gestion.connectee;
  const { erreurs } = validerSaisie({ nom: m.nom, telephone: m.telephone, consentement: m.consentement });
  const panierPret = !!etat.panier.lignes.length && bilan.total !== null && !etat.lecture && !etat.erreurLecture && !etat.erreur;
  const peutEnvoyer = m.peutEnvoyer(etat.panier, plats, connectee, panierPret);
  const verrouille = m.verrouille;
  async function envoyer() {
    const r = await m.envoyer(etat.panier, plats, etat.vider, connectee, panierPret);
    if (r.type === 'succes') { apresSucces(r.reference); m.acquitter(); }
    else if (r.type === 'session_changee') verifierCommandes();
  }
  const fermerSiPossible = () => { if (m.peutFermer()) fermer(); };
  return <Modal visible={ouvert} onRequestClose={fermerSiPossible} animationType="slide"><SafeAreaView style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Action titre="Retour au panier" agir={fermerSiPossible} disabled={verrouille} />
    <Text accessibilityRole="header" style={s.titre}>Valider ma commande</Text>
    <Text style={s.texte}>{etat.menu?.restaurant.nom ?? 'Votre sélection'} · retrait au restaurant</Text>
    <View style={s.carte}>
      {chiffrer(etat.panier, plats).lignes.map(l => <Text key={l.platId} style={s.texte}>{l.quantite} × {l.plat?.nom ?? 'Plat à vérifier'}{l.plat ? ' · ' + gnf(l.plat.prixGnf * l.quantite) : ''}</Text>)}
      <Text accessibilityRole="header" style={s.nom}>{bilan.total === null ? 'Total à vérifier' : `Sous-total : ${gnf(bilan.total)}`}</Text>
      <Text style={s.secondaire}>Retrait : pas de frais de livraison. Le restaurant confirme votre commande ; le montant final est recalculé par Speedfood.</Text>
    </View>
    {!panierPret && !verrouille && <Text accessibilityRole="alert" style={s.texte}>{etat.panier.lignes.length ? 'Les prix doivent être relus avant l’envoi. Retournez au panier et actualisez-le.' : 'Votre panier est vide.'}</Text>}
    {!connectee && <View style={s.carte}><Text accessibilityRole="alert" style={s.texte}>Connectez-vous pour envoyer votre commande.</Text><Action titre="Ouvrir mon compte" agir={ouvrirCompte} /></View>}
    <Text style={s.texte}>Votre nom</Text>
    <TextInput accessibilityLabel="Votre nom" value={m.nom} onChangeText={v => m.saisir('nom', v)} editable={!verrouille} autoComplete="name" maxLength={120} style={s.champ} />
    {m.nom !== '' && erreurs.nom && <Text style={s.secondaire}>{erreurs.nom}</Text>}
    <Text style={s.texte}>Téléphone</Text>
    <TextInput accessibilityLabel="Votre téléphone" value={m.telephone} onChangeText={v => m.saisir('telephone', v)} editable={!verrouille} keyboardType="phone-pad" autoComplete="tel" maxLength={30} style={s.champ} />
    {m.telephone !== '' && erreurs.telephone && <Text style={s.secondaire}>{erreurs.telephone}</Text>}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: m.consentement, disabled: verrouille }} disabled={verrouille} onPress={() => m.saisir('consentement', !m.consentement)} style={s.consentement}>
      <View style={[s.case, m.consentement && s.caseCochee]}>{m.consentement && <Text style={s.coche}>✓</Text>}</View>
      <Text style={s.consentementTexte}>Je comprends que le règlement se fait en dehors de l’application et que le restaurant doit confirmer ma commande.</Text>
    </Pressable>
    {m.phase === 'envoi' && <View accessibilityLiveRegion="polite" style={s.attente}><ActivityIndicator color={c.action} /><Text style={s.texte}>Envoi de votre commande…</Text></View>}
    {m.message && <Text accessibilityRole="alert" style={s.texte}>{m.message}</Text>}
    {m.phase === 'incertain' && <View style={s.carte}>
      <Text style={s.texte}>Si vous réessayez, la même demande est renvoyée : vous ne risquez pas de commande en double.</Text>
      <Action titre="Réessayer" agir={() => { void envoyer(); }} />
      <Action titre="Vérifier mes commandes" agir={verifierCommandes} />
      {!m.abandonDemande ? <Action titre="Modifier ma commande" agir={() => m.demanderAbandon()} /> : <>
        <Text accessibilityRole="alert" style={s.texte}>Si la commande précédente a été enregistrée, en envoyer une autre créerait un doublon. Vérifiez d’abord vos commandes.</Text>
        <Action titre="Je confirme : elle n’a pas été enregistrée" agir={() => m.confirmerAbandon()} />
        <Action titre="Non, garder mon envoi" agir={() => m.annulerAbandon()} /></>}
    </View>}
    {m.phase !== 'incertain' && <Action titre={m.phase === 'envoi' ? 'Envoi en cours…' : 'Envoyer ma commande'} disabled={!peutEnvoyer} agir={() => { void envoyer(); }} />}
  </ScrollView></SafeAreaView></Modal>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fond }, contenu: { padding: 22, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center' },
  titre: { fontFamily: polices.titre, fontSize: 34, color: c.encre }, nom: { fontFamily: polices.titre, fontSize: 21, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre }, secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  carte: { padding: 18, gap: 12, backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.bordure },
  champ: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, padding: 16, minHeight: 54, fontFamily: polices.texte, fontSize: 16, color: c.encre },
  bouton: { backgroundColor: c.action, minHeight: 48, padding: 14, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, inactif: { opacity: 0.5 },
  boutonTexte: { fontFamily: polices.texte, color: c.surface, fontWeight: '700' },
  consentement: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  case: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: c.action, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }, caseCochee: { backgroundColor: c.action },
  coche: { color: c.surface, fontWeight: '700' }, consentementTexte: { flex: 1, fontFamily: polices.texte, fontSize: 14, lineHeight: 21, color: c.encre },
  attente: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
