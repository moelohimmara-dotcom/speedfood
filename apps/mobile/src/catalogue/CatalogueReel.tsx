import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PageMenu, PlatCataloguePublic, RestaurantPublic } from '../../../../packages/shared/src/contracts/catalogue';
import { creerLecteurCatalogue, validerPageMenu, validerPageRestaurants } from './client';
import { creerCacheCatalogue, libelleAgeCache, ouvrirCacheOuVide } from './cache-catalogue';
import { ouvrirStockageCacheCatalogue } from './cache-catalogue-natif';
import { chiffrer, type PanierReel } from './panier-reel';
import { libelleRecommande, trouverMemo, type MemoCommande } from './recommande';
import * as SecureStore from 'expo-secure-store';
import { CLE_ZONE_ACCUEIL, FILTRES, filtrerRestaurants, libelleZone, nombreParZone, restaurantsDansZone, sectionsAccueil, zoneEffective, zonesDisponibles, type IdFiltre } from './accueil';
import { ChoixZone } from './ChoixZone';
import { ouvrirCommandesEnvoyees } from '../stockage/commandes-envoyees';
import { couleurs as c, polices } from '../design/tokens';
import { dateLisible } from '../design/format';
import { Bouton } from '../design/Composants';
import { Icone, type NomIcone } from '../design/Icone';
import { usePanierReel } from './usePanierReel';
import { PanierReelVue } from './PanierReelVue';
import { CompteReel } from '../connexion/CompteReel';
import { gestion } from '../connexion/gestion';
import { AideReelle } from '../connexion/AideReelle';
import { FavoriFiche } from '../connexion/FavoriFiche';
import { verrouPro } from '../connexion/verrou-natif';
import { CommandeReelle } from './CommandeReelle';
import { Vignette } from './Vignette';
import { CartePlat, EnteteFiche, Pastille } from './FicheRestaurant';
import { grouperMenu, libelleNote, titreEtatRestaurant } from './menu-groupes';
import { ChangerRestaurant, ChoixSupplements } from './ChoixSupplements';
import { BarreOnglets } from './BarreOnglets';
import { etatPourOnglet, ongletActif, type IdOnglet } from './onglets';
import type { EspaceEntree } from '../connexion/entree';
import { lireLienProfond } from '../connexion/liens-profonds';
import { abonnerLienEnAttente, prendreLienEnAttente } from '../connexion/lien-en-attente';
import { VisiteGuidee } from '../connexion/VisiteReel';
import { LEGENDE_A_CONFIRMER, commandabilite, nombreAConfirmer, ordonnerPlats, ordonnerRestaurants } from './parcours-client';
import { CandidatureReel } from '../connexion/CandidatureReel';
import { brancherOuvertureRestaurateur, brancherOuvertureSuivi, notifications } from '../notifications';
import { creerOuvertureDifferee } from '../notifications/ouverture';
import { MESSAGES_ETAT } from '../notifications/autorisation';
const lecteur = creerLecteurCatalogue();
const Action = ({ titre, agir, disabled = false, secondaire = false, icone, libelleCourt, iconeSeule = false }: { titre: string; agir(): void; disabled?: boolean; secondaire?: boolean; icone?: NomIcone; libelleCourt?: string; iconeSeule?: boolean }) => <Bouton titre={titre} onPress={agir} disabled={disabled} secondaire={secondaire} icone={icone} libelleCourt={libelleCourt} iconeSeule={iconeSeule} />;
export function CatalogueReel() {
  const panier = usePanierReel();
  const [panierOuvert, setPanierOuvert] = useState(false);
  const [compteOuvert, setCompteOuvert] = useState(false);
  const [commandeOuverte, setCommandeOuverte] = useState(false);
  const [aideOuverte, setAideOuverte] = useState(false);
  const [visiteOuverte, setVisiteOuverte] = useState(false);
  const [candidatureOuverte, setCandidatureOuverte] = useState(false);
  const [demandeCompte, setDemandeCompte] = useState<{ reference: string | null; espaceRestaurateur?: boolean } | null>(null);
  const [messagePanier, setMessagePanier] = useState('');
  const [messageNotifications, setMessageNotifications] = useState('');
  function voirPanier() { setPanierOuvert(true); void panier.recharger(); }
  const [restaurants, setRestaurants] = useState<RestaurantPublic[]>([]);
  const [suivant, setSuivant] = useState<string | null>(null);
  const [selection, setSelection] = useState<RestaurantPublic | null>(null);
  const [menu, setMenu] = useState<PageMenu | null>(null);
  const [lectureLe, setLectureLe] = useState<string | null>(null);
  const [ageHorsLigne, setAgeHorsLigne] = useState<number | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const generation = useRef(0);
  async function charger(r: RestaurantPublic | null, apres: string | null = null) {
    const numero = ++generation.current;
    setCharge(true); setErreur(null);
    try {
      // Cache hors ligne (B13) : chaque lecture réussie est gardée ; hors ligne, la dernière lecture valable (7 jours au plus) est rendue avec son âge.
      const cache = creerCacheCatalogue(await ouvrirCacheOuVide(ouvrirStockageCacheCatalogue));
      if (r) {
        const res = await cache.lire('menu:' + r.id + ':' + (apres ?? ''), () => lecteur.menu(r.id, apres), validerPageMenu);
        if (numero !== generation.current) return;
        setAgeHorsLigne(res.ageMs);
        const page = res.donnees;
        setMenu(ancien => ({ ...page, sections: page.sections ?? (apres ? ancien?.sections : undefined), plats: apres && ancien ? [...ancien.plats, ...page.plats.filter(p => !ancien.plats.some(a => a.id === p.id))] : page.plats }));
      } else {
        const res = await cache.lire('restaurants:' + (apres ?? ''), () => lecteur.restaurants(apres), validerPageRestaurants);
        if (numero !== generation.current) return;
        setAgeHorsLigne(res.ageMs);
        const page = res.donnees;
        setRestaurants(anciens => apres ? [...anciens, ...page.restaurants.filter(r => !anciens.some(a => a.id === r.id))] : page.restaurants);
        setSuivant(page.suivant); setLectureLe(page.luLe);
      }
    } catch (e) {
      if (numero === generation.current) setErreur(e instanceof Error && e.message === 'CATALOGUE_INTROUVABLE' ? 'Ce restaurant ne figure plus au catalogue public.' : 'Le catalogue est indisponible pour le moment. Réessayez dans un instant.');
    } finally { if (numero === generation.current) setCharge(false); }
  }
  useEffect(() => { void charger(null); return () => { generation.current++; }; }, []);
  const restaurantsRef = useRef<RestaurantPublic[]>([]);
  restaurantsRef.current = restaurants;
  // Premier lancement (revue du 18/11/2026) : le catalogue s'ouvre directement, sans écran « Qui êtes-vous ? » ni visite par-dessus. La visite reste dans l'en-tête et dans « Mon compte » ; restaurateurs et livreurs se connectent depuis « Mon compte ».
  const [espaceDemande, setEspaceDemande] = useState<EspaceEntree | null>(null);
  const [messageEntree, setMessageEntree] = useState<string | null>(null);
  // Liens profonds (A12) : un lien Speedfood connu ouvre la fiche du restaurant ; un lien de commande ouvre « Mon compte » (le suivi s'y lit, connecté).
  // Tout autre lien est ignoré ici et reste sur le site : aucune navigation arbitraire.
  useEffect(() => {
    let actif = true;
    let derniereUrl: string | null = null;
    const traiter = (url: string | null) => {
      if (!actif || !url || url === derniereUrl) return;
      derniereUrl = url;
      const lien = lireLienProfond(url);
      if (lien === null) return;
      if (lien.genre === 'restaurant') {
        const connu = restaurantsRef.current.find(r => r.id === lien.id);
        if (connu) ouvrir(connu);
        else { const amorce = { id: lien.id } as RestaurantPublic; setSelection(amorce); setMenu(null); void charger(amorce); }
      } else {
        setDemandeCompte({ reference: null }); setCompteOuvert(true);
        setMessagePanier('Lien de commande reçu : retrouvez son suivi dans vos commandes.');
      }
    };
    // Le routeur intercepte /r/... et /commande/... : le layout dépose le lien, pris ici au montage ou dès son dépôt.
    traiter(prendreLienEnAttente());
    const desabonner = abonnerLienEnAttente((url) => traiter(url));
    void Linking.getInitialURL().then(traiter).catch(() => undefined);
    const abonnement = Linking.addEventListener('url', e => traiter(e.url));
    return () => { actif = false; desabonner(); abonnement.remove(); };
  }, []);
  // Notifications : canaux, appui suivi → « Mon compte », appui `commande_nouvelle` → espace restaurateur. Ne demande jamais l'autorisation ici.
  // L'appui ne ferme JAMAIS l'écran de commande pendant un envoi ou un état incertain : l'ouverture attend la fin du verrou (une seule fois).
  const commandeVerrouillee = useRef(false);
  const ouvertureSuivi = useRef(creerOuvertureDifferee({ verrouille: () => commandeVerrouillee.current, ouvrir: () => { setCommandeOuverte(false); setPanierOuvert(false); setDemandeCompte({ reference: null }); setCompteOuvert(true); } })).current;
  const ouvertureResto = useRef(creerOuvertureDifferee({ verrouille: () => commandeVerrouillee.current, ouvrir: () => { setCommandeOuverte(false); setPanierOuvert(false); setDemandeCompte({ reference: null, espaceRestaurateur: true }); setCompteOuvert(true); } })).current;
  useEffect(() => {
    const debrancherSuivi = brancherOuvertureSuivi(() => ouvertureSuivi.demander());
    const debrancherResto = brancherOuvertureRestaurateur(() => ouvertureResto.demander());
    const arreter = notifications.demarrer();
    return () => { arreter(); debrancherSuivi(); debrancherResto(); };
  }, []);
  // Verrou des espaces professionnels : départ et retour au premier plan (délai de 2 minutes mesuré par le verrou lui-même).
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', etat => { if (etat === 'active') verrouPro.reprise(); else verrouPro.quitte(); });
    return () => abonnement.remove();
  }, []);
  // Suppléments (10.2) et changement de restaurant (G8) : un plat avec suppléments ouvre d'abord leur choix ; un panier d'un autre restaurant demande confirmation avant d'être vidé.
  const [platEnChoix, setPlatEnChoix] = useState<PlatCataloguePublic | null>(null);
  const [remplacement, setRemplacement] = useState<{ plat: PlatCataloguePublic; optionIds: string[] } | null>(null);
  function ajouterAuPanier(p: PlatCataloguePublic, optionIds: string[]) {
    const r = menu?.restaurant; if (!r) return;
    try { panier.ajouter(r, p, optionIds); setMessagePanier(`${p.nom} ajouté à votre panier.`); }
    catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (m === 'AUTRE_RESTAURANT') setRemplacement({ plat: p, optionIds });
      else if (m === 'OPTION_INVALIDE') setMessagePanier('Un supplément choisi n’est plus proposé. Actualisez le menu puis réessayez.');
      else setMessagePanier('Ajout impossible. Vérifiez les quantités du panier (30 maximum par plat).');
    }
  }
  function demanderAjout(p: PlatCataloguePublic) {
    const dispo = menu ? commandabilite(menu.restaurant) : null;
    if (dispo && !dispo.commandable) { setMessagePanier(dispo.titre + '. ' + dispo.message); return; }
    if ((p.options?.length ?? 0) > 0) setPlatEnChoix(p); else ajouterAuPanier(p, []);
  }
  function remplacerPanier() {
    const r = menu?.restaurant; const demande = remplacement; setRemplacement(null);
    if (!r || !demande) return;
    try { panier.remplacerEtAjouter(r, demande.plat, demande.optionIds); setMessagePanier(`${demande.plat.nom} ajouté à votre panier.`); } catch { setMessagePanier('Ajout impossible. Vérifiez la sélection puis réessayez.'); }
  }
  // « Commander à nouveau » (G13) : mémoire locale des commandes envoyées d'ici ; le panier est rebâti sur le menu actuel (changement de restaurant confirmé avant d'être vidé).
  const [memos, setMemos] = useState<MemoCommande[]>([]);
  const [recommandeEnAttente, setRecommandeEnAttente] = useState<MemoCommande | null>(null);
  const [messageRecommande, setMessageRecommande] = useState('');
  const lireMemos = () => { void ouvrirCommandesEnvoyees().then(m => m.lire()).then(setMemos, () => undefined); };
  useEffect(lireMemos, []);
  function memoriserEnvoi(reference: string, envoye: PanierReel) { void ouvrirCommandesEnvoyees().then(m => m.memoriser(reference, envoye)).then(lireMemos, () => undefined); }
  async function recommander(memo: MemoCommande) {
    setRecommandeEnAttente(null);
    try {
      const plan = await panier.recommander(memo);
      setMessageRecommande(libelleRecommande(plan));
      if (plan.ajoutes > 0) { setCompteOuvert(false); setDemandeCompte(null); setPanierOuvert(true); }
    } catch { setMessageRecommande('Impossible de relire le menu du restaurant. Votre panier n’a pas été modifié : réessayez.'); setCompteOuvert(false); setDemandeCompte(null); setPanierOuvert(true); }
  }
  function lancerRecommande(reference: string) {
    const memo = trouverMemo(memos, reference); if (!memo) return;
    if (panier.panier.lignes.length > 0 && panier.panier.restaurantId !== memo.restaurantId) setRecommandeEnAttente(memo); else void recommander(memo);
  }
  function ouvrir(r: RestaurantPublic) { setSelection(r); setMenu(null); void charger(r); }
  function retour() { generation.current++; setCharge(false); setErreur(null); setSelection(null); setMenu(null); }
  useEffect(() => {
    if (!selection || Platform.OS === 'web') return;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => { retour(); return true; });
    return () => abonnement.remove();
  }, [selection]);
  // Accueil (10.3) : zone choisie sans position (m\u00e9moris\u00e9e), filtre, recherche, sections quand la liste est assez longue.
  const [choixZone, setChoixZone] = useState<string | null>(null);
  const [zoneOuverte, setZoneOuverte] = useState(false);
  const [filtre, setFiltre] = useState<IdFiltre>('tous');
  useEffect(() => { void SecureStore.getItemAsync(CLE_ZONE_ACCUEIL).then(v => setChoixZone(v), () => undefined); }, []);
  function choisirZone(id: string) { setChoixZone(id); setZoneOuverte(false); void SecureStore.setItemAsync(CLE_ZONE_ACCUEIL, id).catch(() => undefined); }
  const zones = zonesDisponibles(restaurants);
  const zone = zoneEffective(zones, choixZone);
  const visibles = ordonnerRestaurants(filtrerRestaurants(restaurantsDansZone(restaurants, zone), recherche, filtre));
  const sections = sectionsAccueil(visibles, recherche, filtre);
  const carteRestaurant = (r: RestaurantPublic, cle: string) => { const etat = titreEtatRestaurant(r); const note = libelleNote(r); return <Pressable key={cle} accessibilityRole="button" accessibilityLabel={`Voir le menu de ${r.nom}`} onPress={() => ouvrir(r)} style={[s.carte, { flexDirection: 'row', gap: 14 }, !r.ouvert && { opacity: 0.72 }]}>
    <Vignette url={r.logoUrl ?? r.photoUrl} nom={r.nom} taille={72} />
    <View style={{ flex: 1, gap: 8 }}>
      <Text style={s.nom}>{r.nom}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icone nom="position" taille={16} couleur={c.secondaire} /><Text style={[s.texte, { flex: 1 }]}>{[r.categorie, r.lieu].filter(Boolean).join(' \u00b7 ') || 'Localisation non renseign\u00e9e'}</Text></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Pastille texte={etat.texte} ton={etat.ton} />{note && <Text style={s.secondaire}>{note}</Text>}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ color: c.action, fontFamily: polices.texte, fontWeight: '700' }}>Voir le menu</Text><Icone nom="fleche" taille={16} couleur={c.action} /></View>
    </View>
  </Pressable>; };
  const titreRestaurant = menu?.restaurant ?? selection;
  const nombreArticles = panier.panier.lignes.reduce((total, ligne) => total + ligne.quantite, 0);
  const sousTotal = panier.menu ? chiffrer(panier.panier, panier.menu.plats).total : null;
  // Barre d'onglets (G18) : l'onglet actif se déduit de l'état des écrans ; un appui donne l'état voulu. Panier et Compte s'affichent DANS la page, sous la barre.
  const onglet = ongletActif({ panierOuvert, compteOuvert, demandeCompte });
  const surRestaurants = onglet === 'restaurants';
  const barrePanierVisible = nombreArticles > 0 && surRestaurants;
  function choisirOnglet(id: IdOnglet) {
    const e = etatPourOnglet(id);
    setPanierOuvert(e.panierOuvert); setCompteOuvert(e.compteOuvert); setDemandeCompte(e.demandeCompte); setMessageRecommande('');
    if (id !== 'compte' && id !== 'commandes') { setEspaceDemande(null); setMessageEntree(null); }
    if (e.panierOuvert) void panier.recharger();
  }
  // Retour Android depuis Commandes, Panier ou Compte : on revient à Restaurants au lieu de quitter l'application (la fiche, elle, a son propre retour plus haut).
  useEffect(() => {
    if (selection || onglet === 'restaurants' || Platform.OS === 'web') return;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => { choisirOnglet('restaurants'); return true; });
    return () => abonnement.remove();
  }, [selection, onglet]);
  return <View style={{ flex: 1, backgroundColor: c.fond }}>
    <View style={s.entete}>
      <Image source={require('../../assets/images/speedfood.png')} style={{ width: 36, height: 36 }} /><Text style={s.marque}>Speedfood</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Aide et contact" onPress={() => setAideOuverte(true)} style={s.rondEntete}><Icone nom="message" taille={22} couleur={c.encre} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Visite guidée" onPress={() => setVisiteOuverte(true)} style={s.rondEntete}><Icone nom="info" taille={22} couleur={c.encre} /></Pressable>
    </View>
    {surRestaurants && ageHorsLigne !== null && <View accessibilityRole="alert" style={s.bandeauHorsLigne}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icone nom="alerte" taille={20} couleur={c.avertissement} />
        <Text style={s.bandeauHorsLigneTexte}>Vous êtes hors ligne : voici la dernière version gardée sur ce téléphone, {libelleAgeCache(ageHorsLigne)}. Prix et disponibilités peuvent avoir changé ; commander demande le réseau.</Text>
      </View>
      <Action titre="Réessayer" secondaire agir={() => { void charger(selection); }} disabled={charge} />
    </View>}
    <ScrollView style={surRestaurants ? { flex: 1 } : { display: 'none' }} contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
      {selection && <Action titre="Retour aux restaurants" agir={retour} icone="retour" iconeSeule secondaire />}
      <Text accessibilityRole="header" style={s.titre}>{titreRestaurant?.nom ?? 'Une envie. Un bon repas.'}</Text>
      <Text style={s.texte}>{selection ? [titreRestaurant?.categorie, titreRestaurant?.lieu].filter(Boolean).join(' · ') || 'Localisation non renseignée' : 'Commandez en retrait ou en livraison. Vous réglez le restaurant après sa confirmation.'}</Text>
      {selection && <FavoriFiche restaurantId={selection.id} nom={titreRestaurant?.nom ?? selection.nom ?? 'ce restaurant'} version={compteOuvert ? 1 : 0} ouvrirCompte={() => setCompteOuvert(true)} />}
      <Text accessibilityLiveRegion="polite" style={s.secondaire}>{panier.statut}</Text>
      {panier.erreur && <><Text accessibilityRole="alert" style={s.texte}>{panier.erreur}</Text><Action titre="Réessayer l’enregistrement du panier" agir={panier.reessayer} icone="actualiser" secondaire /></>}
      {messagePanier !== '' && <Text accessibilityRole="alert" style={s.texte}>{messagePanier}</Text>}
      {messageNotifications !== '' && <Text accessibilityLiveRegion="polite" style={s.secondaire}>{messageNotifications}</Text>}
      {erreur && <View style={s.note}><Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>{!charge && <Action titre="Réessayer" agir={() => { void charger(selection); }} />}</View>}
      {charge && <View accessibilityLiveRegion="polite" style={{ gap: 10, alignItems: 'center' }}><ActivityIndicator color={c.action} /><Text style={s.texte}>Chargement du catalogue…</Text></View>}
      {!selection && <>
        <View style={s.rechercheBoite}><Icone nom="recherche" taille={20} couleur={c.secondaire} /><TextInput accessibilityLabel="Rechercher un restaurant, un quartier ou une cuisine" placeholder="Un restaurant, un quartier, une cuisine…" placeholderTextColor={c.secondaire} value={recherche} onChangeText={setRecherche} style={s.rechercheChamp} /></View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{zones.length >= 2 && <Pressable accessibilityRole="button" accessibilityLabel={libelleZone(zone)} onPress={() => setZoneOuverte(true)} style={s.puceZone}><Icone nom="position" taille={16} couleur={c.encre} /><Text style={s.puceTexte}>{libelleZone(zone)}</Text></Pressable>}{FILTRES.map(f => <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ selected: filtre === f.id }} onPress={() => setFiltre(f.id)} style={[s.puceZone, filtre === f.id && { backgroundColor: c.mangue }]}><Text style={s.puceTexte}>{f.libelle}</Text></Pressable>)}</View>
        <Text style={s.secondaire}>{visibles.length} restaurant{visibles.length > 1 ? 's' : ''} sur {restaurants.length} chargé{restaurants.length > 1 ? 's' : ''}.</Text>
        {sections ? <>
          {sections.ouverts.length > 0 && <><Text accessibilityRole="header" style={s.titreSection}>Ouverts maintenant</Text>{sections.ouverts.map(r => carteRestaurant(r, 'ouverts-' + r.id))}</>}
          {sections.mieuxNotes.length > 0 && <><Text accessibilityRole="header" style={s.titreSection}>Les mieux notés</Text>{sections.mieuxNotes.map(r => carteRestaurant(r, 'notes-' + r.id))}</>}
          <Text accessibilityRole="header" style={s.titreSection}>Tous les restaurants</Text>{visibles.map(r => carteRestaurant(r, 'tous-' + r.id))}
        </> : visibles.map(r => carteRestaurant(r, r.id))}
        {!charge && !erreur && visibles.length === 0 && <Text style={s.texte}>{restaurants.length ? 'Aucun restaurant ne correspond à votre recherche.' : 'Aucun restaurant disponible au catalogue pour le moment.'}</Text>}
        {suivant && <Action titre="Charger plus de restaurants" disabled={charge} agir={() => { void charger(null, suivant); }} icone="plus" secondaire />}
      </>}
      {menu && <>
        <EnteteFiche restaurant={menu.restaurant} />
        {nombreAConfirmer(menu.plats) > 0 && <Text style={s.secondaire}>{LEGENDE_A_CONFIRMER}</Text>}
        {grouperMenu(menu.sections, menu.plats).map(g => <View key={'section-' + g.titre} style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={s.titreSection}>{g.titre}</Text>
          {ordonnerPlats(g.plats).map(p => <CartePlat key={p.id} plat={p} desactive={!panier.pret} commandable={commandabilite(menu.restaurant).commandable} ajouter={() => demanderAjout(p)} />)}
        </View>)}
        {!menu.plats.length && <Text style={s.texte}>Aucun plat publié pour ce restaurant.</Text>}
        {menu.suivant && <Action titre="Charger la suite du menu" disabled={charge} agir={() => { void charger(selection, menu.suivant); }} icone="plus" secondaire />}
      </>}
      {(selection ? menu?.luLe : lectureLe) && <Text style={s.secondaire}>Mis à jour le {dateLisible((selection ? menu!.luLe : lectureLe)!)}. La disponibilité peut évoluer.</Text>}
      <Action titre={selection ? 'Actualiser le menu' : 'Actualiser les restaurants'} disabled={charge} agir={() => { void charger(selection); }} icone="actualiser" iconeSeule secondaire />
    </ScrollView>
    {barrePanierVisible && <View style={s.barrePanier} accessibilityRole="summary">
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityLabel={`${nombreArticles} article${nombreArticles > 1 ? 's' : ''} dans votre panier`} style={s.barrePanierTitre}>{nombreArticles} article{nombreArticles > 1 ? 's' : ''}</Text>
        <Text style={s.barrePanierSousTitre}>{sousTotal === null ? 'Total à vérifier' : `Sous-total indicatif · ${new Intl.NumberFormat('fr-FR').format(sousTotal)} GNF`}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Voir le panier" onPress={voirPanier} style={s.barrePanierAction}><Text style={s.barrePanierActionTexte}>Voir le panier</Text></Pressable>
    </View>}
    <PanierReelVue enModal={false} information={messageRecommande} ouvert={onglet === 'panier'} fermer={() => setPanierOuvert(false)} etat={panier} commander={() => { setPanierOuvert(false); setCommandeOuverte(true); }} />
    <CompteReel enModal={false} vue={onglet === 'commandes' ? 'commandes' : 'compte'} ouvert={onglet === 'compte' || onglet === 'commandes'} fermer={() => { setCompteOuvert(false); setDemandeCompte(null); setEspaceDemande(null); setMessageEntree(null); }} demande={demandeCompte} espaceDemande={espaceDemande} messageEntree={messageEntree} recommander={{ references: new Set(memos.map(m => m.reference)), lancer: lancerRecommande }} ouvrirCandidature={() => setCandidatureOuverte(true)} parametres={{ ouvrirVisite: () => setVisiteOuverte(true), oublierCommandes: async () => { const m = await ouvrirCommandesEnvoyees(); await m.oublier(); setMemos([]); await gestion.oublierCommandesAppareil(); } }} />
    <BarreOnglets actif={onglet} articles={nombreArticles} choisir={choisirOnglet} />
    <CommandeReelle ouvert={commandeOuverte} surVerrou={v => { commandeVerrouillee.current = v; ouvertureSuivi.verrouillageChange(); ouvertureResto.verrouillageChange(); }} fermer={() => { setCommandeOuverte(false); setPanierOuvert(true); void panier.recharger(); }} etat={panier}
      ouvrirCompte={() => { setCommandeOuverte(false); setDemandeCompte(null); setCompteOuvert(true); }}
      verifierCommandes={() => { setCommandeOuverte(false); setDemandeCompte({ reference: null }); setCompteOuvert(true); }}
      apresSucces={(reference, envoye) => { memoriserEnvoi(reference, envoye); setMessageRecommande(''); setCommandeOuverte(false); setPanierOuvert(false); setDemandeCompte({ reference }); setCompteOuvert(true); void notifications.apresCommande().then(e => setMessageNotifications(e ? MESSAGES_ETAT[e] : '')); }} />
    <AideReelle ouvert={aideOuverte} fermer={() => setAideOuverte(false)} />
    <VisiteGuidee ouvert={visiteOuverte} variante="client" fermer={() => setVisiteOuverte(false)} />
    <CandidatureReel ouvert={candidatureOuverte} fermer={() => setCandidatureOuverte(false)} ouvrirCompte={() => { setDemandeCompte(null); setCompteOuvert(true); }} />
    <ChoixZone visible={zoneOuverte} zones={zones} nombres={nombreParZone(restaurants, zones)} total={restaurants.length} courante={zone} choisir={choisirZone} fermer={() => setZoneOuverte(false)} />
    <ChoixSupplements key={platEnChoix?.id ?? 'aucun'} plat={platEnChoix} annuler={() => setPlatEnChoix(null)} confirmer={ids => { const p = platEnChoix; setPlatEnChoix(null); if (p) ajouterAuPanier(p, ids); }} />
    <ChangerRestaurant visible={remplacement !== null} nomPanier={panier.menu?.restaurant.nom ?? null} vider={remplacerPanier} garder={() => setRemplacement(null)} />
    <ChangerRestaurant visible={recommandeEnAttente !== null} titreAction="Vider et recommander" nomPanier={panier.menu?.restaurant.nom ?? null} vider={() => { if (recommandeEnAttente) void recommander(recommandeEnAttente); }} garder={() => setRecommandeEnAttente(null)} />
  </View>;
}
const s = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.bordure },
  marque: { fontFamily: polices.titre, fontSize: 26, color: c.encre, flex: 1 }, badge: { color: c.encre, backgroundColor: c.mangue, padding: 8, borderRadius: 10, fontSize: 11, fontFamily: polices.texte },
  contenu: { padding: 22, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 40 },
  bandeauHorsLigne: { marginHorizontal: 16, marginBottom: 8, padding: 12, gap: 10, borderRadius: 14, backgroundColor: c.avertissementFond },
  bandeauHorsLigneTexte: { flex: 1, fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: c.avertissement },
  surtitre: { color: c.secondaire, fontFamily: polices.texte, fontSize: 11 }, titre: { color: c.encre, fontFamily: polices.titre, fontSize: 32, lineHeight: 37 },
  texte: { color: c.encre, fontFamily: polices.texte, fontSize: 15, lineHeight: 23 }, secondaire: { color: c.secondaire, fontFamily: polices.texte, fontSize: 12, lineHeight: 19 },
  puceZone: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1.5, borderColor: c.encre, backgroundColor: c.surface }, puceTexte: { color: c.encre, fontFamily: polices.texte, fontSize: 14 },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, padding: 20, gap: 10 }, nom: { color: c.encre, fontFamily: polices.titre, fontSize: 22 }, titreSection: { color: c.encre, fontFamily: polices.titre, fontSize: 24, marginTop: 8 },
  note: { backgroundColor: c.avertissementFond, borderRadius: 16, padding: 16, gap: 12 }, rechercheBoite: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.champBordure, borderRadius: 18, minHeight: 56, paddingHorizontal: 16 }, rechercheChamp: { flex: 1, minHeight: 54, fontFamily: polices.texte, fontSize: 15, color: c.encre },
  rondEntete: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.bordure, backgroundColor: c.surface },
  action: { backgroundColor: c.action, minHeight: 48, padding: 14, borderRadius: 26, justifyContent: 'center', alignItems: 'center' }, actionTexte: { color: c.surface, fontFamily: polices.texte, fontWeight: '700', fontSize: 14 },
  barrePanier: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 18, backgroundColor: c.encre, shadowColor: c.encre, shadowOpacity: 0.16, shadowRadius: 10, elevation: 4 }, barrePanierTitre: { color: c.surface, fontFamily: polices.texte, fontSize: 15, fontWeight: '700' }, barrePanierSousTitre: { color: c.fond, fontFamily: polices.texte, fontSize: 12 }, barrePanierAction: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, justifyContent: 'center', backgroundColor: c.mangue }, barrePanierActionTexte: { color: c.encre, fontFamily: polices.texte, fontWeight: '700', fontSize: 13 },
});
