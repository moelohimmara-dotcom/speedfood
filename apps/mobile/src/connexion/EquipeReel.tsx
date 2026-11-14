import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bouton } from '../design/Composants';
import type { NomIcone } from '../design/Icone';
import { Action } from './BoutonAction';
import { ErreurConnexion } from './client';
import { gestion } from './gestion';
import { ErreurEquipe } from './equipe';
import { SITE_WEB } from './aide';
import { formaterGnf } from './restaurateur';
import { libelleStatutVersement, tauxAffiche, type FinancesEquipe } from './finances-equipe';
import type { TableauEquipe } from './tableau-equipe';
import type { PaiementsEquipe } from './paiements-equipe';
import type { AccesEquipe } from './commandes-equipe';
import { CommandesEquipeReel, ExploitationEquipeReel, RepartitionEquipeReel } from './EquipeCommandes';
import { MenusEquipeReel, PartenariatsEquipeReel, ReferencementsEquipeReel, RestaurantsEquipeReel } from './EquipeCatalogue';
import { AvisEquipeReel, BannieresEquipeReel, MediasEquipeReel, ParametresEquipeReel } from './EquipeContenus';
import { AttenteEquipeReel, AuditEquipeReel, ComptesEquipeReel, MisesAJourEquipeReel } from './EquipeAdmin';
import { couleurs as c, polices } from '../design/tokens';

/**
 * Espace équipe (parité Kotlin, lots 5 à 8) : les modules s'ouvrent un par un, chacun relu strictement, chacun refusé proprement
 * quand le compte n'a pas le droit du module (le serveur décide, jamais l'écran). Lectures manuelles, un seul essai, aucune relance.
 * Premier module livré : les finances (E2, lecture seule — les taux et versements se modifient sur le site).
 */
type ModuleEquipe = 'tableau' | 'commandes' | 'repartition' | 'exploitation' | 'restaurants' | 'menus' | 'referencements' | 'partenariats' | 'avis' | 'bannieres' | 'medias' | 'parametres' | 'comptes' | 'audit' | 'attente' | 'mises-a-jour' | 'finances' | 'paiements';
const MODULES_EQUIPE: ReadonlyArray<{ id: ModuleEquipe; libelle: string; icone: NomIcone }> = [
  { id: 'tableau', libelle: 'Tableau de bord', icone: 'accueil' }, { id: 'commandes', libelle: 'Commandes (support)', icone: 'document' }, { id: 'repartition', libelle: 'Répartition', icone: 'partage' },
  { id: 'exploitation', libelle: 'Exploitation livreurs', icone: 'eclair' }, { id: 'restaurants', libelle: 'Établissements', icone: 'plat' }, { id: 'menus', libelle: 'Menus', icone: 'liste' },
  { id: 'referencements', libelle: 'Référencements', icone: 'info' }, { id: 'partenariats', libelle: 'Partenariats', icone: 'message' }, { id: 'avis', libelle: 'Avis et signalements', icone: 'alerte' },
  { id: 'bannieres', libelle: 'Bannières', icone: 'etoile' }, { id: 'medias', libelle: 'Médias', icone: 'camera' }, { id: 'parametres', libelle: 'Paramètres', icone: 'engrenage' },
  { id: 'comptes', libelle: 'Comptes', icone: 'compte' }, { id: 'audit', libelle: 'Journal d’audit', icone: 'recherche' }, { id: 'attente', libelle: 'Liste d’attente', icone: 'cloche' }, { id: 'mises-a-jour', libelle: 'Mises à jour', icone: 'actualiser' },
  { id: 'finances', libelle: 'Finances', icone: 'document' }, { id: 'paiements', libelle: 'Paiements', icone: 'coche' },
];

export function EquipeReel({ ouvert, fermer }: { ouvert: boolean; fermer(): void }) {
  const [module, setModule] = useState<ModuleEquipe>('tableau');
  const { donnees: acces } = useLectureEquipe<AccesEquipe>(() => gestion.accesEquipe());
  return <Modal visible={ouvert} onRequestClose={fermer} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: c.fond }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.contenu}>
    <Action titre="Retour au compte" agir={fermer} />
    <Text accessibilityRole="header" style={s.titre}>Espace équipe</Text>
    <Text style={s.secondaire}>Chaque module est relu depuis le serveur. Si votre compte n'a pas le droit d'un module, le serveur le refuse et l'écran vous le dit.</Text>
    {acces && <View style={s.carte}>
      <Text style={s.nomPetit}>Votre accès : {acces.role}</Text>
      {acces.groupes.map(g => <View key={g.libelle} style={{ gap: 4 }}>
        <Text style={s.texte}>{g.libelle}</Text>
        {g.entrees.map(e => <Text key={e.chemin} style={s.secondaire}>{e.natif ? 'Dans l’application : ' : 'Sur le site : '}{e.libelle}</Text>)}
      </View>)}
    </View>}
    <View style={s.modules}>{MODULES_EQUIPE.map(m => <Bouton key={m.id} titre={m.libelle} icone={m.icone} secondaire={module !== m.id} onPress={() => setModule(m.id)} />)}</View>
    {module === 'tableau' && <TableauEquipeReel />}
    {module === 'commandes' && <CommandesEquipeReel />}
    {module === 'repartition' && <RepartitionEquipeReel />}
    {module === 'exploitation' && <ExploitationEquipeReel />}
    {module === 'restaurants' && <RestaurantsEquipeReel />}
    {module === 'menus' && <MenusEquipeReel />}
    {module === 'referencements' && <ReferencementsEquipeReel />}
    {module === 'partenariats' && <PartenariatsEquipeReel />}
    {module === 'avis' && <AvisEquipeReel />}
    {module === 'bannieres' && <BannieresEquipeReel />}
    {module === 'medias' && <MediasEquipeReel />}
    {module === 'parametres' && <ParametresEquipeReel />}
    {module === 'comptes' && <ComptesEquipeReel />}
    {module === 'audit' && <AuditEquipeReel />}
    {module === 'attente' && <AttenteEquipeReel />}
    {module === 'mises-a-jour' && <MisesAJourEquipeReel />}
    {module === 'finances' && <FinancesEquipeReel />}
    {module === 'paiements' && <PaiementsEquipeReel />}
  </ScrollView></SafeAreaView></Modal>;
}

