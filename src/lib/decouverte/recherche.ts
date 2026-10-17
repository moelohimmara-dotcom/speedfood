import "server-only";
import { creerClientPublic } from "@/lib/db/public";
import { validerIllustration, type Illustration } from "@/lib/illustrations/modele";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { etatDisponibilite, scoreFraicheur, type EtatDisponibilite } from "@/lib/disponibilite/etat";
import { communeDuQuartier } from "@/lib/geographie/quartiers";
import { etatRestaurant } from "@/lib/disponibilite/etat";
import { lireSignauxClassement } from "./signaux";
import {
  ORDRE_GROUPES,
  classerResultats,
  type FiltresDecouverte,
  type PlatPublic,
  type ResultatClasse,
  type RestaurantClassable,
} from "./classement";
import { pastilles, scoresRestaurants, type ModeTri, type Pastille, type ScoreRestaurant } from "./recommandation";
import { moyenneAffichee } from "@/lib/notation/regles";

/**
 * Recherche publique : restaurants publiés (la RLS de lecture publique ne
 * renvoie déjà que ceux-là), leurs plats, classement explicable.
 *
 * Volumes du pilote : le filtrage par texte se fait ici, sans accents ni
 * casse (la base ne les ignore pas sans extension dédiée), sur au plus
 * LIMITE_RESTAURANTS_LUS restaurants et LIMITE_PLATS_LUS plats. À revoir
 * (extension `unaccent` ou index trigramme, côté base) bien avant d'approcher
 * ces plafonds.
 */
const LIMITE_RESTAURANTS_LUS = 500;
const LIMITE_PLATS_LUS = 2000;
export const LIMITE_RESULTATS_AFFICHES = 60;

export interface RestaurantCatalogue extends RestaurantClassable {
  categorieId: string | null;
  couleurAccent: string | null;
  logoIllustration: Illustration | null;
  couvertureIllustration: Illustration | null;
  categorie: string;
  quartier: string;
  communeNom: string;
  /** Identifiants de la zone du restaurant (vides si inconnus) : les zones se comparent par identifiant, jamais par nom. */
  quartierId: string;
  communeId: string;
  communeSlug: string;
  prefectureId: string;
  prefectureNom: string;
  prefectureSlug: string;
  regionId: string;
  regionNom: string;
  regionSlug: string;
  /** Quartier « Centre de … » d'une commune hors Conakry : il désigne la commune elle-même, on ne l'affiche pas comme quartier. */
  quartierGenerique: boolean;
}

export interface RechercheCatalogue {
  q: string;
  categorie?: string;
  quartier?: string;
  filtres: FiltresDecouverte;
  /** Mode de tri choisi par le visiteur (« recommandés » par défaut). */
  tri?: ModeTri;
}

/** Ce que la carte d'un restaurant affiche de sa réputation (jamais d'identifiant de compte). */
export interface ReputationRestaurant {
  /** Moyenne publique, seulement à partir de 5 avis ; sinon `null`. */
  moyenne: number | null;
  total: number;
  pastilles: Pastille[];
  score: ScoreRestaurant;
}

/** Plat mis en avant dans le carrousel « Plats du moment » : jamais sans photo, jamais épuisé. */
export interface PlatVedette {
  platId: string;
  nom: string;
  prixAffiche: number;
  photoUrl: string;
  restaurantId: string;
  restaurantNom: string;
  quartier: string;
  etat: EtatDisponibilite;
}

export interface ResultatRecherche {
  vedettes: PlatVedette[];
  resultats: ResultatClasse<RestaurantCatalogue>[];
  reputations: Map<string, ReputationRestaurant>;
  fraicheurHeures: number;
  maintenant: Date;
  erreur: boolean;
}

export interface CatalogueLu {
  restaurants: RestaurantCatalogue[];
  platsParRestaurant: Map<string, PlatPublic[]>;
  fraicheurHeures: number;
  maintenant: Date;
  erreur: boolean;
}

