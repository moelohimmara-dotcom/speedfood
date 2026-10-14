/**
 * Catalogue des « emplacements » de contenu du site public (Studio, palier 1) : chaque texte simple d'une page est un
 * emplacement nommé (clé `page.zone.nom`) avec sa valeur par défaut dans le code. Une ligne de `contenu_emplacements` la
 * remplace ; sans ligne, c'est le défaut. Module PUR (aucun import serveur) : utilisé par le site, la console et les tests.
 *
 * Texte brut uniquement : React échappe tout, aucune balise n'est interprétée. Les textes déjà éditables ailleurs
 * (signature et sous-titre de l'accueil : `parametres_application`, voir `lib/parametres/promesse.ts`) ne sont PAS
 * dupliqués ici.
 *
 * Les espaces insécables (U+00A0) des défauts sont voulus (ponctuation française) : ne pas les remplacer par des espaces.
 */

export interface Emplacement {
  /** Clé stable, `^[a-z0-9_.]{3,80}$` (miroir du CHECK de la table). */
  readonly cle: string;
  /** Groupe d'affichage dans la console (une section par groupe). */
  readonly groupe: string;
  /** Libellé lisible, avec l'endroit de la page où le texte apparaît. */
  readonly libelle: string;
  /** Texte affiché tant qu'aucune surcharge n'existe. */
  readonly defaut: string;
  /** Longueur maximale d'une surcharge (200 par défaut, voir `LONGUEUR_MAX_DEFAUT`). */
  readonly max?: number;
  /** Champ sur plusieurs lignes dans la console (phrases longues). */
  readonly multiligne?: boolean;
}

export const LONGUEUR_MAX_DEFAUT = 200;

const HAUT = "Accueil : haut de page";
const VIDE = "Accueil : si aucun restaurant n'est ouvert";
const CARTE = "Accueil : restaurants à la une";
const QUARTIERS = "Accueil : quartiers";
const ETAPES = "Accueil : les quatre étapes";
const SUIVI = "Accueil : suivi de commande";
const PRO = "Accueil : bande restaurateurs";

