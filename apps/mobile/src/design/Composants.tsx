import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, type TextProps, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { couleurs as c, dureeMouvement, polices } from './tokens';
import { useMouvementReduit } from './mouvement';
import { Icone, type NomIcone } from './Icone';
import { useApplication } from '../etat/Application';
export function Texte({ style, ...props }: TextProps) { return <Text {...props} style={[s.texte, style]} />; }
export function Titre({ children, petit = false }: PropsWithChildren<{ petit?: boolean }>) { return <Texte accessibilityRole="header" style={[s.titre, petit && { fontSize: 25 }]}>{children}</Texte>; }
/**
 * Les cinq niveaux d'un bouton (un seul « plein » par écran, comme dans les applications actuelles) :
 * `plein` (action principale), `teinte` (action secondaire, c'est le sens de `secondaire`), `contour` (choix neutre), `texte` (action légère),
 * `danger` (destructif : contour rouge, jamais le rempli de l'action principale).
 */
export type VarianteBouton = 'plein' | 'teinte' | 'contour' | 'texte' | 'danger';
interface ApparenceBouton { fond: string; texte: string; bordure?: string; pression: string }
function apparence(v: VarianteBouton, disabled: boolean): ApparenceBouton {
  if (disabled) return { fond: v === 'texte' ? 'transparent' : c.desactiveFond, texte: c.desactiveTexte, pression: c.desactiveFond };
  switch (v) {
    case 'plein': return { fond: c.action, texte: c.surface, pression: '#9A2119' };
    case 'teinte': return { fond: c.actionTeinte, texte: c.actionTeinteTexte, pression: '#F6D6D0' };
    case 'contour': return { fond: 'transparent', texte: c.encre, bordure: c.contour, pression: c.actionTeinte };
    case 'texte': return { fond: 'transparent', texte: c.action, pression: c.actionTeinte };
    case 'danger': return { fond: 'transparent', texte: c.danger, bordure: c.danger, pression: c.dangerFond };
  }
}
/** `libelle` : texte affiché quand il est plus court que le titre (le nom du plat est déjà au-dessus du bouton) ; le titre complet reste le nom accessible. */
export function Bouton({ titre, libelle, onPress, secondaire = false, variante, disabled = false, icone, iconeSeule = false, libelleCourt, testID }: { titre: string; libelle?: string; onPress(): void; secondaire?: boolean; variante?: VarianteBouton; disabled?: boolean; icone?: NomIcone; iconeSeule?: boolean; libelleCourt?: string; testID?: string }) {
  const niveau: VarianteBouton = variante ?? (secondaire ? 'teinte' : 'plein');
  const a = apparence(niveau, disabled);
  if (libelleCourt && icone) {
    // Tuile d'accueil : icône au-dessus, mot court dessous ; le nom accessible reste le titre complet.
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={titre} testID={testID} disabled={disabled} onPress={onPress}
      android_ripple={{ color: c.actionTeinte }}
      style={({ pressed }) => [s.boutonTuile, secondaire && s.boutonSecondaire, disabled && { backgroundColor: c.bordure }, pressed && { opacity: .85 }]}>
      <Icone nom={icone} couleur={c.action} taille={26} />
      <Texte style={{ color: c.encre, fontWeight: '700', fontSize: 12.5, textAlign: 'center' }}>{libelleCourt}</Texte>
    </Pressable>;
  }
  // Icône seule : le nom accessible reste le titre complet (jamais un bouton muet). Action principale : rond plein de 48 px (ajouter au panier) ;
  // sinon icône discrète sur zone de toucher de 48 px, qui se teinte au toucher (actualiser, retour, supprimer).
  const plein = niveau === 'plein';
  // Retour : flèche sombre, comme dans les applications courantes ; les autres icônes seules prennent la couleur de leur niveau.
  const couleurIcone = plein ? c.surface : disabled ? c.desactiveTexte : niveau === 'danger' ? c.danger : niveau === 'teinte' || niveau === 'contour' || icone === 'retour' ? c.encre : c.action;
  // Une icône seule se place sans s'étirer : le retour à gauche, l'actualisation à droite.
  const placement = icone === 'actualiser' ? { alignSelf: 'flex-end' as const } : { alignSelf: 'flex-start' as const };
  if (iconeSeule && icone) {
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={titre} testID={testID} disabled={disabled} onPress={onPress}
      android_ripple={{ color: plein ? '#9A2119' : a.pression, borderless: false }}
      style={({ pressed }) => [s.boutonIcone, placement, niveau === 'contour' && { borderWidth: 1.5, borderColor: disabled ? c.bordure : c.contour }, niveau === 'danger' && { borderWidth: 1.5, borderColor: disabled ? c.bordure : c.danger }, plein ? { backgroundColor: disabled ? c.desactiveFond : pressed ? a.pression : c.action } : { backgroundColor: pressed ? a.pression : niveau === 'teinte' && !disabled ? c.actionTeinte : 'transparent' }, pressed && { transform: [{ scale: .96 }] }]}>
      <Icone nom={icone} couleur={couleurIcone} taille={24} />
    </Pressable>;
  }
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={titre} testID={testID} disabled={disabled} onPress={onPress}
    android_ripple={{ color: a.pression }}
    style={({ pressed }) => [s.bouton, { backgroundColor: pressed ? a.pression : a.fond }, a.bordure ? { borderWidth: 1.5, borderColor: a.bordure } : null, niveau === 'texte' && s.boutonTexte, niveau === 'texte' && icone === 'retour' && { alignSelf: 'flex-start' }, pressed && { transform: [{ scale: .985 }] }]}>
    {icone && <Icone nom={icone} couleur={a.texte} taille={22} />}
    <Texte style={{ color: a.texte, fontWeight: '700', fontSize: 16, lineHeight: 22, textAlign: 'center', flexShrink: 1 }}>{libelle ?? titre}</Texte>
  </Pressable>;
}
/**
 * Ligne de navigation (écran Compte, réglages) : icône dans un rond teinté, titre, aide courte, flèche. Les lignes d'un même groupe se suivent dans une carte ;
 * `premiere` supprime le trait de séparation du haut. Remplace les gros boutons rouges qui ne sont pas des actions mais des destinations.
 */