/** Lecture publique du catalogue (restaurants publiés et leurs plats), partagée par la recherche et les alternatives. */
export async function lireCatalogue(
  filtres: { categorie?: string; quartier?: string } = {}
): Promise<CatalogueLu> {
  const supabase = creerClientPublic();
  const maintenant = new Date();
  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();

  let requete = supabase
    .from("restaurants")
    .select(
      "id, nom, horaires, ouvert, accepte_commandes, photo_url, logo_url, logo_illustration, couverture_illustration, couleur_accent, categorie_id, menu_categories(nom), neighborhoods(id, nom, generique, communes(id, nom, slug, prefectures(id, nom, slug, regions(id, nom, slug))))"
    )
    .order("nom")
    .limit(LIMITE_RESTAURANTS_LUS);
  if (filtres.categorie) requete = requete.eq("categorie_id", filtres.categorie);
  if (filtres.quartier) requete = requete.eq("quartier_id", filtres.quartier);

  const [{ data: restaurantsBruts, error: erreurRestaurants }, { data: platsBruts, error: erreurPlats }] =
    await Promise.all([
      requete,
      supabase
        .from("menu_items")
        .select("id, restaurant_id, nom, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, illustration")
        .is("archive_le", null)
        .limit(LIMITE_PLATS_LUS),
    ]);

  if (erreurRestaurants || erreurPlats) {
    return {
      restaurants: [],
      platsParRestaurant: new Map(),
      fraicheurHeures: disponibiliteFraicheurHeures,
      maintenant,
      erreur: true,
    };
  }

  const restaurants: RestaurantCatalogue[] = (restaurantsBruts ?? []).map((r) => ({
    id: r.id,
    nom: r.nom,
    horaires: r.horaires,
    ouvert: r.ouvert,
    accepteCommandes: r.accepte_commandes,
    categorieId: r.categorie_id,
    photoUrl: r.photo_url,
    logoUrl: r.logo_url,
    couleurAccent: r.couleur_accent,
    logoIllustration: validerIllustration(r.logo_illustration),
    couvertureIllustration: validerIllustration(r.couverture_illustration),
    categorie: r.menu_categories?.nom ?? "",
    quartier: r.neighborhoods?.generique ? "" : (r.neighborhoods?.nom ?? ""),
    communeNom: communeDuQuartier(r.neighborhoods),
    quartierId: r.neighborhoods?.id ?? "",
    communeId: r.neighborhoods?.communes?.id ?? "",
    communeSlug: r.neighborhoods?.communes?.slug ?? "",
    prefectureId: r.neighborhoods?.communes?.prefectures?.id ?? "",
    prefectureNom: r.neighborhoods?.communes?.prefectures?.nom ?? "",
    prefectureSlug: r.neighborhoods?.communes?.prefectures?.slug ?? "",
    regionId: r.neighborhoods?.communes?.prefectures?.regions?.id ?? "",
    regionNom: r.neighborhoods?.communes?.prefectures?.regions?.nom ?? "",
    regionSlug: r.neighborhoods?.communes?.prefectures?.regions?.slug ?? "",
    quartierGenerique: r.neighborhoods?.generique ?? false,
  }));

  const platsParRestaurant = new Map<string, PlatPublic[]>();
  for (const p of platsBruts ?? []) {
    const liste = platsParRestaurant.get(p.restaurant_id) ?? [];
    liste.push({
      id: p.id,
      nom: p.nom,
      prix: p.prix,
      prixPromo: p.prix_promo,
      disponible: p.disponible,
      confirmeLe: p.disponibilite_confirmee_le,
      photoUrl: p.photo_url,
      illustration: validerIllustration(p.illustration),
    });
    platsParRestaurant.set(p.restaurant_id, liste);
  }

  return { restaurants, platsParRestaurant, fraicheurHeures: disponibiliteFraicheurHeures, maintenant, erreur: false };
}

