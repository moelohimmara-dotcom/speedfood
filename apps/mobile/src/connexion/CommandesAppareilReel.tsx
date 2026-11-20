import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Action } from './BoutonAction';
import { gestion } from './gestion';
import { RELECTURES_APPAREIL_MAX, type VueCommandeAppareil } from './commandes-appareil';
import type { ResumeSuivi } from './commandes';
import { DELAI_RELECTURE_MS, doitRelire, estFinal, etapeActuelle, libelleStatutSuivi, previsionPreparation, tonStatut } from './suivi-affichage';
import { FriseSuivi } from './FriseSuivi';
import { phraseProchaineEtape } from './suivi-acteur';
import { Pastille } from '../catalogue/FicheRestaurant';
import { couleurs as c, polices } from '../design/tokens';

export const TITRE_COMMANDES_APPAREIL = 'Commandes de cet appareil';
export const TEXTE_COMMANDES_APPAREIL = 'Elles sont gardées sur ce téléphone pour que vous les retrouviez sans vous connecter. Connectez-vous pour les annuler, répondre au restaurant ou régler.';
export const MESSAGE_AUCUNE_COMMANDE_APPAREIL = 'Aucune commande n’est gardée sur ce téléphone.';
export const MESSAGE_ANNULER_CONNECTEZ_VOUS = 'Pour annuler cette commande, connectez-vous.';
export const MESSAGE_PROPOSITION_CONNECTEZ_VOUS = 'Le restaurant propose un changement : connectez-vous pour répondre.';
/** Les plus récentes d'abord : la connexion reste à portée de doigt ; le reste de la liste s'affiche à la demande. */
export const VISIBLES_MAX = 5;
const MODES: Record<string, string> = { retrait: 'Retrait', livraison: 'Livraison', sur_place: 'Sur place' };

/**
 * Commandes de cet appareil, vues SANS connexion (parité Kotlin, écart G12) : la liste de ce que ce téléphone a envoyé, l'état en direct de chacune (lu avec son jeton de suivi,
 * qui ne quitte jamais le coffre) et son suivi. LECTURE SEULE : annuler, répondre au restaurant et régler exigent d'être connecté (le texte le dit). « Oublier » efface les références
 * et les jetons de ce téléphone ; les commandes du compte restent sur le serveur.
 */