function useLectureEquipe<T>(lire: () => Promise<T>) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);
  async function relire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { const d = await lire(); if (actif.current) setDonnees(d); }
    catch (e) { if (actif.current) setErreur(e instanceof ErreurEquipe || e instanceof ErreurConnexion ? e.message : 'Impossible de lire ce module. Réessayez.'); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void relire(); }, []);
  return { donnees, chargement, erreur, relire };
}

function TableauEquipeReel() {
  const { donnees: t, chargement, erreur, relire } = useLectureEquipe<TableauEquipe>(() => gestion.tableauEquipe());
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Tableau de bord</Text>
    {t && <Text style={s.secondaire}>Rôle : {t.role}. Seuls les chiffres de vos domaines sont montrés.</Text>}
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture du tableau de bord…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser le tableau" agir={() => { void relire(); }} disabled={chargement} />
    {t?.commandes && <View style={s.carte}>
      <Text style={s.nomPetit}>Commandes</Text>
      <Text style={s.texte}>{t.commandes.activesDuJour} actives aujourd’hui · {t.commandes.enAttente} en attente · {t.commandes.propositionsEnAttente} propositions en attente</Text>
    </View>}
    {t?.exploitation && <View style={s.carte}>
      <Text style={s.nomPetit}>Exploitation</Text>
      <Text style={s.texte}>{t.exploitation.aConfirmer} commandes à confirmer · {t.exploitation.coursesSansLivreur} courses sans livreur</Text>
      <Text style={s.texte}>{t.exploitation.livreursEnLigne} livreurs en ligne · {t.exploitation.candidatsLivreurs} candidats livreurs · {t.exploitation.etablissementsSansTelephone} établissements sans téléphone</Text>
    </View>}
    {t?.catalogue && <View style={s.carte}>
      <Text style={s.nomPetit}>Catalogue</Text>
      <Text style={s.texte}>{t.catalogue.enAttenteValidation} en attente de validation · {t.catalogue.publies} publiés · {t.catalogue.suspendus} suspendus</Text>
      <Text style={s.texte}>{t.catalogue.aCorriger} à corriger · {t.catalogue.platsAReconfirmer} plats à reconfirmer</Text>
    </View>}
    {t && !t.commandes && !t.exploitation && !t.catalogue && <Text style={s.texte}>Aucun chiffre à montrer pour votre rôle.</Text>}
  </View>;
}

function PaiementsEquipeReel() {
  const { donnees: p, chargement, erreur, relire } = useLectureEquipe<PaiementsEquipe>(() => gestion.paiementsEquipe());
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Paiements en ligne</Text>
    <Text style={s.secondaire}>Lecture seule : les décisions qui déplacent de l'argent restent sur le site.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des paiements…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser les paiements" agir={() => { void relire(); }} disabled={chargement} />
    {p && <>
      {p.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{p.illisibles === 1 ? '1 paiement est illisible dans l’application.' : p.illisibles + ' paiements sont illisibles dans l’application.'}</Text>}
      <View style={s.carte}>
        <Text style={s.nomPetit}>Vue d'ensemble</Text>
        <Text style={s.texte}>Paiement en ligne : {p.reglages.actif ? 'activé' : 'éteint'} · fournisseur : {p.reglages.fournisseur}{p.reglages.valeursValidees ? ' · valeurs validées' : ''}</Text>
        <Text style={s.texte}>{p.compteurs.enAttente} en attente du client · {p.compteurs.versementsATraiter} versements à traiter · {p.compteurs.litigesAHumain} litiges à confier à l'exploitation</Text>
      </View>
      {p.paiements.length === 0 && <Text style={s.texte}>Aucun paiement à montrer.</Text>}
      {p.paiements.map(x => <View key={x.id} style={s.carte}>
        <Text style={s.nomPetit}>{x.commandeReference} · {x.restaurantNom}</Text>
        <Text style={s.texte}>{x.etat.replaceAll('_', ' ')} · {x.operateur.replaceAll('_', ' ')} · {formaterGnf(x.totalGnf)} GNF</Text>
        <Text style={s.secondaire}>Restaurant {formaterGnf(x.restaurantGnf)} GNF · livreur {formaterGnf(x.livreurGnf)} GNF · Speedfood {formaterGnf(x.speedfoodBrutGnf)} GNF · frais mobile {formaterGnf(x.fraisMobileGnf)} GNF{x.rembourseGnf > 0 ? ' · remboursé ' + formaterGnf(x.rembourseGnf) + ' GNF' : ''}</Text>
        {x.versements.map((v, i) => <Text key={i} style={s.secondaire}>Versement {v.beneficiaire} : {v.etat.replaceAll('_', ' ')} · {formaterGnf(v.montantGnf)} GNF{v.erreurCode ? ' · erreur ' + v.erreurCode : ''}</Text>)}
        {x.litiges.map((l, i) => <Text key={i} accessibilityRole="alert" style={s.texte}>Litige : {l.situation} ({l.etat.replaceAll('_', ' ')})</Text>)}
      </View>)}
    </>}
  </View>;
}

