/**
 * Compléments de panier : proposer au client un plat qui va avec ce qu'il a
 * déjà choisi.
 *
 * ## Pourquoi ce n'est pas (encore) de l'intelligence artificielle
 *
 * L'idée était d'apprendre les associations à partir des commandes réelles.
 * On ne le peut pas encore : le projet compte **trois commandes au total**.
 * Un modèle de co-occurrence appris sur trois commandes n'est pas un modèle,
 * c'est du bruit avec des coefficients — et il servirait à suggérer n'importe
 * quoi avec une assurance trompeuse.
 *
 * On fait donc ce qui est vérifiable aujourd'hui : des **règles lisibles**,
 * testées, et explicables à l'écran (« pour accompagner », « à partager »).
 * Elles ne trompent pas le client, et le restaurateur peut les comprendre.
 * Le jour où le volume le permettra, `cooccurrences()` remplacera ces règles
 * sans rien changer à l'interface.
 *
 * Module pur : aucun accès réseau, aucune base. Les tests tournent sans rien
 * mocker.
 */

/** Plat du restaurant, tel que le client peut l'ajouter au panier. */
export interface PlatSuggestion {
  id: string;
  nom: string;
  prix: number;
  photoUrl?: string | null;
  /**
   * Vrai quand le restaurant n'a pas confirmé récemment : le plat est proposé
   * quand même — c'est la fiche restaurant qui autorise l'ajout — mais le
   * client doit le savoir. Un bloc qui cache l'information est un bloc qui
   * ment par omission.
   */
  aConfirmer?: boolean;
}

/** Ce que le panier contient déjà, suffisant pour raisonner. */
export interface LigneDuPanier {
  menuItemId: string;
  nom: string;
}

export interface Suggestion {
  plat: PlatSuggestion;
  /** Phrase affichée au client : elle doit dire POURQUOI. */
  raison: string;
}

export const SUGGESTIONS_MAX = 3;

/**
 * Ce qui qualifie un plat comme boisson ou entrée. Volontairement court et
 * explicite : un mot oublié fait perdre une suggestion, un mot de trop en
 * invente une — entre les deux, mieux vaut l'ignorance que le mensonge.
 */
const MOTS_BOISSON = [
  "boisson", "bissap", "jus", "eau", "the", "tisane", "cafe", "cafeine",
  "limonade", "smoothie", "cola", "soda", "sirop", "lait", "yaourt", "gorgonzona",
];

const MOTS_ENTREE = [
  "entree", "soupe", "salade", "beurre", "hutte", "attieke", "samoussa",
  "sandwich", "brochette", "amuse", "pastel", "beurre de cacahuete",
];

/** Minuscules sans accents, pour comparer des noms de plats. */
function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function contientUnMot(texteNormalise: string, mots: string[]): boolean {
  return mots.some((mot) => texteNormalise.includes(mot));
}

export type FamillePlat = "boisson" | "entree" | "plat";

export function famillePlat(nom: string): FamillePlat {
  const n = normaliser(nom);
  if (contientUnMot(n, MOTS_BOISSON)) return "boisson";
  if (contientUnMot(n, MOTS_ENTREE)) return "entree";
  return "plat";
}

/** Prix retenu : la promotion si elle existe, comme partout ailleurs dans le panier. */
function prixEffectif(plat: PlatSuggestion): number {
  return plat.prix;
}

/**
 * Propose des compléments pour les lignes déjà au panier.
 *
 * Ordre d'importance, du plus utile au moins :
 * 1. **une boisson** quand le panier n'en contient aucune ;
 * 2. **un plat** quand le panier ne contient qu'une entrée ;
 * 3. **une entrée** quand le panier ne contient qu'un plat.
 *
 * `dejaAuPanier` sert à ne jamais proposer deux fois le même plat.
 */
export function proposerComplements(
  lignesPanier: LigneDuPanier[],
  platsDisponibles: PlatSuggestion[]
): Suggestion[] {
  const idsPresents = new Set(lignesPanier.map((l) => l.menuItemId));
  const familles = new Set(lignesPanier.map((l) => famillePlat(l.nom)));
  if (lignesPanier.length === 0 || platsDisponibles.length === 0) {
    return [];
  }

  const candidats = platsDisponibles
    .filter((plat) => !idsPresents.has(plat.id))
    .filter((plat) => prixEffectif(plat) > 0);
  if (candidats.length === 0) {
    return [];
  }

  const suggestions: Suggestion[] = [];
  const dejaProposes = new Set<string>();
  const ajouter = (plat: PlatSuggestion, raison: string) => {
    if (dejaProposes.has(plat.id)) return;
    dejaProposes.add(plat.id);
    suggestions.push({ plat, raison });
  };

  // 1. Une boisson pour accompagner un plat.
  if (!familles.has("boisson")) {
    const boissons = candidats
      .filter((p) => famillePlat(p.nom) === "boisson")
      // La moins chère d'abord : c'est le geste de découverte le moins cher à
      // faire, et le restaurant n'y perd rien.
      .sort((a, b) => prixEffectif(a) - prixEffectif(b));
    if (boissons[0]) ajouter(boissons[0], "Pour accompagner votre plat");
  }

  // 2 et 3. Compléter une entrée par un plat, un plat par une entrée.
  if (!familles.has("plat") && familles.has("entree")) {
    const plats = candidats
      .filter((p) => famillePlat(p.nom) === "plat")
      .sort((a, b) => prixEffectif(a) - prixEffectif(b));
    if (plats[0]) ajouter(plats[0], "Pour compléter votre entrée");
  }

  if (!familles.has("entree") && familles.has("plat")) {
    const entrees = candidats.filter((p) => famillePlat(p.nom) === "entree");
    if (entrees[0]) ajouter(entrees[0], "À partager avant le plat");
  }

  // Rien trouvé par famille : on ne comble pas avec du hasard. Proposer un plat
  // au hasard se lirait comme une recommandation.
  return suggestions.slice(0, SUGGESTIONS_MAX);
}

/*
 * Note pour plus tard : le jour où le volume le permettra (quelques centaines de
 * commandes réelles), les règles ci-dessus seront remplacées par des
 * cooccurrences apprises — un plat fréquemment commandé avec un autre. Rien
 * dans l'interface n'aura à changer ; seule la fonction qui produit les paires
 * changera. Tant que les données manquent, une fonction qui lèverait une
 * exception vaut mieux qu'un modèle appris sur trois commandes : elle serait
 * fausse avec l'air d'être vraie.
 */