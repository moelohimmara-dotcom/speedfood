import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurEquipe } from './equipe';
import { SITE_WEB } from './aide';
import { ACTIONS_MODERATION_EQUIPE, libelleAlerteAvis, motifModerationRequis, type AvisEquipe, type BanniereEquipe, type ParametresEquipe, type SignalementEquipe } from './contenus-equipe';
import { couleurs as c, polices } from '../design/tokens';

function messageErreur(e: unknown) {
  return e instanceof ErreurEquipe || e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.';
}
function useCharge<T>(lire: () => Promise<T>) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);
  async function relire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { const d = await lire(); if (actif.current) setDonnees(d); }
    catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void relire(); }, []);
  return { donnees, setDonnees, chargement, erreur, setErreur, message, setMessage, relire, actif, enCours };
}
const LIBELLES_MODERATION: Record<string, string> = { masquer_commentaire: 'Masquer le commentaire', annuler_note: 'Annuler la note', retablir: 'Rétablir', classer_sans_suite: 'Classer sans suite' };

/** Avis à modérer (E8) : signalements, alertes de qualité, décisions avec motif pour retirer du contenu. */
export function AvisEquipeReel() {
  const { donnees, chargement, erreur, setErreur, message, setMessage, relire, actif, enCours } = useCharge<AvisEquipe>(() => gestion.avisEquipe());
  const [motif, setMotif] = useState('');
  const [confirmation, setConfirmation] = useState<{ s: SignalementEquipe; action: string } | null>(null);

  async function agir() {
    if (confirmation === null || enCours.current) return;
    enCours.current = true; setErreur(null);
    try {
      const retour = await gestion.modererAvisEquipe(confirmation.s.avisId, confirmation.action, motifModerationRequis(confirmation.action) ? motif : undefined);
      if (!actif.current) return;
      setConfirmation(null); setMotif(''); setMessage(retour + ' Liste relue.');
      await relire();
    } catch (e) { if (actif.current) { setConfirmation(null); setErreur(messageErreur(e)); } }
    finally { enCours.current = false; }
  }

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Avis et signalements</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des avis…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Action titre="Actualiser les avis" agir={() => { void relire(); }} disabled={chargement} />
    {(donnees?.alertes ?? []).map((a, i) => <View key={i} style={s.carte}>
      <Text style={s.nomPetit}>{libelleAlerteAvis(a.type)}</Text>
      <Text style={s.texte}>{a.cible} · {a.detail}</Text>
    </View>)}
    <Text accessibilityRole="header" style={s.nomPetit}>Signalements en attente</Text>
    {donnees !== null && donnees.signalements.length === 0 && <Text style={s.texte}>Aucun signalement en attente.</Text>}
    {(donnees?.signalements ?? []).map(x => <View key={x.id} style={s.carte}>
      <Text style={s.nomPetit}>{x.restaurantNom} · {x.note}/5</Text>
      {x.commentaire && <Text style={s.texte}>« {x.commentaire} »</Text>}
      <Text style={s.secondaire}>Signalé le {new Date(x.date).toLocaleDateString('fr-FR')} : {x.motif}</Text>
      {confirmation?.s.id === x.id ? <>
        <Text accessibilityRole="alert" style={s.texte}>{LIBELLES_MODERATION[confirmation.action]} cet avis ?</Text>
        {motifModerationRequis(confirmation.action) && <TextInput accessibilityLabel="Motif de la décision de modération" value={motif} onChangeText={setMotif} editable={!chargement} style={s.champ} />}
        <Action titre="Oui, appliquer" disabled={chargement} agir={() => { void agir(); }} />
        <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmation(null)} />
      </> : ACTIONS_MODERATION_EQUIPE.map(a => <Action key={a} titre={LIBELLES_MODERATION[a]} secondaire disabled={chargement} agir={() => { setErreur(null); setMotif(''); setConfirmation({ s: x, action: a }); }} />)}
    </View>)}
  </View>;
}

