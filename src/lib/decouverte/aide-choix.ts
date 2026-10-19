// Pur, sans dépendance : testable seul (npm run test:unit). Voir docs/AIDE-AU-CHOIX.md.

/**
 * « Aide-moi à choisir » : à partir de la position et du budget d'un client, propose quelques restaurants du moins cher au plus
 * huppé. Règles de fond :
 *  - la GAMME d'un restaurant vient de ses prix réels (prix typique = médiane de ses plats disponibles) comparés à des seuils en GNF
 *    réglés par l'exploitation ; une gamme VALIDÉE par l'exploitation (à la demande du restaurateur) l'emporte ;
 *  - seuls les restaurants ouverts, qui acceptent des commandes, proches (rayon) et dont au moins un plat tient dans le budget
 *    (ou le dépasse d'une marge annoncée) sont proposés : aucun signal inventé, aucune promotion payante ;
 *  - quand il y a plus de restaurants que de places, la sélection couvre toutes les gammes (le plus proche de chaque gamme d'abord),
 *    puis l'affichage est trié du moins cher au plus huppé.
 */

export type Gamme = "economique" | "intermediaire" | "haut_de_gamme" | "premium";

export const GAMMES: readonly Gamme[] = ["economique", "intermediaire", "haut_de_gamme", "premium"];

export const LIBELLES_GAMME: Record<Gamme, string> = {
  economique: "Économique",
  intermediaire: "Intermédiaire",
  haut_de_gamme: "Haut de gamme",
  premium: "Premium",
};

export function estGamme(valeur: unknown): valeur is Gamme {
  return typeof valeur === "string" && (GAMMES as readonly string[]).includes(valeur);
}

export function rangGamme(g: Gamme): number {
  return GAMMES.indexOf(g);
}

/** Bornes hautes INCLUSES (GNF) du prix typique : au-delà de la dernière, c'est « Premium ». */
export interface SeuilsGamme {
  economiqueJusqua: number;
  intermediaireJusqua: number;
  hautDeGammeJusqua: number;
}

export const SEUILS_PAR_DEFAUT: SeuilsGamme = { economiqueJusqua: 25_000, intermediaireJusqua: 50_000, hautDeGammeJusqua: 100_000 };

export function seuilsValides(s: SeuilsGamme): boolean {
  const v = [s.economiqueJusqua, s.intermediaireJusqua, s.hautDeGammeJusqua];
  return v.every((x) => Number.isInteger(x) && x >= 1000 && x <= 10_000_000) && v[0] < v[1] && v[1] < v[2];
}

/** Gamme déduite du prix typique ; `null` sans prix (jamais de gamme inventée). */
export function gammeAutomatique(prixTypique: number | null, seuils: SeuilsGamme = SEUILS_PAR_DEFAUT): Gamme | null {
  if (prixTypique === null || !Number.isFinite(prixTypique) || prixTypique <= 0) return null;
  if (prixTypique <= seuils.economiqueJusqua) return "economique";
  if (prixTypique <= seuils.intermediaireJusqua) return "intermediaire";
  if (prixTypique <= seuils.hautDeGammeJusqua) return "haut_de_gamme";
  return "premium";
}

/** La gamme validée par l'exploitation l'emporte sur le calcul. */
export function gammeEffective(automatique: Gamme | null, validee: Gamme | null): Gamme | null {
  return validee ?? automatique;
}

// ---------------------------------------------------------------- budget

export const BUDGET_MIN_GNF = 5_000;
export const BUDGET_MAX_GNF = 1_000_000;

/** Budget par personne : entier en GNF, borné. */
export function budgetValide(valeur: unknown): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= BUDGET_MIN_GNF && valeur <= BUDGET_MAX_GNF;
}

export interface CandidatChoix {
  id: string;
  nom: string;
  ouvert: boolean;
  accepteCommandes: boolean;
  /** Prix (GNF, promo comprise) des plats DISPONIBLES. */
  prixPlats: number[];
  /** Distance estimée au client ; `null` si elle ne peut pas être calculée. */
  distanceKm: number | null;
  /** Vrai si la distance part du centre du quartier du restaurant (sans coordonnées propres) : affichée « environ ». */
  distanceApprochee?: boolean;
  /** Même quartier ou même commune que le client : permet de proposer un restaurant sans coordonnées. */
  memeZone: boolean;
  gamme: Gamme | null;
  noteMoyenne: number | null;
  avisTotal: number;
}

export interface ParametresChoix {
  budgetGnf: number;
  rayonKm: number;
  /** Dépassement toléré, en pourcentage du budget, pour la section « un peu au-dessus ». */
  margeAuDessusPct: number;
  /** Nombre maximal de propositions. */
  max: number;
}

export type GroupeChoix = "dans_budget" | "un_peu_au_dessus";

export const LIBELLES_GROUPE_CHOIX: Record<GroupeChoix, string> = {
  dans_budget: "Dans votre budget",
  un_peu_au_dessus: "Un peu au-dessus de votre budget",
};

