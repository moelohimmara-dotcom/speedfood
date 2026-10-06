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
  { cle: "accueil.hero.titre_debut", groupe: HAUT, libelle: "Titre, début (avant le mot qui change)", defaut: "Une envie de", max: 80 },
  { cle: "accueil.hero.titre_fin", groupe: HAUT, libelle: "Titre, fin (après le mot qui change)", defaut: "Speedfood s'en occupe.", max: 120 },
  {
    cle: "accueil.hero.titre_lecteur",
    groupe: HAUT,
    libelle: "Titre complet lu par les lecteurs d'écran (phrase stable, sans le mot qui change)",
    defaut: "Une envie d'un bon plat ? Speedfood s'en occupe.",
    max: 200,
  },
  { cle: "accueil.hero.bouton_commander", groupe: HAUT, libelle: "Bouton principal", defaut: "Je commande", max: 40 },
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
    defaut: "Chaque plat porte son heure de confirmation",
    max: 120,
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
  { cle: "accueil.carte.titre_debut", groupe: CARTE, libelle: "Titre, début", defaut: "Des tables de quartier,", max: 100 },
  { cle: "accueil.carte.titre_surligne", groupe: CARTE, libelle: "Titre, partie surlignée", defaut: "pas des enseignes", max: 80 },
  { cle: "accueil.carte.bouton_tous", groupe: CARTE, libelle: "Bouton vers la liste des restaurants", defaut: "Tous les restaurants", max: 40 },
  // --- Quartiers ---
  { cle: "accueil.quartiers.kicker", groupe: QUARTIERS, libelle: "Petit titre", defaut: "Où nous trouver", max: 60 },
  { cle: "accueil.quartiers.titre", groupe: QUARTIERS, libelle: "Titre", defaut: "Votre quartier d'abord", max: 100 },
  // --- Quatre étapes ---
  { cle: "accueil.etapes.kicker", groupe: ETAPES, libelle: "Petit titre", defaut: "Quatre étapes", max: 60 },
  { cle: "accueil.etapes.titre_debut", groupe: ETAPES, libelle: "Titre, début", defaut: "Du choix à", max: 80 },
  { cle: "accueil.etapes.titre_surligne", groupe: ETAPES, libelle: "Titre, partie surlignée", defaut: "l'assiette", max: 60 },
  { cle: "accueil.etapes.choisir_titre", groupe: ETAPES, libelle: "Étape 1, titre", defaut: "Choisir", max: 40 },
  {
    cle: "accueil.etapes.choisir_texte",
    groupe: ETAPES,
    libelle: "Étape 1, texte",
    defaut: "Un restaurant de votre quartier, un plat, et l'heure à laquelle le restaurant l'a confirmé.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.commander_titre", groupe: ETAPES, libelle: "Étape 2, titre", defaut: "Commander", max: 40 },
  {
    cle: "accueil.etapes.commander_texte",
    groupe: ETAPES,
    libelle: "Étape 2, texte",
    defaut: "Vous remplissez le panier et vous envoyez. Nom, téléphone, adresse : c'est tout.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.suivre_titre", groupe: ETAPES, libelle: "Étape 3, titre", defaut: "Suivre", max: 40 },
  {
    cle: "accueil.etapes.suivre_texte",
    groupe: ETAPES,
    libelle: "Étape 3, texte",
    defaut: "Un lien de suivi vous dit si la commande est en attente, acceptée, prête ou terminée.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.recevoir_titre", groupe: ETAPES, libelle: "Étape 4, titre", defaut: "Recevoir", max: 40 },
  {
    cle: "accueil.etapes.recevoir_texte",
    groupe: ETAPES,
    libelle: "Étape 4, texte",
    defaut: "Retrait ou livraison selon le restaurant. Vous réglez directement avec lui.",
    max: 240,
    multiligne: true,
  },
  { cle: "accueil.etapes.bouton_detail", groupe: ETAPES, libelle: "Bouton vers le détail", defaut: "Voir le détail", max: 40 },
  // --- Suivi de commande ---
  { cle: "accueil.suivi.kicker", groupe: SUIVI, libelle: "Petit titre", defaut: "Votre commande, en direct", max: 60 },
  { cle: "accueil.suivi.titre_debut", groupe: SUIVI, libelle: "Titre, début", defaut: "Vous savez toujours", max: 80 },
  { cle: "accueil.suivi.titre_surligne", groupe: SUIVI, libelle: "Titre, partie surlignée", defaut: "où elle en est", max: 60 },
  {
    cle: "accueil.suivi.texte",
    groupe: SUIVI,
    libelle: "Texte d'explication",
    defaut:
      "Après l'envoi, un lien de suivi vous dit si la commande est en attente, acceptée, prête ou terminée. Voici un exemple, avec les plats d'un restaurant ouvert.",
    max: 400,
    multiligne: true,
  },
  // --- Bande restaurateurs ---
  { cle: "accueil.pro.kicker", groupe: PRO, libelle: "Petit titre", defaut: "Vous tenez un restaurant ?", max: 80 },
  { cle: "accueil.pro.titre_debut", groupe: PRO, libelle: "Titre, début", defaut: "Votre carte en ligne,", max: 100 },
  { cle: "accueil.pro.titre_surligne", groupe: PRO, libelle: "Titre, partie surlignée", defaut: "sans intermédiaire de paiement", max: 80 },
  {
    cle: "accueil.pro.texte",
    groupe: PRO,
    libelle: "Texte d'explication",
    defaut: "Créez votre fiche, nous la contrôlons, vos clients du quartier la trouvent. Vous encaissez directement.",
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
