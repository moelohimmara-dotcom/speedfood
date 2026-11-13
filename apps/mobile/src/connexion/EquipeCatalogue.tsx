import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurEquipe } from './equipe';
import { formaterGnf } from './restaurateur';
import {
  STATUTS_PARTENARIAT_EQUIPE, STATUTS_REFERENCEMENT_EQUIPE,
  type DemandePartenariat, type DemandeReferencement, type FicheRestaurantEquipe, type MenusEquipe, type PlatMenuEquipe, type RestaurantEquipe,
} from './catalogue-equipe';
import { couleurs as c, polices } from '../design/tokens';

function messageErreur(e: unknown) {
  return e instanceof ErreurEquipe || e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.';
}
function useActif() {
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);
  return actif;
}
function useChargement() {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const enCours = useRef(false);
  const actif = useActif();
  async function executer(f: () => Promise<void>) {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { await f(); } catch (e) { if (actif.current) setErreur(messageErreur(e)); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  return { chargement, erreur, setErreur, message, setMessage, executer, actif };
}
const etatEtablissement = (r: RestaurantEquipe) => r.suspendu ? 'Suspendu' : r.publie ? 'Publié' : 'Non publié';

/** Établissements (E4) : état lu, fiche et menu ; seul le profil simple (horaires, numéro interne) s'y modifie. Publication et suspension restent sur le site. */
export function RestaurantsEquipeReel() {
  const { chargement, erreur, message, setMessage, executer, actif } = useChargement();
  const [restaurants, setRestaurants] = useState<RestaurantEquipe[] | null>(null);
  const [illisibles, setIllisibles] = useState(0);
  const [fiche, setFiche] = useState<FicheRestaurantEquipe | null>(null);
  const [horaires, setHoraires] = useState('');
  const [telephone, setTelephone] = useState('');

  async function lire() {
    await executer(async () => {
      const l = await gestion.restaurantsEquipe();
      if (actif.current) { setRestaurants(l.restaurants); setIllisibles(l.illisibles); }
    });
  }
  useEffect(() => { void lire(); }, []);
  async function ouvrir(r: RestaurantEquipe) {
    await executer(async () => {
      const f = await gestion.ficheRestaurantEquipe(r.id);
      if (actif.current) { setFiche(f); setHoraires(f.horaires); setTelephone(f.telephoneCommandes ?? ''); }
    });
  }

  if (fiche) return <View style={{ gap: 12 }}>
    <Action titre="Retour aux établissements" agir={() => setFiche(null)} />
    <Text accessibilityRole="header" style={s.nom}>{fiche.nom}</Text>
    <Text style={s.texte}>{etatEtablissement(fiche)}{fiche.ouvert ? ' · ouvert' : ' · fermé'} · {fiche.modeVente === 'speedfood' ? 'tenu par Speedfood' : 'autonome'} · {fiche.quartier}</Text>
    {fiche.motifCorrection && <Text accessibilityRole="alert" style={s.texte}>Correction demandée : {fiche.motifCorrection}</Text>}
    <Text style={s.secondaire}>La publication, la suspension et la suppression se décident sur le site.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Un instant…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Text style={s.texte}>Horaires d’ouverture</Text>
    <TextInput accessibilityLabel="Horaires d’ouverture" value={horaires} onChangeText={setHoraires} editable={!chargement} style={s.champ} />
    <Text style={s.texte}>Numéro interne à joindre (vide = retrait)</Text>
    <TextInput accessibilityLabel="Numéro interne à joindre" value={telephone} onChangeText={setTelephone} editable={!chargement} keyboardType="phone-pad" style={s.champ} />
    <Action titre="Enregistrer horaires et numéro" disabled={chargement} agir={() => {
      void executer(async () => {
        const retour = await gestion.modifierProfilEquipe(fiche.id, horaires, telephone);
        if (!actif.current) return;
        setMessage(retour + ' Fiche relue.');
        const f = await gestion.ficheRestaurantEquipe(fiche.id);
        if (actif.current) { setFiche(f); setHoraires(f.horaires); setTelephone(f.telephoneCommandes ?? ''); }
      });
    }} />
    <Text accessibilityRole="header" style={s.nomPetit}>Menu ({fiche.platsDetail.length} plats)</Text>
    {fiche.platsDetail.map(p => <Text key={p.id} style={s.secondaire}>{p.nom} · {formaterGnf(p.prix)} GNF · {p.etat === 'epuise' ? 'épuisé' : p.etat === 'a_confirmer' ? 'à reconfirmer' : 'disponible'}</Text>)}
  </View>;

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Établissements</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des établissements…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser les établissements" agir={() => { void lire(); }} disabled={chargement} />
    {illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{illisibles === 1 ? '1 établissement est illisible dans l’application.' : illisibles + ' établissements sont illisibles dans l’application.'}</Text>}
    {restaurants !== null && restaurants.length === 0 && <Text style={s.texte}>Aucun établissement.</Text>}
    {(restaurants ?? []).map(r => <View key={r.id} style={s.carte}>
      <Text style={s.nomPetit}>{r.nom}</Text>
      <Text style={s.texte}>{etatEtablissement(r)} · {r.categorie} · {r.platsDisponibles}/{r.plats} plats disponibles</Text>
      <Action titre={'Fiche ' + r.nom} secondaire disabled={chargement} agir={() => { void ouvrir(r); }} />
    </View>)}
  </View>;
}

/** Fraîcheur des menus (E5) : plats à reconfirmer ou épuisés des établissements tenus par l'équipe ; reconfirmation et disponibilité confirmées puis relues. */
export function MenusEquipeReel() {
  const { chargement, erreur, message, setMessage, executer, actif } = useChargement();
  const [menus, setMenus] = useState<MenusEquipe | null>(null);
  const [plats, setPlats] = useState<{ restaurantId: string; nom: string; plats: PlatMenuEquipe[] } | null>(null);
  const [confirmation, setConfirmation] = useState<{ restaurantId: string; plat: PlatMenuEquipe; genre: 'reconfirmer' | 'disponibilite' } | null>(null);

  async function lire() {
    await executer(async () => { const m = await gestion.menusEquipe(); if (actif.current) setMenus(m); });
  }
  useEffect(() => { void lire(); }, []);
  async function ouvrir(restaurantId: string) {
    await executer(async () => {
      const p = await gestion.platsMenuEquipe(restaurantId);
      if (actif.current) setPlats({ restaurantId, ...p });
    });
  }
  async function agir() {
    if (confirmation === null) return;
    const { restaurantId, plat, genre } = confirmation;
    await executer(async () => {
      const retour = genre === 'reconfirmer'
        ? await gestion.reconfirmerMenuEquipe(restaurantId, plat.id)
        : await gestion.disponibiliteMenuEquipe(restaurantId, plat.id, !plat.disponible);
      if (!actif.current) return;
      setConfirmation(null); setMessage(retour + ' Menu relu.');
      const p = await gestion.platsMenuEquipe(restaurantId);
      if (actif.current) setPlats({ restaurantId, ...p });
      const m = await gestion.menusEquipe();
      if (actif.current) setMenus(m);
    });
  }

  if (plats) return <View style={{ gap: 12 }}>
    <Action titre="Retour aux menus" agir={() => setPlats(null)} />
    <Text accessibilityRole="header" style={s.nom}>{plats.nom}</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Un instant…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Action titre="Tout reconfirmer" disabled={chargement} agir={() => {
      void executer(async () => {
        const retour = await gestion.reconfirmerMenuEquipe(plats.restaurantId);
        if (!actif.current) return;
        setMessage(retour + ' Menu relu.');
        const p = await gestion.platsMenuEquipe(plats.restaurantId);
        if (actif.current) setPlats({ restaurantId: plats.restaurantId, ...p });
      });
    }} />
    {plats.plats.map(p => <View key={p.id} style={s.carte}>
      <Text style={s.nomPetit}>{p.nom} · {formaterGnf(p.prix)} GNF</Text>
      <Text style={s.texte}>{p.etat === 'epuise' ? 'Épuisé' : p.etat === 'a_confirmer' ? 'À reconfirmer' : 'Disponible'}{p.confirmeLe ? ' · confirmé le ' + new Date(p.confirmeLe).toLocaleDateString('fr-FR') : ''}</Text>
      {confirmation?.plat.id === p.id ? <>
        <Text accessibilityRole="alert" style={s.texte}>{confirmation.genre === 'reconfirmer' ? 'Reconfirmer ' + p.nom + ' ?' : (p.disponible ? 'Marquer ' + p.nom + ' épuisé ?' : 'Remettre ' + p.nom + ' en vente ?')}</Text>
        <Action titre="Oui, appliquer" disabled={chargement} agir={() => { void agir(); }} />
        <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmation(null)} />
      </> : <>
        {p.disponible && <Action titre={'Reconfirmer ' + p.nom} secondaire disabled={chargement} agir={() => setConfirmation({ restaurantId: plats.restaurantId, plat: p, genre: 'reconfirmer' })} />}
        <Action titre={p.disponible ? 'Marquer épuisé ' + p.nom : 'Remettre en vente ' + p.nom} secondaire disabled={chargement} agir={() => setConfirmation({ restaurantId: plats.restaurantId, plat: p, genre: 'disponibilite' })} />
      </>}
    </View>)}
  </View>;

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Menus à tenir à jour</Text>
    {menus && <Text style={s.secondaire}>Un plat est à reconfirmer après {menus.fraicheurHeures} h sans confirmation.</Text>}
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des menus…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser les menus" agir={() => { void lire(); }} disabled={chargement} />
    {(menus?.menus ?? []).map(m => <View key={m.restaurantId} style={s.carte}>
      <Text style={s.nomPetit}>{m.nom}</Text>
      <Text style={s.texte}>{m.plats} plats · {m.aReconfirmer} à reconfirmer · {m.epuises} épuisés</Text>
      <Action titre={'Voir le menu de ' + m.nom} secondaire disabled={chargement} agir={() => { void ouvrir(m.restaurantId); }} />
    </View>)}
  </View>;
}

const LIBELLES_REF: Record<string, string> = { nouvelle: 'Nouvelle', rappelee: 'Rappelée', visite_prevue: 'Visite prévue', accord: 'Accord signé', refusee: 'Refusée', creee: 'Établissement créé' };

/** Demandes de référencement (E6) : suivi, création de l'établissement et rattachement du compte, confirmés puis relus. */
export function ReferencementsEquipeReel() {
  const { chargement, erreur, setErreur, message, setMessage, executer, actif } = useChargement();
  const [demandes, setDemandes] = useState<DemandeReferencement[] | null>(null);
  const [illisibles, setIllisibles] = useState(0);
  const [motif, setMotif] = useState('');
  const [options, setOptions] = useState<{ categories: Array<{ id: string; nom: string }>; quartiers: Array<{ id: string; nom: string }> } | null>(null);
  const [creation, setCreation] = useState<{ demande: DemandeReferencement; categorieId: string; quartierId: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{ demande: DemandeReferencement; genre: 'statut' | 'rattacher'; statut?: string } | null>(null);

  async function lire() {
    await executer(async () => {
      const l = await gestion.referencementsEquipe();
      if (actif.current) { setDemandes(l.demandes); setIllisibles(l.illisibles); }
    });
  }
  useEffect(() => { void lire(); }, []);

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Demandes de référencement</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des demandes…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Action titre="Actualiser les demandes" agir={() => { void lire(); }} disabled={chargement} />
    {illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{illisibles} demande(s) illisible(s) dans l’application.</Text>}
    {(demandes ?? []).map(d => <View key={d.id} style={s.carte}>
      <Text style={s.nomPetit}>{d.organisation}</Text>
      <Text style={s.texte}>{LIBELLES_REF[d.statut] ?? d.statut} · {d.responsable} · {d.telephone}</Text>
      <Text style={s.secondaire}>{d.commune} · {d.quartier} · reçue le {new Date(d.creeLe).toLocaleDateString('fr-FR')}{d.candidature ? ' · dossier appli : ' + d.candidature.nombrePlats + ' plats' + (d.candidature.avecLogo ? ', logo' : '') + (d.candidature.avecPhoto ? ', photo' : '') : ''}</Text>
      {confirmation?.demande.id === d.id ? <>
        <Text accessibilityRole="alert" style={s.texte}>{confirmation.genre === 'rattacher' ? 'Rattacher le compte de ' + d.responsable + ' à son établissement ?' : 'Passer ' + d.organisation + ' à « ' + (LIBELLES_REF[confirmation.statut ?? ''] ?? confirmation.statut) + ' » ?'}</Text>
        {confirmation.genre === 'statut' && confirmation.statut === 'refusee' && <TextInput accessibilityLabel="Motif du refus (lu par le demandeur)" value={motif} onChangeText={setMotif} editable={!chargement} style={s.champ} />}
        <Action titre="Oui, appliquer" disabled={chargement} agir={() => {
          void executer(async () => {
            const retour = confirmation.genre === 'rattacher'
              ? await gestion.rattacherReferencement(d.id)
              : await gestion.statutReferencement(d.id, confirmation.statut ?? '', confirmation.statut === 'refusee' ? motif : undefined);
            if (!actif.current) return;
            setConfirmation(null); setMotif(''); setMessage(retour + ' Liste relue.');
            await lire();
          });
        }} />
        <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmation(null)} />
      </> : <>
        {d.statut !== 'creee' && STATUTS_REFERENCEMENT_EQUIPE.filter(x => x !== 'creee' && x !== d.statut).map(x => <Action key={x} titre={(LIBELLES_REF[x] ?? x) + ' — ' + d.organisation} secondaire disabled={chargement} agir={() => { setErreur(null); setMotif(''); setConfirmation({ demande: d, genre: 'statut', statut: x }); }} />)}
        {!d.etablissementCree && <Action titre={'Créer l’établissement de ' + d.organisation} secondaire disabled={chargement} agir={() => {
          void executer(async () => {
            const o = await gestion.optionsReferencement();
            if (actif.current) { setOptions(o); setCreation({ demande: d, categorieId: o.categories[0]?.id ?? '', quartierId: o.quartiers[0]?.id ?? '' }); }
          });
        }} />}
        {d.candidature?.compteRattachable && <Action titre={'Rattacher le compte de ' + d.responsable} secondaire disabled={chargement} agir={() => setConfirmation({ demande: d, genre: 'rattacher' })} />}
      </>}
      {creation?.demande.id === d.id && options && <View style={{ gap: 8 }}>
        <Text style={s.texte}>Catégorie</Text>
        {options.categories.map(cat => <Action key={cat.id} titre={(creation.categorieId === cat.id ? '✓ ' : '') + cat.nom} secondaire disabled={chargement} agir={() => setCreation({ ...creation, categorieId: cat.id })} />)}
        <Text style={s.texte}>Quartier</Text>
        {options.quartiers.slice(0, 12).map(q => <Action key={q.id} titre={(creation.quartierId === q.id ? '✓ ' : '') + q.nom} secondaire disabled={chargement} agir={() => setCreation({ ...creation, quartierId: q.id })} />)}
        <Action titre="Créer l’établissement (non publié)" disabled={chargement || !creation.categorieId || !creation.quartierId} agir={() => {
          void executer(async () => {
            const retour = await gestion.creerEtablissementReferencement(d.id, creation.categorieId, creation.quartierId);
            if (!actif.current) return;
            setCreation(null); setMessage(retour + ' Liste relue.');
            await lire();
          });
        }} />
        <Action titre="Annuler la création" secondaire disabled={chargement} agir={() => setCreation(null)} />
      </View>}
    </View>)}
  </View>;
}

const LIBELLES_PART: Record<string, string> = { nouvelle: 'Nouvelle', en_cours: 'En cours', traitee: 'Traitée', classee: 'Classée' };

/** Demandes de partenariat (E7) : suivi seulement ; la suppression reste sur le site (irréversible). */
export function PartenariatsEquipeReel() {
  const { chargement, erreur, message, setMessage, executer, actif } = useChargement();
  const [demandes, setDemandes] = useState<DemandePartenariat[] | null>(null);
  const [confirmation, setConfirmation] = useState<{ demande: DemandePartenariat; statut: string } | null>(null);

  async function lire() {
    await executer(async () => {
      const l = await gestion.partenariatsEquipe();
      if (actif.current) setDemandes(l.partenariats);
    });
  }
  useEffect(() => { void lire(); }, []);

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Demandes de partenariat</Text>
    <Text style={s.secondaire}>La suppression d’une demande reste sur le site : elle est irréversible.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des demandes…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
    <Action titre="Actualiser les partenariats" agir={() => { void lire(); }} disabled={chargement} />
    {(demandes ?? []).map(d => <View key={d.id} style={s.carte}>
      <Text style={s.nomPetit}>{d.organisation}</Text>
      <Text style={s.texte}>{LIBELLES_PART[d.statut] ?? d.statut} · {d.nomContact} · {d.contact}</Text>
      {d.message !== '' && <Text style={s.secondaire}>{d.message}</Text>}
      {confirmation?.demande.id === d.id ? <>
        <Text accessibilityRole="alert" style={s.texte}>Passer {d.organisation} à « {LIBELLES_PART[confirmation.statut] ?? confirmation.statut} » ?</Text>
        <Action titre="Oui, appliquer" disabled={chargement} agir={() => {
          void executer(async () => {
            const retour = await gestion.statutPartenariat(d.id, confirmation.statut);
            if (!actif.current) return;
            setConfirmation(null); setMessage(retour + ' Liste relue.');
            await lire();
          });
        }} />
        <Action titre="Non, revenir" secondaire disabled={chargement} agir={() => setConfirmation(null)} />
      </> : STATUTS_PARTENARIAT_EQUIPE.filter(x => x !== d.statut).map(x => <Action key={x} titre={(LIBELLES_PART[x] ?? x) + ' — ' + d.organisation} secondaire disabled={chargement} agir={() => setConfirmation({ demande: d, statut: x })} />)}
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
