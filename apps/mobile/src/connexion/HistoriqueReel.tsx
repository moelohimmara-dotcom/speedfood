import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurRestaurateur } from './restaurateur';
import {
  TAILLE_PAGE_HISTORIQUE, dateHeureHistorique, libelleArticlesHistorique, libelleModeHistorique, libelleStatutHistorique, resumeHistorique,
  type CommandeHistorique, type PageHistorique,
} from './historique-restaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Historique des commandes du restaurant (parité Kotlin, lot 2, ligne C8) : commandes terminées, refusées ou annulées, page par page.
 * Lecture seule et MANUELLE (ouverture, « Actualiser », « Charger la suite ») : aucun rafraîchissement automatique, un seul essai par lecture,
 * jamais de relance. Une page qui échoue laisse les commandes déjà lues à l'écran. Aucune coordonnée client n'est reçue ni affichée.
 * Les commandes d'essai (TEST) sont exclues par le serveur : l'écran le rappelle, comme l'ancienne appli.
 */
export function HistoriqueReel() {
  const [commandes, setCommandes] = useState<CommandeHistorique[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pageSuivante, setPageSuivante] = useState<number | null>(null);
  const [illisibles, setIllisibles] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [luLe, setLuLe] = useState<string | null>(null);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  function messageErreur(e: unknown) { return e instanceof ErreurRestaurateur || e instanceof ErreurConnexion ? e.message : 'Impossible de lire l’historique. Réessayez.'; }

  /** Une lecture : la première page remplace, la suivante s'ajoute (sans doublon si une commande a glissé d'une page à l'autre entre-temps). */
  async function lire(pageDemandee: number, remplacer: boolean) {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try {
      const p: PageHistorique = await gestion.historiqueRestaurant(pageDemandee, TAILLE_PAGE_HISTORIQUE);
      if (!actif.current) return;
      setCommandes(actuelles => {
        if (remplacer || actuelles === null) return p.commandes;
        const vues = new Set(actuelles.map(x => x.id));
        return [...actuelles, ...p.commandes.filter(x => !vues.has(x.id))];
      });
      setTotal(p.total); setPageSuivante(p.pageSuivante); setIllisibles(p.illisibles);
      setLuLe(new Date().toLocaleTimeString('fr-FR'));
    } catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }

  useEffect(() => { void lire(1, true); }, []);

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Historique des commandes</Text>
    <Text style={s.secondaire}>Les commandes d’essai ne sont pas dans cet historique : elles ne comptent pas dans vos chiffres réels.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture de l’historique…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{illisibles === 1 ? '1 commande ancienne est illisible dans l’application' : illisibles + ' commandes anciennes sont illisibles dans l’application'} : ouvrez Speedfood sur le site pour {illisibles === 1 ? 'la' : 'les'} retrouver.</Text>}
    <Action titre="Actualiser l’historique" agir={() => { void lire(1, true); }} disabled={chargement} />
    {commandes !== null && <>
      <Text style={s.texte}>{resumeHistorique(commandes.length, total)}</Text>
      {commandes.length === 0 && !chargement && <Text style={s.texte}>Aucune commande dans l’historique.</Text>}
      {commandes.map(o => <View key={o.id} style={s.carte}>
        <Text style={s.nom}>{o.reference}</Text>
        <Text style={s.texte}>{libelleStatutHistorique(o.statut)} · {libelleModeHistorique(o.mode)}</Text>
        <Text style={s.secondaire}>{dateHeureHistorique(o.creeLe)}{o.nbLignes > 0 ? ' · ' + libelleArticlesHistorique(o.nbLignes) : ''}</Text>
        <Text style={s.nom}>{o.totalGnf.toLocaleString('fr-FR')} GNF</Text>
      </View>)}
      {pageSuivante !== null
        ? <Action titre="Charger la suite" secondaire agir={() => { void lire(pageSuivante, false); }} disabled={chargement} />
        : commandes.length > 0 && <Text style={s.secondaire}>Vous avez vu toutes les commandes.</Text>}
    </>}
    {luLe && <Text style={s.secondaire}>Historique lu à {luLe}. Il ne se met pas à jour tout seul : actualisez pour voir les commandes terminées depuis.</Text>}
  </View>;
}

const s = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
});
