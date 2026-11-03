import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurRestaurateur } from './restaurateur';
import { Action } from './BoutonAction';
import {
  ETAT_SERVICE_REPOS, HORAIRES_MAX, actionConfirmerTout, actionStatut, brouillonDe, brouillonModifie, chiffresSeulement, confirmationDe, evoluerService, formaterPrix, libelleDisponibilitePlat, preparerReglages, serviceVerrouille,
  type ActionService, type BrouillonReglages, type ErreursReglages, type EtatService, type EvenementService, type MenuRestaurateur, type ReglagesRestaurateur, type RelectureService,
} from './serviceRestaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Sections « Service » et « Menu » de l'espace restaurateur (lot D4a). Service : deux interrupteurs (« Ouvert » et « Prend des commandes ») avec confirmation, horaires et délai de préparation
 * (bouton « Enregistrer »), résumé des plats à reconfirmer (la liste du SERVEUR). Menu : disponibilité de chaque plat, confirmation d'un plat, « Tout confirmer » (avec confirmation).
 * Rien d'autre : ni création, ni modification, ni archivage de plat, ni suppléments, ni photos.
 *
 * Toute règle (verrou, un seul essai, relecture après chaque écriture, verdict honnête) est dans `serviceRestaurateur.ts` ; cet écran n'envoie jamais le restaurant (le serveur le tire du compte)
 * et n'affiche que ce que le serveur a relu : un interrupteur ne bouge qu'après relecture, jamais par supposition.
 */
export interface ClavierChamps { reference(nom: string): (t: TextInput | null) => void; auFocus(nom: string): () => void; auBlur(): void }

