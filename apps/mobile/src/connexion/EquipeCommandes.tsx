import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurEquipe } from './equipe';
import { formaterGnf } from './restaurateur';
import {
  ACTIONS_REPARTITION_EQUIPE, type ActionRepartitionEquipe, type CommandeARepartir, type CommandeEquipe, type CoordonneesEquipe, type ReponseDetailEquipe, type StatutCommandeEquipe,
} from './commandes-equipe';
import { ACTIONS_LIVREUR_EQUIPE, MOTIF_ACTIONS_LIVREUR, type ExploitationEquipe, type LivraisonEquipe, type LivreurEquipe } from './exploitation-equipe';
import { couleurs as c, polices } from '../design/tokens';

function messageErreur(e: unknown) {
  return e instanceof ErreurEquipe || e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.';
}
function useActif() {
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);
  return actif;
}
const LIBELLES_ACTION: Record<ActionRepartitionEquipe, string> = { accepter: 'Accepter', refuser: 'Refuser', prete: 'Prête', terminee: 'Remise (terminée)', annuler: 'Annuler' };
function actionsPour(statut: StatutCommandeEquipe): ActionRepartitionEquipe[] {
  if (statut === 'en_attente') return ['accepter', 'refuser', 'annuler'];
  if (statut === 'acceptee') return ['prete', 'annuler'];
  if (statut === 'prete') return ['terminee', 'annuler'];
  return [];
}

/** Poste de répartition : commandes actives des établissements tenus par l'équipe ; chaque action est confirmée, envoyée une fois, puis la liste est relue. */
export function RepartitionEquipeReel() {
  const actif = useActif();
  const [commandes, setCommandes] = useState<CommandeARepartir[] | null>(null);
  const [illisibles, setIllisibles] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState<{ commande: CommandeARepartir; action: ActionRepartitionEquipe } | null>(null);
  const enCours = useRef(false);

  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { const l = await gestion.commandesARepartir(); if (actif.current) { setCommandes(l.commandes); setIllisibles(l.illisibles); } }
    catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lire(); }, []);

  async function agir() {
    if (confirmation === null || enCours.current) return;
    const { commande, action } = confirmation;
    enCours.current = true; setChargement(true); setErreur(null);
    try {
      const statut = await gestion.actionRepartitionEquipe(commande.id, action);
      if (!actif.current) return;
      setConfirmation(null);
      setMessage(commande.reference + ' : action appliquée (statut ' + statut.replaceAll('_', ' ') + '). Liste relue.');
      const l = await gestion.commandesARepartir();
      if (actif.current) { setCommandes(l.commandes); setIllisibles(l.illisibles); }
    } catch (e) { if (actif.current) { setConfirmation(null); setErreur(messageErreur(e)); } }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Répartition</Text>
    <Text style={s.secondaire}>Commandes des établissements tenus par Speedfood. Chaque action est tracée par le serveur ; les commandes d’essai sont marquées.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des commandes à répartir…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Action titre="Actualiser la répartition" agir={() => { void lire(); }} disabled={chargement} />
    {illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{illisibles === 1 ? '1 commande est illisible dans l’application.' : illisibles + ' commandes sont illisibles dans l’application.'}</Text>}
    {commandes !== null && commandes.length === 0 && <Text style={s.texte}>Aucune commande à confirmer pour le moment.</Text>}
    {(commandes ?? []).map(o => <View key={o.id} style={s.carte}>
      <Text style={s.nomPetit}>{o.reference} · {o.restaurantNom}{o.estTest ? ' · TEST' : ''}</Text>
      <Text style={s.texte}>{o.statut.replaceAll('_', ' ')} · {o.mode === 'livraison' ? 'Livraison' : o.mode === 'sur_place' ? 'Sur place' : 'Retrait'} · {formaterGnf(o.totalGnf)} GNF</Text>
      {o.lignes.map((l, i) => <Text key={i} style={s.secondaire}>{l.quantite} × {l.nom}</Text>)}
      {o.telephoneRestaurant && <Text style={s.secondaire}>Restaurant : {o.telephoneRestaurant}</Text>}
      {confirmation?.commande.id === o.id ? <>
        <Text accessibilityRole="alert" style={s.texte}>{LIBELLES_ACTION[confirmation.action]} la commande {o.reference} ?</Text>
        <Action titre={'Oui, ' + LIBELLES_ACTION[confirmation.action].toLowerCase()} disabled={chargement} agir={() => { void agir(); }} />
        <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmation(null)} />
      </> : actionsPour(o.statut).map(a => <Action key={a} titre={LIBELLES_ACTION[a] + ' ' + o.reference} secondaire disabled={chargement} agir={() => { setErreur(null); setMessage(''); setConfirmation({ commande: o, action: a }); }} />)}
    </View>)}
  </View>;
}

