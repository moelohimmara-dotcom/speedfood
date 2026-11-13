import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bouton } from '../design/Composants';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import {
  ErreurCandidature, MOYENS_PAIEMENT_CANDIDATURE, SERVICES_CANDIDATURE, ajouterLignesCochees, ajouterPlatCandidature,
  brouillonVide, erreurEtapeCandidature, lignesProposees, type BrouillonCandidature, type LigneProposee, type VueCandidature,
} from './candidature';
import { creerLecteurCatalogue } from '../catalogue/client';
import type { QuartierPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { choisirPhoto, type SourcePhoto } from './photoPlat';
import { depsPhotoNatives } from './photoPlatNatif';
import { couleurs as c, polices } from '../design/tokens';

const lecteur = creerLecteurCatalogue();

/**
 * Candidature « J'ai un restaurant » (parité Kotlin, lot 4, ligne B12) : la demande du compte, ou le formulaire en trois temps
 * (le restaurant, le service, les plats — dont la lecture d'une photo de menu, relue avant ajout), puis l'envoi et les images.
 * Le brouillon reste dans l'écran tant qu'il n'est pas envoyé ; chaque envoi est un essai unique, jamais rejoué : après un résultat
 * incertain, on relit la demande avant de proposer de réessayer. Il faut être connecté : le serveur tire l'identité du jeton.
 */
export function CandidatureReel({ ouvert, fermer, ouvrirCompte }: { ouvert: boolean; fermer(): void; ouvrirCompte(): void }) {
  const [vue, setVue] = useState<VueCandidature | null | undefined>(undefined);
  const [b, setB] = useState<BrouillonCandidature>(brouillonVide());
  const [etape, setEtape] = useState(0);
  const [quartiers, setQuartiers] = useState<QuartierPublic[]>([]);
  const [nomPlat, setNomPlat] = useState(''); const [prixPlat, setPrixPlat] = useState('');
  const [lignes, setLignes] = useState<LigneProposee[] | null>(null);
  const [refuses, setRefuses] = useState<string[]>([]);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  function texteErreur(e: unknown) {
    return e instanceof ErreurCandidature || e instanceof ErreurConnexion ? e.message : 'Impossible de terminer cette opération. Réessayez.';
  }
  async function executer(f: () => Promise<void>) {
    if (enCours.current) return;
    enCours.current = true; setAttente(true); setErreur(null);
    try { await f(); } catch (e) { if (actif.current) setErreur(texteErreur(e)); }
    finally { enCours.current = false; if (actif.current) setAttente(false); }
  }
  async function relire() {
    const v = await gestion.lireCandidature();
    if (actif.current) setVue(v);
  }
  useEffect(() => {
    if (!ouvert) return;
    setErreur(null); setMessage(''); setLignes(null); setRefuses([]);
    if (!gestion.connectee) { setVue(undefined); return; }
    void executer(relire);
    void lecteur.listerQuartiers().then(l => { if (actif.current) setQuartiers(l.quartiers); }, () => undefined);
  }, [ouvert]);

  function basculer(liste: 'services' | 'moyensPaiement', valeur: string) {
    setB(x => ({ ...x, [liste]: x[liste].includes(valeur) ? x[liste].filter(v => v !== valeur) : [...x[liste], valeur] }));
  }
  function continuer() {
    const probleme = erreurEtapeCandidature(etape, b);
    if (probleme !== null) { setErreur(probleme); return; }
    setErreur(null); setEtape(e => Math.min(3, e + 1));
  }
  async function photoMenu(source: SourcePhoto) {
    const choix = await choisirPhoto(source, depsPhotoNatives);
    if (choix.genre === 'annule') return;
    if (choix.genre !== 'pret') { setErreur(choix.message); return; }
    await executer(async () => {
      const lecture = await gestion.lireMenuPhotoCandidature(choix.fichier);
      if (!actif.current) return;
      setLignes(lignesProposees(lecture));
      setRefuses(lecture.refuses.map(r => r.brut + ' — ' + r.raison));
      if (lecture.etat === 'vide') setMessage('Aucun plat lu sur cette photo. Saisissez les plats à la main.');
    });
  }
  async function envoyerImage(type: 'logo' | 'photo', source: SourcePhoto) {
    const choix = await choisirPhoto(source, depsPhotoNatives);
    if (choix.genre === 'annule') return;
    if (choix.genre !== 'pret') { setErreur(choix.message); return; }
    await executer(async () => {
      const v = await gestion.envoyerImageCandidature(type, choix.fichier);
      if (actif.current) { setVue(v); setMessage(type === 'logo' ? 'Logo envoyé.' : 'Photo envoyée.'); }
    });
  }

  return <Modal visible={ouvert} onRequestClose={fermer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Bouton titre="Retour" onPress={fermer} />
    <Text accessibilityRole="header" style={s.titre}>J'ai un restaurant</Text>
    {!gestion.connectee ? <>
      <Text style={s.texte}>Connectez-vous avec votre compte Speedfood pour déposer la demande de votre restaurant. L'équipe Speedfood la lit et vous répond sous 48 h.</Text>
      <Bouton titre="Me connecter ou créer un compte" onPress={() => { fermer(); ouvrirCompte(); }} />
    </> : <>
      {attente && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Un instant…</Text></>}
      {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
      {message !== '' && <Text accessibilityLiveRegion="polite" style={s.texte}>{message}</Text>}
      {vue ? <>
        <Text accessibilityRole="header" style={s.nom}>Votre demande</Text>
        <View style={s.carte}>
          <Text style={s.nomPetit}>{vue.nom}</Text>
          <Text style={s.texte}>{vue.libelleEtat} · déposée le {new Date(vue.deposeeLe).toLocaleDateString('fr-FR')}</Text>
          <Text style={s.texte}>{vue.nombrePlats} plat(s) déclarés · réponse attendue sous {vue.delaiHeures} h{vue.reponseAttendueLe ? ' (avant le ' + new Date(vue.reponseAttendueLe).toLocaleDateString('fr-FR') + ')' : ''}</Text>
          {vue.etat === 'refusee' && vue.motifRefus && <Text accessibilityRole="alert" style={s.texte}>Motif : {vue.motifRefus}</Text>}
          <Text style={s.secondaire}>{vue.aLogo ? 'Logo reçu.' : 'Pas encore de logo.'} {vue.aPhoto ? 'Photo reçue.' : 'Pas encore de photo.'}</Text>
        </View>
        <Bouton titre="Actualiser ma demande" secondaire disabled={attente} onPress={() => { void executer(relire); }} />
        {vue.etat !== 'creee' && <>
          <Bouton titre={vue.aLogo ? 'Changer le logo' : 'Envoyer le logo'} secondaire disabled={attente} onPress={() => { void envoyerImage('logo', 'galerie'); }} />
          <Bouton titre={vue.aPhoto ? 'Changer la photo' : 'Envoyer une photo du restaurant'} secondaire disabled={attente} onPress={() => { void envoyerImage('photo', 'galerie'); }} />
        </>}
        {vue.etat === 'refusee' && <Bouton titre="Déposer une nouvelle demande" disabled={attente} onPress={() => { setVue(null); setB(brouillonVide()); setEtape(0); }} />}
      </> : vue === null ? <>
        <Text style={s.secondaire}>Étape {etape + 1} sur 4. Votre brouillon reste sur ce téléphone tant que la demande n'est pas envoyée.</Text>
        {etape === 0 && <>
          <Champ label="Nom du restaurant" valeur={b.nom} changer={v => setB(x => ({ ...x, nom: v }))} editable={!attente} />
          <Text style={s.texte}>Quartier</Text>
          {quartiers.length === 0 && <Text style={s.secondaire}>Chargement des quartiers…</Text>}
          <View style={s.rangee}>{quartiers.map(q => <Pressable key={q.id} accessibilityRole="button" accessibilityState={{ selected: b.quartierId === q.id }} disabled={attente} onPress={() => setB(x => ({ ...x, quartierId: q.id }))} style={[s.puce, b.quartierId === q.id && s.puceActive]}><Text style={s.texte}>{q.libelle}</Text></Pressable>)}</View>
          <Champ label="Indications pour vous trouver (facultatif)" valeur={b.indications} changer={v => setB(x => ({ ...x, indications: v }))} editable={!attente} />
          <Champ label="Votre prénom" valeur={b.prenom} changer={v => setB(x => ({ ...x, prenom: v }))} editable={!attente} />
          <Champ label="Votre nom" valeur={b.nomResponsable} changer={v => setB(x => ({ ...x, nomResponsable: v }))} editable={!attente} />
          <Champ label="Téléphone (Guinée)" valeur={b.telephone} changer={v => setB(x => ({ ...x, telephone: v }))} editable={!attente} clavier="phone-pad" />
        </>}
        {etape === 1 && <>
          <Champ label="Horaires" valeur={b.horaires} changer={v => setB(x => ({ ...x, horaires: v }))} editable={!attente} placeholder="Tous les jours, 9h à 22h" />
          <Champ label="Catégories (facultatif)" valeur={b.categories} changer={v => setB(x => ({ ...x, categories: v }))} editable={!attente} placeholder="Grillades, cuisine locale…" />
          <Text style={s.texte}>Services proposés</Text>
          <View style={s.rangee}>{SERVICES_CANDIDATURE.map(x => <Pressable key={x.valeur} accessibilityRole="button" accessibilityState={{ selected: b.services.includes(x.valeur) }} disabled={attente} onPress={() => basculer('services', x.valeur)} style={[s.puce, b.services.includes(x.valeur) && s.puceActive]}><Text style={s.texte}>{x.libelle}</Text></Pressable>)}</View>
          <Text style={s.texte}>Moyens de paiement acceptés</Text>
          <View style={s.rangee}>{MOYENS_PAIEMENT_CANDIDATURE.map(x => <Pressable key={x.valeur} accessibilityRole="button" accessibilityState={{ selected: b.moyensPaiement.includes(x.valeur) }} disabled={attente} onPress={() => basculer('moyensPaiement', x.valeur)} style={[s.puce, b.moyensPaiement.includes(x.valeur) && s.puceActive]}><Text style={s.texte}>{x.libelle}</Text></Pressable>)}</View>
        </>}
        {etape === 2 && <>
          <Text accessibilityRole="header" style={s.nomPetit}>Vos plats</Text>
          {b.plats.length === 0 && <Text style={s.texte}>Aucun plat pour le moment. Ajoutez les principaux, ou lisez la photo de votre menu.</Text>}
          {b.plats.map((p, i) => <View key={p.nom + '-' + i} style={s.carte}>
            <Text style={s.texte}>{p.nom} · {p.prix.toLocaleString('fr-FR')} GNF</Text>
            <Bouton titre={'Retirer ' + p.nom} secondaire disabled={attente} onPress={() => setB(x => ({ ...x, plats: x.plats.filter((_, j) => j !== i) }))} />
          </View>)}
          <Champ label="Nom du plat" valeur={nomPlat} changer={setNomPlat} editable={!attente} />
          <Champ label="Prix en GNF" valeur={prixPlat} changer={setPrixPlat} editable={!attente} clavier="number-pad" />
          <Bouton titre="Ajouter ce plat" secondaire disabled={attente} onPress={() => {
            const r = ajouterPlatCandidature(b, nomPlat, prixPlat);
            if (r.brouillon === null) { setErreur(r.erreur); return; }
            setErreur(null); setB(r.brouillon); setNomPlat(''); setPrixPlat('');
          }} />
          <Text style={s.texte}>Ou lisez la photo de votre menu : rien n'est conservé, vous relisez la liste avant de l'ajouter.</Text>
          <Bouton titre="Lire une photo de menu (galerie)" secondaire disabled={attente} onPress={() => { void photoMenu('galerie'); }} />
          <Bouton titre="Lire une photo de menu (appareil photo)" secondaire disabled={attente} onPress={() => { void photoMenu('camera'); }} />
          {lignes !== null && <>
            <Text style={s.nomPetit}>Plats lus sur la photo</Text>
            {lignes.map((l, i) => <Pressable key={l.nom + '-' + i} accessibilityRole="button" accessibilityState={{ selected: l.coche }} disabled={attente} onPress={() => setLignes(x => x === null ? x : x.map((y, j) => j === i ? { ...y, coche: !y.coche } : y))} style={[s.carte, l.coche && s.puceActive]}>
              <Text style={s.texte}>{l.coche ? '✓ ' : ''}{l.nom} · {l.prix} GNF</Text>
            </Pressable>)}
            {refuses.map(r => <Text key={r} style={s.secondaire}>Non lu : {r}</Text>)}
            <Bouton titre="Ajouter les plats cochés" disabled={attente} onPress={() => {
              const r = ajouterLignesCochees(b, lignes);
              if (r.brouillon === null) { setErreur(r.erreur); return; }
              setErreur(null); setB(r.brouillon); setLignes(null); setRefuses([]);
            }} />
          </>}
        </>}
        {etape === 3 && <>
          <Text accessibilityRole="header" style={s.nomPetit}>Vérifiez avant l'envoi</Text>
          <View style={s.carte}>
            <Text style={s.texte}>{b.nom}</Text>
            <Text style={s.texte}>{b.prenom} {b.nomResponsable} · {b.telephone}</Text>
            <Text style={s.texte}>{b.horaires}</Text>
            <Text style={s.texte}>{b.plats.length} plat(s) déclaré(s)</Text>
          </View>
          <Text style={s.secondaire}>L'équipe Speedfood lit chaque demande et répond sous 48 h. Une seule demande ouverte par compte.</Text>
          <Bouton titre="Envoyer ma demande" disabled={attente} onPress={() => {
            void executer(async () => {
              const v = await gestion.deposerCandidature(b);
              if (actif.current) { setVue(v); setMessage('Demande envoyée. Vous pouvez ajouter votre logo et une photo.'); }
            });
          }} />
        </>}
        {etape > 0 && <Bouton titre="Retour" secondaire disabled={attente} onPress={() => setEtape(e => Math.max(0, e - 1))} />}
        {etape < 3 && <Bouton titre="Continuer" disabled={attente} onPress={continuer} />}
      </> : null}
    </>}
  </ScrollView></SafeAreaView></Modal>;
}

function Champ({ label, valeur, changer, editable, placeholder, clavier }: { label: string; valeur: string; changer(v: string): void; editable: boolean; placeholder?: string; clavier?: 'phone-pad' | 'number-pad' }) {
  return <>
    <Text style={s.texte}>{label}</Text>
    <TextInput accessibilityLabel={label} value={valeur} onChangeText={changer} editable={editable} placeholder={placeholder} keyboardType={clavier ?? 'default'} style={s.champ} />
  </>;
}

const s = StyleSheet.create({
  contenu: { padding: 22, gap: 14, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 },
  titre: { fontFamily: polices.titre, fontSize: 34, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 23, color: c.encre, marginTop: 8 },
  nomPetit: { fontFamily: polices.titre, fontSize: 18, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, padding: 16, gap: 10 },
  champ: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 16, padding: 14, minHeight: 50, fontFamily: polices.texte, fontSize: 16, color: c.encre },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 48, paddingHorizontal: 14, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.bordure, backgroundColor: c.surface },
  puceActive: { borderColor: c.action, borderWidth: 2 },
});
