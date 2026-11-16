import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone } from '../design/Icone';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurEspaceClient, type FavoriClient } from './espace-client';
import { etatFavori, libelleFavori } from './favori-fiche';
import { couleurs as c, polices } from '../design/tokens';
/**
 * Bouton « favori » de la fiche restaurant (parité Kotlin, lot 1, ligne B9). L'état est LU sur le serveur avant toute action ; la bascule est faite en un seul essai puis l'état réel est relu
 * (même après un refus ou un résultat incertain) : un favori se bascule, on ne rejoue jamais. `version` change quand l'écran du compte se ferme : la session a pu changer.
 */
export function FavoriFiche({ restaurantId, nom, version, ouvrirCompte }: { restaurantId: string; nom: string; version: number; ouvrirCompte(): void }) {
  const [favoris, setFavoris] = useState<FavoriClient[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState(false);
  const [attente, setAttente] = useState(false); const [message, setMessage] = useState('');
  const enCours = useRef(false); const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);
  async function lire() {
    try { const e = await gestion.espaceComplet(); if (actif.current) { setFavoris(e.favoris); setErreurLecture(false); } }
    catch (e) { if (actif.current) { setFavoris(null); setErreurLecture(!(e instanceof ErreurConnexion && e.definitive)); } }
  }
  useEffect(() => {
    setFavoris(null); setErreurLecture(false); setMessage('');
    if (!gestion.connectee || enCours.current) return;
    enCours.current = true; setAttente(true);
    void lire().finally(() => { enCours.current = false; if (actif.current) setAttente(false); });
  }, [restaurantId, version]);
  async function basculer() {
    if (enCours.current) return;
    enCours.current = true; setAttente(true); setMessage('');
    try {
      try { const r = await gestion.basculerFavori(restaurantId); if (actif.current) setMessage(r.message); }
      catch (e) { if (actif.current) setMessage(e instanceof ErreurEspaceClient || e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.'); }
      await lire();
    } finally { enCours.current = false; if (actif.current) setAttente(false); }
  }
  const etat = etatFavori({ connectee: gestion.connectee, favoris, erreurLecture }, restaurantId);
  const titre = libelleFavori(etat, nom);
  // Cœur seul, compris de tous : plein quand le restaurant est en favori, vide sinon. Le nom accessible dit l'action exacte (« Ajouter X aux favoris »…).
  return <View style={s.bloc}>
    {titre !== null && <Pressable accessibilityRole="button" accessibilityLabel={titre} accessibilityState={{ disabled: attente, selected: etat === 'favori' }} disabled={attente} style={[s.coeur, etat === 'favori' && s.coeurActif, attente && { opacity: .5 }]}
      onPress={() => { if (etat === 'connexion') ouvrirCompte(); else if (etat === 'indisponible') { enCours.current = true; setAttente(true); void lire().finally(() => { enCours.current = false; if (actif.current) setAttente(false); }); } else void basculer(); }}>
      <Icone nom="coeur" taille={26} couleur={etat === 'favori' ? c.action : c.encre} rempli={etat === 'favori'} />
    </Pressable>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
  </View>;
}
const s = StyleSheet.create({ bloc: { gap: 8 }, texte: { fontFamily: polices.texte, fontSize: 13, lineHeight: 20, color: c.secondaire },
  coeur: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.bordure, backgroundColor: c.surface }, coeurActif: { borderColor: c.action, borderWidth: 2 } });
