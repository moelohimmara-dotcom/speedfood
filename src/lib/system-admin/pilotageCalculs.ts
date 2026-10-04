/**
 * Calculs du tableau de bord de pilotage (fonctions pures, testées) : regroupement des statuts, séries par jour,
 * comparaison avec la période précédente, taux d'acceptation, heures de pointe. Les chiffres viennent de
 * `fn_support_serie_commandes` et `fn_support_commandes_par_heure` (aucune donnée personnelle).
 *
 * Jours et heures sont en UTC, qui est l'heure locale de la Guinée.
 */
export interface LigneSerie {
  /** `AAAA-MM-JJ`. */
  jour: string;
  statut: string;
  nb: number;
  montant: number;
}

export type CategorieStatut = "enAttente" | "enCours" | "terminees" | "ecartees";

/** Regroupement des six statuts d'une commande en quatre familles lisibles. */
export const CATEGORIE_DU_STATUT: Record<string, CategorieStatut> = {
  en_attente: "enAttente",
  acceptee: "enCours",
  prete: "enCours",
  terminee: "terminees",
  refusee: "ecartees",
  annulee: "ecartees",
};

export interface Bilan {
  total: number;
  enAttente: number;
  enCours: number;
  terminees: number;
  ecartees: number;
  /** Montant des commandes non écartées (indicatif : le règlement se fait hors Speedfood). */
  montantRetenu: number;
}

export interface JourSerie extends Bilan {
  jour: string;
  libelle: string;
}

function bilanVide(): Bilan {
  return { total: 0, enAttente: 0, enCours: 0, terminees: 0, ecartees: 0, montantRetenu: 0 };
}

function ajouter(bilan: Bilan, ligne: LigneSerie): void {
  const categorie = CATEGORIE_DU_STATUT[ligne.statut];
  if (!categorie) {
    return;
  }
  bilan.total += ligne.nb;
  bilan[categorie] += ligne.nb;
  if (categorie !== "ecartees") {
    bilan.montantRetenu += ligne.montant;
  }
}

/** `AAAA-MM-JJ` d'un instant, en UTC. */
export function cleJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function jourDepuis(aujourdhui: Date, decalage: number): string {
  const d = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - decalage);
  return cleJour(d);
}

