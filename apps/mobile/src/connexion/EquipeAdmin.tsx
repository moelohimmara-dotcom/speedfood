import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurEquipe } from './equipe';
import { SITE_WEB } from './aide';
import { nonPrevenues, zoneAMarquerPrevenue, type AuditEquipe, type CompteEquipe, type MisesAJourEquipe, type ZoneAttenteEquipe } from './admin-equipe';
import { couleurs as c, polices } from '../design/tokens';

function messageErreur(e: unknown) {
  return e instanceof ErreurEquipe || e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.';
}
function useCharge<T>(lire: () => Promise<T>, dependances: unknown[] = []) {
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
  useEffect(() => { void relire(); }, dependances);
  return { donnees, chargement, erreur, setErreur, message, setMessage, relire, actif, enCours };
}

/** Annuaire des comptes (E11) : lecture seule ; suppressions et rôles restent sur le site. */
export function ComptesEquipeReel() {
  const [q, setQ] = useState('');
  const [recherche, setRecherche] = useState('');
  const { donnees, chargement, erreur, relire } = useCharge<{ comptes: CompteEquipe[]; tronque: boolean; illisibles: number }>(() => gestion.comptesEquipe({ q: recherche || undefined }), [recherche]);
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Comptes</Text>
    <Text style={s.secondaire}>Lecture seule : supprimer un compte ou changer un rôle se fait sur le site, ce sont des actions irréversibles.</Text>
    <Text style={s.texte}>Recherche par e-mail</Text>
    <TextInput accessibilityLabel="Recherche par e-mail" value={q} onChangeText={setQ} style={s.champ} />
    <Action titre="Rechercher" disabled={chargement} agir={() => setRecherche(q.trim())} />
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des comptes…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser les comptes" agir={() => { void relire(); }} disabled={chargement} />
    {donnees?.tronque && <Text accessibilityRole="alert" style={s.texte}>Liste incomplète : ouvrez le site pour tout voir.</Text>}
    {(donnees?.comptes ?? []).map(x => <View key={x.utilisateurId} style={s.carte}>
      <Text style={s.nomPetit}>{x.email}</Text>
      <Text style={s.texte}>{x.roleSysteme ? 'Équipe : ' + x.roleSysteme : 'Client'}{x.test ? ' · compte de test' : ''} · depuis le {new Date(x.creeLe).toLocaleDateString('fr-FR')}</Text>
      {x.restaurants.map(r => <Text key={r.restaurantId} style={s.secondaire}>{r.nom} ({r.role === 'owner' ? 'propriétaire' : 'équipier'})</Text>)}
    </View>)}
  </View>;
}

/** Journal d'audit (E12) : lecture seule, filtres proposés par le serveur. */
export function AuditEquipeReel() {
  const [depuis, setDepuis] = useState<number | undefined>(undefined);
  const { donnees, chargement, erreur, relire } = useCharge<AuditEquipe>(() => gestion.auditEquipe({ depuis }), [depuis]);
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Journal d’audit</Text>
    <Text style={s.secondaire}>Écrit par le serveur seul : rien ne se modifie ici.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture du journal…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser le journal" agir={() => { void relire(); }} disabled={chargement} />
    {donnees && <View style={s.carte}>
      {donnees.indicateurs.map(i => <Text key={i.cle} style={s.texte}>{i.libelle} : {i.valeur}</Text>)}
    </View>}
    {donnees && <View style={{ gap: 8 }}>
      {donnees.periodes.map(p => <Action key={p.libelle} titre={(depuis === (p.valeur ?? undefined) ? '✓ ' : '') + p.libelle} secondaire disabled={chargement} agir={() => setDepuis(p.valeur ?? undefined)} />)}
    </View>}
    {donnees?.tronque && <Text accessibilityRole="alert" style={s.texte}>Journal incomplet : ouvrez le site pour tout voir.</Text>}
    {donnees && donnees.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{donnees.illisibles} entrée(s) du journal n’ont pas pu être lues et ont été écartées ; le reste est affiché.</Text>}
    {(donnees?.journal ?? []).map(j => <View key={j.id} style={s.carte}>
      <Text style={s.nomPetit}>{j.libelle}</Text>
      <Text style={s.secondaire}>{new Date(j.horodatage).toLocaleString('fr-FR')} · {j.auteur} · {j.cible}</Text>
      {j.motif && <Text style={s.secondaire}>Motif : {j.motif}</Text>}
    </View>)}
  </View>;
}

