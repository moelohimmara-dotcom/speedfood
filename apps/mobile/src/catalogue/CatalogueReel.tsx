import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PageMenu, RestaurantPublic } from '../../../../packages/shared/src/contracts/catalogue';
import { creerLecteurCatalogue, validerPageMenu, validerPageRestaurants } from './client';
import { creerCacheCatalogue, libelleAgeCache } from './cache-catalogue';
import { ouvrirStockageCacheCatalogue } from './cache-catalogue-natif';
import { chiffrer } from './panier-reel';
import { couleurs as c, polices } from '../design/tokens';
import { Bouton } from '../design/Composants';
import { Icone, type NomIcone } from '../design/Icone';
import { usePanierReel } from './usePanierReel';
import { PanierReelVue } from './PanierReelVue';
import { CompteReel } from '../connexion/CompteReel';
import { AideReelle } from '../connexion/AideReelle';
import { FavoriFiche } from '../connexion/FavoriFiche';
import { verrouPro } from '../connexion/verrou-natif';
import { CommandeReelle } from './CommandeReelle';
import { lireLienProfond } from '../connexion/liens-profonds';
import { abonnerLienEnAttente, prendreLienEnAttente } from '../connexion/lien-en-attente';
import { VisiteGuidee, doitOuvrirVisite } from '../connexion/VisiteReel';
import { CandidatureReel } from '../connexion/CandidatureReel';
import { brancherOuvertureRestaurateur, brancherOuvertureSuivi, notifications } from '../notifications';
import { creerOuvertureDifferee } from '../notifications/ouverture';
import { MESSAGES_ETAT } from '../notifications/autorisation';
const lecteur = creerLecteurCatalogue();
const Action = ({ titre, agir, disabled = false, secondaire = false, icone, libelleCourt }: { titre: string; agir(): void; disabled?: boolean; secondaire?: boolean; icone?: NomIcone; libelleCourt?: string }) => <Bouton titre={titre} onPress={agir} disabled={disabled} secondaire={secondaire} icone={icone} libelleCourt={libelleCourt} />;
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
      const cache = creerCacheCatalogue(await ouvrirStockageCacheCatalogue());
      if (r) {
        const res = await cache.lire('menu:' + r.id + ':' + (apres ?? ''), () => lecteur.menu(r.id, apres), validerPageMenu);
        if (numero !== generation.current) return;
        setAgeHorsLigne(res.ageMs);
        const page = res.donnees;
        setMenu(ancien => ({ ...page, plats: apres && ancien ? [...ancien.plats, ...page.plats.filter(p => !ancien.plats.some(a => a.id === p.id))] : page.plats }));
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
  // Visite guidée (A10) : proposée automatiquement au premier lancement seulement ; rouvrable depuis le catalogue.
  useEffect(() => { let actif = true; void doitOuvrirVisite().then(v => { if (actif && v) setVisiteOuverte(true); }); return () => { actif = false; }; }, []);
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
  function ouvrir(r: RestaurantPublic) { setSelection(r); setMenu(null); void charger(r); }
  function retour() { generation.current++; setCharge(false); setErreur(null); setSelection(null); setMenu(null); }
  useEffect(() => {
    if (!selection || Platform.OS === 'web') return;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => { retour(); return true; });
    return () => abonnement.remove();
  }, [selection]);
  const normaliser = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visibles = restaurants.filter(r => normaliser(r.nom+' '+r.lieu+' '+r.categorie).includes(normaliser(recherche.trim())));
  const titreRestaurant = menu?.restaurant ?? selection;
  const nombreArticles = panier.panier.lignes.reduce((total, ligne) => total + ligne.quantite, 0);
  const sousTotal = panier.menu ? chiffrer(panier.panier, panier.menu.plats).total : null;
  const barrePanierVisible = nombreArticles > 0;
  return <View style={{ flex: 1, backgroundColor: c.fond }}>
    <View style={s.entete}><Image source={require('../../assets/images/speedfood.png')} style={{ width: 36, height: 36 }} /><Text style={s.marque}>Speedfood</Text><Text style={s.badge}>CATALOGUE</Text></View>
    <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
      {selection && <Action titre="Retour aux restaurants" agir={retour} icone="retour" secondaire />}
      <Text style={s.surtitre}>LE CATALOGUE SPEEDFOOD</Text>
      <Text accessibilityRole="header" style={s.titre}>{titreRestaurant?.nom ?? 'Une envie. Un bon repas.'}</Text>
      <Text style={s.texte}>{selection ? [titreRestaurant?.categorie, titreRestaurant?.lieu].filter(Boolean).join(' · ') || 'Localisation non renseignée' : 'Découvrez les restaurants et leurs menus publiés.'}</Text>
      {selection && <FavoriFiche restaurantId={selection.id} nom={titreRestaurant?.nom ?? selection.nom ?? 'ce restaurant'} version={compteOuvert ? 1 : 0} ouvrirCompte={() => setCompteOuvert(true)} />}
      <View style={s.note}><Text style={s.texte}>Les menus sont réels. Vous pouvez commander en retrait ou en livraison depuis le panier après connexion ; le paiement en ligne n’est pas encore disponible ici.</Text></View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Action titre={`Voir mon panier · ${panier.panier.lignes.reduce((n,l)=>n+l.quantite,0)} article(s)`} agir={voirPanier} icone="panier" libelleCourt={nombreArticles > 0 ? `Panier (${nombreArticles})` : 'Panier'} />
        <Action titre="Mon compte Speedfood" agir={() => setCompteOuvert(true)} icone="compte" libelleCourt="Compte" />
        <Action titre="Aide et contact" agir={() => setAideOuverte(true)} icone="message" libelleCourt="Aide" />
        <Action titre="Visite guidée" agir={() => setVisiteOuverte(true)} icone="etoile" libelleCourt="Visite" />
      </View>
      <Action titre="J’ai un restaurant" agir={() => setCandidatureOuverte(true)} icone="plat" secondaire />
      <Text accessibilityLiveRegion="polite" style={s.secondaire}>{panier.statut}</Text>
      {panier.erreur && <><Text accessibilityRole="alert" style={s.texte}>{panier.erreur}</Text><Action titre="Réessayer le stockage du panier" agir={panier.reessayer} icone="actualiser" secondaire /></>}
      {messagePanier !== '' && <Text accessibilityRole="alert" style={s.texte}>{messagePanier}</Text>}
      {messageNotifications !== '' && <Text accessibilityLiveRegion="polite" style={s.secondaire}>{messageNotifications}</Text>}
      {erreur && <View style={s.note}><Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>{!charge && <Action titre="Réessayer" agir={() => { void charger(selection); }} />}</View>}
      {charge && <View accessibilityLiveRegion="polite" style={{ gap: 10, alignItems: 'center' }}><ActivityIndicator color={c.action} /><Text style={s.texte}>Chargement du catalogue…</Text></View>}
      {!selection && <>
        <TextInput accessibilityLabel="Rechercher dans les restaurants chargés" placeholder="Restaurant, cuisine, localité…" placeholderTextColor={c.secondaire} value={recherche} onChangeText={setRecherche} style={s.recherche} />
        <Text style={s.secondaire}>Recherche dans {restaurants.length} restaurant{restaurants.length > 1 ? 's chargés' : ' chargé'}.</Text>
        {visibles.map(r => <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Voir le menu de ${r.nom}`} onPress={() => ouvrir(r)} style={s.carte}>
          <Text style={s.nom}>{r.nom}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icone nom="position" taille={16} couleur={c.secondaire} /><Text style={s.texte}>{[r.categorie, r.lieu].filter(Boolean).join(' · ') || 'Localisation non renseignée'}</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ color: c.action, fontFamily: polices.texte, fontWeight: '700' }}>Voir le menu</Text><Icone nom="fleche" taille={16} couleur={c.action} /></View>
        </Pressable>)}
        {!charge && !erreur && visibles.length === 0 && <Text style={s.texte}>{restaurants.length ? 'Aucun résultat parmi les restaurants chargés.' : 'Aucun restaurant disponible au catalogue pour le moment.'}</Text>}
        {suivant && <Action titre="Charger plus de restaurants" disabled={charge} agir={() => { void charger(null, suivant); }} icone="plus" secondaire />}
      </>}
      {menu && <>
        <Text style={s.secondaire}>{menu.restaurant.statutMisAJourLe ? `État déclaré le ${new Date(menu.restaurant.statutMisAJourLe).toLocaleString('fr-FR')} : ${menu.restaurant.ouvert ? 'ouvert' : 'fermé'}.` : 'Ouverture à confirmer.'}</Text>
        {menu.plats.map(p => <View key={p.id} style={s.carte}><Text style={s.nom}>{p.nom}</Text>{p.description !== '' && <Text style={s.texte}>{p.description}</Text>}<Text style={s.nom}>{new Intl.NumberFormat('fr-FR').format(p.prixGnf)} GNF</Text><Text style={s.secondaire}>{{ disponible: 'Disponibilité récemment confirmée', epuise: 'Épuisé', a_confirmer: 'Disponibilité à confirmer' }[p.disponibilite]}</Text>{p.confirmeLe && <Text style={s.secondaire}>Confirmation du {new Date(p.confirmeLe).toLocaleString('fr-FR')}</Text>}
          <Action titre={p.disponibilite === 'epuise' ? `${p.nom} épuisé` : `Ajouter ${p.nom} au panier`} icone="panier" disabled={!panier.pret || p.disponibilite === 'epuise'} agir={() => { try { panier.ajouter(menu.restaurant,p); setMessagePanier(`${p.nom} ajouté à votre sélection.`); } catch(e) { setMessagePanier(e instanceof Error && e.message === 'AUTRE_RESTAURANT' ? 'Votre panier contient un autre restaurant. Ouvrez-le et videz-le volontairement avant de changer.' : 'Ajout impossible. Vérifiez les quantités du panier (30 maximum par plat).'); } }} />
        </View>)}
        {!menu.plats.length && <Text style={s.texte}>Aucun plat publié pour ce restaurant.</Text>}
        {menu.suivant && <Action titre="Charger la suite du menu" disabled={charge} agir={() => { void charger(selection, menu.suivant); }} icone="plus" secondaire />}
      </>}
      {(selection ? menu?.luLe : lectureLe) && <Text style={s.secondaire}>Dernière lecture : {new Date((selection ? menu!.luLe : lectureLe)!).toLocaleString('fr-FR')}. La disponibilité peut évoluer.</Text>}
      {ageHorsLigne !== null && <Text accessibilityRole="alert" style={s.texte}>Vous êtes hors ligne : voici la dernière lecture gardée sur ce téléphone, {libelleAgeCache(ageHorsLigne)}. Les prix et disponibilités peuvent avoir changé ; commander demande le réseau.</Text>}
      <Action titre={selection ? 'Actualiser le menu' : 'Actualiser les restaurants'} disabled={charge} agir={() => { void charger(selection); }} icone="actualiser" secondaire />
    </ScrollView>
    {barrePanierVisible && <View style={s.barrePanier} accessibilityRole="summary">
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityLabel={`${nombreArticles} article${nombreArticles > 1 ? 's' : ''} dans votre panier`} style={s.barrePanierTitre}>{nombreArticles} article{nombreArticles > 1 ? 's' : ''}</Text>
        <Text style={s.barrePanierSousTitre}>{sousTotal === null ? 'Total à vérifier' : `Sous-total indicatif · ${new Intl.NumberFormat('fr-FR').format(sousTotal)} GNF`}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Voir le panier" onPress={voirPanier} style={s.barrePanierAction}><Text style={s.barrePanierActionTexte}>Voir le panier</Text></Pressable>
    </View>}
    <PanierReelVue ouvert={panierOuvert} fermer={() => setPanierOuvert(false)} etat={panier} commander={() => { setPanierOuvert(false); setCommandeOuverte(true); }} />
    <CommandeReelle ouvert={commandeOuverte} surVerrou={v => { commandeVerrouillee.current = v; ouvertureSuivi.verrouillageChange(); ouvertureResto.verrouillageChange(); }} fermer={() => { setCommandeOuverte(false); setPanierOuvert(true); void panier.recharger(); }} etat={panier}
      ouvrirCompte={() => { setCommandeOuverte(false); setDemandeCompte(null); setCompteOuvert(true); }}
      verifierCommandes={() => { setCommandeOuverte(false); setDemandeCompte({ reference: null }); setCompteOuvert(true); }}
      apresSucces={reference => { setCommandeOuverte(false); setPanierOuvert(false); setDemandeCompte({ reference }); setCompteOuvert(true); void notifications.apresCommande().then(e => setMessageNotifications(e ? MESSAGES_ETAT[e] : '')); }} />
    <CompteReel ouvert={compteOuvert} fermer={() => { setCompteOuvert(false); setDemandeCompte(null); }} demande={demandeCompte} />
    <AideReelle ouvert={aideOuverte} fermer={() => setAideOuverte(false)} />
    <VisiteGuidee ouvert={visiteOuverte} variante="client" fermer={() => setVisiteOuverte(false)} />
    <CandidatureReel ouvert={candidatureOuverte} fermer={() => setCandidatureOuverte(false)} ouvrirCompte={() => { setDemandeCompte(null); setCompteOuvert(true); }} />
  </View>;
}
const s = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.bordure },
  marque: { fontFamily: polices.titre, fontSize: 26, color: c.encre, flex: 1 }, badge: { color: c.encre, backgroundColor: c.mangue, padding: 8, borderRadius: 10, fontSize: 11, fontFamily: polices.texte },
  contenu: { padding: 22, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 40 },
  surtitre: { color: c.secondaire, fontFamily: polices.texte, fontSize: 11 }, titre: { color: c.encre, fontFamily: polices.titre, fontSize: 36, lineHeight: 41 },
  texte: { color: c.encre, fontFamily: polices.texte, fontSize: 15, lineHeight: 23 }, secondaire: { color: c.secondaire, fontFamily: polices.texte, fontSize: 12, lineHeight: 19 },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, padding: 20, gap: 10 }, nom: { color: c.encre, fontFamily: polices.titre, fontSize: 22 },
  note: { backgroundColor: c.avertissementFond, borderRadius: 16, padding: 16, gap: 12 }, recherche: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, minHeight: 56, padding: 16, fontFamily: polices.texte, fontSize: 15, color: c.encre },
  action: { backgroundColor: c.action, minHeight: 48, padding: 14, borderRadius: 26, justifyContent: 'center', alignItems: 'center' }, actionTexte: { color: c.surface, fontFamily: polices.texte, fontWeight: '700', fontSize: 14 },
  barrePanier: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 18, backgroundColor: c.encre, shadowColor: c.encre, shadowOpacity: 0.16, shadowRadius: 10, elevation: 4 }, barrePanierTitre: { color: c.surface, fontFamily: polices.texte, fontSize: 15, fontWeight: '700' }, barrePanierSousTitre: { color: c.fond, fontFamily: polices.texte, fontSize: 12 }, barrePanierAction: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: c.mangue }, barrePanierActionTexte: { color: c.encre, fontFamily: polices.texte, fontWeight: '700', fontSize: 13 },
});
