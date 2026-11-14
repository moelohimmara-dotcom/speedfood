import { Stack, router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { deposerLienEnAttente } from '../connexion/lien-en-attente';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View, Text, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApplicationProvider, useApplication } from '../etat/Application';
import { couleurs as c } from '../design/tokens';
import { Icone, type NomIcone } from '../design/Icone';
import { Texte } from '../design/Composants';
import { CatalogueReel } from '../catalogue/CatalogueReel';
import { BandeauMiseAJour } from '../livraison/BandeauMiseAJour';
function Navigation() {
  const chemin = usePathname();
  const insets = useSafeAreaInsets();
  const { panier } = useApplication();
  const nombre = panier.lignes.reduce((n, l) => n + l.quantite, 0);
  const entrees: { titre: string; chemin: '/' | '/favoris' | '/panier' | '/compte'; icone: NomIcone }[] = [
    { titre: 'Découvrir', chemin: '/', icone: 'accueil' }, { titre: 'Favoris', chemin: '/favoris', icone: 'coeur' },
    { titre: 'Panier', chemin: '/panier', icone: 'panier' }, { titre: 'Compte', chemin: '/compte', icone: 'compte' },
  ];
  return <View style={{ backgroundColor: c.surface, borderTopColor: c.bordure, borderTopWidth: 1, paddingBottom: Math.max(insets.bottom, 12), paddingTop: 10 }}><View style={{ flexDirection: 'row', width: '100%', maxWidth: 660, alignSelf: 'center' }}>
    {entrees.map(e => { const actif = e.chemin === '/' ? chemin === '/' || chemin.startsWith('/restaurant') : chemin === e.chemin;
      return <Pressable key={e.chemin} onPress={() => router.navigate(e.chemin)} accessibilityRole="tab" accessibilityState={{ selected: actif }} {...(Platform.OS === 'web' ? { 'aria-selected': actif } : {})} accessibilityLabel={e.titre === 'Panier' ? `Panier, ${nombre} article${nombre > 1 ? 's' : ''}` : e.titre} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <View><Icone nom={e.icone} couleur={actif ? c.action : c.secondaire} />{e.chemin === '/panier' && nombre > 0 && <View style={{ position: 'absolute', right: -12, top: -6, backgroundColor: c.action, borderRadius: 10, minWidth: 19, alignItems: 'center' }}><Texte style={{ fontSize: 10, color: c.surface, lineHeight: 18 }}>{nombre}</Texte></View>}</View>
        <Texte style={{ color: actif ? c.action : c.secondaire, fontSize: 11, fontWeight: actif ? '700' : '500' }}>{e.titre}</Texte>
      </Pressable>;
    })}
  </View></View>;
}
export default function Layout() {
  const chemin = usePathname();
  // Liens profonds (A12) : le routeur reçoit /r/:id et /commande/:jeton avant l'écran catalogue.
  // Le lien reconstruit est déposé pour le catalogue (seul juge des hôtes et chemins connus), puis on revient à l'accueil.
  useEffect(() => {
    if (!chemin) return;
    const m = /^\/(r|commande)\/([^/]+)$/.exec(chemin);
    if (m) {
      deposerLienEnAttente('https://speedfood.dev/' + m[1] + '/' + m[2]);
      router.replace('/');
    }
  }, [chemin]);
  const [chargees, erreur] = useFonts({ Manrope: require('../../assets/fonts/manrope.ttf'), Bricolage: require('../../assets/fonts/bricolage.ttf') });
  if (!chargees && !erreur) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fond }}><Text>Speedfood</Text></View>;
  // Premier branchement réel en lecture. Aucun écran démo ni stockage démo monté.
  return <SafeAreaProvider><SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.fond }}><StatusBar style="dark" /><BandeauMiseAJour /><CatalogueReel /></SafeAreaView></SafeAreaProvider>;
}
/** Conservé pour retour arrière du démonstrateur, non monté par le catalogue réel. */
export function LayoutDemonstration() {
  return <SafeAreaProvider><ApplicationProvider><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.fond }}>
    <StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fond } }} /><Navigation />
  </SafeAreaView></ApplicationProvider></SafeAreaProvider>;
}