function ListeBannieres({ titre, seulementImages }: { titre: string; seulementImages: boolean }) {
  const { donnees, chargement, erreur, relire } = useCharge<{ bannieres: BanniereEquipe[]; tronque: boolean; illisibles: number }>(() => seulementImages ? gestion.mediasEquipe() : gestion.bannieresEquipe());
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>{titre}</Text>
    <Text style={s.secondaire}>Lecture seule : créer, publier ou supprimer reste sur le site, car cela change ce que voit le public.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser" agir={() => { void relire(); }} disabled={chargement} />
    {donnees?.tronque && <Text accessibilityRole="alert" style={s.texte}>Liste incomplète : ouvrez le site pour tout voir.</Text>}
    {(donnees?.bannieres ?? []).map(b => <View key={b.id} style={s.carte}>
      <Text style={s.nomPetit}>{b.titre}</Text>
      <Text style={s.texte}>{b.statut === 'publie' ? 'Publiée' : 'Brouillon'} · ordre {b.ordre}</Text>
      {b.texte !== '' && <Text style={s.secondaire}>{b.texte}</Text>}
      {b.imageUrl && <Image source={{ uri: b.imageUrl }} style={s.image} accessibilityLabel={'Image de la bannière ' + b.titre} />}
    </View>)}
    <Action titre="Ouvrir le studio sur le site" secondaire agir={() => { void Linking.openURL(SITE_WEB + '/system/contenu/bannieres').catch(() => undefined); }} />
  </View>;
}
export function BannieresEquipeReel() { return <ListeBannieres titre="Bannières publiques" seulementImages={false} />; }
export function MediasEquipeReel() { return <ListeBannieres titre="Bibliothèque de médias" seulementImages />; }

const LIGNES_PARAMETRES: ReadonlyArray<{ libelle: string; lire(p: ParametresEquipe): string }> = [
  { libelle: 'Délai d’une proposition de prix', lire: p => p.commandePropositionDelaiMinutes + ' min' },
  { libelle: 'Prix maximal d’un plat', lire: p => p.prixPlatMaxGnf.toLocaleString('fr-FR') + ' GNF' },
  { libelle: 'Fraîcheur des disponibilités', lire: p => p.disponibiliteFraicheurHeures + ' h' },
  { libelle: 'Conservation des coordonnées', lire: p => p.conservationCoordonneesJours + ' jours' },
  { libelle: 'Conservation des commandes non clôturées', lire: p => p.conservationNonClotureeJours + ' jours' },
  { libelle: "Conservation du journal d'audit", lire: p => p.conservationAuditMois + ' mois' },
  { libelle: 'WhatsApp de l’assistance', lire: p => p.whatsappAssistance || 'Non renseigné' },
  { libelle: 'Délai de validation d’un établissement', lire: p => p.delaiValidationHeures === null ? 'Non fixé' : p.delaiValidationHeures + ' h' },
  { libelle: 'Position sur la carte', lire: p => p.positionCarteActive ? 'Active' : 'Inactive' },
  { libelle: 'Connexion Facebook', lire: p => p.connexionFacebookActive ? 'Active' : 'Inactive' },
  { libelle: 'Connexion Google', lire: p => p.connexionGoogleActive ? 'Active' : 'Inactive' },
];

/** Paramètres globaux (E10) : consultation seulement ; les modifier reste sur le site. */
export function ParametresEquipeReel() {
  const { donnees: p, chargement, erreur, relire } = useCharge<ParametresEquipe>(() => gestion.parametresEquipe());
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Paramètres de l’application</Text>
    <Text style={s.secondaire}>Lecture seule : modifier un réglage se fait sur le site, où il est validé et tracé.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des paramètres…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser les paramètres" agir={() => { void relire(); }} disabled={chargement} />
    {p && <View style={s.carte}>
      {LIGNES_PARAMETRES.map(l => <Text key={l.libelle} style={s.texte}>{l.libelle} : {l.lire(p)}</Text>)}
      <Text style={s.texte}>Signature : {p.promesseSignature}</Text>
      <Text style={s.secondaire}>{p.promesseSousTitre} · {p.promessePartage}</Text>
    </View>}
    <Action titre="Modifier sur le site" secondaire agir={() => { void Linking.openURL(SITE_WEB + '/system/parametres').catch(() => undefined); }} />
  </View>;
}

const s = StyleSheet.create({
  nom: { fontFamily: polices.titre, fontSize: 23, color: c.encre, marginTop: 8 },
  nomPetit: { fontFamily: polices.titre, fontSize: 17, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, padding: 16, gap: 8 },
  champ: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, padding: 14, minHeight: 50, fontFamily: polices.texte, fontSize: 16, color: c.encre },
  image: { width: '100%', height: 140, borderRadius: 12, backgroundColor: c.bordure },
});