/** « 4 oct. » pour `2026-10-04`. */
export function libelleJour(jour: string): string {
  return new Date(`${jour}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Les `jours` derniers jours (du plus ancien au plus récent, aujourd'hui compris), jours vides remplis à zéro. */
export function construireJours(lignes: readonly LigneSerie[], jours: number, aujourdhui: Date): JourSerie[] {
  const parJour = new Map<string, Bilan>();
  for (const ligne of lignes) {
    const bilan = parJour.get(ligne.jour) ?? bilanVide();
    ajouter(bilan, ligne);
    parJour.set(ligne.jour, bilan);
  }
  const resultat: JourSerie[] = [];
  for (let decalage = jours - 1; decalage >= 0; decalage--) {
    const jour = jourDepuis(aujourdhui, decalage);
    resultat.push({ jour, libelle: libelleJour(jour), ...(parJour.get(jour) ?? bilanVide()) });
  }
  return resultat;
}

/** Période courante et période précédente de même durée (les lignes couvrent les deux). */
export function comparerPeriodes(
  lignes: readonly LigneSerie[],
  jours: number,
  aujourdhui: Date
): { courant: Bilan; precedent: Bilan } {
  const debutCourant = jourDepuis(aujourdhui, jours - 1);
  const debutPrecedent = jourDepuis(aujourdhui, 2 * jours - 1);
  const courant = bilanVide();
  const precedent = bilanVide();
  for (const ligne of lignes) {
    if (ligne.jour >= debutCourant) {
      ajouter(courant, ligne);
    } else if (ligne.jour >= debutPrecedent) {
      ajouter(precedent, ligne);
    }
  }
  return { courant, precedent };
}

/** Part des commandes décidées (hors « en attente ») qui ont été acceptées, ou `null` s'il n'y a encore aucune décision. */
export function tauxAcceptation(bilan: Bilan): number | null {
  const decidees = bilan.total - bilan.enAttente;
  if (decidees <= 0) {
    return null;
  }
  return (bilan.enCours + bilan.terminees) / decidees;
}

/** Variation relative (0,25 = +25 %), ou `null` quand la période précédente est vide et que la courante ne l'est pas. */
export function variation(courant: number, precedent: number): number | null {
  if (precedent === 0) {
    return courant === 0 ? 0 : null;
  }
  return (courant - precedent) / precedent;
}

/** Commandes par heure (24 valeurs, de 0 h à 23 h). */
export function heuresPleines(lignes: readonly { heure: number; nb: number }[]): number[] {
  const heures = new Array<number>(24).fill(0);
  for (const ligne of lignes) {
    if (Number.isInteger(ligne.heure) && ligne.heure >= 0 && ligne.heure < 24) {
      heures[ligne.heure] += ligne.nb;
    }
  }
  return heures;
}

/** Valeur ronde au-dessus d'un maximum, pour l'axe d'un graphique (4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100…). */
export function maximumAxe(maximum: number): number {
  if (maximum <= 4) {
    return 4;
  }
  const echelle = 10 ** Math.floor(Math.log10(maximum));
  for (const pas of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (pas * echelle >= maximum) {
      return Math.round(pas * echelle);
    }
  }
  return 10 * echelle;
}

/** Restaurants créés pour des essais (nom `[DEV]…`, « test », « essai ») : séparés du travail réel dans la file « À traiter ». */
export function estElementDeTest(nom: string): boolean {
  return /^\s*\[dev\]/i.test(nom) || /(^|[^a-zà-ÿ])(test|essai)([^a-zà-ÿ]|$)/i.test(nom);
}

/** Statistiques agrégées de toute l'application (réponse de `fn_statistiques_application`), toutes en nombres. */
export interface StatistiquesApplication {
  restaurants: Record<"total" | "publies" | "enAttente" | "correction" | "suspendus" | "ouverts" | "acceptentCommandes" | "avecLogo" | "avecPhoto" | "nouveaux", number>;
  catalogue: Record<"plats" | "disponibles" | "enPromo" | "avecPhoto" | "nouveaux" | "supplements", number>;
  commandes: Record<"total" | "livraison" | "retrait" | "panierMoyen" | "restaurantsActifs", number>;
  propositions: Record<"total" | "acceptees" | "refusees" | "expirees" | "enAttente", number>;
  clients: Record<"comptes" | "nouveaux" | "avecCoordonnees", number>;
  alertes: Record<"abonnements" | "restaurantsEquipes" | "actifs7j" | "enEchec", number>;
  contenus: Record<"pagesPubliees" | "pagesBrouillon" | "bannieresPubliees" | "bannieresBrouillon" | "misesEnAvantActives", number>;
  equipes: Record<"membresRestaurants" | "comptesSysteme", number>;
  evenementsAudit: number;
  topRestaurants: { nom: string; nb: number; montant: number }[];
  topPlats: { nom: string; nb: number }[];
  quartiers: { nom: string; nb: number }[];
}

function nombre(valeur: unknown): number {
  const n = Number(valeur);
  return Number.isFinite(n) ? n : 0;
}

function objet(valeur: unknown): Record<string, unknown> {
  return valeur !== null && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : {};
}

function liste(valeur: unknown): Record<string, unknown>[] {
  return Array.isArray(valeur) ? valeur.map(objet) : [];
}

/** Transforme la réponse JSON de la base en objet typé ; tout champ absent ou invalide vaut 0 (jamais d'erreur d'écran). */
export function normaliserStatistiques(brut: unknown): StatistiquesApplication {
  const b = objet(brut);
  const r = objet(b.restaurants);
  const c = objet(b.catalogue);
  const o = objet(b.commandes);
  const p = objet(b.propositions);
  const cl = objet(b.clients);
  const a = objet(b.alertes);
  const ct = objet(b.contenus);
  const e = objet(b.equipes);
  return {
    restaurants: {
      total: nombre(r.total), publies: nombre(r.publies), enAttente: nombre(r.en_attente), correction: nombre(r.correction),
      suspendus: nombre(r.suspendus), ouverts: nombre(r.ouverts), acceptentCommandes: nombre(r.acceptent_commandes),
      avecLogo: nombre(r.avec_logo), avecPhoto: nombre(r.avec_photo), nouveaux: nombre(r.nouveaux),
    },
    catalogue: {
      plats: nombre(c.plats), disponibles: nombre(c.disponibles), enPromo: nombre(c.en_promo),
      avecPhoto: nombre(c.avec_photo), nouveaux: nombre(c.nouveaux), supplements: nombre(c.supplements),
    },
    commandes: {
      total: nombre(o.total), livraison: nombre(o.livraison), retrait: nombre(o.retrait),
      panierMoyen: nombre(o.panier_moyen), restaurantsActifs: nombre(o.restaurants_actifs),
    },
    propositions: {
      total: nombre(p.total), acceptees: nombre(p.acceptees), refusees: nombre(p.refusees),
      expirees: nombre(p.expirees), enAttente: nombre(p.en_attente),
    },
    clients: { comptes: nombre(cl.comptes), nouveaux: nombre(cl.nouveaux), avecCoordonnees: nombre(cl.avec_coordonnees) },
    alertes: {
      abonnements: nombre(a.abonnements), restaurantsEquipes: nombre(a.restaurants_equipes),
      actifs7j: nombre(a.actifs_7j), enEchec: nombre(a.en_echec),
    },
    contenus: {
      pagesPubliees: nombre(ct.pages_publiees), pagesBrouillon: nombre(ct.pages_brouillon),
      bannieresPubliees: nombre(ct.bannieres_publiees), bannieresBrouillon: nombre(ct.bannieres_brouillon),
      misesEnAvantActives: nombre(ct.mises_en_avant_actives),
    },
    equipes: { membresRestaurants: nombre(e.membres_restaurants), comptesSysteme: nombre(e.comptes_systeme) },
    evenementsAudit: nombre(objet(b.audit).evenements),
    topRestaurants: liste(b.top_restaurants).map((l) => ({ nom: String(l.nom ?? ""), nb: nombre(l.nb), montant: nombre(l.montant) })),
    topPlats: liste(b.top_plats).map((l) => ({ nom: String(l.nom ?? ""), nb: nombre(l.nb) })),
    quartiers: liste(b.quartiers).map((l) => ({ nom: String(l.nom ?? ""), nb: nombre(l.nb) })),
  };
}

/** Part en pourcentage entier (0 si le total est nul). */
export function pourcentage(partie: number, total: number): number {
  return total > 0 ? Math.round((partie / total) * 100) : 0;
}