export function ServiceMenuReel({ section, clavier, allerAuMenu, signalerOccupe }: { section: 'service' | 'menu'; clavier: ClavierChamps; allerAuMenu(): void; signalerOccupe(occupe: boolean): void }) {
  const [reglages, setReglages] = useState<ReglagesRestaurateur | null>(null);
  const [menu, setMenu] = useState<MenuRestaurateur | null>(null);
  const [luLe, setLuLe] = useState<string | null>(null);
  const [lecture, setLecture] = useState(0);
  const [etat, setEtat] = useState<EtatService>(ETAT_SERVICE_REPOS);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [brouillon, setBrouillon] = useState<BrouillonReglages | null>(null);
  const [erreurs, setErreurs] = useState<ErreursReglages>({});
  const etatRef = useRef<EtatService>(ETAT_SERVICE_REPOS);
  const lectureRef = useRef(0);
  const reglagesRef = useRef<ReglagesRestaurateur | null>(null);
  const brouillonRef = useRef<BrouillonReglages | null>(null);
  const actif = useRef(true);
  const envoiEnCours = useRef(false);
  const lectureEnCours = useRef(false);

  function appliquer(ev: EvenementService) { const suivant = evoluerService(etatRef.current, ev); etatRef.current = suivant; if (actif.current) setEtat(suivant); }
  function poserBrouillon(b: BrouillonReglages | null) { brouillonRef.current = b; if (actif.current) setBrouillon(b); }
  /** Une lecture réussie remplace ce qui est affiché ; la saisie en cours des réglages n'est écrasée que si elle n'a pas été modifiée. */
  function accepterReglages(r: ReglagesRestaurateur) {
    const precedent = reglagesRef.current; const saisie = brouillonRef.current;
    reglagesRef.current = r; lectureRef.current++;
    if (!actif.current) return;
    setReglages(r); setLecture(lectureRef.current);
    if (saisie === null || precedent === null || !brouillonModifie(precedent, saisie)) poserBrouillon(brouillonDe(r));
  }
  function accepterMenu(m: MenuRestaurateur) { lectureRef.current++; if (!actif.current) return; setMenu(m); setLecture(lectureRef.current); }
  function messageErreur(e: unknown) { return e instanceof ErreurRestaurateur || e instanceof ErreurConnexion ? e.message : 'Impossible de lire ces informations. Réessayez.'; }

  /** Lit les réglages ET le menu (un seul essai chacun, jamais de relance). Renvoie ce qui a pu être relu ; une panne laisse l'affichage précédent. */
  async function lireTout(): Promise<RelectureService> {
    const [r, m] = await Promise.allSettled([gestion.reglagesRestaurateur(), gestion.menuRestaurateur()]);
    const relue: RelectureService = {};
    if (r.status === 'fulfilled') { accepterReglages(r.value); relue.reglages = r.value; }
    if (m.status === 'fulfilled') { accepterMenu(m.value); relue.menu = m.value; }
    const echec = r.status === 'rejected' ? r.reason : m.status === 'rejected' ? m.reason : null;
    if (actif.current) { setErreur(echec === null ? null : messageErreur(echec)); if (echec === null) setLuLe(new Date().toLocaleTimeString('fr-FR')); }
    return relue;
  }
  async function actualiser() {
    if (lectureEnCours.current || envoiEnCours.current) return;
    lectureEnCours.current = true; setChargement(true); setErreur(null);
    try { await lireTout(); } finally { lectureEnCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { actif.current = true; void actualiser(); return () => { actif.current = false; }; }, []);

  /** UN SEUL essai. Ensuite l'état du serveur est relu pour savoir ce qui a vraiment été enregistré ; jamais de relance automatique. */
  async function envoyer(action: ActionService) {
    if (envoiEnCours.current || lectureEnCours.current) return;
    const avant = etatRef.current;
    appliquer({ type: 'envoyer', action, lecture: lectureRef.current });
    if (etatRef.current === avant || etatRef.current.phase !== 'envoi') return;
    envoiEnCours.current = true;
    try {
      let echec: ErreurRestaurateur | null = null; let session: string | null = null;
      try { await gestion.ecrireService(action); }
      catch (e) { if (e instanceof ErreurRestaurateur) echec = e; else session = e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.'; }
      appliquer({ type: 'repondre', erreur: echec, sessionTerminee: session });
      const relue: RelectureService = session === null ? await lireTout() : {};
      appliquer({ type: 'relire', relue, lecture: lectureRef.current });
      const e: EtatService = etatRef.current as EtatService;
      // Réglages enregistrés et relus : la saisie reprend EXACTEMENT ce que le serveur a (jamais une supposition).
      if (action.type === 'reglages' && e.phase === 'verdict' && e.verdict.genre === 'confirme' && relue.reglages) poserBrouillon(brouillonDe(relue.reglages));
    } finally { envoiEnCours.current = false; }
  }

  const verrou = serviceVerrouille(etat, lecture);
  const envoiOuRelecture = etat.phase === 'envoi' || etat.phase === 'relecture';
  const occupe = chargement || envoiOuRelecture;
  useEffect(() => { signalerOccupe(envoiOuRelecture); return () => signalerOccupe(false); }, [envoiOuRelecture]);
  const bloque = occupe || verrou;
  const verdict = etat.phase === 'verdict' ? etat.verdict : null;
  const confirmation = etat.phase === 'confirmation' ? etat.action : null;
  const aReconfirmer = new Set((reglages?.platsAReconfirmer ?? []).map(p => p.id));
  const maintenant = new Date();

  function enregistrerReglages() {
    if (!reglages || !brouillon) return;
    const p = preparerReglages(reglages, brouillon);
    if (!p.ok) { setErreurs(p.erreurs); return; }
    setErreurs({});
    void envoyer({ type: 'reglages', valeurs: p.valeurs });
  }
  const bloc = (a: ActionService | null) => {
    const textes = a ? confirmationDe(a) : null;
    return a && textes ? <View style={s.formulaire}>
      <Text accessibilityRole="alert" style={s.texte}>{textes.question}</Text>
      <Action titre={textes.oui} disabled={bloque} agir={() => { void envoyer(a); }} />
      <Action titre={textes.non} secondaire disabled={occupe} agir={() => appliquer({ type: 'annuler_confirmation' })} />
    </View> : null;
  };

  return <View style={{ gap: 14 }}>
    {occupe && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>{etat.phase === 'envoi' ? 'Envoi de votre changement…' : etat.phase === 'relecture' ? 'Relecture de l’état du restaurant…' : 'Lecture en cours…'}</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre={section === 'service' ? 'Actualiser le service' : 'Actualiser le menu'} agir={() => { void actualiser(); }} disabled={occupe} />
    {luLe && <Text style={s.secondaire}>Lu à {luLe}. L’écran ne se met pas à jour tout seul : actualisez pour voir les changements faits ailleurs.</Text>}
    {verdict && <Text accessibilityRole={verdict.genre === 'confirme' ? undefined : 'alert'} accessibilityLiveRegion="polite" style={s.texte}>{verdict.message}</Text>}

    {section === 'service' && reglages && <View style={{ gap: 14 }}>
      <Text accessibilityRole="header" style={s.nom}>État du service</Text>
      <View style={s.ligneInterrupteur}>
        <View style={{ flex: 1 }}>
          <Text style={s.texte}>Ouvert</Text>
          <Text style={s.secondaire}>{reglages.ouvert ? 'Le restaurant apparaît ouvert.' : 'Le restaurant apparaît fermé : aucune commande possible.'}</Text>
        </View>
        <Switch accessibilityLabel="Ouvert" value={reglages.ouvert} disabled={bloque} onValueChange={(valeur) => appliquer({ type: 'demander_confirmation', action: actionStatut('ouvert', valeur), lecture })} />
      </View>
      {confirmation?.type === 'statut' && confirmation.champ === 'ouvert' && bloc(confirmation)}
      <View style={s.ligneInterrupteur}>
        <View style={{ flex: 1 }}>
          <Text style={s.texte}>Prend des commandes</Text>
          <Text style={s.secondaire}>{reglages.accepteCommandes ? 'Les clients peuvent commander (si le restaurant est ouvert).' : 'En pause : les clients voient votre menu mais ne peuvent plus commander.'}</Text>
        </View>
        <Switch accessibilityLabel="Prend des commandes" value={reglages.accepteCommandes} disabled={bloque} onValueChange={(valeur) => appliquer({ type: 'demander_confirmation', action: actionStatut('accepte_commandes', valeur), lecture })} />
      </View>
      {confirmation?.type === 'statut' && confirmation.champ === 'accepte_commandes' && bloc(confirmation)}

      <Text accessibilityRole="header" style={s.nom}>Horaires et délai</Text>
      <Text style={s.texte}>Horaires d’ouverture</Text>
      <TextInput ref={clavier.reference('horaires')} onFocus={clavier.auFocus('horaires')} onBlur={clavier.auBlur} accessibilityLabel="Horaires d’ouverture" style={[s.champ, s.champLong]} multiline maxLength={HORAIRES_MAX} value={brouillon?.horaires ?? ''} onChangeText={(texte) => { setErreurs({}); poserBrouillon({ ...(brouillonRef.current ?? brouillonDe(reglages)), horaires: texte }); }} editable={!bloque} placeholder="Ex. : lundi au samedi, 8 h à 22 h" />
      <Text style={s.secondaire}>{(brouillon?.horaires ?? '').length} / {HORAIRES_MAX} caractères</Text>
      {erreurs.horaires && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreurs.horaires}</Text>}
      <Text style={s.texte}>Délai habituel de préparation (minutes, de 5 à 240 ; vide = aucun délai annoncé)</Text>
      <TextInput ref={clavier.reference('delai')} onFocus={clavier.auFocus('delai')} onBlur={clavier.auBlur} accessibilityLabel="Délai de préparation en minutes" style={s.champ} keyboardType="number-pad" autoCorrect={false} maxLength={3} value={brouillon?.delai ?? ''} onChangeText={(texte) => { setErreurs({}); poserBrouillon({ ...(brouillonRef.current ?? brouillonDe(reglages)), delai: chiffresSeulement(texte) }); }} editable={!bloque} />
      {erreurs.delai && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreurs.delai}</Text>}
      {erreurs.general && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreurs.general}</Text>}
      <Action titre="Enregistrer les réglages" disabled={bloque || brouillon === null} agir={enregistrerReglages} />

      <Text accessibilityRole="header" style={s.nom}>Plats à reconfirmer ({reglages.platsAReconfirmer.length})</Text>
      {reglages.platsAReconfirmer.length === 0
        ? <Text style={s.texte}>Aucun plat à reconfirmer pour le moment.</Text>
        : <Text style={s.texte}>{reglages.platsAReconfirmer.slice(0, 8).map(p => p.nom).join(', ')}{reglages.platsAReconfirmer.length > 8 ? ' et ' + (reglages.platsAReconfirmer.length - 8) + ' autre(s)' : ''}. Leur disponibilité n’a pas été confirmée récemment : les clients la voient « à confirmer ».</Text>}
      {reglages.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{reglages.illisibles === 1 ? '1 plat à reconfirmer est illisible dans l’application' : reglages.illisibles + ' plats à reconfirmer sont illisibles dans l’application'} : ouvrez Speedfood sur le site pour {reglages.illisibles === 1 ? 'le' : 'les'} voir.</Text>}
      <Action titre="Voir le menu" secondaire agir={allerAuMenu} disabled={occupe} />
    </View>}

    {section === 'menu' && menu && <View style={{ gap: 12 }}>
      {menu.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{menu.illisibles === 1 ? '1 plat est illisible dans l’application' : menu.illisibles + ' plats sont illisibles dans l’application'} : ouvrez Speedfood sur le site pour {menu.illisibles === 1 ? 'le' : 'les'} voir et {menu.illisibles === 1 ? 'le' : 'les'} modifier.</Text>}
      <Text accessibilityRole="header" style={s.nom}>Vos plats ({menu.plats.length})</Text>
      {menu.plats.length === 0 && <Text style={s.texte}>Aucun plat dans le menu.</Text>}
      {menu.plats.some(p => p.disponible) && (confirmation?.type === 'confirmer_tout'
        ? bloc(confirmation)
        : <Action titre="Tout confirmer" disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', action: actionConfirmerTout(menu), lecture })} />)}
      {menu.plats.map(p => {
        const lib = libelleDisponibilitePlat(p, aReconfirmer, maintenant);
        const prix = formaterPrix(p.prixGnf);
        return <View key={p.id} style={s.carte}>
          <Text style={s.nomPlat}>{p.nom}</Text>
          {prix && <Text style={s.texte}>{prix}</Text>}
          <Text style={s.texte}>{lib.etat}</Text>
          {lib.confirmation && <Text style={s.secondaire}>{lib.confirmation}</Text>}
          <Action titre={(p.disponible ? 'Marquer indisponible ' : 'Marquer disponible ') + p.nom} secondaire disabled={bloque} agir={() => { void envoyer({ type: 'disponibilite', platId: p.id, disponible: !p.disponible }); }} />
          {p.disponible && <Action titre={'Confirmer la disponibilité ' + p.nom} disabled={bloque} agir={() => { void envoyer({ type: 'confirmer', platId: p.id, avant: p.confirmeLe }); }} />}
        </View>;
      })}
      <Text style={s.secondaire}>Créer ou modifier un plat : sur le site pour l’instant.</Text>
    </View>}
  </View>;
}

const s = StyleSheet.create({
  formulaire: { gap: 8, padding: 12, borderWidth: 1, borderColor: c.action, borderRadius: 14 },
  ligneInterrupteur: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  champ: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.bordure, borderRadius: 12, backgroundColor: c.surface, color: c.encre, fontFamily: polices.texte, fontSize: 16 },
  champLong: { minHeight: 110, textAlignVertical: 'top' },
  erreurChamp: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.action, fontWeight: '700' },
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  nomPlat: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
});
