import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurRestaurateur, formaterGnf } from './restaurateur';
import { lignesRepartition, type ActiviteRestaurateur, type BilanRestaurateur } from './activite-restaurateur';
import { dateHeureHistorique, libelleModeHistorique } from './historique-restaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Activité du restaurant (parité Kotlin, lot 2, ligne C10) : aujourd'hui et 7 derniers jours (reçues, terminées, chiffre des plats terminés),
 * répartition par issue et dernières commandes terminées. Lecture seule et MANUELLE : aucun rafraîchissement automatique, un seul essai par lecture.
 * Le chiffre vient du serveur (plats des commandes terminées, hors frais de livraison) : l'écran ne recalcule rien et ne montre aucune coordonnée client.
 */
export function ActiviteReel() {
  const [activite, setActivite] = useState<ActiviteRestaurateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [luLe, setLuLe] = useState<string | null>(null);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try {
      const a = await gestion.activiteRestaurant();
      if (!actif.current) return;
      setActivite(a); setLuLe(new Date().toLocaleTimeString('fr-FR'));
    } catch (e) { if (actif.current) setErreur(e instanceof ErreurRestaurateur || e instanceof ErreurConnexion ? e.message : 'Impossible de lire l’activité. Réessayez.'); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lire(); }, []);

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Activité</Text>
    <Text style={s.secondaire}>Le chiffre compte les plats des commandes terminées, sans les frais de livraison. Les commandes d’essai ne comptent pas.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture de l’activité…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {activite && activite.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{activite.illisibles === 1 ? '1 commande récente est illisible dans l’application' : activite.illisibles + ' commandes récentes sont illisibles dans l’application'} : ouvrez Speedfood sur le site pour {activite.illisibles === 1 ? 'la' : 'les'} retrouver.</Text>}
    <Action titre="Actualiser l’activité" agir={() => { void lire(); }} disabled={chargement} />
    {activite && <>
      <BlocBilan titre="Aujourd’hui" bilan={activite.aujourdhui} />
      <BlocBilan titre="7 derniers jours" bilan={activite.semaine} />
      <View style={s.carte}>
        <Text style={s.nomPetit}>Répartition (7 derniers jours)</Text>
        {lignesRepartition(activite).map(l => <Text key={l.libelle} style={s.texte}>{l.libelle} : {l.nombre}</Text>)}
      </View>
      <Text accessibilityRole="header" style={s.nomPetit}>Dernières commandes terminées</Text>
      {activite.recentes.length === 0 && <Text style={s.texte}>Aucune commande terminée ces 7 derniers jours.</Text>}
      {activite.recentes.map((r, i) => <View key={r.reference + '-' + i} style={s.carte}>
        <Text style={s.nomPetit}>{r.reference}</Text>
        <Text style={s.secondaire}>{dateHeureHistorique(r.creeLe)} · {libelleModeHistorique(r.mode)}</Text>
        <Text style={s.nomPetit}>{formaterGnf(r.totalGnf)} GNF</Text>
      </View>)}
    </>}
    {luLe && <Text style={s.secondaire}>Activité lue à {luLe}. Elle ne se met pas à jour toute seule : actualisez pour la relire.</Text>}
  </View>;
}

function BlocBilan({ titre, bilan }: { titre: string; bilan: BilanRestaurateur }) {
  return <View style={s.carte}>
    <Text style={s.nomPetit}>{titre}</Text>
    <Text style={s.texte}>{bilan.recues} commandes reçues · {bilan.terminees} terminées</Text>
    <Text style={s.nomPetit}>{formaterGnf(bilan.chiffreGnf)} GNF de chiffre</Text>
  </View>;
}

const s = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  nomPetit: { fontFamily: polices.titre, fontSize: 17, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
});
