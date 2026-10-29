// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Bloc « Décision » de la fiche restaurant (refonte du 17 octobre 2026) : ce que l'on propose à l'administrateur selon l'état du restaurant.
 * Principe : UNE action principale, celle qui fait avancer ; jamais un bouton grisé sans solution (« Approuver » n'apparaît que lorsqu'il est possible,
 * sinon on montre le point à régler et le moyen de le régler) ; les actions graves restent à l'écart (« Plus d'actions »).
 * Le serveur revérifie toujours les droits et les conditions : ceci ne décide que de l'affichage.
 */
export interface PointBloquant {
  cle: string;
  libelle: string;
  detail: string;
}

export interface EntreeDecision {
  publie: boolean;
  suspendu: boolean;
  correctionEnCours: boolean;
  bloquants: PointBloquant[];
  /** Un compte propriétaire est rattaché : sans lui, personne ne lirait une demande de correction. */
  aProprietaire: boolean;
}

export type ActionPrincipale = "reactiver" | "regler" | "approuver" | "aucune";
export type TonDecision = "attention" | "succes" | "danger" | "neutre";

export interface CibleBlocage {
  cta: string;
  href: string;
}

export interface SortieDecision {
  etat: { libelle: string; ton: TonDecision };
  phrase: string;
  action: ActionPrincipale;
  /** Le premier point à régler, avec le moyen de le régler (action « regler » seulement). */
  premierBlocage: (PointBloquant & CibleBlocage) | null;
  /** « Demander une correction » : visible sous l'action principale. */
  correctionVisible: boolean;
  /** « Demander une correction » : rangée dans « Plus d'actions » (quand il y a d'abord un point à régler). */
  correctionDansPlus: boolean;
  suspensionVisible: boolean;
  /** Résumé de la barre fixe sur téléphone. */
  barre: { titre: string; sous: string; ton: TonDecision };
}

/** Où régler un point bloquant : l'ancre de la page qui permet de le faire. */
export function cibleBlocage(cle: string): CibleBlocage {
  switch (cle) {
    case "proprietaire":
      return { cta: "Rattacher un propriétaire", href: "#equipe" };
    case "horaires":
      return { cta: "Renseigner les horaires", href: "#administration-restaurant" };
    default:
      return { cta: "Voir le dossier", href: "#dossier" };
  }
}

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

export function decision(e: EntreeDecision): SortieDecision {
  if (e.suspendu) {
    return {
      etat: { libelle: "Suspendu", ton: "danger" },
      phrase: "Suspendu : invisible des clients tant qu'il n'est pas réactivé.",
      action: "reactiver",
      premierBlocage: null,
      correctionVisible: false,
      correctionDansPlus: false,
      suspensionVisible: false,
      barre: { titre: "Suspendu", sous: "À réactiver ?", ton: "danger" },
    };
  }

  const besoinApprobation = !e.publie || e.correctionEnCours;
  if (!besoinApprobation) {
    return {
      etat: { libelle: "En ligne", ton: "succes" },
      phrase: "En ligne : visible des clients.",
      action: "aucune",
      premierBlocage: null,
      correctionVisible: e.aProprietaire,
      correctionDansPlus: false,
      suspensionVisible: true,
      barre: { titre: "En ligne", sous: "Aucune décision en attente", ton: "succes" },
    };
  }

  const etat = e.correctionEnCours ? { libelle: "Correction demandée", ton: "attention" as const } : { libelle: "En attente", ton: "attention" as const };

  if (e.bloquants.length > 0) {
    const premier = e.bloquants[0];
    const n = e.bloquants.length;
    return {
      etat,
      phrase: e.correctionEnCours ? "En attente d'une correction du restaurateur." : "En attente de votre décision : invisible des clients.",
      action: "regler",
      premierBlocage: { ...premier, ...cibleBlocage(premier.cle) },
      correctionVisible: false,
      correctionDansPlus: e.aProprietaire,
      suspensionVisible: true,
      barre: { titre: `${n} ${pluriel(n, "point à régler", "points à régler")}`, sous: premier.libelle, ton: "attention" },
    };
  }

  return {
    etat: e.correctionEnCours ? etat : { libelle: "Prêt à publier", ton: "succes" },
    phrase: "Le dossier est complet. Le restaurant devient visible et peut recevoir des commandes.",
    action: "approuver",
    premierBlocage: null,
    correctionVisible: e.aProprietaire,
    correctionDansPlus: false,
    suspensionVisible: true,
    barre: { titre: "Prêt à publier", sous: "Dossier complet", ton: "succes" },
  };
}