export async function rechercherCatalogue(recherche: RechercheCatalogue): Promise<ResultatRecherche> {
  const catalogue = await lireCatalogue({ categorie: recherche.categorie, quartier: recherche.quartier });
  if (catalogue.erreur) {
    return { vedettes: [], resultats: [], reputations: new Map(), fraicheurHeures: catalogue.fraicheurHeures, maintenant: catalogue.maintenant, erreur: true };
  }

  const classes = classerResultats({
    terme: recherche.q,
    restaurants: catalogue.restaurants,
    platsParRestaurant: catalogue.platsParRestaurant,
    fraicheurHeures: catalogue.fraicheurHeures,
    maintenant: catalogue.maintenant,
    filtres: recherche.filtres,
  });

  // Note, prix et fréquentation : comparés à TOUS les restaurants lus (pas seulement aux résultats), pour qu'un score ne change pas selon le filtre.
  const signaux = await lireSignauxClassement(
    catalogue.restaurants.map((r) => r.id),
    catalogue.platsParRestaurant
  );
  const entrees = catalogue.restaurants.map((r) => signaux.entrees.get(r.id)!);
  const scores = new Map(scoresRestaurants(entrees, signaux.poids).map((s) => [s.id, s]));
  const reputations = new Map<string, ReputationRestaurant>();
  for (const e of entrees) {
    const score = scores.get(e.id)!;
    reputations.set(e.id, { moyenne: moyenneAffichee(e.avisSomme, e.avisTotal), total: e.avisTotal, pastilles: pastilles(e, score), score });
  }

  const tri: ModeTri = recherche.tri ?? "recommandes";
  const valeurTri = (id: string): number => {
    const s = scores.get(id)!;
    return tri === "mieux_notes" ? s.note : tri === "moins_chers" ? s.prix : tri === "populaires" ? s.frequentation : s.global;
  };
  // Une recherche par texte garde l'ordre de pertinence existant (« recommandés ») ; sinon le score global ou le tri choisi ordonne
  // À L'INTÉRIEUR de chaque groupe, les restaurants ouverts d'abord. À égalité, l'ordre d'origine est conservé.
  const garderPertinence = recherche.q.trim().length > 0 && tri === "recommandes";
  const rangOuverture = (r: RestaurantCatalogue) => (etatRestaurant(r) === "ouvert" ? 0 : etatRestaurant(r) === "pause" ? 1 : 2);
  const ordonnes = garderPertinence
    ? classes
    : classes
        .map((c, i) => ({ c, i }))
        .sort(
          (a, b) =>
            ORDRE_GROUPES.indexOf(a.c.groupe) - ORDRE_GROUPES.indexOf(b.c.groupe) ||
            rangOuverture(a.c.restaurant) - rangOuverture(b.c.restaurant) ||
            valeurTri(b.c.restaurant.id) - valeurTri(a.c.restaurant.id) ||
            a.i - b.i
        )
        .map((x) => x.c);
  const resultats = ordonnes.slice(0, LIMITE_RESULTATS_AFFICHES);

  const vedettes = choisirVedettes(resultats, catalogue.platsParRestaurant, catalogue.fraicheurHeures, catalogue.maintenant);
  return { vedettes, resultats, reputations, fraicheurHeures: catalogue.fraicheurHeures, maintenant: catalogue.maintenant, erreur: false };
}

const MAX_VEDETTES = 12;

/**
 * Plats du moment : parmi les restaurants du résultat, les plats DISPONIBLES qui ont une photo,
 * les plus récemment confirmés d'abord, un seul plat par restaurant (pour varier), ordre
 * alphabétique à égalité (déterministe). Rien n'est inventé : un plat jamais confirmé reste « à
 * confirmer » et passe après les plats confirmés.
 */
function choisirVedettes(
  resultats: ResultatClasse<RestaurantCatalogue>[],
  platsParRestaurant: Map<string, PlatPublic[]>,
  fraicheurHeures: number,
  maintenant: Date
): PlatVedette[] {
  const candidats: PlatVedette[] = [];
  for (const { restaurant } of resultats) {
    const meilleurs = (platsParRestaurant.get(restaurant.id) ?? [])
      .filter((p) => p.disponible && p.photoUrl)
      .map((p) => ({ p, etat: etatDisponibilite({ disponible: p.disponible, confirmeLe: p.confirmeLe }, fraicheurHeures, maintenant) }))
      .sort(
        (a, b) =>
          scoreFraicheur(b.etat, fraicheurHeures, maintenant) - scoreFraicheur(a.etat, fraicheurHeures, maintenant) ||
          a.p.nom.localeCompare(b.p.nom, "fr")
      );
    const choisi = meilleurs[0];
    if (choisi && choisi.p.photoUrl) {
      candidats.push({
        platId: choisi.p.id,
        nom: choisi.p.nom,
        prixAffiche: choisi.p.prixPromo ?? choisi.p.prix,
        photoUrl: choisi.p.photoUrl,
        restaurantId: restaurant.id,
        restaurantNom: restaurant.nom,
        quartier: restaurant.quartier,
        etat: choisi.etat,
      });
    }
  }
  return candidats
    .sort(
      (a, b) =>
        scoreFraicheur(b.etat, fraicheurHeures, maintenant) - scoreFraicheur(a.etat, fraicheurHeures, maintenant) ||
        a.restaurantNom.localeCompare(b.restaurantNom, "fr")
    )
    .slice(0, MAX_VEDETTES);
}
