import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { gestion } from './gestion';
import { MESSAGE_ETAT_ILLISIBLE, messagePublication, type EtatPublication } from './etat-restaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Bandeau d'état de publication de l'espace restaurateur (comme celui de la console du site) : « Une correction est demandée avant publication : … », « pas encore visible
 * au catalogue » ou « suspendu ». Rien n'est affiché quand le restaurant est publié et que rien n'est à corriger. Lecture seule, relue à l'ouverture et à la demande.
 * Une lecture qui échoue ne bloque jamais l'écran : elle garde le dernier état connu et le dit, sans jamais inventer un état « tout va bien ».
 */
export function EtatPublicationReel() {
  const [etat, setEtat] = useState<EtatPublication | null>(null);
  const [erreur, setErreur] = useState(false);
  const [chargement, setChargement] = useState(false);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true);
    try { const e = await gestion.etatRestaurant(); if (actif.current) { setEtat(e); setErreur(false); } }
    catch { if (actif.current) setErreur(true); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lire(); }, []);

  const message = etat !== null ? messagePublication(etat) : null;
  if (message === null && !erreur) return null;
  return <View style={s.carte}>
    {message !== null && <Text accessibilityRole="alert" style={s.texte}>{message}</Text>}
    {erreur && <Text accessibilityRole="alert" style={s.erreur}>{etat === null ? MESSAGE_ETAT_ILLISIBLE : 'Dernière lecture impossible : ce que vous voyez est le dernier état connu.'}</Text>}
    <Action titre="Actualiser l’état de publication" variante="texte" icone="actualiser" iconeSeule agir={() => { void lire(); }} disabled={chargement} />
  </View>;
}

const s = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderRadius: 18, backgroundColor: c.actionTeinte },
  texte: { fontFamily: polices.texte, fontSize: 16, color: c.actionTeinteTexte },
  erreur: { fontFamily: polices.texte, fontSize: 14, color: c.danger },
});