export function CommandesAppareilReel({ oublier, apresOubli }: { oublier(): Promise<void>; apresOubli?(): void }) {
  const [liste, setListe] = useState<VueCommandeAppareil[] | null>(null);
  const [statuts, setStatuts] = useState<Record<string, string>>({});
  const [suivi, setSuivi] = useState<{ cle: string; valeur: ResumeSuivi; luLe: string } | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerOubli, setConfirmerOubli] = useState(false);
  const [toutes, setToutes] = useState(false);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try {
      const l = await gestion.commandesAppareil();
      if (!actif.current) return;
      setListe(l);
      // Statuts des plus récentes seulement (chaque lecture est plafonnée par jeton côté serveur) ; une panne laisse le statut absent.
      const lus = await Promise.all(l.slice(0, RELECTURES_APPAREIL_MAX).map(async v => {
        try { const r = await gestion.suiviAppareil(v.cle); return [v.cle, libelleStatutSuivi(r.statut, r.etatDerive)] as const; } catch { return null; }
      }));
      if (actif.current) setStatuts(a => ({ ...a, ...Object.fromEntries(lus.filter(x => x !== null) as Array<readonly [string, string]>) }));
    } catch { if (actif.current) setErreur('Vos commandes gardées sur ce téléphone n’ont pas pu être lues. Réessayez.'); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lire(); }, []);

  async function ouvrir(cle: string) {
    setErreur(null); setChargement(true);
    try { const valeur = await gestion.suiviAppareil(cle); if (actif.current) setSuivi({ cle, valeur, luLe: new Date().toLocaleTimeString('fr-FR') }); }
    catch (e) { if (actif.current) setErreur(e instanceof Error && e.message !== '' ? e.message : 'Le suivi de cette commande n’a pas pu être lu.'); }
    finally { if (actif.current) setChargement(false); }
  }
  // Relecture automatique (15 s) tant que le suivi est ouvert et que la commande n'est pas finie ; une panne garde le dernier état connu.
  const cleSuivi = suivi ? suivi.cle : null; const statutSuivi = suivi ? suivi.valeur.statut : null;
  useEffect(() => {
    if (cleSuivi === null || statutSuivi === null || !doitRelire(statutSuivi)) return;
    const minuterie = setInterval(() => {
      gestion.suiviAppareil(cleSuivi).then(valeur => { if (actif.current) { setSuivi(a => a && a.cle === cleSuivi ? { cle: cleSuivi, valeur, luLe: new Date().toLocaleTimeString('fr-FR') } : a); setErreur(null); } }).catch(() => { if (actif.current) setErreur('Connexion perdue : nouvelle tentative en cours.'); });
    }, DELAI_RELECTURE_MS);
    return () => clearInterval(minuterie);
  }, [cleSuivi, statutSuivi]);

  async function oubli() {
    setConfirmerOubli(false);
    try { await oublier(); if (actif.current) { setListe([]); setStatuts({}); setSuivi(null); setToutes(false); apresOubli?.(); } }
    catch { if (actif.current) setErreur('Impossible d’oublier les commandes de cet appareil pour le moment. Réessayez.'); }
  }

  return <View style={s.bloc}>
    <View style={s.ligneTitre}>
      <Text accessibilityRole="header" style={s.titre}>{TITRE_COMMANDES_APPAREIL}</Text>
      <Action titre="Actualiser les commandes de cet appareil" variante="texte" icone="actualiser" iconeSeule agir={() => { void lire(); }} disabled={chargement} />
    </View>
    <Text style={s.secondaire}>{TEXTE_COMMANDES_APPAREIL}</Text>
    {chargement && liste === null && <ActivityIndicator color={c.action} />}
    {erreur !== null && <Text accessibilityRole="alert" style={s.erreur}>{erreur}</Text>}
    {liste !== null && liste.length === 0 && <Text style={s.texte}>{MESSAGE_AUCUNE_COMMANDE_APPAREIL}</Text>}
    {/* Le suivi ouvert s'affiche AU-DESSUS de la liste : en le demandant on le voit, sans défiler une longue liste. */}
    {suivi !== null && <View style={s.carte}>
      <Text accessibilityRole="header" style={s.nom}>{'Suivi '}{suivi.valeur.reference}{suivi.valeur.estTest ? ' · TEST' : ''}</Text>
      <Text style={s.texte}>{suivi.valeur.restaurantNom}</Text>
      <Pastille texte={libelleStatutSuivi(suivi.valeur.statut, suivi.valeur.etatDerive)} ton={tonStatut(suivi.valeur.statut)} />
      {previsionPreparation(suivi.valeur) !== null && <Text style={s.texte}>{previsionPreparation(suivi.valeur)}</Text>}
      {etapeActuelle(suivi.valeur.statut) !== null && <FriseSuivi etape={etapeActuelle(suivi.valeur.statut) as number} />}
      {phraseProchaineEtape(suivi.valeur) !== null && <Text style={s.nom}>{phraseProchaineEtape(suivi.valeur)}</Text>}
      {suivi.valeur.lignes.map((l, i) => <Text key={i} style={s.texte}>{l.quantite} × {l.nom}{l.options.length > 0 ? ' (' + l.options.join(', ') + ')' : ''} · {(l.prixGnf * l.quantite).toLocaleString('fr-FR')} GNF</Text>)}
      {suivi.valeur.fraisLivraisonGnf > 0 && <Text style={s.texte}>Livraison estimée : {suivi.valeur.fraisLivraisonGnf.toLocaleString('fr-FR')} GNF</Text>}
      <Text style={s.nom}>Total : {suivi.valeur.totalGnf.toLocaleString('fr-FR')} GNF</Text>
      {suivi.valeur.propositionEnAttente && <Text style={s.texte}>{MESSAGE_PROPOSITION_CONNECTEZ_VOUS}</Text>}
      {suivi.valeur.etatDerive === 'en_attente' && <Text style={s.secondaire}>{MESSAGE_ANNULER_CONNECTEZ_VOUS}</Text>}
      {!estFinal(suivi.valeur.statut) && <Text style={s.secondaire}>Cet écran se met à jour tout seul.</Text>}
      <Text style={s.secondaire}>État lu à {suivi.luLe}.</Text>
      <Action titre="Fermer le suivi" variante="texte" agir={() => setSuivi(null)} />
    </View>}
    {liste !== null && (toutes ? liste : liste.slice(0, VISIBLES_MAX)).map(v => <View key={v.cle} style={s.carte}>
      <Text style={s.nom}>{v.reference}</Text>
      <Text style={s.texte}>{v.restaurantNom !== '' ? v.restaurantNom : 'Restaurant'} · {MODES[v.mode] ?? v.mode}</Text>
      <Text style={s.texte}>{new Date(v.creeLe).toLocaleString('fr-FR')}{v.totalGnf > 0 ? ' · ' + v.totalGnf.toLocaleString('fr-FR') + ' GNF' : ''}</Text>
      {statuts[v.cle] !== undefined && <Text style={s.texte}>{statuts[v.cle]}</Text>}
      <Action titre={'Suivre ' + v.reference} libelle="Suivre" variante="contour" disabled={chargement} agir={() => { void ouvrir(v.cle); }} />
    </View>)}
    {liste !== null && !toutes && liste.length > VISIBLES_MAX && <Action titre={'Afficher les ' + liste.length + ' commandes de cet appareil'} libelle={'Afficher les ' + liste.length + ' commandes'} variante="contour" agir={() => setToutes(true)} />}
    {liste !== null && liste.length > 0 && (confirmerOubli
      ? <><Text accessibilityRole="alert" style={s.texte}>Oublier les commandes de cet appareil ? Elles disparaissent de ce téléphone, avec leur clé de suivi ; vos commandes restent dans votre compte.</Text>
        <Action titre="Oublier" variante="danger" icone="corbeille" agir={() => { void oubli(); }} />
        <Action titre="Retour" secondaire agir={() => setConfirmerOubli(false)} /></>
      : <Action titre="Oublier les commandes de cet appareil" variante="danger" icone="corbeille" agir={() => setConfirmerOubli(true)} />)}
  </View>;
}

const s = StyleSheet.create({
  bloc: { gap: 12 },
  ligneTitre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  nom: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 16, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 14, color: c.secondaire },
  erreur: { fontFamily: polices.texte, fontSize: 14, color: c.danger },
});