export function LigneNavigation({ titre, sousTitre, icone, onPress, disabled = false, premiere = false, actif = false, testID }: { titre: string; sousTitre?: string; icone: NomIcone; onPress(): void; disabled?: boolean; premiere?: boolean; actif?: boolean; testID?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={sousTitre ? titre + '. ' + sousTitre : titre} accessibilityState={{ disabled, selected: actif }} testID={testID} disabled={disabled} onPress={onPress}
    android_ripple={{ color: c.actionTeinte }}
    style={({ pressed }) => [s.ligneNav, !premiere && { borderTopWidth: 1, borderTopColor: c.bordure }, actif && { backgroundColor: c.actionTeinte }, pressed && { backgroundColor: c.surfaceAlt }, disabled && { opacity: .5 }]}>
    <View style={[s.rondNav, actif && { backgroundColor: c.surface }]}><Icone nom={icone} couleur={c.action} taille={22} /></View>
    <View style={{ flex: 1, gap: 2 }}>
      <Texte style={{ fontWeight: '700', fontSize: 16, lineHeight: 22 }}>{titre}</Texte>
      {sousTitre ? <Texte style={{ color: c.secondaire, fontSize: 13, lineHeight: 18 }}>{sousTitre}</Texte> : null}
    </View>
    <Icone nom="chevron" couleur={c.secondaire} taille={20} />
  </Pressable>;
}
/**
 * Onglets à icônes seules (commutateur segmenté) : une icône par section, la section active en plein, le nom accessible dit toujours la section en toutes lettres.
 * L'écran qui l'utilise affiche le titre de la section active juste dessous : l'icône seule suffit pour choisir, le mot confirme où l'on est.
 */
export function OngletsIcones<T extends string>({ onglets, actif, choisir, desactive = false }: { onglets: ReadonlyArray<{ id: T; libelle: string; icone: NomIcone }>; actif: T; choisir(id: T): void; desactive?: boolean }) {
  return <View accessibilityRole="tablist" style={s.segments}>
    {onglets.map(o => {
      const selectionne = o.id === actif;
      return <Pressable key={o.id} accessibilityRole="tab" accessibilityLabel={o.libelle} accessibilityState={{ selected: selectionne, disabled: desactive }} disabled={desactive}
        android_ripple={{ color: c.actionTeinte, borderless: false }} onPress={() => choisir(o.id)}
        style={({ pressed }) => [s.segment, selectionne && { backgroundColor: c.action }, !selectionne && pressed && { backgroundColor: c.actionTeinte }, desactive && !selectionne && { opacity: .5 }]}>
        <Icone nom={o.icone} taille={24} couleur={selectionne ? c.surface : c.secondaire} />
      </Pressable>;
    })}
  </View>;
}
/** Carte qui regroupe des lignes de navigation. */
export function GroupeLignes({ children }: PropsWithChildren) { return <View style={s.groupeNav}>{children}</View>; }
export function Ecran({ children, retour = false, style }: PropsWithChildren<{ retour?: boolean; style?: ViewStyle }>) {
  const { statutSauvegarde, reessayerSauvegarde } = useApplication();
  return <View style={s.ecran}>
    <View style={s.entete}>
      {retour && <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/')} accessibilityRole="button" accessibilityLabel="Retour" style={s.touche}><Icone nom="retour" /></Pressable>}
      <Image source={require('../../assets/images/speedfood.png')} style={{ width: 34, height: 34, borderRadius: 10 }} accessibilityIgnoresInvertColors />
      <Texte style={{ fontFamily: polices.titre, fontSize: 25, fontWeight: '800' }}>Speedfood</Texte>
      <View style={{ flex: 1 }} /><View style={s.badge}><Texte style={{ fontSize: 11, fontWeight: '700' }}>DÉMO</Texte></View>
    </View>
    <View style={{ paddingHorizontal: 22, paddingVertical: 5, backgroundColor: statutSauvegarde === 'erreur' ? c.avertissementFond : c.fond }}>
      <Texte accessibilityLiveRegion="polite" style={{ color: statutSauvegarde === 'erreur' ? c.avertissement : c.secondaire, fontSize: 11, lineHeight: 17 }}>
        {{ pret: 'Données locales prêtes', enregistrement: 'Enregistrement sur cet appareil…', enregistre: 'Enregistré sur cet appareil', erreur: 'Non enregistré : vos changements restent en mémoire.' }[statutSauvegarde]}
      </Texte>
      {statutSauvegarde === 'erreur' && <Pressable onPress={reessayerSauvegarde} accessibilityRole="button" accessibilityLabel="Réessayer la sauvegarde" style={{ minHeight: 44, justifyContent: 'center' }}><Texte style={{ color: c.action, fontWeight: '700' }}>Réessayer la sauvegarde</Texte></Pressable>}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.contenu, style]}>
      {children}
      <Texte style={s.noteFin}>Version de démonstration · données fictives.{ '\n' }Aucune commande réelle ni paiement.</Texte>
    </ScrollView>
  </View>;
}
/**
 * Squelette de chargement : des barres qui respirent en opacité pendant une lecture (charte animations).
 * En mouvement réduit, le squelette est statique ; il ne remplace jamais un message d'état annoncé.
 */
