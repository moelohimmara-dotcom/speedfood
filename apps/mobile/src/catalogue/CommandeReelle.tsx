import { useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { QuartierPublic } from '../../../../packages/shared/src/contracts/catalogue';
import { chiffrer } from './panier-reel';
import { ADRESSE_MAX, doitChargerQuartiers, estimationValable, filtrerQuartiers, fraisDeLEstimation, totalEstime, validerSaisie } from './commande-reelle';
import { EnvoiCommande } from './envoi-commande';
import { creerLecteurCatalogue } from './client';
import type { usePanierReel } from './usePanierReel';
import { gestion } from '../connexion/gestion';
import { couleurs as c, polices } from '../design/tokens';
const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
const lecteur = creerLecteurCatalogue();
const COLLATEUR_FR = new Intl.Collator('fr');
function Action({ titre, agir, disabled = false }: { titre: string; agir(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={titre} disabled={disabled} accessibilityState={{ disabled }} onPress={agir} style={[s.bouton, disabled && s.inactif]}><Text style={s.boutonTexte}>{titre}</Text></Pressable>;
}
function Choix({ titre, actif, desactive, agir, moitie = false }: { titre: string; actif: boolean; desactive: boolean; agir(): void; moitie?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={titre} accessibilityState={{ checked: actif, disabled: desactive }} disabled={desactive} onPress={agir} style={[s.choix, moitie && s.choixMoitie, actif && s.choixActif, desactive && s.inactif]}><Text style={[s.choixTexte, actif && s.choixTexteActif]}>{titre}</Text></Pressable>;
}
type Quartiers = { etat: 'aucun' | 'chargement' | 'ok' | 'erreur'; liste: QuartierPublic[] };
/**
 * Validation d'une commande en RETRAIT (lot A) ou en LIVRAISON (lot B). Fenêtre du même type que le panier et le compte : l'application réelle ne monte pas de routeur.
 * Composant mince : toute la logique (clé d'idempotence, rejeu à l'identique, verrous, remise à zéro par compte, estimation de livraison) est dans `EnvoiCommande`.
 */
export function CommandeReelle({ ouvert, fermer, etat, ouvrirCompte, verifierCommandes, apresSucces }: {
  ouvert: boolean; fermer(): void; etat: ReturnType<typeof usePanierReel>;
  ouvrirCompte(): void; verifierCommandes(): void; apresSucces(reference: string): void;
}) {
  const [, redessiner] = useReducer((n: number) => n + 1, 0);
  const machine = useRef<EnvoiCommande | null>(null);
  if (!machine.current) { machine.current = new EnvoiCommande({ envoyer: p => gestion.creerCommande(p), estimer: (r, q, t) => gestion.estimerLivraison(r, q, t) }); machine.current.surChangement = redessiner; }
  const m = machine.current;
  m.lierCompte(gestion.identifiant, gestion.deconnexions);
  const [quartiers, setQuartiers] = useState<Quartiers>({ etat: 'aucun', liste: [] });
  const [recherche, setRecherche] = useState('');
  const [essaiQuartiers, setEssaiQuartiers] = useState(0);
  const plats = etat.menu?.plats ?? [];
  const bilan = chiffrer(etat.panier, plats);
  const connectee = gestion.connectee;
  const { erreurs } = validerSaisie({ nom: m.nom, telephone: m.telephone, consentement: m.consentement, mode: m.mode, adresse: m.adresse, quartierId: m.quartierId });
  const panierPret = !!etat.panier.lignes.length && bilan.total !== null && !etat.lecture && !etat.erreurLecture && !etat.erreur;
  const peutEnvoyer = m.peutEnvoyer(etat.panier, plats, connectee, panierPret);
  const verrouille = m.verrouille;
  const livraison = m.mode === 'livraison';
  const estimation = estimationValable(m.estimation, etat.panier.restaurantId, m.quartierId, bilan.total) ? m.estimation.estimation : null;
  const frais = fraisDeLEstimation(estimation);
  const total = totalEstime(bilan.total, livraison ? frais : 0);
  const quartierChoisi = quartiers.liste.find(q => q.id === m.quartierId) ?? null;
  // Liste des quartiers : lue seulement au PREMIER passage en livraison (jamais en retrait) ; pas de cache entre deux ouvertures de l'écran la route étant `no-store` ; son échec n'empêche pas le retrait.
  useEffect(() => {
    if (!doitChargerQuartiers(ouvert, m.mode, quartiers.etat)) return;
    let actif = true; setQuartiers(q => ({ ...q, etat: 'chargement' }));
    lecteur.listerQuartiers().then(l => { if (actif) setQuartiers({ etat: 'ok', liste: [...l.quartiers].sort((a, b) => COLLATEUR_FR.compare(a.libelle, b.libelle)) }); }, () => { if (actif) setQuartiers({ etat: 'erreur', liste: [] }); });
    return () => { actif = false; setQuartiers(q => q.etat === 'chargement' ? { etat: 'aucun', liste: [] } : q); }; // lecture interrompue (écran fermé, retour au retrait) : à refaire au prochain passage en livraison
  }, [ouvert, livraison, essaiQuartiers]);
  // Frais de livraison : recalculés quand le quartier, le sous-total, le restaurant ou la connexion changent ; la dernière demande remplace les précédentes.
  useEffect(() => { if (ouvert) void m.actualiserEstimation(etat.panier, plats, connectee, panierPret); }, [ouvert, m.mode, m.quartierId, bilan.total, etat.panier.restaurantId, connectee, panierPret, m.etatEstimation, verrouille]);
  async function envoyer() {
    const r = await m.envoyer(etat.panier, plats, etat.vider, connectee, panierPret);
    if (r.type === 'succes') { apresSucces(r.reference); }
    else if (r.type === 'session_changee') verifierCommandes();
  }
  const fermerSiPossible = () => { if (m.peutFermer()) fermer(); };
  const propositions = quartiers.etat === 'ok' ? filtrerQuartiers(quartiers.liste, recherche) : [];
  return <Modal visible={ouvert} onRequestClose={fermerSiPossible} animationType="slide"><SafeAreaView style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Action titre="Retour au panier" agir={fermerSiPossible} disabled={verrouille} />
    <Text accessibilityRole="header" style={s.titre}>Valider ma commande</Text>
    <Text style={s.texte}>{etat.menu?.restaurant.nom ?? 'Votre sélection'} · {livraison ? 'livraison' : 'retrait au restaurant'}</Text>
    <View accessibilityRole="radiogroup" style={s.rangee}>
      <Choix moitie titre="Retrait" actif={!livraison} desactive={verrouille} agir={() => m.saisir('mode', 'retrait')} />
      <Choix moitie titre="Livraison" actif={livraison} desactive={verrouille} agir={() => m.saisir('mode', 'livraison')} />
    </View>
    <View style={s.carte}>
      {chiffrer(etat.panier, plats).lignes.map(l => <Text key={l.platId} style={s.texte}>{l.quantite} × {l.plat?.nom ?? 'Plat à vérifier'}{l.plat ? ' · ' + gnf(l.plat.prixGnf * l.quantite) : ''}</Text>)}
      <Text accessibilityRole="header" style={s.nom}>{bilan.total === null ? 'Total à vérifier' : `Sous-total : ${gnf(bilan.total)}`}</Text>
      {livraison && bilan.total !== null && <>
        {m.etatEstimation === 'calcul' && <View accessibilityLiveRegion="polite" style={s.attente}><ActivityIndicator color={c.action} /><Text style={s.texte}>Calcul des frais de livraison…</Text></View>}
        {estimation?.statut === 'ok' && <Text accessibilityLiveRegion="polite" style={s.texte}>Frais de livraison estimés : {estimation.fraisGnf === 0 ? 'offerts' : gnf(estimation.fraisGnf)} · environ {estimation.dureeMinutes} min</Text>}
        {estimation?.statut === 'non_calcule' && <Text accessibilityLiveRegion="polite" style={s.texte}>Frais de livraison : à convenir avec le restaurant (non calculés par l’application).</Text>}
        {total !== null && <Text accessibilityRole="header" style={s.nom}>Total estimé : {gnf(total)}</Text>}
      </>}
      <Text style={s.secondaire}>{livraison ? 'Livraison : les frais affichés sont une estimation de Speedfood ; le serveur les recalcule à l’envoi et vous demande de confirmer s’ils ont changé.' : 'Retrait : pas de frais de livraison.'} Le restaurant confirme votre commande ; le montant final est recalculé par Speedfood.</Text>
    </View>
    {!panierPret && !verrouille && <Text accessibilityRole="alert" style={s.texte}>{etat.panier.lignes.length ? 'Les prix doivent être relus avant l’envoi. Retournez au panier et actualisez-le.' : 'Votre panier est vide.'}</Text>}
    {!connectee && <View style={s.carte}><Text accessibilityRole="alert" style={s.texte}>Connectez-vous pour envoyer votre commande.</Text><Action titre="Ouvrir mon compte" agir={ouvrirCompte} /></View>}
    <Text style={s.texte}>Votre nom</Text>
    <TextInput accessibilityLabel="Votre nom" value={m.nom} onChangeText={v => m.saisir('nom', v)} editable={!verrouille} autoComplete="name" maxLength={120} style={s.champ} />
    {m.nom !== '' && erreurs.nom && <Text style={s.secondaire}>{erreurs.nom}</Text>}
    <Text style={s.texte}>Téléphone</Text>
    <TextInput accessibilityLabel="Votre téléphone" value={m.telephone} onChangeText={v => m.saisir('telephone', v)} editable={!verrouille} keyboardType="phone-pad" autoComplete="tel" maxLength={30} style={s.champ} />
    {m.telephone !== '' && erreurs.telephone && <Text style={s.secondaire}>{erreurs.telephone}</Text>}
    {livraison && <>
      <Text style={s.texte}>Adresse de livraison</Text>
      <TextInput accessibilityLabel="Adresse de livraison" value={m.adresse} onChangeText={v => m.saisir('adresse', v)} editable={!verrouille} autoComplete="street-address" maxLength={ADRESSE_MAX} multiline style={s.champ} />
      {m.adresse !== '' && erreurs.adresse && <Text style={s.secondaire}>{erreurs.adresse}</Text>}
      <Text style={s.texte}>Quartier</Text>
      {quartierChoisi && <Text accessibilityLiveRegion="polite" style={s.nom}>{quartierChoisi.libelle}</Text>}
      {quartiers.etat === 'chargement' && <View style={s.attente}><ActivityIndicator color={c.action} /><Text style={s.texte}>Chargement des quartiers…</Text></View>}
      {quartiers.etat === 'erreur' && <View style={s.carte}><Text accessibilityRole="alert" style={s.texte}>Impossible de charger la liste des quartiers. Vous pouvez toujours commander en retrait.</Text><Action titre="Réessayer la liste des quartiers" agir={() => { setQuartiers({ etat: 'aucun', liste: [] }); setEssaiQuartiers(n => n + 1); }} /></View>}
      {quartiers.etat === 'ok' && <>
        <TextInput accessibilityLabel="Rechercher votre quartier" placeholder="Rechercher votre quartier" value={recherche} onChangeText={setRecherche} editable={!verrouille} autoCorrect={false} style={s.champ} />
        {propositions.map(q => <Choix key={q.id} titre={q.libelle} actif={q.id === m.quartierId} desactive={verrouille} agir={() => { m.saisir('quartierId', q.id); setRecherche(''); }} />)}
        {recherche.trim() !== '' && propositions.length === 0 && <Text style={s.secondaire}>Aucun quartier ne correspond. Essayez une autre orthographe.</Text>}
        {recherche.trim() === '' && !quartierChoisi && <Text style={s.secondaire}>Saisissez le début du nom de votre quartier pour le trouver.</Text>}
      </>}
      {m.quartierId && m.etatEstimation === 'erreur' && <View style={s.carte}><Text accessibilityRole="alert" style={s.texte}>{m.messageEstimation}</Text><Action titre="Recalculer les frais de livraison" disabled={verrouille} agir={() => m.relancerEstimation()} /></View>}
    </>}
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
  rangee: { flexDirection: 'row', gap: 12 },
  choixMoitie: { flex: 1 },
  choix: { minHeight: 48, padding: 14, borderRadius: 26, borderWidth: 2, borderColor: c.action, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }, choixActif: { backgroundColor: c.action },
  choixTexte: { fontFamily: polices.texte, color: c.encre, fontWeight: '700', textAlign: 'center' }, choixTexteActif: { color: c.surface },
  consentement: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  case: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: c.action, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }, caseCochee: { backgroundColor: c.action },
  coche: { color: c.surface, fontWeight: '700' }, consentementTexte: { flex: 1, fontFamily: polices.texte, fontSize: 14, lineHeight: 21, color: c.encre },
  attente: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
