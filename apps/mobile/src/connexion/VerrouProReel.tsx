import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { chargerVerrou, verrouPro } from './verrou-natif';
/**
 * Verrou des espaces professionnels (parité Kotlin, lot 1, ligne A7) : écran de verrouillage et réglage. Le contenu reste MONTÉ sous le voile : une action en cours (réponse à une commande,
 * envoi incertain) n'est jamais perdue parce que le téléphone est resté 2 minutes en arrière-plan.
 */
function useVerrou() {
  const [, rafraichir] = useState(0);
  useEffect(() => { let actif = true; void chargerVerrou().then(() => { if (actif) rafraichir(n => n + 1); }); const stop = verrouPro.abonner(() => { if (actif) rafraichir(n => n + 1); }); return () => { actif = false; stop(); }; }, []);
  return verrouPro;
}

export function PorteVerrou({ children, retour }: { children: ReactNode; retour(): void }) {
  const verrou = useVerrou(); const verrouille = !verrou.peutAfficher();
  const [echec, setEchec] = useState(false); const enCours = useRef(false);
  async function demander() {
    if (enCours.current) return;
    enCours.current = true; setEchec(false);
    try { const ok = await verrou.deverrouiller(); setEchec(!ok); } finally { enCours.current = false; }
  }
  // La demande part d'elle-même quand l'écran de verrouillage apparaît ; le bouton permet de recommencer.
  useEffect(() => { if (verrouille) void demander(); }, [verrouille]);
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} importantForAccessibility={verrouille ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={verrouille}>{children}</View>
    {verrouille && <View accessibilityViewIsModal style={s.voile}>
      <Text accessibilityRole="header" style={s.titre}>Espace verrouillé</Text>
      <Text style={s.texte}>Pour protéger votre espace professionnel, déverrouillez-le avec l’empreinte, le visage ou le code de votre téléphone.</Text>
      {echec && <Text accessibilityRole="alert" style={s.texte}>Le déverrouillage n’a pas abouti. Vous pouvez réessayer.</Text>}
      <Bouton titre="Déverrouiller" onPress={() => { void demander(); }} />
      <Bouton titre="Retour" secondaire onPress={retour} />
    </View>}
  </View>;
}

/** Réglage « Verrouiller mes espaces professionnels » (désactivé par défaut), affiché dans « Mon compte » pour un restaurateur ou un livreur. */
export function ReglageVerrou() {
  const verrou = useVerrou();
  const [occupe, setOccupe] = useState(false); const [message, setMessage] = useState(''); const enCours = useRef(false);
  async function changer() {
    if (enCours.current) return;
    enCours.current = true; setOccupe(true); setMessage('');
    try {
      const voulu = !verrou.actif;
      const ok = await verrou.regler(voulu);
      setMessage(ok ? (voulu ? 'Verrouillage activé.' : 'Verrouillage désactivé.') : voulu ? 'Le verrouillage n’a pas été activé : la vérification n’a pas abouti.' : 'Le verrouillage n’a pas pu être désactivé. Réessayez.');
    } finally { enCours.current = false; setOccupe(false); }
  }
  return <View style={s.bloc}>
    <Text accessibilityRole="header" style={s.sousTitre}>Verrouillage de mes espaces professionnels</Text>
    <Text style={s.texte}>{verrou.actif ? 'Activé : votre espace demande l’empreinte, le visage ou le code du téléphone à l’ouverture et après 2 minutes passées en arrière-plan.' : 'Désactivé. Activez-le si ce téléphone est partagé.'}</Text>
    {!verrou.disponible && !verrou.actif
      ? <Text style={s.texte}>Pour l’activer, configurez d’abord un verrouillage d’écran (code, schéma, empreinte ou visage) dans les réglages du téléphone.</Text>
      : <Bouton titre={verrou.actif ? 'Désactiver le verrouillage' : 'Activer le verrouillage'} secondaire disabled={occupe} onPress={() => { void changer(); }} />}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
  </View>;
}
const s = StyleSheet.create({
  voile: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.fond, padding: 22, gap: 16, justifyContent: 'center' },
  bloc: { gap: 8 },
  titre: { fontFamily: polices.titre, fontSize: 30, color: c.encre },
  sousTitre: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
});
