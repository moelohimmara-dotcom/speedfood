import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action } from './BoutonAction';
import { ServiceMenuReel } from './ServiceMenuReel';
import { LIBELLES_SECTIONS, SECTIONS_RESTAURATEUR, peutChangerDeSection, type SectionRestaurateur } from './serviceRestaurateur';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import {
  CONFIRMATIONS, ETAT_REPOS, MESSAGE_DEJA_PAYEE, actionLivraisonDe, annulationRefuseePourPaiement, chiffresDuCode, ErreurRestaurateur, actionVerrouillee, actionsAffichees, actionsPossibles, evoluer, formaterGnf, formulaireOuvert, grouper, libelleStatut, libellePaiement, ligneClient, ligneLivraison, lignesRecapProposition, preparerCodeLivraison,
  type ActionRestaurateur, type ChampProposition, type CommandeRestaurateur, type EtatAction, type EvenementAction, type ListeRestaurateur,
} from './restaurateur';
import { cibleDefilement, margeBasseClavier } from './clavier';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Espace restaurateur (lots D1 à D4a), trois sections en haut de l'écran : « Commandes » (ci-dessous), « Service » et « Menu » (voir ServiceMenuReel.tsx). Commandes : les commandes de MON restaurant en trois groupes (À traiter, En cours, Historique), actualisation MANUELLE (aucun rafraîchissement
 * automatique, aucune notification ici), boutons Accepter, Refuser, Marquer prête, Marquer terminée, et Paiement reçu / non reçu pour un paiement DÉCLARÉ par code marchand
 * Annuler la commande, et Proposer un autre prix (formulaire à trois champs, récapitulatif « ancien prix → nouveau prix », confirmation avant l'envoi). Le refus, l'annulation et le
 * « non reçu » demandent une confirmation. Aucun bouton « espèces » : Speedfood ne manipule jamais d'espèces. Depuis le lot D5, la LIVRAISON par le restaurant : « Parti livrer », « Livrée » (code à 4 chiffres du client,
 * clavier numérique, champ visible clavier ouvert) et « Annuler la livraison » (avec confirmation), selon l'état que le serveur a donné.
 * Toute règle (verrou, un seul essai, relecture après réponse incertaine) est dans `restaurateur.ts` ; cet écran n'envoie jamais le restaurant (le serveur le tire du compte).
 */