export function Squelette({ lignes = 3 }: { lignes?: number }) {
  const reduit = useMouvementReduit();
  const opacite = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduit) { opacite.setValue(0.8); return; }
    const boucle = Animated.loop(Animated.sequence([
      Animated.timing(opacite, { toValue: 0.45, duration: dureeMouvement(reduit, 700), useNativeDriver: true }),
      Animated.timing(opacite, { toValue: 1, duration: dureeMouvement(reduit, 700), useNativeDriver: true }),
    ]));
    boucle.start();
    return () => boucle.stop();
  }, [reduit, opacite]);
  return <Animated.View accessibilityLabel="Chargement en cours" style={{ gap: 10, opacity: opacite }}>
    {Array.from({ length: lignes }, (_, i) => <View key={i} style={{ height: 16, borderRadius: 8, backgroundColor: c.bordure, width: i === lignes - 1 ? '55%' : '100%' }} />)}
  </Animated.View>;
}
export function EtatVide({ titre, message, action = 'Découvrir les restaurants', onPress = () => router.push('/') }: { titre: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={{ gap: 18, paddingVertical: 36 }}><View style={s.pastille}><Icone nom="panier" taille={30} /></View><Titre>{titre}</Titre><Texte style={{ color: c.secondaire, lineHeight: 24 }}>{message}</Texte><Bouton titre={action} onPress={onPress} /></View>;
}
export const s = StyleSheet.create({
  texte: { fontFamily: polices.texte, color: c.encre, fontSize: 15, lineHeight: 23 },
  titre: { fontFamily: polices.titre, fontWeight: '700', fontSize: 32, lineHeight: 37, color: c.encre },
  ecran: { flex: 1, backgroundColor: c.fond },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, minHeight: 68, borderBottomColor: c.bordure, borderBottomWidth: 1 },
  contenu: { padding: 22, gap: 22, width: '100%', maxWidth: 660, alignSelf: 'center', paddingBottom: 30 },
  touche: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  bouton: { minHeight: 52, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 26, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  boutonTexte: { minHeight: 48, paddingHorizontal: 14 },
  boutonSecondaire: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.encre },
  boutonIcone: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ligneNav: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  rondNav: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.actionTeinte, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 28 },
  segment: { flex: 1, minHeight: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  groupeNav: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 20, overflow: 'hidden' },
  boutonTuile: { flex: 1, minHeight: 76, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { backgroundColor: c.mangue, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  note: { backgroundColor: c.avertissementFond, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: c.bordure },
  noteFin: { textAlign: 'center', fontSize: 12, lineHeight: 18, color: c.secondaire, paddingTop: 10 },
  pastille: { backgroundColor: c.mangue, borderRadius: 24, padding: 20, alignSelf: 'flex-start' },
});
