import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurRestaurateur } from './restaurateur';
import { Action } from './BoutonAction';
import { choisirPhoto, type SourcePhoto } from './photoPlat';
import { depsPhotoNatives } from './photoPlatNatif';
import {
  BROUILLON_OPTION_VIDE, BROUILLON_PLAT_VIDE, ETAT_SERVICE_REPOS, HORAIRES_MAX, actionArchiver, actionConfirmerTout, actionPhotoDefinir, actionPhotoRetirer, actionRetirerOption, actionStatut, brouillonDe, brouillonModifie, brouillonPlatDe, chiffresSeulement, confirmationDe, formulaireSeReferme, evoluerService,
  formaterPrix, libelleDisponibilitePlat, lecturePourAction, lecturePourEtat, photoPeutPartir, preparerOption, preparerPlat, preparerReglages, serviceVerrouille,
  type ActionService, type BrouillonOption, type BrouillonPlat, type BrouillonReglages, type ErreursOption, type ErreursPlat, type ErreursReglages, type EtatService, type EvenementService, type Lectures, type MenuRestaurateur, type PlatRestaurateur,
  type ReglagesRestaurateur, type RelectureService,
} from './serviceRestaurateur';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Sections « Service » et « Menu » de l'espace restaurateur (lots D4a et D4b). Service : deux interrupteurs (« Ouvert » et « Prend des commandes ») avec confirmation, horaires et délai de préparation
 * (bouton « Enregistrer »), résumé des plats à reconfirmer (la liste du SERVEUR). Menu : disponibilité de chaque plat, confirmation d'un plat, « Tout confirmer » (avec confirmation) et, depuis D4b,
 * ajout, modification et archivage d'un plat (avec confirmation), ajout et retrait d'un supplément (avec confirmation) et, depuis D4c, la photo de chaque plat : aperçu, « Ajouter une photo » / « Changer la photo »
 * (galerie ou appareil photo, image réduite avant l'envoi) et « Retirer la photo » (avec confirmation). Les documents restent sur le site.
 *
 * Toute règle (verrou, un seul essai, relecture après chaque écriture, verdict honnête) est dans `serviceRestaurateur.ts` ; cet écran n'envoie jamais le restaurant (le serveur le tire du compte)
 * et n'affiche que ce que le serveur a relu : un interrupteur ne bouge qu'après relecture, jamais par supposition, et un plat n'apparaît qu'une fois relu.
 */
export interface ClavierChamps { reference(nom: string): (t: TextInput | null) => void; auFocus(nom: string): () => void; auBlur(): void }

type FormulairePlat = { mode: 'creer' } | { mode: 'modifier'; platId: string };

export function ServiceMenuReel({ section, clavier, allerAuMenu, signalerOccupe }: { section: 'service' | 'menu'; clavier: ClavierChamps; allerAuMenu(): void; signalerOccupe(occupe: boolean): void }) {
  const [reglages, setReglages] = useState<ReglagesRestaurateur | null>(null);
  const [menu, setMenu] = useState<MenuRestaurateur | null>(null);
  const [luLe, setLuLe] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Lectures>({ reglages: 0, menu: 0 });
  const [etat, setEtat] = useState<EtatService>(ETAT_SERVICE_REPOS);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [brouillon, setBrouillon] = useState<BrouillonReglages | null>(null);
  const [erreurs, setErreurs] = useState<ErreursReglages>({});
  const [formPlat, setFormPlat] = useState<FormulairePlat | null>(null);
  const [brouillonPlat, setBrouillonPlat] = useState<BrouillonPlat>(BROUILLON_PLAT_VIDE);
  const [erreursPlat, setErreursPlat] = useState<ErreursPlat>({});
  const [formOption, setFormOption] = useState<string | null>(null);
  const [brouillonOption, setBrouillonOption] = useState<BrouillonOption>(BROUILLON_OPTION_VIDE);
  const [erreursOption, setErreursOption] = useState<ErreursOption>({});
  const [choixPhoto, setChoixPhoto] = useState<string | null>(null);
  const [selection, setSelection] = useState(false);
  const [messagePhoto, setMessagePhoto] = useState<{ platId: string; texte: string } | null>(null);
  const [imagesEnErreur, setImagesEnErreur] = useState<Record<string, string>>({});
  const menuRef = useRef<MenuRestaurateur | null>(null);
  const selectionEnCours = useRef(false);
  const etatRef = useRef<EtatService>(ETAT_SERVICE_REPOS);
  const lecturesRef = useRef<Lectures>({ reglages: 0, menu: 0 });
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
    reglagesRef.current = r; lecturesRef.current = { ...lecturesRef.current, reglages: lecturesRef.current.reglages + 1 };
    if (!actif.current) return;
    setReglages(r); setLectures(lecturesRef.current);
    if (saisie === null || precedent === null || !brouillonModifie(precedent, saisie)) poserBrouillon(brouillonDe(r));
  }
  function accepterMenu(m: MenuRestaurateur) { menuRef.current = m; lecturesRef.current = { ...lecturesRef.current, menu: lecturesRef.current.menu + 1 }; if (!actif.current) return; setMenu(m); setLectures(lecturesRef.current); }
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
    appliquer({ type: 'envoyer', action, lecture: lecturePourEtat(etatRef.current, lecturesRef.current) });
    if (etatRef.current === avant || etatRef.current.phase !== 'envoi') return;
    envoiEnCours.current = true;
    try {
      let echec: ErreurRestaurateur | null = null; let session: string | null = null;
      try { await gestion.ecrireService(action); }
      catch (e) { if (e instanceof ErreurRestaurateur) echec = e; else session = e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.'; }
      appliquer({ type: 'repondre', erreur: echec, sessionTerminee: session });
      const relue: RelectureService = session === null ? await lireTout() : {};
      appliquer({ type: 'relire', relue, lecture: lecturePourAction(action, lecturesRef.current) });
      const e: EtatService = etatRef.current as EtatService;
      // Réglages enregistrés et relus : la saisie reprend EXACTEMENT ce que le serveur a (jamais une supposition).
      if (action.type === 'reglages' && e.phase === 'verdict' && e.verdict.genre === 'confirme' && relue.reglages) poserBrouillon(brouillonDe(relue.reglages));
      // Plat ou supplément enregistré (le serveur l'a confirmé) : le formulaire se referme et se vide. Dans tout autre cas il reste ouvert avec la saisie, pour corriger ou réessayer (si le verdict le permet).
      if (e.phase === 'verdict' && formulaireSeReferme(action, e.verdict) && actif.current) {
        if (action.type === 'creer' || action.type === 'modifier') { setFormPlat(null); setBrouillonPlat(BROUILLON_PLAT_VIDE); setErreursPlat({}); }
        if (action.type === 'option_ajouter') { setFormOption(null); setBrouillonOption(BROUILLON_OPTION_VIDE); setErreursOption({}); }
      }
    } finally { envoiEnCours.current = false; }
  }

  /**
   * Photo d'un plat (lot D4c) : sélecteur (galerie ou appareil photo), image réduite, puis l'envoi passe par `envoyer` (un seul essai, relecture du menu, verdict honnête). Annuler le sélecteur ne fait RIEN et n'affiche
   * aucune erreur ; une permission refusée ou une photo inutilisable affiche un message fixe et laisse tous les boutons actifs. `avant` est la photo que le serveur avait à la DERNIÈRE lecture.
   */
  async function prendrePhoto(plat: PlatRestaurateur, source: SourcePhoto) {
    if (selectionEnCours.current || !photoPeutPartir(envoiEnCours.current, lectureEnCours.current, etatRef.current, lecturesRef.current)) return;
    selectionEnCours.current = true; setSelection(true); setMessagePhoto(null);
    let action: ActionService | null = null;
    try {
      const choix = await choisirPhoto(source, depsPhotoNatives);
      if (!actif.current || choix.genre === 'annule') return;
      if (choix.genre === 'pret') {
        const courant = menuRef.current?.plats.find(x => x.id === plat.id);
        if (courant === undefined) setMessagePhoto({ platId: plat.id, texte: 'Ce plat n’apparaît plus dans le menu. Actualisez le menu.' });
        else action = actionPhotoDefinir(courant, choix.fichier);
      } else setMessagePhoto({ platId: plat.id, texte: choix.message });
    } finally { selectionEnCours.current = false; if (actif.current) setSelection(false); }
    if (action !== null && actif.current) {
      // Un autre changement a démarré pendant que le sélecteur était ouvert : la photo choisie n'est pas envoyée, et on le dit (jamais un abandon silencieux).
      if (!photoPeutPartir(envoiEnCours.current, lectureEnCours.current, etatRef.current, lecturesRef.current)) { setMessagePhoto({ platId: plat.id, texte: 'Un autre changement est en cours : la photo n’a pas été envoyée. Réessayez dans un instant.' }); return; }
      setChoixPhoto(null); await envoyer(action);
    }
  }

  const lectureVerrou = lecturePourEtat(etat, lectures);
  const verrou = serviceVerrouille(etat, lectureVerrou);
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

  // ---------- plats : formulaire d'ajout / de modification ----------
  function ouvrirCreation() { setFormOption(null); setFormPlat({ mode: 'creer' }); setBrouillonPlat(BROUILLON_PLAT_VIDE); setErreursPlat({}); }
  function ouvrirModification(p: PlatRestaurateur) { const b = brouillonPlatDe(p); if (b === null) return; setFormOption(null); setFormPlat({ mode: 'modifier', platId: p.id }); setBrouillonPlat(b); setErreursPlat({}); }
  function fermerFormulairePlat() { setFormPlat(null); setBrouillonPlat(BROUILLON_PLAT_VIDE); setErreursPlat({}); }
  function ouvrirSupplement(p: PlatRestaurateur) { setFormPlat(null); setFormOption(p.id); setBrouillonOption(BROUILLON_OPTION_VIDE); setErreursOption({}); }
  function fermerFormulaireOption() { setFormOption(null); setBrouillonOption(BROUILLON_OPTION_VIDE); setErreursOption({}); }
  function enregistrerPlat(cible: { mode: 'creer' } | { mode: 'modifier'; plat: PlatRestaurateur }) {
    if (!menu) return;
    const p = preparerPlat(brouillonPlat, cible.mode === 'creer' ? { mode: 'creer', menu } : { mode: 'modifier', plat: cible.plat });
    if (!p.ok) { setErreursPlat(p.erreurs); return; }
    setErreursPlat({});
    void envoyer(p.action);
  }
  function enregistrerSupplement(plat: PlatRestaurateur) {
    const p = preparerOption(brouillonOption, plat);
    if (!p.ok) { setErreursOption(p.erreurs); return; }
    setErreursOption({});
    void envoyer(p.action);
  }
  const platEnEdition = formPlat?.mode === 'modifier' ? menu?.plats.find(p => p.id === formPlat.platId) ?? null : null;
  const formulairePlat = (cible: { mode: 'creer' } | { mode: 'modifier'; plat: PlatRestaurateur }) => <View style={s.formulaire}>
    <Text accessibilityRole="header" style={s.nomPlat}>{cible.mode === 'creer' ? 'Nouveau plat' : 'Modifier ' + cible.plat.nom}</Text>
    <Text style={s.texte}>Nom du plat</Text>
    <TextInput ref={clavier.reference('plat-nom')} onFocus={clavier.auFocus('plat-nom')} onBlur={clavier.auBlur} accessibilityLabel="Nom du plat" style={s.champ} maxLength={200} value={brouillonPlat.nom} onChangeText={(texte) => { setErreursPlat({}); setBrouillonPlat({ ...brouillonPlat, nom: texte }); }} editable={!bloque} />
    {erreursPlat.nom && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreursPlat.nom}</Text>}
    <Text style={s.texte}>Prix en francs guinéens (GNF)</Text>
    <TextInput ref={clavier.reference('plat-prix')} onFocus={clavier.auFocus('plat-prix')} onBlur={clavier.auBlur} accessibilityLabel="Prix du plat en GNF" style={s.champ} keyboardType="number-pad" autoCorrect={false} maxLength={14} value={brouillonPlat.prix} onChangeText={(texte) => { setErreursPlat({}); setBrouillonPlat({ ...brouillonPlat, prix: texte }); }} editable={!bloque} />
    {erreursPlat.prix && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreursPlat.prix}</Text>}
    <Text style={s.texte}>Description (facultative)</Text>
    <TextInput ref={clavier.reference('plat-description')} onFocus={clavier.auFocus('plat-description')} onBlur={clavier.auBlur} accessibilityLabel="Description du plat" style={[s.champ, s.champLong]} multiline maxLength={500} value={brouillonPlat.description} onChangeText={(texte) => { setErreursPlat({}); setBrouillonPlat({ ...brouillonPlat, description: texte }); }} editable={!bloque} />
    <Text style={s.secondaire}>{brouillonPlat.description.length} / 500 caractères</Text>
    {erreursPlat.description && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreursPlat.description}</Text>}
    {erreursPlat.general && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreursPlat.general}</Text>}
    <Action titre={cible.mode === 'creer' ? 'Ajouter ce plat' : 'Enregistrer les modifications'} disabled={bloque} agir={() => enregistrerPlat(cible)} />
    <Action titre="Annuler" secondaire disabled={occupe} agir={fermerFormulairePlat} />
  </View>;
  const formulaireOption = (plat: PlatRestaurateur) => <View style={s.formulaire}>
    <Text accessibilityRole="header" style={s.nomPlat}>{'Nouveau supplément pour ' + plat.nom}</Text>
    <Text style={s.texte}>Nom du supplément</Text>
    <TextInput ref={clavier.reference('option-nom')} onFocus={clavier.auFocus('option-nom')} onBlur={clavier.auBlur} accessibilityLabel="Nom du supplément" style={s.champ} maxLength={200} value={brouillonOption.nom} onChangeText={(texte) => { setErreursOption({}); setBrouillonOption({ ...brouillonOption, nom: texte }); }} editable={!bloque} />
    {erreursOption.nom && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreursOption.nom}</Text>}
    <Text style={s.texte}>Prix du supplément en francs guinéens (GNF)</Text>
    <TextInput ref={clavier.reference('option-prix')} onFocus={clavier.auFocus('option-prix')} onBlur={clavier.auBlur} accessibilityLabel="Prix du supplément en GNF" style={s.champ} keyboardType="number-pad" autoCorrect={false} maxLength={14} value={brouillonOption.prix} onChangeText={(texte) => { setErreursOption({}); setBrouillonOption({ ...brouillonOption, prix: texte }); }} editable={!bloque} />
    {erreursOption.prix && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreursOption.prix}</Text>}
    {erreursOption.general && <Text accessibilityRole="alert" style={s.erreurChamp}>{erreursOption.general}</Text>}
    <Action titre="Ajouter ce supplément" disabled={bloque} agir={() => enregistrerSupplement(plat)} />
    <Action titre="Annuler" secondaire disabled={occupe} agir={fermerFormulaireOption} />
  </View>;

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
        <Switch accessibilityLabel="Ouvert" value={reglages.ouvert} disabled={bloque} onValueChange={(valeur) => appliquer({ type: 'demander_confirmation', action: actionStatut('ouvert', valeur), lecture: lectureVerrou })} />
      </View>
      {confirmation?.type === 'statut' && confirmation.champ === 'ouvert' && bloc(confirmation)}
      <View style={s.ligneInterrupteur}>
        <View style={{ flex: 1 }}>
          <Text style={s.texte}>Prend des commandes</Text>
          <Text style={s.secondaire}>{reglages.accepteCommandes ? 'Les clients peuvent commander (si le restaurant est ouvert).' : 'En pause : les clients voient votre menu mais ne peuvent plus commander.'}</Text>
        </View>
        <Switch accessibilityLabel="Prend des commandes" value={reglages.accepteCommandes} disabled={bloque} onValueChange={(valeur) => appliquer({ type: 'demander_confirmation', action: actionStatut('accepte_commandes', valeur), lecture: lectureVerrou })} />
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
      {formPlat?.mode === 'creer' ? formulairePlat({ mode: 'creer' }) : <Action titre="Ajouter un plat" disabled={bloque || formPlat !== null} agir={ouvrirCreation} />}
      {menu.plats.length === 0 && <Text style={s.texte}>Aucun plat dans le menu.</Text>}
      {menu.plats.some(p => p.disponible) && (confirmation?.type === 'confirmer_tout'
        ? bloc(confirmation)
        : <Action titre="Tout confirmer" disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', action: actionConfirmerTout(menu), lecture: lectureVerrou })} />)}
      {menu.plats.map(p => {
        const lib = libelleDisponibilitePlat(p, aReconfirmer, maintenant);
        const prix = formaterPrix(p.prixGnf);
        return <View key={p.id} style={s.carte}>
          <Text style={s.nomPlat}>{p.nom}</Text>
          {prix && <Text style={s.texte}>{prix}</Text>}
          <Text style={s.texte}>{lib.etat}</Text>
          {lib.confirmation && <Text style={s.secondaire}>{lib.confirmation}</Text>}
          <View style={s.blocPhoto}>
            {p.photoUrl !== null && imagesEnErreur[p.id] !== p.photoUrl
              ? <Image source={{ uri: p.photoUrl }} accessibilityLabel={'Photo de ' + p.nom} style={s.photo} resizeMode="cover" onError={() => setImagesEnErreur(x => ({ ...x, [p.id]: p.photoUrl as string }))} />
              : <Text style={s.secondaire}>{p.photoRef === null ? 'Aucune photo pour ce plat.' : 'La photo de ce plat ne peut pas être affichée ici.'}</Text>}
            {confirmation?.type === 'photo_retirer' && confirmation.platId === p.id
              ? bloc(confirmation)
              : <>
                <Action titre={(p.photoRef === null ? 'Ajouter une photo à ' : 'Changer la photo de ') + p.nom} secondaire disabled={bloque || selection} agir={() => { setMessagePhoto(null); setChoixPhoto(choixPhoto === p.id ? null : p.id); }} />
                {p.photoRef !== null && <Action titre={'Retirer la photo de ' + p.nom} secondaire disabled={bloque || selection} agir={() => { setChoixPhoto(null); appliquer({ type: 'demander_confirmation', action: actionPhotoRetirer(p), lecture: lectureVerrou }); }} />}
              </>}
            {choixPhoto === p.id && <View style={s.formulaire}>
              <Text style={s.texte}>D’où vient la photo de {p.nom} ? Elle sera réduite avant l’envoi.</Text>
              <Action titre={'Choisir dans la galerie une photo de ' + p.nom} disabled={bloque || selection} agir={() => { void prendrePhoto(p, 'galerie'); }} />
              <Action titre={'Prendre une photo de ' + p.nom} disabled={bloque || selection} agir={() => { void prendrePhoto(p, 'camera'); }} />
              <Action titre="Annuler" secondaire disabled={selection} agir={() => setChoixPhoto(null)} />
            </View>}
            {messagePhoto?.platId === p.id && <Text accessibilityRole="alert" style={s.erreurChamp}>{messagePhoto.texte}</Text>}
          </View>
          <Action titre={(p.disponible ? 'Marquer indisponible ' : 'Marquer disponible ') + p.nom} secondaire disabled={bloque} agir={() => { void envoyer({ type: 'disponibilite', platId: p.id, disponible: !p.disponible }); }} />
          {p.disponible && <Action titre={'Confirmer la disponibilité ' + p.nom} disabled={bloque} agir={() => { void envoyer({ type: 'confirmer', platId: p.id, avant: p.confirmeLe }); }} />}

          {platEnEdition?.id === p.id && platEnEdition ? formulairePlat({ mode: 'modifier', plat: platEnEdition })
            : p.edition !== null ? <Action titre={'Modifier ' + p.nom} secondaire disabled={bloque} agir={() => ouvrirModification(p)} />
              : <Text style={s.secondaire}>Ce plat a des informations illisibles dans l’application : modifiez-le sur le site.</Text>}
          {confirmation?.type === 'archiver' && confirmation.platId === p.id
            ? bloc(confirmation)
            : <Action titre={'Archiver ' + p.nom} secondaire disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', action: actionArchiver(p), lecture: lectureVerrou })} />}

          <Text accessibilityRole="header" style={s.sousTitre}>Suppléments ({p.options.length})</Text>
          {p.options.length === 0 && <Text style={s.secondaire}>Aucun supplément.</Text>}
          {p.options.map(o => <View key={o.id} style={s.ligneOption}>
            <Text style={s.texte}>{o.nom} · {formaterPrix(o.prixGnf)}</Text>
            {confirmation?.type === 'option_retirer' && confirmation.optionId === o.id
              ? bloc(confirmation)
              : <Action titre={'Retirer le supplément ' + o.nom + ' de ' + p.nom} secondaire disabled={bloque} agir={() => appliquer({ type: 'demander_confirmation', action: actionRetirerOption(p, o), lecture: lectureVerrou })} />}
          </View>)}
          {p.optionsIllisibles > 0 && <Text accessibilityRole="alert" style={s.secondaire}>{p.optionsIllisibles === 1 ? '1 supplément est illisible' : p.optionsIllisibles + ' suppléments sont illisibles'} dans l’application : voyez-les sur le site.</Text>}
          {formOption === p.id ? formulaireOption(p) : <Action titre={'Ajouter un supplément à ' + p.nom} secondaire disabled={bloque} agir={() => ouvrirSupplement(p)} />}
        </View>;
      })}
    </View>}
  </View>;
}

const s = StyleSheet.create({
  formulaire: { gap: 8, padding: 12, borderWidth: 1, borderColor: c.action, borderRadius: 14 },
  ligneInterrupteur: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ligneOption: { gap: 6 },
  blocPhoto: { gap: 8 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: c.bordure },
  champ: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.bordure, borderRadius: 12, backgroundColor: c.surface, color: c.encre, fontFamily: polices.texte, fontSize: 16 },
  champLong: { minHeight: 110, textAlignVertical: 'top' },
  erreurChamp: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: c.action, fontWeight: '700' },
  carte: { gap: 8, padding: 16, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, backgroundColor: c.surface },
  nom: { fontFamily: polices.titre, fontSize: 20, color: c.encre },
  nomPlat: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  sousTitre: { fontFamily: polices.titre, fontSize: 15, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
});
