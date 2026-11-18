import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import {
  DELAI_RELECTURE_DOSSIER_MS, EXPLICATION_PAR_DEFAUT, MESSAGE_DOSSIER_ILLISIBLE, NOTE_DOSSIER, TITRE_DOSSIER, piecesManquantes, resumeDossier, type DossierLivreur,
} from './dossier-livreur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * « Mon dossier » du livreur (parité Kotlin, `LivreurCompteScreen`) : une phrase (« Votre dossier est complet. » ou ce qui manque), l'explication de chaque pièce
 * manquante et, si le serveur en envoie un, son message. Lecture seule : l'application ne montre que l'ÉTAT des pièces, jamais un document ni un numéro.
 * Relue à l'ouverture, toutes les minutes tant que la rubrique est ouverte, et à la demande ; une lecture qui échoue garde le dernier état connu (jamais un
 * dossier « complet » inventé) et le dit.
 */
export function DossierLivreurReel() {
  const [dossier, setDossier] = useState<DossierLivreur | null | undefined>(undefined);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true);
    try { const d = await gestion.dossierLivreur(); if (actif.current) { setDossier(d); setErreur(null); } }
    catch (e) { if (actif.current) setErreur(e instanceof ErreurConnexion ? e.message : MESSAGE_DOSSIER_ILLISIBLE); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => {
    void lire();
    const minuteur = setInterval(() => { void lire(); }, DELAI_RELECTURE_DOSSIER_MS);
    return () => clearInterval(minuteur);
  }, []);

  return <View style={s.carte}>
    <View style={s.entete}>
      <Text accessibilityRole="header" style={s.titre}>{TITRE_DOSSIER}</Text>
      <Action titre="Actualiser mon dossier" variante="texte" icone="actualiser" iconeSeule agir={() => { void lire(); }} disabled={chargement} />
    </View>
    {chargement && dossier === undefined && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.secondaire}>Lecture de votre dossier…</Text></>}
    {dossier === undefined && !chargement && erreur === null && <Text style={s.secondaire}>{MESSAGE_DOSSIER_ILLISIBLE}</Text>}
    {dossier === null && <Text style={s.texte}>Ce compte n’est pas un compte livreur.</Text>}
    {dossier && <>
      <Text style={s.texte}>{resumeDossier(dossier)}</Text>
      {piecesManquantes(dossier).map(p => <Text key={p.code + p.libelle} style={s.avertissement}>{p.explication.trim() === '' ? EXPLICATION_PAR_DEFAUT : p.explication}</Text>)}
      {dossier.message !== null && dossier.message.trim() !== '' && <Text style={s.secondaire}>{dossier.message}</Text>}
    </>}
    {erreur !== null && <Text accessibilityRole="alert" style={s.erreur}>{dossier === undefined ? MESSAGE_DOSSIER_ILLISIBLE : 'Dernière lecture impossible : ' + erreur + ' Ce que vous voyez est le dernier état connu.'}</Text>}
    <Text style={s.secondaire}>{NOTE_DOSSIER}</Text>
  </View>;
}

const s = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 16, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 14, color: c.secondaire },
  avertissement: { fontFamily: polices.texte, fontSize: 14, color: c.actionTeinteTexte },
  erreur: { fontFamily: polices.texte, fontSize: 14, color: c.danger },
});