function FinancesEquipeReel() {
  const [finances, setFinances] = useState<FinancesEquipe | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enCours = useRef(false);
  const actif = useRef(true);
  useEffect(() => { actif.current = true; return () => { actif.current = false; }; }, []);

  async function lire() {
    if (enCours.current) return;
    enCours.current = true; setChargement(true); setErreur(null);
    try { const f = await gestion.financesEquipe(); if (actif.current) setFinances(f); }
    catch (e) { if (actif.current) setErreur(e instanceof ErreurEquipe || e instanceof ErreurConnexion ? e.message : 'Impossible de lire les finances. Réessayez.'); }
    finally { enCours.current = false; if (actif.current) setChargement(false); }
  }
  useEffect(() => { void lire(); }, []);

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.nom}>Finances</Text>
    <Text style={s.secondaire}>Période : 1-31 octobre 2026. Lecture seule : les taux affichés sont ceux du développement, ils se modifient sur le site.</Text>
    {chargement && <><ActivityIndicator color={c.action} /><Text accessibilityLiveRegion="polite" style={s.texte}>Lecture des finances…</Text></>}
    {erreur && <Text accessibilityRole="alert" style={s.texte}>{erreur}</Text>}
    <Action titre="Actualiser les finances" agir={() => { void lire(); }} disabled={chargement} />
    {finances && <>
      {finances.illisibles > 0 && <Text accessibilityRole="alert" style={s.texte}>{finances.illisibles === 1 ? '1 ligne de relevé est illisible dans l’application.' : finances.illisibles + ' lignes de relevé sont illisibles dans l’application.'}</Text>}
      <Text style={s.texte}>Rythme : {finances.parametres.rythme} · devise {finances.parametres.devise} · taux par défaut : {tauxAffiche(finances.parametres.tauxDefaut)}</Text>
      <Bouton titre="Modifier ou exporter : ouvrir le site" secondaire onPress={() => { void Linking.openURL(SITE_WEB + '/system/finances').catch(() => setErreur('Impossible d’ouvrir le site sur cet appareil.')); }} />
      {finances.releve.length === 0 && <Text style={s.texte}>Aucun relevé pour cette période.</Text>}
      {finances.releve.map(l => <View key={l.etablissementId} style={s.carte}>
        <Text style={s.nomPetit}>{l.etablissementNom}</Text>
        <Text style={s.texte}>Ventes : {formaterGnf(l.ventesGnf)} GNF</Text>
        <Text style={s.texte}>Commission : {formaterGnf(l.commissionGnf)} GNF · Taux : {tauxAffiche(l.taux)}</Text>
        <Text style={s.texte}>Frais de livraison : {formaterGnf(l.fraisLivraisonGnf)} GNF</Text>
        <Text style={s.texte}>Remboursements : {formaterGnf(l.remboursementsGnf)} GNF</Text>
        <Text style={s.nomPetit}>Net à reverser : {formaterGnf(l.netAReverserGnf)} GNF</Text>
        <Text style={s.secondaire}>Versement : {libelleStatutVersement(l.versement.statut)}{l.versement.reference ? ' · ' + l.versement.reference : ''}</Text>
      </View>)}
    </>}
  </View>;
}

const s = StyleSheet.create({
  modules: { gap: 8 },
  contenu: { padding: 22, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 },
  titre: { fontFamily: polices.titre, fontSize: 34, color: c.encre },
  nom: { fontFamily: polices.titre, fontSize: 23, color: c.encre, marginTop: 8 },
  nomPetit: { fontFamily: polices.titre, fontSize: 17, color: c.encre },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 23, color: c.encre },
  secondaire: { fontFamily: polices.texte, fontSize: 12, lineHeight: 19, color: c.secondaire },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 18, padding: 16, gap: 8 },
});
