import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { gestion } from './gestion';
import { LIBELLE_PALIER_SCORE, type ScoreRestaurateur } from './score-restaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Score qualité mensuel de l'espace restaurateur : score, palier et détail des indicateurs, avec ce qui tire le score vers le bas lu en premier.
 * Avant le premier calcul mensuel, un texte l'explique au lieu d'un faux zéro. Lecture seule, relue à l'ouverture et à la demande ; un échec
 * garde le dernier score connu et le dit.
 */
export function ScoreRestaurateurReel() {
  const [score, setScore] = useState<ScoreRestaurateur | null | undefined>(undefined);
  const [erreur, setErreur] = useState(false);
  const [chargement, setChargement] = useState(false);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true);
    try { const s = await gestion.scoreRestaurant(); if (actif.current) { setScore(s); setErreur(false); } }
    catch { if (actif.current) setErreur(true); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lire(); }, []);

  if (score === undefined && !erreur) return null;
  const pct = (v: number | null) => (v === null ? 'sans données' : `${v} %`);
  const indicateurs: Array<[string, number | null]> = score ? [
    ['Réponses dans le délai', score.acceptationDelai],
    ['Commandes menées à prêtes', score.preparationTenue],
    ['Sans annulation du restaurant', score.exactitude],
    ['Note des clients', score.note],
    ['Plats avec photo et description', score.ficheComplete],
    ['Disponibilité', score.disponibilite],
  ] : [];
  const plusFaible = indicateurs.filter(([, v]) => v !== null).sort((a, b) => (a[1] as number) - (b[1] as number))[0];
  return <View style={s.carte}>
    <Text accessibilityRole="header" style={s.titre}>Score qualité</Text>
    {score === null && <Text style={s.texte}>Votre premier score sera calculé au début du mois prochain, sur les commandes de ce mois. Il ne change rien à vos commandes en cours.</Text>}
    {score ? <>
      <Text style={s.score}>{score.score} · {LIBELLE_PALIER_SCORE[score.palier]}</Text>
      <Text style={s.secondaire}>Mois calculé : {score.mois.slice(0, 7)}. La note des clients n’est pas encore mesurable par mois : elle ne compte ni pour ni contre.</Text>
      {indicateurs.map(([libelle, v]) => <Text key={libelle} style={s.texte}>{libelle} : {pct(v)}</Text>)}
      {plusFaible && <Text style={s.texte}>Le plus faible : {plusFaible[0].toLowerCase()} ({pct(plusFaible[1])}). C’est là que le score peut monter le plus.</Text>}
      {score.moisBasConsecutifs > 0 && <Text accessibilityRole="alert" style={s.texte}>Palier le plus bas depuis {score.moisBasConsecutifs} mois : l’équipe peut vous contacter pour vous aider à remonter.</Text>}
    </> : null}
    {erreur && <Text accessibilityRole="alert" style={s.erreur}>{score === undefined || score === null ? 'Votre score n’a pas pu être lu pour l’instant.' : 'Dernière lecture impossible : ce que vous voyez est le dernier score connu.'}</Text>}
    <Action titre="Actualiser le score" variante="texte" icone="actualiser" iconeSeule agir={() => { void lire(); }} disabled={chargement} />
  </View>;
}

const s = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure },
  titre: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  score: { fontFamily: polices.titre, fontSize: 26, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 13, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 14, color: c.danger },
});
