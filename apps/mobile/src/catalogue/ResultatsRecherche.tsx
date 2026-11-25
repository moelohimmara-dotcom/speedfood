import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RestaurantIndexPublic } from '../../../../packages/shared/src/contracts/catalogue.ts';
import { Bouton } from '../design/Composants';
import { couleurs as c, polices } from '../design/tokens';
import { Pastille } from './FicheRestaurant';
import { VignettePlat } from './MentionIllustrative';
import { LIBELLE_NIVEAU, type RestaurantTrouve, type ResultatRecherche } from './recherche-appli';
import type { EtatRecherche } from './useRechercheArticles';
import type { EtatPersonnalisation } from './usePersonnalisation';
import { MESSAGE_AVERTISSEMENT_ALLERGIES } from '../connexion/preferences-client';

const gnf = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
/** Restaurants affichés avant « Voir plus » : la liste reste courte, la recherche reste complète. */
const PREMIERS = 10;

/**
 * Résultats de la recherche de plats sous la zone de recherche de l'accueil : les restaurants qui proposent l'article tapé (ou un article proche ou similaire), du meilleur au moins bon,
 * avec ses plats, leur photo, leur prix. Un appui ouvre le menu du restaurant. Sans résultat, un texte honnête ; si l'index est indisponible, un mot discret (la recherche de restaurants continue).
 */
export function ResultatsRecherche({ etat, resultat, saisie, ouvrir, perso }: { etat: EtatRecherche; resultat: ResultatRecherche | null; saisie: string; ouvrir(restaurant: RestaurantIndexPublic): void; perso: EtatPersonnalisation }) {
  const [toutVoir, setToutVoir] = useState(false);
  if (!resultat) {
    if (etat === 'chargement') return <View accessibilityLiveRegion="polite" style={s.ligne}><ActivityIndicator color={c.action} /><Text style={s.secondaire}>Préparation de la recherche de plats…</Text></View>;
    if (etat === 'indisponible') return <Text style={s.secondaire}>La recherche de plats est indisponible pour le moment. Les restaurants correspondants restent listés plus bas.</Text>;
    return null;
  }
  if (resultat.restaurants.length === 0) return <Text accessibilityLiveRegion="polite" style={s.texte}>Aucun plat ne correspond à « {saisie.trim()} ». Essayez un autre mot, ou une partie du nom.</Text>;
  const visibles = toutVoir ? resultat.restaurants : resultat.restaurants.slice(0, PREMIERS);
  let niveauPrecedent: string | null = null;
  const avecAllergies = perso.contexte.profil.allergies.length > 0;
  const distancePossible = resultat.restaurants.some(r => r.restaurant.latitude !== undefined);
  return <View style={{ gap: 12 }}>
    {avecAllergies && <Text accessibilityRole="alert" style={s.avertissement}>{MESSAGE_AVERTISSEMENT_ALLERGIES}</Text>}
    {!perso.connecte && <Text style={s.secondaire}>Connectez-vous pour adapter les résultats à vos préférences et à vos allergies.</Text>}
    {perso.connecte && !perso.chargement && !perso.aDesPreferences && <Text style={s.secondaire}>Renseignez vos préférences et allergies dans Compte, puis Paramètres, pour des résultats adaptés.</Text>}
    {distancePossible && perso.contexte.position === null && <Bouton titre="Trier par distance" secondaire icone="position" onPress={() => { void perso.situer(); }} />}
    {perso.contexte.position !== null && <Text style={s.secondaire}>Résultats classés selon votre position, qui reste sur votre téléphone.</Text>}
    {perso.messagePosition !== '' && <Text accessibilityRole="alert" style={s.secondaire}>{perso.messagePosition}</Text>}
    {visibles.map(r => {
      const titre = r.niveau !== niveauPrecedent ? LIBELLE_NIVEAU[r.niveau] : null;
      niveauPrecedent = r.niveau;
      return <View key={r.restaurant.id} style={{ gap: 12 }}>
        {titre && <Text accessibilityRole="header" style={s.titreSection}>{titre}</Text>}
        <BlocRestaurant r={r} ouvrir={ouvrir} />
      </View>;
    })}
    {!toutVoir && resultat.restaurants.length > PREMIERS && <Bouton titre={`Voir ${resultat.restaurants.length - PREMIERS} restaurants de plus`} secondaire icone="plus" onPress={() => setToutVoir(true)} />}
  </View>;
}