/** Recherche et détail support : coordonnées masquées partout, vraies coordonnées seulement après motif, affichées puis oubliées. */
export function CommandesEquipeReel() {
  const actif = useActif();
  const [reference, setReference] = useState('');
  const [jour, setJour] = useState(true);
  const [commandes, setCommandes] = useState<CommandeEquipe[] | null>(null);
  const [illisibles, setIllisibles] = useState(0);
  const [detail, setDetail] = useState<ReponseDetailEquipe | null>(null);
  const [motif, setMotif] = useState('');
  const [coordonnees, setCoordonnees] = useState<CoordonneesEquipe | null>(null);
  const [confirmationStatut, setConfirmationStatut] = useState<StatutCommandeEquipe | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const enCours = useRef(false);

  async function executer(f: () => Promise<void>) {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { await f(); } catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  async function chercher() {
    await executer(async () => {
      const l = await gestion.commandesEquipe({ reference: reference.trim() || undefined, jour });
      if (actif.current) { setCommandes(l.commandes); setIllisibles(l.illisibles); setDetail(null); setCoordonnees(null); }
    });
  }
  useEffect(() => { void chercher(); }, []);
  async function ouvrirDetail(id: string) {
    await executer(async () => {
      const d = await gestion.detailCommandeEquipe(id);
      if (actif.current) { setDetail(d); setCoordonnees(null); setConfirmationStatut(null); setMotif(''); }
    });
  }
  function fermerDetail() { setDetail(null); setCoordonnees(null); setMotif(''); setConfirmationStatut(null); }

  if (detail) {
    const o = detail.commande;
    return <View style={{ gap: 12 }}>
      <Action titre="Retour à la liste" agir={fermerDetail} />
      <Text accessibilityRole="header" style={s.nom}>{o.reference}</Text>
      <Text style={s.texte}>{o.restaurantNom} · {o.statut.replaceAll('_', ' ')} · {o.mode === 'livraison' ? 'Livraison' : o.mode === 'sur_place' ? 'Sur place' : 'Retrait'}</Text>
      <Text style={s.texte}>{o.clientNom} · {o.telephoneAffiche}</Text>
      <Text style={s.texte}>{o.adresseAffichee}</Text>
      <Text style={s.texte}>Sous-total {formaterGnf(o.sousTotal)} GNF · frais {formaterGnf(o.fraisLivraisonEstime)} GNF · total {formaterGnf(o.totalGnf)} GNF</Text>
      {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Un instant…</Text></>}
      {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
      {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
      <Text accessibilityRole="header" style={s.nomPetit}>Historique</Text>
      {o.historique.length === 0 && <Text style={s.secondaire}>Aucun événement.</Text>}
      {o.historique.map((h, i) => <Text key={i} style={s.secondaire}>{new Date(h.horodatage).toLocaleString('fr-FR')} · {(h.statutPrecedent ?? '—').replaceAll('_', ' ')} → {h.statutSuivant.replaceAll('_', ' ')} · {h.acteur}</Text>)}
      {o.propositions.length > 0 && <>
        <Text accessibilityRole="header" style={s.nomPetit}>Propositions de prix</Text>
        {o.propositions.map(p => <Text key={p.version} style={s.secondaire}>v{p.version} · {formaterGnf(p.sousTotalPrecedent)} → {formaterGnf(p.nouveauSousTotal)} GNF · {p.statut.replaceAll('_', ' ')}</Text>)}
      </>}
      {detail.transitions.length > 0 && <>
        <Text accessibilityRole="header" style={s.nomPetit}>Action de support</Text>
        <Text style={s.texte}>Motif (obligatoire, il sera tracé)</Text>
        <TextInput accessibilityLabel="Motif de l’action de support" value={motif} onChangeText={setMotif} editable={!chargement} style={s.champ} />
        {detail.transitions.map(v => confirmationStatut === v ? <View key={v} style={{ gap: 8 }}>
          <Text accessibilityRole="alert" style={s.texte}>Passer {o.reference} à « {v.replaceAll('_', ' ')} » avec ce motif ?</Text>
          <Action titre="Oui, appliquer" disabled={chargement} agir={() => {
            void executer(async () => {
              await gestion.changerStatutEquipe(o.id, v, motif);
              if (!actif.current) return;
              setMessage('Statut appliqué. Détail relu.');
              const d = await gestion.detailCommandeEquipe(o.id);
              if (actif.current) { setDetail(d); setConfirmationStatut(null); }
            });
          }} />
          <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmationStatut(null)} />
        </View> : <Action key={v} titre={'Passer à ' + v.replaceAll('_', ' ')} secondaire disabled={chargement} agir={() => { setErreur(null); setConfirmationStatut(v); }} />)}
      </>}
      {detail.peutReveler && coordonnees === null && <>
        <Text accessibilityRole="header" style={s.nomPetit}>Coordonnées du client</Text>
        <Text style={s.secondaire}>Elles sont masquées. Les révéler demande un motif : la consultation est journalisée par le serveur avant l’affichage.</Text>
        <TextInput accessibilityLabel="Motif de la révélation des coordonnées" value={motif} onChangeText={setMotif} editable={!chargement} style={s.champ} />
        <Action titre="Révéler les coordonnées" secondaire disabled={chargement} agir={() => {
          void executer(async () => {
            const co = await gestion.revelerCoordonneesEquipe(o.id, motif);
            if (actif.current) setCoordonnees(co);
          });
        }} />
      </>}
      {coordonnees && <View style={s.carte}>
        <Text style={s.nomPetit}>Coordonnées (à oublier après usage)</Text>
        <Text style={s.texte}>{coordonnees.telephone}</Text>
        <Text style={s.texte}>{coordonnees.adresse}</Text>
        <Action titre="Masquer les coordonnées" secondaire agir={() => setCoordonnees(null)} />
      </View>}
    </View>;
  }

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Commandes (support)</Text>
    <Text style={s.texte}>Recherche par référence</Text>
    <TextInput accessibilityLabel="Référence à rechercher" value={reference} onChangeText={setReference} editable={!chargement} style={s.champ} />
    <Action titre={jour ? 'Limiter au jour : oui' : 'Limiter au jour : non'} secondaire disabled={chargement} agir={() => setJour(v => !v)} />
    <Action titre="Rechercher" disabled={chargement} agir={() => { void chercher(); }} />
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Recherche…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{illisibles === 1 ? '1 commande est illisible dans l’application.' : illisibles + ' commandes sont illisibles dans l’application.'}</Text>}
    {commandes !== null && commandes.length === 0 && <Text style={s.texte}>Aucune commande trouvée.</Text>}
    {(commandes ?? []).map(o => <View key={o.id} style={s.carte}>
      <Text style={s.nomPetit}>{o.reference} · {o.restaurantNom}</Text>
      <Text style={s.texte}>{o.statut.replaceAll('_', ' ')} · {o.clientNom} · {formaterGnf(o.totalGnf)} GNF</Text>
      <Text style={s.secondaire}>{new Date(o.creeLe).toLocaleString('fr-FR')} · {o.telephoneAffiche}</Text>
      <Action titre={'Détail ' + o.reference} secondaire disabled={chargement} agir={() => { void ouvrirDetail(o.id); }} />
    </View>)}
  </View>;
}

type ConfirmationExploitation =
  | { genre: 'livraison'; livraison: LivraisonEquipe; action: string; livreurId?: string }
  | { genre: 'livreur'; livreur: LivreurEquipe; action: string };
const LIBELLES_LIVREUR: Record<string, string> = { en_ligne: 'Mettre en ligne', hors_ligne: 'Mettre hors ligne', approuver: 'Approuver', refuser: 'Refuser', suspendre: 'Suspendre', reactiver: 'Réactiver', archiver: 'Archiver' };

/** Exploitation : courses en cours et livreurs. Chaque action est confirmée, envoyée une fois (motif où le serveur l'exige), puis tout est relu. */
export function ExploitationEquipeReel() {
  const actif = useActif();
  const [donnees, setDonnees] = useState<ExploitationEquipe | null>(null);
  const [motif, setMotif] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationExploitation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const enCours = useRef(false);

  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { const d = await gestion.exploitationEquipe(); if (actif.current) setDonnees(d); }
    catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lire(); }, []);

  async function agir() {
    if (confirmation === null || enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try {
      const retour = confirmation.genre === 'livraison'
        ? await gestion.actionLivraisonEquipe(confirmation.action, confirmation.livraison.id, confirmation.livreurId)
        : await gestion.actionLivreurEquipe(confirmation.action, confirmation.livreur.id, MOTIF_ACTIONS_LIVREUR.has(confirmation.action) ? motif : undefined);
      if (!actif.current) return;
      setConfirmation(null); setMotif(''); setMessage(retour + ' Liste relue.');
      const d = await gestion.exploitationEquipe();
      if (actif.current) setDonnees(d);
    } catch (e) { if (actif.current) { setConfirmation(null); setErreur(messageErreur(e)); } }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Exploitation livreurs</Text>
    <Text style={s.secondaire}>Courses en cours et livreurs. Le dossier d’identité d’un livreur reste sur le site, réservé au super administrateur.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture de l’exploitation…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Action titre="Actualiser l’exploitation" agir={() => { void lire(); }} disabled={chargement} />
    {donnees && donnees.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{donnees.illisibles === 1 ? '1 ligne est illisible dans l’application.' : donnees.illisibles + ' lignes sont illisibles dans l’application.'}</Text>}
    <Text accessibilityRole="header" style={s.nomPetit}>Courses en cours</Text>
    {donnees !== null && donnees.livraisons.length === 0 && <Text style={s.texte}>Aucune course en cours.</Text>}
    {(donnees?.livraisons ?? []).map(l => <View key={l.id} style={s.carte}>
      <Text style={s.nomPetit}>{l.commandeReference} · {l.restaurantNom}</Text>
      <Text style={s.texte}>{l.libelle} · {formaterGnf(l.fraisGnf)} GNF de frais</Text>
      <Text style={s.secondaire}>{l.livreurNom ? 'Livreur : ' + l.livreurNom : 'Sans livreur affecté'}{l.raison ? ' · ' + l.raison : ''}</Text>
      {confirmation?.genre === 'livraison' && confirmation.livraison.id === l.id ? <>
        <Text accessibilityRole="alert" style={s.texte}>Appliquer « {confirmation.action === 'assigner' ? 'affecter' : confirmation.action} » à {l.commandeReference} ?</Text>
        <Action titre="Oui, appliquer" disabled={chargement} agir={() => { void agir(); }} />
        <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmation(null)} />
      </> : <>
        <Action titre={'Relancer la recherche ' + l.commandeReference} secondaire disabled={chargement} agir={() => setConfirmation({ genre: 'livraison', livraison: l, action: 'relancer' })} />
        {l.statut === 'assignee' && <Action titre={'En route vers le restaurant ' + l.commandeReference} secondaire disabled={chargement} agir={() => setConfirmation({ genre: 'livraison', livraison: l, action: 'vers_restaurant' })} />}
        {l.statut === 'vers_restaurant' && <Action titre={'Commande récupérée ' + l.commandeReference} secondaire disabled={chargement} agir={() => setConfirmation({ genre: 'livraison', livraison: l, action: 'recuperee' })} />}
        {l.statut === 'recuperee' && <Action titre={'En route vers le client ' + l.commandeReference} secondaire disabled={chargement} agir={() => setConfirmation({ genre: 'livraison', livraison: l, action: 'vers_client' })} />}
        <Action titre={'Annuler la course ' + l.commandeReference} secondaire disabled={chargement} agir={() => setConfirmation({ genre: 'livraison', livraison: l, action: 'annuler' })} />
        {(donnees?.livreurs ?? []).filter(v => v.cycle === 'actif').slice(0, 5).map(v => <Action key={v.id} titre={'Affecter à ' + v.nom} secondaire disabled={chargement} agir={() => setConfirmation({ genre: 'livraison', livraison: l, action: 'assigner', livreurId: v.id })} />)}
      </>}
    </View>)}
    <Text accessibilityRole="header" style={s.nomPetit}>Livreurs</Text>
    {(donnees?.livreurs ?? []).map(v => <View key={v.id} style={s.carte}>
      <Text style={s.nomPetit}>{v.nom}{v.simule ? ' · simulé' : ''}</Text>
      <Text style={s.texte}>{v.statut.replaceAll('_', ' ')} · {v.vehicule} · dossier {v.aDossier ? 'présent' : 'absent'}</Text>
      <Text style={s.secondaire}>{v.aPosition && v.positionLe ? 'Position lue le ' + new Date(v.positionLe).toLocaleString('fr-FR') : 'Pas de position connue'}</Text>
      {confirmation?.genre === 'livreur' && confirmation.livreur.id === v.id ? <>
        <Text accessibilityRole="alert" style={s.texte}>{LIBELLES_LIVREUR[confirmation.action]} {v.nom} ?</Text>
        {MOTIF_ACTIONS_LIVREUR.has(confirmation.action) && <>
          <Text style={s.texte}>Motif (5 caractères au moins, il sera tracé)</Text>
          <TextInput accessibilityLabel="Motif de l’action sur le livreur" value={motif} onChangeText={setMotif} editable={!chargement} style={s.champ} />
        </>}
        <Action titre="Oui, appliquer" disabled={chargement} agir={() => { void agir(); }} />
        <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmation(null)} />
      </> : ACTIONS_LIVREUR_EQUIPE.map(a => <Action key={a} titre={LIBELLES_LIVREUR[a] + ' ' + v.nom} secondaire disabled={chargement} agir={() => { setErreur(null); setMessage(''); setMotif(''); setConfirmation({ genre: 'livreur', livreur: v, action: a }); }} />)}
    </View>)}
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