export function RestaurateurReel({ fermer, signalerOccupe }: { fermer(): void; signalerOccupe?(occupe: boolean): void }) {
  const [liste, setListe] = useState<ListeRestaurateur | null>(null);
  const [luLe, setLuLe] = useState<string | null>(null);
  const [lecture, setLecture] = useState(0);
  const [etat, setEtat] = useState<EtatAction>(ETAT_REPOS);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [section, setSection] = useState<SectionRestaurateur>('commandes');
  // Codes de remise TAPÉS (par commande) : uniquement dans l'écran, jamais dans la machine d'états ni dans un message ; effacés dès l'envoi et dès que la commande n'est plus « en route ».
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [erreursCode, setErreursCode] = useState<Record<string, string>>({});
  const [serviceOuvert, setServiceOuvert] = useState(false);
  const [serviceOccupe, setServiceOccupe] = useState(false);
  const etatRef = useRef<EtatAction>(ETAT_REPOS);
  const lectureRef = useRef(0);
  const actif = useRef(true);
  const envoiEnCours = useRef(false);
  const lectureEnCours = useRef(false);
  // Clavier (lot D3b) : marge basse = hauteur du clavier sous Android, défilement vers le champ actif (voir clavier.ts).
  const defilement = useRef<ScrollView>(null);
  const champActif = useRef<TextInput | null>(null);
  const [hauteurClavier, setHauteurClavier] = useState(0);
  function defilerVersChampActif() {
    const champ = champActif.current; const zone = defilement.current;
    const contenu = zone && (zone as unknown as { getInnerViewRef?: () => unknown }).getInnerViewRef?.();
    if (!champ || !zone || !contenu) return;
    try { champ.measureLayout(contenu as never, (_x, y) => { zone.scrollTo({ y: cibleDefilement(y), animated: true }); }, () => {}); } catch { /* mesure impossible : l'écran reste utilisable en défilant à la main */ }
  }
  useEffect(() => {
    const montre = Keyboard.addListener('keyboardDidShow', e => { setHauteurClavier(e.endCoordinates?.height ?? 0); setTimeout(defilerVersChampActif, 80); });
    const cache = Keyboard.addListener('keyboardDidHide', () => setHauteurClavier(0));
    return () => { montre.remove(); cache.remove(); };
  }, []);
  const champs = useRef<Record<string, TextInput | null>>({});
  const auFocus = (nom: string) => () => { champActif.current = champs.current[nom] ?? null; setTimeout(defilerVersChampActif, 80); };
  const auBlur = () => { champActif.current = null; };
  const reference = (nom: string) => (t: TextInput | null) => { champs.current[nom] = t; };

  function appliquer(ev: EvenementAction) { const suivant = evoluer(etatRef.current, ev); etatRef.current = suivant; if (actif.current) setEtat(suivant); }
  /** Une liste relue qui montre la commande déjà proposée, traitée ou disparue ferme le formulaire de proposition : il ne reste jamais ouvert, invisible, à bloquer l'écran. */
  function fermerFormulaireSiPerime(l: ListeRestaurateur) {
    const e = etatRef.current;
    if (e.phase !== 'saisie' && e.phase !== 'recapitulatif') return;
    const o = l.commandes.find(x => x.id === e.commandeId);
    if (!o || !actionsPossibles(o).includes('proposer')) appliquer({ type: 'annuler_confirmation' });
  }
  function oublierCode(commandeId: string) { setCodes(x => { if (!(commandeId in x)) return x; const n = { ...x }; delete n[commandeId]; return n; }); setErreursCode(x => { if (!(commandeId in x)) return x; const n = { ...x }; delete n[commandeId]; return n; }); }
  /** Un code tapé pour une commande dont la livraison n'est plus « en route » n'a plus lieu d'être : il est effacé. */
  function purgerCodes(l: ListeRestaurateur) { const enRoute = new Set(l.commandes.filter(x => x.livraison?.statut === 'vers_client').map(x => x.id)); setCodes(x => Object.fromEntries(Object.entries(x).filter(([id]) => enRoute.has(id)))); setErreursCode(x => Object.fromEntries(Object.entries(x).filter(([id]) => enRoute.has(id)))); }
  function accepterListe(l: ListeRestaurateur) { lectureRef.current++; if (!actif.current) return; fermerFormulaireSiPerime(l); purgerCodes(l); setLecture(lectureRef.current); setListe(l); setLuLe(new Date().toLocaleTimeString('fr-FR')); setErreur(null); }
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
  async function envoyer(commande: CommandeRestaurateur, action: ActionRestaurateur, codeLivraison?: string) {
    if (envoiEnCours.current || lectureEnCours.current) return;
    const avant = etatRef.current;
    appliquer({ type: 'envoyer', commandeId: commande.id, action, lecture: lectureRef.current, paiementStatut: commande.paiementStatut, paiementMode: commande.paiementMode, codeValide: codeLivraison !== undefined });
    if (etatRef.current === avant || etatRef.current.phase !== 'envoi') return;
    envoiEnCours.current = true;
    oublierCode(commande.id);
    try {
      let echec: ErreurRestaurateur | null = null; let session: string | null = null;
      const enEnvoi = etatRef.current;
      try {
        if (action === 'proposer') {
          // Les montants envoyés sont ceux du récapitulatif confirmé, portés par l'état d'envoi ; le client les revérifie encore avant le réseau.
          if (enEnvoi.phase !== 'envoi' || !enEnvoi.valeurs) throw new ErreurRestaurateur('refus', 'La proposition n’a pas pu être préparée. Recommencez.');
          await gestion.proposerRestaurateur(commande.id, enEnvoi.valeurs);
        } else if (actionLivraisonDe(action) !== null) {
          // Livraison (lot D5) : l'identifiant vient de la livraison que le serveur a donnée pour CETTE commande ; le code, déjà validé, part une seule fois puis est effacé de l'écran.
          const demande = actionLivraisonDe(action); const livraison = commande.livraison;
          if (!demande || !livraison) throw new ErreurRestaurateur('local', 'La livraison de cette commande n’est pas lisible. Actualisez la liste.');
          await gestion.actionLivraisonRestaurateur(livraison.id, demande, demande === 'livree' ? codeLivraison : undefined);
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
  useEffect(() => { signalerOccupe?.(envoiOuRelecture || serviceOccupe); return () => signalerOccupe?.(false); }, [envoiOuRelecture, serviceOccupe]);
  const verdict = etat.phase === 'verdict' ? etat : null;

  const bloque = occupe || verrou || formulaireOuvert(etat);
  const saisir = (champ: ChampProposition) => (valeur: string) => appliquer({ type: 'saisir', champ, valeur });

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <ScrollView ref={defilement} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={[s.contenu, { paddingBottom: 22 + margeBasseClavier(hauteurClavier, Platform.OS) }]}>
    <Action titre="Retour au compte" agir={fermer} disabled={etat.phase === 'envoi' || etat.phase === 'relecture' || serviceOccupe} />
    <Text accessibilityRole="header" style={s.titre}>Espace restaurateur</Text>
    <View accessibilityRole="tablist" style={s.sections}>{SECTIONS_RESTAURATEUR.map(x => <Pressable key={x} accessibilityRole="tab" accessibilityLabel={LIBELLES_SECTIONS[x]} accessibilityState={{ selected: section === x, disabled: !peutChangerDeSection(envoiOuRelecture, serviceOccupe) }} disabled={!peutChangerDeSection(envoiOuRelecture, serviceOccupe)} onPress={() => { setSection(x); if (x !== 'commandes') setServiceOuvert(true); }} style={[s.onglet, section === x && s.ongletActif]}><Text style={[s.ongletTexte, section === x && s.ongletTexteActif]}>{LIBELLES_SECTIONS[x]}</Text></Pressable>)}</View>
    {serviceOuvert && <View style={section === 'commandes' ? s.masque : undefined}><ServiceMenuReel section={section === 'menu' ? 'menu' : 'service'} clavier={{ reference, auFocus, auBlur }} allerAuMenu={() => setSection('menu')} signalerOccupe={setServiceOccupe} /></View>}
    {section === 'commandes' && <>
    {liste?.restaurant && <Text style={s.texte}>{liste.restaurant.nom}{liste.restaurant.accepteCommandes ? '' : ' · n’accepte pas de commandes pour le moment'}</Text>}
    {occupe && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>{etat.phase === 'envoi' ? 'Envoi de votre réponse…' : etat.phase === 'relecture' ? 'Relecture des commandes…' : 'Lecture des commandes…'}</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {liste && liste.livraisonsIllisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{liste.livraisonsIllisibles === 1 ? 'La livraison d’une commande est illisible' : 'Les livraisons de ' + liste.livraisonsIllisibles + ' commandes sont illisibles'} : ses boutons de livraison sont masqués. Actualisez la liste ou ouvrez Speedfood sur le site.</Text>}
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
          {ligneLivraison(o) && <Text style={s.texte}>{ligneLivraison(o)}</Text>}
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
            <TextInput ref={reference('sousTotal')} onFocus={auFocus('sousTotal')} onBlur={auBlur} accessibilityLabel={'Nouveau sous-total en GNF, commande ' + o.reference} style={s.champ} keyboardType="number-pad" autoCorrect={false} maxLength={14} value={formulaire.brouillon.sousTotal} onChangeText={saisir('sousTotal')} editable={!occupe} />
            {formulaire.erreurs.sousTotal && <Text accessibilityRole="alert" style={s.erreurChamp}>{formulaire.erreurs.sousTotal}</Text>}
            <Text style={s.texte}>Nouveaux frais de livraison (GNF)</Text>
            <TextInput ref={reference('frais')} onFocus={auFocus('frais')} onBlur={auBlur} accessibilityLabel={'Nouveaux frais de livraison en GNF, commande ' + o.reference} style={s.champ} keyboardType="number-pad" autoCorrect={false} maxLength={14} value={formulaire.brouillon.frais} onChangeText={saisir('frais')} editable={!occupe} />
            {formulaire.erreurs.frais && <Text accessibilityRole="alert" style={s.erreurChamp}>{formulaire.erreurs.frais}</Text>}
            <Text style={s.texte}>Conditions modifiées (facultatif)</Text>
            <TextInput ref={reference('conditions')} onFocus={auFocus('conditions')} onBlur={auBlur} accessibilityLabel={'Conditions modifiées, commande ' + o.reference} style={[s.champ, s.champLong]} multiline maxLength={500} value={formulaire.brouillon.conditions} onChangeText={saisir('conditions')} editable={!occupe} placeholder="Ex. : un plat est remplacé par…" />
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
          {!confirmation && !formulaire && possibles.includes('livraison_partir') && <Action titre={'Parti livrer ' + o.reference} disabled={bloque} agir={() => { void envoyer(o, 'livraison_partir'); }} />}
          {!confirmation && !formulaire && possibles.includes('livraison_livree') && <View style={{ gap: 8 }}>
            <Text style={s.texte}>Code du client (4 chiffres)</Text>
            <Text style={s.secondaire}>Demandez ce code au client à la porte : il le voit sur son suivi. Le code n’est pas conservé.</Text>
            <TextInput ref={reference('code-' + o.id)} onFocus={auFocus('code-' + o.id)} onBlur={auBlur} accessibilityLabel={'Code du client, 4 chiffres, commande ' + o.reference} style={s.champ} keyboardType="number-pad" inputMode="numeric" maxLength={4} autoCorrect={false} autoComplete="off" importantForAutofill="no" textContentType="none" value={codes[o.id] ?? ''} onChangeText={v => { setCodes(x => ({ ...x, [o.id]: chiffresDuCode(v) })); setErreursCode(x => { if (!(o.id in x)) return x; const n = { ...x }; delete n[o.id]; return n; }); }} editable={!bloque} />
            {erreursCode[o.id] && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreursCode[o.id]}</Text>}
            <Action titre={'Livrée ' + o.reference} disabled={bloque} agir={() => {
              // Validation LOCALE avant tout envoi : un code qui n'a pas 4 chiffres ne part jamais, ne verrouille rien et n'est jamais repris dans le message.
              const p = preparerCodeLivraison(codes[o.id]);
              if (!p.ok) { setErreursCode(x => ({ ...x, [o.id]: p.message })); return; }
              void envoyer(o, 'livraison_livree', p.code);
            }} />
          </View>}
          {!confirmation && !formulaire && possibles.includes('livraison_annuler') && <Action titre={'Annuler la livraison ' + o.reference} secondaire disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', commandeId: o.id, action: 'livraison_annuler', lecture })} />}
          {!confirmation && !formulaire && annulationRefuseePourPaiement(o) && <Text accessibilityRole="alert" style={s.texte}>{MESSAGE_DEJA_PAYEE}</Text>}
          {!confirmation && !formulaire && possibles.includes('annuler') && <Action titre={'Annuler la commande ' + o.reference} secondaire disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', commandeId: o.id, action: 'annuler', lecture, paiementStatut: o.paiementStatut, paiementMode: o.paiementMode })} />}
        </View>;
      })}
    </View>)}
    </>}
  </ScrollView>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  sections: { flexDirection: 'row', gap: 8 },
  onglet: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.action, borderRadius: 22, backgroundColor: c.surface },
  ongletActif: { backgroundColor: c.action },
  ongletTexte: { fontFamily: polices.texte, fontWeight: '700', color: c.action },
  ongletTexteActif: { color: c.surface },
  masque: { display: 'none' },
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
});
