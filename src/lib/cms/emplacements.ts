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
const CARTE = "Accueil : restaurants à la une";
const ENVIES = "Accueil : plats de la zone";
const QUARTIERS = "Accueil : explorer les localités";
const FAQ = "Accueil : questions fréquentes";
const ETAPES = "Accueil : les quatre étapes";
const SUIVI = "Accueil : suivi de commande";
const PRO = "Accueil : bande restaurateurs";

export const EMPLACEMENTS = [
  // --- Haut de page ---
  { cle: "accueil.hero.titre", groupe: HAUT, libelle: "Titre principal", defaut: "Les restaurants de votre localité, sur Speedfood.", max: 140 },
  { cle: "accueil.hero.recherche_libelle", groupe: HAUT, libelle: "Recherche de localité : intitulé du champ", defaut: "Votre localité", max: 60 },
  {
    cle: "accueil.hero.recherche_placeholder",
    groupe: HAUT,
    libelle: "Recherche de localité : exemple dans le champ",
    defaut: "Commune ou quartier : Kaloum, Ratoma, Hafia…",
    max: 100,
  },
  { cle: "accueil.hero.recherche_bouton", groupe: HAUT, libelle: "Recherche de localité : bouton", defaut: "Voir les restaurants", max: 40 },
  {
    cle: "accueil.hero.pilote",
    groupe: HAUT,
    libelle: "Mention de la phase pilote (couverture réelle)",
    defaut: "Phase pilote : les restaurants sont aujourd'hui référencés à Conakry. D'autres localités s'ajoutent avec les restaurants qui s'inscrivent.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.hero.bouton_fonctionnement", groupe: HAUT, libelle: "Bouton secondaire", defaut: "Comment ça marche", max: 40 },
  {
    cle: "accueil.hero.preuve_question",
    groupe: HAUT,
    libelle: "Phrase sous les boutons, partie question",
    defaut: "Ce plat est-il vraiment disponible ?",
    max: 120,
  },
  { cle: "accueil.hero.preuve_reponse", groupe: HAUT, libelle: "Phrase sous les boutons, partie surlignée", defaut: "L'heure le dit.", max: 80 },
  {
    cle: "accueil.hero.macaron",
    groupe: HAUT,
    libelle: "Macaron (autocollant) sous l'idée de plat",
    defaut: "Chaque plat porte son heure de confirmation",
    max: 120,
  },
  // --- Plats de la zone ---
  { cle: "accueil.envies.kicker", groupe: ENVIES, libelle: "Petit titre", defaut: "Plats disponibles", max: 60 },
  { cle: "accueil.envies.titre", groupe: ENVIES, libelle: "Titre", defaut: "Qu'avez-vous envie de manger ?", max: 100 },
  // --- Restaurants à la une ---
  { cle: "accueil.carte.kicker_ouverts", groupe: CARTE, libelle: "Petit titre quand au moins trois restaurants sont ouverts", defaut: "Ouverts en ce moment", max: 60 },
  { cle: "accueil.carte.kicker_catalogue", groupe: CARTE, libelle: "Petit titre sinon", defaut: "Au catalogue", max: 60 },
  { cle: "accueil.carte.titre_debut", groupe: CARTE, libelle: "Titre sans zone choisie, début", defaut: "Restaurants disponibles", max: 100 },
  { cle: "accueil.carte.titre_surligne", groupe: CARTE, libelle: "Titre sans zone choisie, partie surlignée", defaut: "en ce moment", max: 80 },
  { cle: "accueil.carte.titre_zone", groupe: CARTE, libelle: "Titre avec zone choisie (le nom de la zone suit)", defaut: "Restaurants disponibles à", max: 100 },
  { cle: "accueil.carte.bouton_tous", groupe: CARTE, libelle: "Bouton vers la liste des restaurants", defaut: "Tous les restaurants", max: 40 },
  { cle: "accueil.carte.bouton_zone", groupe: CARTE, libelle: "Bouton vers les restaurants de la zone", defaut: "Voir tous les restaurants de cette zone", max: 60 },
  {
    cle: "accueil.carte.vide_titre",
    groupe: CARTE,
    libelle: "Zone sans restaurant : message principal",
    defaut: "Aucun restaurant n'est encore référencé ici.",
    max: 160,
  },
  {
    cle: "accueil.carte.vide_texte",
    groupe: CARTE,
    libelle: "Zone sans restaurant : message secondaire",
    defaut: "Choisissez une localité voisine ci-dessous, ou parcourez tous les restaurants.",
    max: 240,
    multiligne: true,
  },
  // --- Quartiers ---
  { cle: "accueil.quartiers.kicker", groupe: QUARTIERS, libelle: "Petit titre", defaut: "Explorer les localités", max: 60 },
  { cle: "accueil.quartiers.titre", groupe: QUARTIERS, libelle: "Titre", defaut: "Choisissez une localité", max: 100 },
  {
    cle: "accueil.quartiers.texte",
    groupe: QUARTIERS,
    libelle: "Texte d'explication",
    defaut: "Cherchez ici, ou ailleurs que là où vous êtes. Communes et quartiers où des restaurants sont référencés ; les autres arrivent avec les inscriptions.",
    max: 300,
    multiligne: true,
  },
  // --- Quatre étapes ---
  { cle: "accueil.etapes.kicker", groupe: ETAPES, libelle: "Petit titre", defaut: "Comment ça marche", max: 60 },
  { cle: "accueil.etapes.titre_debut", groupe: ETAPES, libelle: "Titre, début", defaut: "De la recherche à", max: 80 },
  { cle: "accueil.etapes.titre_surligne", groupe: ETAPES, libelle: "Titre, partie surlignée", defaut: "la commande", max: 60 },
  { cle: "accueil.etapes.choisir_titre", groupe: ETAPES, libelle: "Étape 1, titre", defaut: "Choisir une zone", max: 40 },
  {
    cle: "accueil.etapes.choisir_texte",
    groupe: ETAPES,
    libelle: "Étape 1, texte",
    defaut: "Indiquez votre localité : vous ne voyez que les restaurants et les plats qui s'y trouvent, avec l'heure de confirmation de chaque plat.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.commander_titre", groupe: ETAPES, libelle: "Étape 2, titre", defaut: "Consulter et commander", max: 40 },
  {
    cle: "accueil.etapes.commander_texte",
    groupe: ETAPES,
    libelle: "Étape 2, texte",
    defaut: "Parcourez les menus, remplissez le panier, connectez-vous en quelques secondes, envoyez. Le restaurant sait qui commande.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.suivre_titre", groupe: ETAPES, libelle: "Étape 3, titre", defaut: "Suivre", max: 40 },
  {
    cle: "accueil.etapes.suivre_texte",
    groupe: ETAPES,
    libelle: "Étape 3, texte",
    defaut: "Votre lien privé affiche les mises à jour du restaurant : en attente, acceptée, prête ou terminée.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.recevoir_titre", groupe: ETAPES, libelle: "Étape 4, titre", defaut: "Retirer ou se faire livrer", max: 40 },
  {
    cle: "accueil.etapes.recevoir_texte",
    groupe: ETAPES,
    libelle: "Étape 4, texte",
    defaut: "Retrait ou livraison : le restaurant précise ses conditions. Vous le réglez directement, en espèces ou par son code marchand.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.bouton_detail", groupe: ETAPES, libelle: "Bouton vers le détail", defaut: "Voir le détail", max: 40 },
  // --- Suivi de commande ---
  { cle: "accueil.suivi.kicker", groupe: SUIVI, libelle: "Petit titre", defaut: "Suivi et paiement", max: 60 },
  { cle: "accueil.suivi.titre_debut", groupe: SUIVI, libelle: "Titre, début", defaut: "Suivez les mises à jour", max: 80 },
  { cle: "accueil.suivi.titre_surligne", groupe: SUIVI, libelle: "Titre, partie surlignée", defaut: "du restaurant", max: 60 },
  {
    cle: "accueil.suivi.texte",
    groupe: SUIVI,
    libelle: "Texte d'explication",
    defaut:
      "Votre lien privé affiche l'état de la commande tel que le restaurant le met à jour, de « en attente » à « terminée ». Vous réglez directement avec le restaurant. Voici un exemple avec un restaurant réellement ouvert.",
    max: 400,
    multiligne: true,
  },
  // --- Bande restaurateurs ---
  { cle: "accueil.pro.kicker", groupe: PRO, libelle: "Petit titre", defaut: "Vous tenez un restaurant ?", max: 80 },
  { cle: "accueil.pro.titre_debut", groupe: PRO, libelle: "Titre, début", defaut: "Présentez votre restaurant", max: 100 },
  { cle: "accueil.pro.titre_surligne", groupe: PRO, libelle: "Titre, partie surlignée", defaut: "sur Speedfood", max: 80 },
  {
    cle: "accueil.pro.texte",
    groupe: PRO,
    libelle: "Texte d'explication",
    defaut: "Créez votre fiche, nous la vérifions, indiquez votre localité, publiez votre menu et recevez les commandes de clients identifiés. Vous gardez la main sur votre menu et vos horaires.",
    max: 300,
    multiligne: true,
  },
  { cle: "accueil.pro.bouton", groupe: PRO, libelle: "Bouton", defaut: "Devenir partenaire", max: 40 },
  // --- Questions fréquentes ---
  { cle: "accueil.faq.kicker", groupe: FAQ, libelle: "Petit titre", defaut: "Avant de commander", max: 60 },
  { cle: "accueil.faq.titre", groupe: FAQ, libelle: "Titre", defaut: "Les questions qui comptent", max: 100 },
  { cle: "accueil.faq.bouton", groupe: FAQ, libelle: "Bouton vers l'aide", defaut: "Toutes les réponses", max: 40 },
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