export interface Proposition {
  id: string;
  nom: string;
  groupe: GroupeChoix;
  gamme: Gamme | null;
  prixMin: number;
  prixTypique: number;
  platsDansBudget: number;
  distanceKm: number | null;
  /** Phrases courtes et vérifiables qui expliquent pourquoi ce restaurant est proposé. */
  raisons: string[];
}

export function mediane(valeurs: readonly number[]): number {
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 === 1 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}

function formaterGnf(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} GNF`;
}

function arrondiDistance(km: number): string {
  return km < 1 ? "moins d'1 km" : `${(Math.round(km * 10) / 10).toLocaleString("fr-FR")} km`;
}

/** Évalue un candidat : `null` s'il ne peut pas être proposé. */
function evaluer(c: CandidatChoix, p: ParametresChoix): Proposition | null {
  if (!c.ouvert || !c.accepteCommandes) return null;
  const prix = c.prixPlats.filter((x) => Number.isFinite(x) && x > 0);
  if (prix.length === 0) return null; // sans prix, impossible de juger le budget
  // Position : une distance connue doit tenir dans le rayon ; sans distance, il faut au moins la même zone.
  if (c.distanceKm !== null) {
    if (c.distanceKm > p.rayonKm) return null;
  } else if (!c.memeZone) {
    return null;
  }
  const prixMin = Math.min(...prix);
  const plafond = Math.floor(p.budgetGnf * (1 + p.margeAuDessusPct / 100));
  const dansBudget = prix.filter((x) => x <= p.budgetGnf).length;
  let groupe: GroupeChoix;
  if (dansBudget > 0) groupe = "dans_budget";
  else if (prixMin <= plafond) groupe = "un_peu_au_dessus";
  else return null;

  const raisons: string[] = [];
  if (c.distanceKm !== null) raisons.push(`${c.distanceApprochee && c.distanceKm >= 1 ? "À environ" : "À"} ${arrondiDistance(c.distanceKm)} de vous`);
  else raisons.push("Dans votre zone");
  if (groupe === "dans_budget") raisons.push(`${dansBudget} plat${dansBudget > 1 ? "s" : ""} dans votre budget, dès ${formaterGnf(prixMin)}`);
  else raisons.push(`Plats dès ${formaterGnf(prixMin)}, soit ${formaterGnf(prixMin - p.budgetGnf)} de plus que votre budget`);
  if (c.noteMoyenne !== null) raisons.push(`Noté ${c.noteMoyenne.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sur ${c.avisTotal} avis`);

  return {
    id: c.id,
    nom: c.nom,
    groupe,
    gamme: c.gamme,
    prixMin,
    prixTypique: mediane(prix),
    platsDansBudget: dansBudget,
    distanceKm: c.distanceKm,
    raisons,
  };
}

const compare = (a: Proposition, b: Proposition): number =>
  a.prixTypique - b.prixTypique || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.id.localeCompare(b.id);

/**
 * Propositions du moins cher au plus huppé. Les restaurants « dans le budget » passent avant ceux « un peu au-dessus » ; à l'intérieur
 * d'un groupe, tri par prix typique croissant. Si la liste est plus longue que `max`, on retient en priorité le plus proche de chaque
 * gamme (tour à tour), pour que le client voie tout l'éventail et pas seulement les moins chers.
 */
export function proposer(candidats: readonly CandidatChoix[], params: ParametresChoix): Proposition[] {
  const evaluees = candidats.map((c) => evaluer(c, params)).filter((x): x is Proposition => x !== null);
  const max = Math.max(1, Math.floor(params.max));
  let retenues = evaluees;
  if (evaluees.length > max) {
    const parGamme = new Map<string, Proposition[]>();
    for (const e of evaluees) {
      const cle = e.groupe + ":" + (e.gamme ?? "inconnue");
      parGamme.set(cle, [...(parGamme.get(cle) ?? []), e]);
    }
    // Dans chaque paquet : le plus proche d'abord ; groupe « dans le budget » avant « au-dessus ».
    const paquets = [...parGamme.entries()]
      .sort(([a], [b]) => (a.startsWith("dans_budget") === b.startsWith("dans_budget") ? a.localeCompare(b) : a.startsWith("dans_budget") ? -1 : 1))
      .map(([, liste]) => [...liste].sort((x, y) => (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity) || x.prixTypique - y.prixTypique || x.id.localeCompare(y.id)));
    retenues = [];
    for (let tour = 0; retenues.length < max && paquets.some((p) => p.length > tour); tour++) {
      for (const p of paquets) {
        if (retenues.length >= max) break;
        if (p[tour]) retenues.push(p[tour]);
      }
    }
  }
  const ordreGroupe: Record<GroupeChoix, number> = { dans_budget: 0, un_peu_au_dessus: 1 };
  return retenues.sort((a, b) => ordreGroupe[a.groupe] - ordreGroupe[b.groupe] || compare(a, b));
}
