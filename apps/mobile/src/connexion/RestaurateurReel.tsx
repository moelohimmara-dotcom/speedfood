import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import {
  ETAT_REPOS, ErreurRestaurateur, actionVerrouillee, actionsAffichees, evoluer, grouper, libelleStatut,
  type ActionRestaurateur, type CommandeRestaurateur, type EtatAction, type EvenementAction, type ListeRestaurateur,
} from './restaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Espace restaurateur (lot D1) : les commandes de MON restaurant en trois groupes (À traiter, En cours, Historique), actualisation MANUELLE (aucun rafraîchissement
 * automatique, aucune notification ici), boutons Accepter et Refuser (le refus demande une confirmation). Rien d'autre : pas de « prête », de paiement ni de menu.
 * Toute règle (verrou, un seul essai, relecture après réponse incertaine) est dans `restaurateur.ts` ; cet écran n'envoie jamais le restaurant (le serveur le tire du compte).
 */
function Action({ titre, agir, disabled = false, secondaire = false }: { titre: string; agir(): void; disabled?: boolean; secondaire?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={titre} disabled={disabled} accessibilityState={{ disabled }} onPress={agir} style={[s.bouton, secondaire && s.boutonSecondaire, disabled && { opacity: .5 }]}><Text style={[s.boutonTexte, secondaire && s.boutonTexteSecondaire]}>{titre}</Text></Pressable>;
}

export function RestaurateurReel({ fermer, signalerOccupe }: { fermer(): void; signalerOccupe?(occupe: boolean): void }) {
  const [liste, setListe] = useState<ListeRestaurateur | null>(null);
  const [luLe, setLuLe] = useState<string | null>(null);
  const [lecture, setLecture] = useState(0);
  const [etat, setEtat] = useState<EtatAction>(ETAT_REPOS);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const etatRef = useRef<EtatAction>(ETAT_REPOS);
  const lectureRef = useRef(0);
  const actif = useRef(true);
  const envoiEnCours = useRef(false);
  const lectureEnCours = useRef(false);

  function appliquer(ev: EvenementAction) { const suivant = evoluer(etatRef.current, ev); etatRef.current = suivant; if (actif.current) setEtat(suivant); }
  function accepterListe(l: ListeRestaurateur) { lectureRef.current++; if (!actif.current) return; setLecture(lectureRef.current); setListe(l); setLuLe(new Date().toLocaleTimeString('fr-FR')); setErreur(null); }
  function messageErreur(e: unknown) { return e instanceof ErreurRestaurateur || e instanceof ErreurConnexion ? e.message : 'Impossible de lire les commandes. Réessayez.'; }

  /** Lecture MANUELLE de la liste (ouverture de l'écran et bouton « Actualiser »). Un seul essai ; une panne laisse la liste précédente. */
  async function actualiser() {
    if (lectureEnCours.current || envoiEnCours.current) return;
    lectureEnCours.current = true; setChargement(true); setErreur(null);
    try { accepterListe(await gestion.commandesRestaurant()); }
    catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { lectureEnCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { actif.current = true; void actualiser(); return () => { actif.current = false; }; }, []);

  /** UN SEUL essai. Ensuite la liste est relue pour savoir ce que le serveur a vraiment enregistré ; jamais de relance automatique. */
  async function envoyer(commande: CommandeRestaurateur, action: ActionRestaurateur) {
    if (envoiEnCours.current || lectureEnCours.current) return;
    const avant = etatRef.current;
    appliquer({ type: 'envoyer', commandeId: commande.id, action, lecture: lectureRef.current });
    if (etatRef.current === avant || etatRef.current.phase !== 'envoi') return;
    envoiEnCours.current = true;
    try {
      let echec: ErreurRestaurateur | null = null; let session: string | null = null;
      try { await gestion.actionRestaurateur(commande.id, action); }
      catch (e) { if (e instanceof ErreurRestaurateur) echec = e; else session = e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.'; }
      appliquer({ type: 'repondre', erreur: echec, sessionTerminee: session });
      let relue: CommandeRestaurateur | null | undefined;
      if (session === null) {
        try { const l = await gestion.commandesRestaurant(); accepterListe(l); relue = l.commandes.find(x => x.id === commande.id) ?? null; }
        catch { relue = undefined; }
      }
      appliquer({ type: 'relire', relue, lecture: lectureRef.current });
    } finally { envoiEnCours.current = false; }
  }

  const verrou = actionVerrouillee(etat, lecture);
  const occupe = chargement || etat.phase === 'envoi' || etat.phase === 'relecture';
  // Le parent ignore le retour Android pendant l'envoi : l'écran ne doit pas être démonté avant le verdict.
  const envoiOuRelecture = etat.phase === 'envoi' || etat.phase === 'relecture';
  useEffect(() => { signalerOccupe?.(envoiOuRelecture); return () => signalerOccupe?.(false); }, [envoiOuRelecture]);
  const verdict = etat.phase === 'verdict' ? etat : null;

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Action titre="Retour au compte" agir={fermer} disabled={etat.phase === 'envoi' || etat.phase === 'relecture'} />
    <Text accessibilityRole="header" style={s.titre}>Espace restaurateur</Text>
    {liste?.restaurant && <Text style={s.texte}>{liste.restaurant.nom}{liste.restaurant.accepteCommandes ? '' : ' · n’accepte pas de commandes pour le moment'}</Text>}
    {occupe && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>{etat.phase === 'envoi' ? 'Envoi de votre réponse…' : etat.phase === 'relecture' ? 'Relecture des commandes…' : 'Lecture des commandes…'}</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {liste && liste.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{liste.illisibles === 1 ? '1 commande est illisible dans l’application' : liste.illisibles + ' commandes sont illisibles dans l’application'} : ouvrez Speedfood sur le site pour {liste.illisibles === 1 ? 'la' : 'les'} voir et {liste.illisibles === 1 ? 'la' : 'les'} traiter.</Text>}
    <Action titre="Actualiser les commandes" agir={() => { void actualiser(); }} disabled={occupe} />
    {luLe && <Text style={s.secondaire}>Liste lue à {luLe}. Elle ne se met pas à jour toute seule : actualisez pour voir les nouvelles commandes.</Text>}
    {verdict && <Text accessibilityRole={verdict.verdict.genre === 'confirme' ? undefined : 'alert'} accessibilityLiveRegion="polite" style={s.texte}>{verdict.verdict.message}</Text>}
    {liste && grouper(liste.commandes).map(g => <View key={g.groupe} style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={s.nom}>{g.titre} ({g.commandes.length})</Text>
      {g.commandes.length === 0 && <Text style={s.secondaire}>Aucune commande.</Text>}
      {g.commandes.map(o => {
        const possibles = actionsAffichees(o, etat);
        const confirmation = etat.phase === 'confirmation_refus' && etat.commandeId === o.id;
        return <View key={o.id} style={s.carte}>
          <Text style={s.nom}>{o.reference}{o.estTest ? ' · TEST' : ''}</Text>
          <Text style={s.texte}>{libelleStatut(o)}</Text>
          <Text style={s.texte}>{o.mode === 'livraison' ? 'Livraison' : o.mode === 'retrait' ? 'Retrait' : 'Sur place' + (o.tableNumero ? ' · table ' + o.tableNumero : '')} · {new Date(o.creeLe).toLocaleString('fr-FR')}</Text>
          <Text style={s.texte}>{o.clientNom} · <Text selectable>{o.clientTelephone}</Text></Text>
          {o.clientAdresse && <Text style={s.texte}>{o.clientAdresse}</Text>}
          {o.lignes.map((l, i) => <Text key={i} style={s.texte}>{l.quantite} × {l.nom}{l.options.length > 0 ? ' (' + l.options.join(', ') + ')' : ''} · {(l.prixGnf * l.quantite).toLocaleString('fr-FR')} GNF</Text>)}
          <Text style={s.nom}>{o.totalGnf.toLocaleString('fr-FR')} GNF</Text>
          {possibles.length > 0 && !confirmation && <>
            <Action titre={'Accepter ' + o.reference} disabled={occupe || verrou} agir={() => { void envoyer(o, 'accepter'); }} />
            <Action titre={'Refuser ' + o.reference} secondaire disabled={occupe || verrou} agir={() => appliquer({ type: 'demander_refus', commandeId: o.id, lecture })} />
          </>}
          {possibles.length > 0 && confirmation && <>
            <Text accessibilityRole="alert" style={s.texte}>Refuser définitivement cette commande ? Le client sera prévenu.</Text>
            <Action titre="Oui, refuser" disabled={occupe || verrou} agir={() => { void envoyer(o, 'refuser'); }} />
            <Action titre="Non, garder" secondaire disabled={occupe} agir={() => appliquer({ type: 'annuler_refus' })} />
          </>}
        </View>;
      })}
    </View>)}
  </ScrollView>;
}

const s = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  contenu: { padding: 22, gap: 18, width: '100%', maxWidth: 620, alignSelf: 'center' },
  titre: { fontFamily: polices.titre, fontSize: 34, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  bouton: { backgroundColor: c.action, minHeight: 48, padding: 14, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  boutonSecondaire: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.action },
  boutonTexte: { color: c.surface, fontFamily: polices.texte, fontWeight: '700' },
  boutonTexteSecondaire: { color: c.action },
});
