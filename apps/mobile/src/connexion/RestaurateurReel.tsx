import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import {
  CONFIRMATIONS, ETAT_REPOS, ErreurRestaurateur, actionVerrouillee, actionsAffichees, actionsPossibles, evoluer, formaterGnf, formulaireOuvert, grouper, libelleStatut, libellePaiement, ligneClient, lignesRecapProposition,
  type ActionRestaurateur, type ChampProposition, type CommandeRestaurateur, type EtatAction, type EvenementAction, type ListeRestaurateur,
} from './restaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Espace restaurateur (lots D1, D2 et D3) : les commandes de MON restaurant en trois groupes (À traiter, En cours, Historique), actualisation MANUELLE (aucun rafraîchissement
 * automatique, aucune notification ici), boutons Accepter, Refuser, Marquer prête, Marquer terminée, et Paiement reçu / non reçu pour un paiement DÉCLARÉ par code marchand
 * Annuler la commande, et Proposer un autre prix (formulaire à trois champs, récapitulatif « ancien prix → nouveau prix », confirmation avant l'envoi). Le refus, l'annulation et le
 * « non reçu » demandent une confirmation. Aucun bouton « espèces » : Speedfood ne manipule jamais d'espèces. Rien d'autre : pas de livraison ni de menu.
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
  /** Une liste relue qui montre la commande déjà proposée, traitée ou disparue ferme le formulaire de proposition : il ne reste jamais ouvert, invisible, à bloquer l'écran. */
  function fermerFormulaireSiPerime(l: ListeRestaurateur) {
    const e = etatRef.current;
    if (e.phase !== 'saisie' && e.phase !== 'recapitulatif') return;
    const o = l.commandes.find(x => x.id === e.commandeId);
    if (!o || !actionsPossibles(o).includes('proposer')) appliquer({ type: 'annuler_confirmation' });
  }
  function accepterListe(l: ListeRestaurateur) { lectureRef.current++; if (!actif.current) return; fermerFormulaireSiPerime(l); setLecture(lectureRef.current); setListe(l); setLuLe(new Date().toLocaleTimeString('fr-FR')); setErreur(null); }
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
      const enEnvoi = etatRef.current;
      try {
        if (action === 'proposer') {
          // Les montants envoyés sont ceux du récapitulatif confirmé, portés par l'état d'envoi ; le client les revérifie encore avant le réseau.
          if (enEnvoi.phase !== 'envoi' || !enEnvoi.valeurs) throw new ErreurRestaurateur('refus', 'La proposition n’a pas pu être préparée. Recommencez.');
          await gestion.proposerRestaurateur(commande.id, enEnvoi.valeurs);
        } else await gestion.actionRestaurateur(commande.id, action);
      }
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

  const bloque = occupe || verrou || formulaireOuvert(etat);
  const saisir = (champ: ChampProposition) => (valeur: string) => appliquer({ type: 'saisir', champ, valeur });

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={s.contenu}>
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
        const confirmation = etat.phase === 'confirmation' && etat.commandeId === o.id && possibles.includes(etat.action) ? etat : null;
        const formulaire = (etat.phase === 'saisie' || etat.phase === 'recapitulatif') && etat.commandeId === o.id && possibles.includes('proposer') ? etat : null;
        const paiement = libellePaiement(o);
        return <View key={o.id} style={s.carte}>
          <Text style={s.nom}>{o.reference}{o.estTest ? ' · TEST' : ''}</Text>
          <Text style={s.texte}>{libelleStatut(o)}</Text>
          <Text style={s.texte}>{o.mode === 'livraison' ? 'Livraison' : o.mode === 'retrait' ? 'Retrait' : 'Sur place' + (o.tableNumero ? ' · table ' + o.tableNumero : '')} · {new Date(o.creeLe).toLocaleString('fr-FR')}</Text>
          <Text selectable style={s.texte}>{ligneClient(o)}</Text>
          {o.clientAdresse && <Text style={s.texte}>{o.clientAdresse}</Text>}
          {o.lignes.map((l, i) => <Text key={i} style={s.texte}>{l.quantite} × {l.nom}{l.options.length > 0 ? ' (' + l.options.join(', ') + ')' : ''} · {(l.prixGnf * l.quantite).toLocaleString('fr-FR')} GNF</Text>)}
          <Text style={s.nom}>{o.totalGnf.toLocaleString('fr-FR')} GNF</Text>
          {paiement && <Text style={s.texte}>{paiement}</Text>}
          {paiement && possibles.includes('paiement_recu') && <Text style={s.secondaire}>Comparez avec le SMS de confirmation de votre opérateur avant de valider.</Text>}
          {confirmation && confirmation.action in CONFIRMATIONS && <>
            <Text accessibilityRole="alert" style={s.texte}>{CONFIRMATIONS[confirmation.action as keyof typeof CONFIRMATIONS].question}</Text>
            <Action titre={CONFIRMATIONS[confirmation.action as keyof typeof CONFIRMATIONS].oui} disabled={occupe || verrou} agir={() => { void envoyer(o, confirmation.action); }} />
            <Action titre={CONFIRMATIONS[confirmation.action as keyof typeof CONFIRMATIONS].non} secondaire disabled={occupe} agir={() => appliquer({ type: 'annuler_confirmation' })} />
          </>}
          {formulaire && formulaire.phase === 'saisie' && <View style={s.formulaire}>
            <Text accessibilityRole="header" style={s.nom}>Proposer un autre prix</Text>
            <Text style={s.secondaire}>Prix actuels : sous-total {formaterGnf(formulaire.actuel.sousTotalGnf)} GNF, frais de livraison {formaterGnf(formulaire.actuel.fraisGnf)} GNF. Le client devra accepter cette nouvelle version avant toute préparation. S’il refuse ou ne répond pas à temps, la commande sera annulée sans frais.</Text>
            <Text style={s.texte}>Nouveau sous-total (GNF)</Text>
            <TextInput accessibilityLabel={'Nouveau sous-total en GNF, commande ' + o.reference} style={s.champ} keyboardType="number-pad" autoCorrect={false} maxLength={14} value={formulaire.brouillon.sousTotal} onChangeText={saisir('sousTotal')} editable={!occupe} />
            {formulaire.erreurs.sousTotal && <Text accessibilityRole="alert" style={s.erreurChamp}>{formulaire.erreurs.sousTotal}</Text>}
            <Text style={s.texte}>Nouveaux frais de livraison (GNF)</Text>
            <TextInput accessibilityLabel={'Nouveaux frais de livraison en GNF, commande ' + o.reference} style={s.champ} keyboardType="number-pad" autoCorrect={false} maxLength={14} value={formulaire.brouillon.frais} onChangeText={saisir('frais')} editable={!occupe} />
            {formulaire.erreurs.frais && <Text accessibilityRole="alert" style={s.erreurChamp}>{formulaire.erreurs.frais}</Text>}
            <Text style={s.texte}>Conditions modifiées (facultatif)</Text>
            <TextInput accessibilityLabel={'Conditions modifiées, commande ' + o.reference} style={[s.champ, s.champLong]} multiline maxLength={500} value={formulaire.brouillon.conditions} onChangeText={saisir('conditions')} editable={!occupe} placeholder="Ex. : un plat est remplacé par…" />
            {formulaire.erreurs.conditions && <Text accessibilityRole="alert" style={s.erreurChamp}>{formulaire.erreurs.conditions}</Text>}
            {formulaire.erreurs.general && <Text accessibilityRole="alert" style={s.erreurChamp}>{formulaire.erreurs.general}</Text>}
            <Action titre="Continuer" disabled={occupe || verrou} agir={() => appliquer({ type: 'valider_saisie' })} />
            <Action titre="Fermer" secondaire disabled={occupe} agir={() => appliquer({ type: 'annuler_confirmation' })} />
          </View>}
          {formulaire && formulaire.phase === 'recapitulatif' && <View style={s.formulaire}>
            <Text accessibilityRole="header" style={s.nom}>Vérifiez la proposition</Text>
            {lignesRecapProposition(formulaire.recap).map(l => <Text key={l} style={s.texte}>{l}</Text>)}
            {formulaire.recap.conditions && <Text style={s.texte}>Conditions : {formulaire.recap.conditions}</Text>}
            <Text accessibilityRole="alert" style={s.texte}>La proposition sera envoyée au client, qui doit l’accepter avant toute préparation. Envoyer ?</Text>
            <Action titre="Envoyer la proposition" disabled={occupe || verrou} agir={() => { void envoyer(o, 'proposer'); }} />
            <Action titre="Modifier" secondaire disabled={occupe} agir={() => appliquer({ type: 'modifier_saisie' })} />
            <Action titre="Fermer" secondaire disabled={occupe} agir={() => appliquer({ type: 'annuler_confirmation' })} />
          </View>}
          {!confirmation && !formulaire && possibles.includes('accepter') && <Action titre={'Accepter ' + o.reference} disabled={bloque} agir={() => { void envoyer(o, 'accepter'); }} />}
          {!confirmation && !formulaire && possibles.includes('proposer') && <Action titre={'Proposer un autre prix ' + o.reference} secondaire disabled={bloque} agir={() => appliquer({ type: 'ouvrir_proposition', commandeId: o.id, actuel: { sousTotalGnf: o.sousTotalGnf, fraisGnf: o.fraisGnf }, lecture })} />}
          {!confirmation && !formulaire && possibles.includes('refuser') && <Action titre={'Refuser ' + o.reference} secondaire disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', commandeId: o.id, action: 'refuser', lecture })} />}
          {!confirmation && !formulaire && possibles.includes('prete') && <Action titre={'Marquer prête ' + o.reference} disabled={bloque} agir={() => { void envoyer(o, 'prete'); }} />}
          {!confirmation && !formulaire && possibles.includes('terminee') && <Action titre={'Marquer terminée ' + o.reference} disabled={bloque} agir={() => { void envoyer(o, 'terminee'); }} />}
          {!confirmation && !formulaire && possibles.includes('paiement_recu') && <Action titre={'Paiement reçu ' + o.reference} disabled={bloque} agir={() => { void envoyer(o, 'paiement_recu'); }} />}
          {!confirmation && !formulaire && possibles.includes('paiement_non_recu') && <Action titre={'Paiement non reçu ' + o.reference} secondaire disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', commandeId: o.id, action: 'paiement_non_recu', lecture })} />}
          {!confirmation && !formulaire && possibles.includes('annuler') && <Action titre={'Annuler la commande ' + o.reference} secondaire disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', commandeId: o.id, action: 'annuler', lecture })} />}
        </View>;
      })}
    </View>)}
  </ScrollView>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  formulaire: { gap: 8, padding: 12, borderWidth: 1, borderColor: c.action, borderRadius: 14 },
  champ: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.bordure, borderRadius: 12, backgroundColor: c.surface, color: c.encre, fontFamily: polices.texte, fontSize: 16 },
  champLong: { minHeight: 90, textAlignVertical: 'top' },
  erreurChamp: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.action, fontWeight: '700' },
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
