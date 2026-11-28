import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bouton } from '../design/Composants';
import { Icone, type NomIcone } from '../design/Icone';
import { couleurs as c, dureeMouvement, polices } from '../design/tokens';
import { useMouvementReduit } from '../design/mouvement';
import { gestion } from '../connexion/gestion';
import { restaurerSession } from '../connexion/CompteReel';
import { IllustrationAccueil } from './Illustrations';
import { deposerOrientation } from './orientation';
import { CLE_ACCUEIL_VU, DIAPOS_ACCUEIL, PROFILS_ACCUEIL, doitAfficherAccueil, etapeAccueil, type ActionAccueil, type ProfilAccueil } from './parcours-accueil';

const ICONES: Record<ProfilAccueil, NomIcone> = { client: 'panier', restaurateur: 'restaurateur', livreur: 'livreur' };

async function marquerAccueilVu(): Promise<void> {
  try { await SecureStore.setItemAsync(CLE_ACCUEIL_VU, '1'); } catch { /* le parcours se reproposera au prochain lancement : sans gravité */ }
}

/**
 * Parcours d'accueil du premier lancement, par-dessus le catalogue déjà monté : quatre écrans de visite illustrés et animés (« Passer » à tout moment),
 * puis « Qui êtes-vous ? ». Le choix dépose une orientation que le catalogue prend pour ouvrir la création de compte ou la connexion, puis l'espace du profil.
 * Jamais affiché à une personne déjà connectée ; vu une fois par appareil.
 */
export function AccueilPremierLancement() {
  const [visible, setVisible] = useState(false);
  const [etape, setEtape] = useState<'visite' | 'choix'>('visite');
  const [page, setPage] = useState(0);
  const [profilOuvert, setProfilOuvert] = useState<ProfilAccueil | null>(null);
  const reduit = useMouvementReduit();
  const apparition = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let actif = true;
    void (async () => {
      let vu: string | null = null;
      try { vu = await SecureStore.getItemAsync(CLE_ACCUEIL_VU); } catch { vu = null; }
      try { await restaurerSession(); } catch { /* session illisible : traitée par « Mon compte » */ }
      if (actif && doitAfficherAccueil(vu, gestion.connectee)) setVisible(true);
      else if (gestion.connectee) void marquerAccueilVu();
    })();
    return () => { actif = false; };
  }, []);

  /** Chaque changement d'écran : fondu et léger glissement (immédiat en mouvement réduit). */
  function changer(f: () => void) {
    const d = dureeMouvement(reduit, 220);
    Animated.timing(apparition, { toValue: 0, duration: d, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      f();
      Animated.timing(apparition, { toValue: 1, duration: dureeMouvement(reduit, 320), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  }
  function suivant() {
    const e = etapeAccueil(page, DIAPOS_ACCUEIL.length);
    changer(() => { if (e.versChoix) setEtape('choix'); else setPage(e.page); });
  }
  function terminer() { void marquerAccueilVu(); setVisible(false); }
  function choisir(profil: ProfilAccueil, action: ActionAccueil) {
    void marquerAccueilVu();
    setVisible(false);
    deposerOrientation({ profil, action });
  }

  if (!visible) return null;
  const glisse = { opacity: apparition, transform: [{ translateY: apparition.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };
  const diapo = DIAPOS_ACCUEIL[page];
  return <Modal visible transparent={false} animationType="fade" onRequestClose={etape === 'choix' ? () => changer(() => setEtape('visite')) : terminer}>
    <SafeAreaView style={st.page}>
      {etape === 'visite' ? <View style={st.visite}>
        <View style={st.haut}>
          <Text style={st.progression} accessibilityLabel={`Écran ${page + 1} sur ${DIAPOS_ACCUEIL.length}`}>{page + 1} / {DIAPOS_ACCUEIL.length}</Text>
          <Bouton titre="Passer" variante="texte" onPress={() => changer(() => setEtape('choix'))} />
        </View>
        <Animated.View key={diapo.scene} style={[st.centre, glisse]}>
          <IllustrationAccueil scene={diapo.scene} />
          <Text accessibilityRole="header" style={st.titre}>{diapo.titre}</Text>
          <Text style={st.texte}>{diapo.texte}</Text>
        </Animated.View>
        <View style={st.bas}>
          <View style={st.points} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {DIAPOS_ACCUEIL.map((d, i) => <View key={d.scene} style={[st.point, i === page && st.pointActif]} />)}
          </View>
          <Bouton titre={page >= DIAPOS_ACCUEIL.length - 1 ? 'Commencer' : 'Suivant'} onPress={suivant} />
        </View>
      </View> : <Animated.View style={[{ flex: 1 }, glisse]}>
        <ScrollView contentContainerStyle={st.choix}>
          <Text accessibilityRole="header" style={st.titre}>Qui êtes-vous ?</Text>
          <Text style={st.texte}>Choisissez votre profil : Speedfood vous ouvre le bon espace.</Text>
          {PROFILS_ACCUEIL.map(p => {
            const ouvert = profilOuvert === p.profil;
            return <View key={p.profil} style={[st.carte, ouvert && st.carteOuverte]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouvert }} accessibilityLabel={`${p.titre}. ${p.texte}`} onPress={() => setProfilOuvert(ouvert ? null : p.profil)} style={st.carteTete}>
                <View style={[st.pastille, ouvert && st.pastilleActive]}><Icone nom={ICONES[p.profil]} couleur={ouvert ? c.surface : c.action} /></View>
                <View style={{ flex: 1, gap: 2 }}><Text style={st.carteTitre}>{p.titre}</Text><Text style={st.carteTexte}>{p.texte}</Text></View>
                <Icone nom={ouvert ? 'bas' : 'chevron'} couleur={c.secondaire} taille={20} />
              </Pressable>
              {ouvert && <View style={st.actions}>
                <Bouton titre="Nouveau, je crée mon compte" onPress={() => choisir(p.profil, 'nouveau')} />
                <Bouton titre="J’ai déjà un compte, je me connecte" variante="contour" onPress={() => choisir(p.profil, 'existant')} />
              </View>}
            </View>;
          })}
          <Bouton titre="Découvrir les restaurants sans compte" variante="texte" onPress={terminer} />
        </ScrollView>
      </Animated.View>}
    </SafeAreaView>
  </Modal>;
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fond },
  visite: { flex: 1, paddingHorizontal: 24, paddingVertical: 12, width: '100%', maxWidth: 620, alignSelf: 'center' },
  haut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progression: { fontFamily: polices.texte, fontSize: 13, color: c.secondaire },
  centre: { flex: 1, justifyContent: 'center', gap: 18 },
  titre: { fontFamily: polices.titre, fontSize: 30, lineHeight: 36, color: c.encre, textAlign: 'center' },
  texte: { fontFamily: polices.texte, fontSize: 16, lineHeight: 24, color: c.encre, textAlign: 'center' },
  bas: { gap: 18, paddingBottom: 8 },
  points: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.bordure },
  pointActif: { width: 28, backgroundColor: c.action },
  choix: { padding: 24, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center' },
  carte: { backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.bordure, overflow: 'hidden' },
  carteOuverte: { borderColor: c.action, borderWidth: 1.5 },
  carteTete: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 72 },
  pastille: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.actionTeinte, alignItems: 'center', justifyContent: 'center' },
  pastilleActive: { backgroundColor: c.action },
  carteTitre: { fontFamily: polices.titre, fontSize: 19, color: c.encre },
  carteTexte: { fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: c.secondaire },
  actions: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
});