const PLATS_VISIBLES = 4;
function BlocRestaurant({ r, ouvrir }: { r: RestaurantTrouve; ouvrir(restaurant: RestaurantIndexPublic): void }) {
  const [tousLesPlats, setTousLesPlats] = useState(false);
  const plats = tousLesPlats ? r.articles : r.articles.slice(0, PLATS_VISIBLES);
  const lieu = [r.restaurant.categorie, r.restaurant.lieu].filter(Boolean).join(' · ');
  return <View style={s.carte}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Voir le menu de ${r.restaurant.nom}`} onPress={() => ouvrir(r.restaurant)} style={{ gap: 4 }}>
      <Text style={s.nom}>{r.restaurant.nom}</Text>
      <View style={s.ligne}>{lieu !== '' && <Text style={[s.secondaire, { flexShrink: 1 }]}>{lieu}</Text>}<Pastille texte={r.restaurant.ouvert ? 'Ouvert' : 'Fermé'} ton={r.restaurant.ouvert ? 'succes' : 'neutre'} /></View>
      {r.raisons.length > 0 && <Text style={s.raisons}>{r.raisons.join(' · ')}</Text>}
    </Pressable>
    {r.articles.length === 0 && r.nombreEcartes > 0 && <Text style={s.secondaire}>Tous les plats de ce restaurant correspondant à votre recherche contiennent un de vos allergènes.</Text>}
    {/* La vignette et son repère « i » restent HORS du bouton : un bouton ne contient jamais un autre bouton (invalide sur le web, ambigu au toucher). */}
    {plats.map(a => <View key={a.id} style={s.article}>
      <VignettePlat url={a.photoUrl} nom={a.nom} taille={56} illustrative={a.illustrative} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${a.nom}, ${gnf(a.prixGnf)}, chez ${r.restaurant.nom}`} onPress={() => ouvrir(r.restaurant)} style={{ flex: 1, gap: 2, minHeight: 56, justifyContent: 'center' }}>
        <Text style={s.nomArticle}>{a.nom}</Text>
        <Text style={s.prix}>{gnf(a.prixGnf)}</Text>
        {a.disponibilite === 'epuise' && <Text style={s.secondaire}>Épuisé</Text>}
        {a.disponibilite === 'a_confirmer' && <Text style={s.secondaire}>Disponibilité à confirmer</Text>}
        {a.alertes.map(t => <Text key={t} accessibilityRole={a.statutAllergie === 'probable' ? 'alert' : undefined} style={a.statutAllergie === 'probable' && /allerg|contient probablement/i.test(t) ? s.alerteGrave : s.alerte}>{t}</Text>)}
      </Pressable>
    </View>)}
    {!tousLesPlats && r.articles.length > PLATS_VISIBLES && <Bouton titre={`Voir les ${r.articles.length - PLATS_VISIBLES} autres plats`} secondaire icone="plus" onPress={() => setTousLesPlats(true)} />}
  </View>;
}
const s = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  carte: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.bordure, borderRadius: 22, padding: 16, gap: 12 },
  titreSection: { color: c.encre, fontFamily: polices.titre, fontSize: 22, marginTop: 4 },
  nom: { color: c.encre, fontFamily: polices.titre, fontSize: 20 },
  nomArticle: { color: c.encre, fontFamily: polices.texte, fontSize: 15, fontWeight: '700' },
  prix: { color: c.encre, fontFamily: polices.texte, fontSize: 14 },
  article: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  texte: { color: c.encre, fontFamily: polices.texte, fontSize: 15, lineHeight: 23 },
  raisons: { color: c.action, fontFamily: polices.texte, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  alerte: { color: c.avertissement, fontFamily: polices.texte, fontSize: 12, lineHeight: 18 },
  alerteGrave: { color: c.danger, fontFamily: polices.texte, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  avertissement: { color: c.avertissement, backgroundColor: c.avertissementFond, fontFamily: polices.texte, fontSize: 13, lineHeight: 19, padding: 12, borderRadius: 12 },
  secondaire: { color: c.secondaire, fontFamily: polices.texte, fontSize: 12, lineHeight: 19 },
});
