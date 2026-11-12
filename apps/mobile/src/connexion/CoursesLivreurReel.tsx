import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { ErreurLivreur } from './livreur';
import { gestion } from './gestion';
import { formaterGnf } from './restaurateur';
import { aUneSuite, type CourseLivree, type GainsLivreur, type PageCoursesLivreur } from './gains-livreur';
import { dateHeureHistorique } from './historique-restaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Gains et historique des courses du livreur (parité Kotlin, lot 3, lignes D7 et D6). Le montant est le FRAIS de la course, pas une paie :
 * l'écran l'écrit « frais de course ». Lectures seules et manuelles, un seul essai chacune, jamais de relance ; une page qui échoue laisse
 * les courses déjà lues à l'écran. Aucune coordonnée de client n'est reçue ni affichée.
 */
export function CoursesLivreurReel() {
  const [gains, setGains] = useState<GainsLivreur | null | undefined>(undefined);
  const [historique, setHistorique] = useState<CourseLivree[] | null>(null);
  const [page, setPage] = useState<PageCoursesLivreur | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  function messageErreur(e: unknown) { return e instanceof ErreurLivreur || e instanceof ErreurConnexion ? e.message : 'Impossible de lire vos courses. Réessayez.'; }

  async function lireGains() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { const g = await gestion.gainsLivreur(); if (actif.current) setGains(g); }
    catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lireGains(); }, []);

  async function lireHistorique(pageDemandee: number, remplacer: boolean) {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try {
      const p = await gestion.historiqueLivreur(pageDemandee);
      if (!actif.current) return;
      if (p === null) { setHistorique(null); setPage(null); return; }
      setPage(p);
      setHistorique(actuelles => {
        if (remplacer || actuelles === null) return p.courses;
        const vues = new Set(actuelles.map(x => x.id));
        return [...actuelles, ...p.courses.filter(x => !vues.has(x.id))];
      });
    } catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Mes courses livrées et leurs frais</Text>
    <Text style={s.secondaire}>Les montants sont les frais de chaque course livrée. Ce ne sont pas une paie : la règle de rémunération n'existe pas encore.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture de vos courses…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser mes courses" agir={() => { void lireGains(); }} disabled={chargement} />
    {gains === null && <Text style={s.texte}>Ce compte n'est pas un compte livreur.</Text>}
    {gains && <>
      {(gains.illisibles > 0) && <Text accessibilityRole="alert" style={s.texte}>{gains.illisibles === 1 ? '1 course récente est illisible dans l’application.' : gains.illisibles + ' courses récentes sont illisibles dans l’application.'}</Text>}
      <View style={s.carte}>
        <Text style={s.nomPetit}>Aujourd’hui</Text>
        <Text style={s.texte}>{gains.aujourdhui.courses} courses livrées · {formaterGnf(gains.aujourdhui.fraisGnf)} GNF de frais de course</Text>
      </View>
      <View style={s.carte}>
        <Text style={s.nomPetit}>7 derniers jours</Text>
        <Text style={s.texte}>{gains.semaine.courses} courses livrées · {formaterGnf(gains.semaine.fraisGnf)} GNF de frais de course</Text>
      </View>
      <Text accessibilityRole="header" style={s.nomPetit}>Dernières courses livrées</Text>
      {gains.recentes.length === 0 && <Text style={s.texte}>Aucune course livrée ces 7 derniers jours.</Text>}
      {gains.recentes.map(r => <Course key={r.id} course={r} />)}
    </>}
    <Text accessibilityRole="header" style={s.nomPetit}>Historique des courses</Text>
    {historique === null
      ? <Action titre="Charger l’historique des courses" secondaire agir={() => { void lireHistorique(1, true); }} disabled={chargement} />
      : <>
        {page && page.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{page.illisibles === 1 ? '1 course ancienne est illisible dans l’application.' : page.illisibles + ' courses anciennes sont illisibles dans l’application.'}</Text>}
        {historique.length === 0 && <Text style={s.texte}>Aucune course dans l’historique.</Text>}
        {historique.map(r => <Course key={r.id} course={r} />)}
        {page && aUneSuite(page)
          ? <Action titre="Charger la suite" secondaire agir={() => { void lireHistorique(page.page + 1, false); }} disabled={chargement} />
          : historique.length > 0 && <Text style={s.secondaire}>Vous avez vu toutes vos courses livrées.</Text>}
      </>}
  </View>;
}

function Course({ course: r }: { course: CourseLivree }) {
  return <View style={s.carte}>
    <Text style={s.nomPetit}>{r.reference || 'Course'}{r.restaurantNom ? ' · ' + r.restaurantNom : ''}</Text>
    <Text style={s.secondaire}>{r.livreeLe ? dateHeureHistorique(r.livreeLe) : ''}</Text>
    <Text style={s.nomPetit}>{formaterGnf(r.fraisGnf)} GNF de frais de course</Text>
  </View>;
}

const s = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  nomPetit: { fontFamily: polices.titre, fontSize: 17, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
});