export const EMPLACEMENTS = [
  // --- Haut de page ---
  { cle: "accueil.hero.titre", groupe: HAUT, libelle: "Titre de la page (h1)", defaut: "Les restaurants de votre localité, sur Speedfood.", max: 120 },
  { cle: "accueil.hero.bouton_commander", groupe: HAUT, libelle: "Bouton principal", defaut: "Voir les restaurants", max: 40 },
  { cle: "accueil.hero.lien_localites", groupe: HAUT, libelle: "Bouton secondaire (vers les localités)", defaut: "Explorer les localités", max: 40 },
  {
    cle: "accueil.hero.preuve_question",
    groupe: HAUT,
    libelle: "Phrase sous les boutons, partie question",
    defaut: "Disponibilité :",
    max: 120,
  },
  { cle: "accueil.hero.preuve_reponse", groupe: HAUT, libelle: "Phrase sous les boutons, partie surlignée", defaut: "vérifiez quand le restaurant a confirmé le plat.", max: 80 },
  {
    cle: "accueil.hero.encart_aria",
    groupe: HAUT,
    libelle: "Encart « idée de plat », intitulé pour les lecteurs d'écran",
    defaut: "Une idée de plat",
    max: 80,
  },
  {
    cle: "accueil.hero.macaron",
    groupe: HAUT,
    libelle: "Macaron (autocollant) sous l'idée de plat",
    defaut: "Consultez l'heure à laquelle le restaurant a confirmé chaque plat.",
    max: 120,
  },
  {
    cle: "accueil.hero.pilote",
    groupe: HAUT,
    libelle: "Mention de phase pilote (à retirer quand la couverture change)",
    defaut: "Phase pilote : les commandes sont actuellement disponibles dans certaines zones de Conakry. D'autres localités seront ajoutées progressivement.",
    max: 240,
    multiligne: true,
  },
  // --- Aucun restaurant ouvert ---
  { cle: "accueil.vide.kicker", groupe: VIDE, libelle: "Petit titre", defaut: "En ce moment", max: 60 },
  { cle: "accueil.vide.titre", groupe: VIDE, libelle: "Message principal", defaut: "Aucun restaurant n'est ouvert pour l'instant.", max: 160 },
  {
    cle: "accueil.vide.texte",
    groupe: VIDE,
    libelle: "Message secondaire",
    defaut: "Revenez un peu plus tard, ou découvrez les cartes en attendant.",
    max: 240,
    multiligne: true,
  },
  // --- Restaurants à la une ---
  { cle: "accueil.carte.kicker_ouverts", groupe: CARTE, libelle: "Petit titre quand au moins trois restaurants sont ouverts", defaut: "Ouverts en ce moment", max: 60 },
  { cle: "accueil.carte.kicker_catalogue", groupe: CARTE, libelle: "Petit titre sinon", defaut: "Au catalogue", max: 60 },
  { cle: "accueil.carte.titre_debut", groupe: CARTE, libelle: "Titre, début", defaut: "Découvrez les restaurants", max: 100 },
  { cle: "accueil.carte.titre_surligne", groupe: CARTE, libelle: "Titre, partie surlignée", defaut: "disponibles dans votre zone", max: 80 },
  { cle: "accueil.carte.bouton_tous", groupe: CARTE, libelle: "Bouton vers la liste des restaurants", defaut: "Tous les restaurants", max: 40 },
  // --- Quartiers ---
  { cle: "accueil.quartiers.kicker", groupe: QUARTIERS, libelle: "Petit titre", defaut: "Explorez la Guinée", max: 60 },
  { cle: "accueil.quartiers.titre", groupe: QUARTIERS, libelle: "Titre", defaut: "Choisissez une localité", max: 100 },
  // --- Quatre étapes ---
  { cle: "accueil.etapes.kicker", groupe: ETAPES, libelle: "Petit titre", defaut: "Quatre étapes", max: 60 },
  { cle: "accueil.etapes.titre_debut", groupe: ETAPES, libelle: "Titre, début", defaut: "De la recherche à", max: 80 },
  { cle: "accueil.etapes.titre_surligne", groupe: ETAPES, libelle: "Titre, partie surlignée", defaut: "la commande", max: 60 },
  { cle: "accueil.etapes.choisir_titre", groupe: ETAPES, libelle: "Étape 1, titre", defaut: "Choisissez votre zone", max: 40 },
  {
    cle: "accueil.etapes.choisir_texte",
    groupe: ETAPES,
    libelle: "Étape 1, texte",
    defaut: "Sélectionnez une localité pour trouver les restaurants référencés dans votre zone.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.commander_titre", groupe: ETAPES, libelle: "Étape 2, titre", defaut: "Consultez les menus", max: 40 },
  {
    cle: "accueil.etapes.commander_texte",
    groupe: ETAPES,
    libelle: "Étape 2, texte",
    defaut: "Vérifiez les plats proposés, leur heure de confirmation et les informations du restaurant.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.suivre_titre", groupe: ETAPES, libelle: "Étape 3, titre", defaut: "Envoyez votre commande", max: 40 },
  {
    cle: "accueil.etapes.suivre_texte",
    groupe: ETAPES,
    libelle: "Étape 3, texte",
    defaut: "Ajoutez vos plats au panier et connectez-vous pour transmettre la commande au restaurant.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.recevoir_titre", groupe: ETAPES, libelle: "Étape 4, titre", defaut: "Suivez et recevez votre commande", max: 40 },
  {
    cle: "accueil.etapes.recevoir_texte",
    groupe: ETAPES,
    libelle: "Étape 4, texte",
    defaut: "Consultez les mises à jour. Le restaurant précise les options de retrait ou de livraison disponibles.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.bouton_detail", groupe: ETAPES, libelle: "Bouton vers le détail", defaut: "Voir le détail du fonctionnement", max: 40 },
  // --- Suivi de commande ---
  { cle: "accueil.suivi.kicker", groupe: SUIVI, libelle: "Petit titre", defaut: "Votre commande, étape par étape", max: 60 },
  { cle: "accueil.suivi.titre_debut", groupe: SUIVI, libelle: "Titre, début", defaut: "Suivez les mises à jour", max: 80 },
  { cle: "accueil.suivi.titre_surligne", groupe: SUIVI, libelle: "Titre, partie surlignée", defaut: "du restaurant", max: 60 },
  {
    cle: "accueil.suivi.texte",
    groupe: SUIVI,
    libelle: "Texte d'explication",
    defaut:
      "Un lien vous permet de consulter le statut de votre commande : en attente, acceptée, prête ou terminée. Le statut évolue lorsque le restaurant le met à jour. Vous réglez directement auprès du restaurant, selon les moyens de paiement qu'il accepte.",
    max: 400,
    multiligne: true,
  },
  // --- Bande restaurateurs ---
  { cle: "accueil.pro.kicker", groupe: PRO, libelle: "Petit titre", defaut: "Vous êtes restaurateur ?", max: 80 },
  { cle: "accueil.pro.titre_debut", groupe: PRO, libelle: "Titre, début", defaut: "Présentez votre restaurant", max: 100 },
  { cle: "accueil.pro.titre_surligne", groupe: PRO, libelle: "Titre, partie surlignée", defaut: "sur Speedfood", max: 80 },
  {
    cle: "accueil.pro.texte",
    groupe: PRO,
    libelle: "Texte d'explication",
    defaut: "Créez votre fiche et indiquez votre localité. Après vérification, les clients pourront consulter votre menu et vous envoyer leurs commandes. Vous encaissez directement auprès de vos clients.",
    max: 300,
    multiligne: true,
  },
  { cle: "accueil.pro.bouton", groupe: PRO, libelle: "Bouton", defaut: "Devenir partenaire", max: 40 },
] as const satisfies readonly Emplacement[];