/** Liste d'attente (E13) : zones et nombres seulement ; marquer une zone comme prévenue, confirmé puis relu. */
export function AttenteEquipeReel() {
  const { donnees, chargement, erreur, setErreur, message, setMessage, relire, actif, enCours } = useCharge<{ zones: ZoneAttenteEquipe[]; illisibles: number }>(() => gestion.zonesAttenteEquipe());
  const [confirmation, setConfirmation] = useState<ZoneAttenteEquipe | null>(null);
  async function marquer() {
    if (confirmation === null || enCours.current) return;
    enCours.current = true; setErreur(null);
    try {
      const retour = await gestion.marquerZonePrevenueEquipe(confirmation.niveau, confirmation.id);
      if (!actif.current) return;
      setConfirmation(null); setMessage(retour + ' Liste relue.');
      enCours.current = false;
      await relire();
    } catch (e) { if (actif.current) { setConfirmation(null); setErreur(messageErreur(e)); } }
    finally { enCours.current = false; }
  }
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Liste d’attente</Text>
    <Text style={s.secondaire}>Aucun contact n’est montré ici : supprimer des contacts ou exporter la liste reste sur le site.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des zones…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Action titre="Actualiser les zones" agir={() => { void relire(); }} disabled={chargement} />
    {(donnees?.zones ?? []).map(z => <View key={z.niveau + '-' + z.id} style={s.carte}>
      <Text style={s.nomPetit}>{z.nom}</Text>
      <Text style={s.texte}>{z.personnes} personnes · {nonPrevenues(z.personnes, z.prevenues)} pas encore prévenues</Text>
      <Text style={s.secondaire}>{z.contexte} · dernière inscription le {new Date(z.derniere).toLocaleDateString('fr-FR')}</Text>
      {confirmation?.id === z.id ? <>
        <Text accessibilityRole="alert" style={s.texte}>Marquer {z.nom} comme prévenue ?</Text>
        <Action titre="Oui, marquer" disabled={chargement} agir={() => { void marquer(); }} />
        <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmation(null)} />
      </> : zoneAMarquerPrevenue(z.personnes, z.prevenues) && <Action titre={'Marquer ' + z.nom + ' comme prévenue'} secondaire disabled={chargement} agir={() => setConfirmation(z)} />}
    </View>)}
  </View>;
}

/** Mises à jour (E14) : état lu seulement ; basculer un interrupteur ou annoncer une version reste sur le site. */
export function MisesAJourEquipeReel() {
  const { donnees: m, chargement, erreur, relire } = useCharge<MisesAJourEquipe>(() => gestion.misesAJourEquipe());
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Mises à jour</Text>
    <Text style={s.secondaire}>Lecture seule : activer une fonctionnalité ou annoncer une version change ce que voient les clients, cela reste sur le site.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des mises à jour…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser les mises à jour" agir={() => { void relire(); }} disabled={chargement} />
    {m && <>
      <View style={s.carte}>
        <Text style={s.nomPetit}>Version publiée : {m.version.nom} (code {m.version.code})</Text>
        <Text style={s.texte}>{m.appareils} appareils enregistrés</Text>
        {m.annonce && <Text style={s.secondaire}>Dernière annonce : {m.annonce.versionNom}, {m.annonce.envoyes}/{m.annonce.appareils} envois, le {new Date(m.annonce.annonceeLe).toLocaleDateString('fr-FR')}</Text>}
        {m.version.notes !== '' && <Text style={s.secondaire}>{m.version.notes}</Text>}
      </View>
      <Text accessibilityRole="header" style={s.nomPetit}>Fonctionnalités</Text>
      {m.fonctionnalites.map(f => <Text key={f.cle} style={s.texte}>{f.active ? '● ' : '○ '}{f.libelle} ({f.groupe})</Text>)}
      <Text accessibilityRole="header" style={s.nomPetit}>Nouveautés livrées</Text>
      {m.misesAJour.map(j => <View key={j.id} style={s.carte}>
        <Text style={s.nomPetit}>{j.titre}</Text>
        <Text style={s.secondaire}>{j.date} · {j.active === null ? 'toujours active' : j.active ? 'active' : 'coupée'}</Text>
        <Text style={s.texte}>{j.resume}</Text>
      </View>)}
    </>}
    <Action titre="Gérer sur le site" secondaire agir={() => { void Linking.openURL(SITE_WEB + '/system/mises-a-jour').catch(() => undefined); }} />
  </View>;
}

const s = StyleSheet.create({
  nom: { fontFamily: polices.titre, fontSize: 23, color: c.encre, marginTop: 8 },
  nomPetit: { fontFamily: polices.titre, fontSize: 17, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, padding: 16, gap: 8 },
  champ: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, padding: 14, minHeight: 50, fontFamily: polices.texte, fontSize: 16, color: c.encre },
});