export type CleEmplacement = (typeof EMPLACEMENTS)[number]["cle"];

/** Longueur maximale effective d'une surcharge pour cet emplacement. */
export function longueurMax(e: Emplacement): number {
  return e.max ?? LONGUEUR_MAX_DEFAUT;
}

/** Valeurs par défaut de tout le catalogue. */
export function defauts(): Record<CleEmplacement, string> {
  return Object.fromEntries(EMPLACEMENTS.map((e) => [e.cle, e.defaut])) as Record<CleEmplacement, string>;
}

/**
 * Valeur effective de chaque emplacement du catalogue : la surcharge si elle n'est pas vide après `trim` et ne dépasse pas
 * `max`, sinon le défaut. Une clé inconnue du catalogue (restée en base) est ignorée. La surcharge renvoyée est rognée.
 */
export function resoudre(surcharges: Record<string, string>): Record<CleEmplacement, string> {
  const resultat = defauts();
  for (const e of EMPLACEMENTS) {
    const brut = Object.prototype.hasOwnProperty.call(surcharges, e.cle) ? surcharges[e.cle] : undefined;
    if (typeof brut !== "string") continue;
    const valeur = brut.trim();
    if (valeur.length > 0 && valeur.length <= longueurMax(e)) {
      resultat[e.cle] = valeur;
    }
  }
  return resultat;
}

/** Contrôle d'une saisie de console : `null` si valide, sinon le message à afficher. Pas de balises, pas de dépassement. */
export function erreurSaisie(e: Emplacement, valeurRognee: string): string | null {
  if (/<[a-zA-Z/]/.test(valeurRognee)) return "Les balises HTML ne sont pas permises";
  if (valeurRognee.length > longueurMax(e)) return `${longueurMax(e)} caractères au maximum`;
  return null;
}

export type DecisionChamp = "rien" | "enregistrer" | "retablir" | "conflit";

/** Normalise une saisie de console : sauts de ligne selon le type de champ, puis rognage. */
export function normaliserSaisie(e: Emplacement, brut: string): string {
  return (e.multiligne ? brut.replace(/\r\n/g, "\n") : brut.replace(/\s*[\r\n]+\s*/g, " ")).trim();
}

/**
 * Décision pour UN champ d'un groupe enregistré. Valeurs « effectives » : la surcharge, sinon le défaut.
 * - `saisie` : ce que l'éditeur envoie (déjà normalisée) ; vide = retour au défaut ;
 * - `initiale` : valeur effective que l'éditeur voyait à l'ouverture (vient du navigateur : sert UNIQUEMENT à savoir si le
 *   champ a été touché et à détecter un conflit, jamais à valider) ;
 * - `enBase` : surcharge actuelle en base (`null` si aucune).
 * Un champ non touché n'est jamais écrit (un autre éditeur a pu le modifier entre-temps) ; un champ touché dont la valeur en
 * base a changé depuis l'ouverture, vers autre chose que la saisie, est un conflit : rien n'est écrasé.
 */
export function decider(saisie: string, initiale: string, enBase: string | null, defaut: string): DecisionChamp {
  const effSaisie = saisie === "" ? defaut : saisie;
  if (effSaisie === initiale) return "rien";
  const effBase = enBase ?? defaut;
  if (effBase === effSaisie) return "rien";
  if (effBase !== initiale) return "conflit";
  return effSaisie === defaut ? "retablir" : "enregistrer";
}
