/**
 * Journal des mises à jour livrées (octobre 2026), affiché dans `/system/mises-a-jour`. Fichier sans "use server" : c'est un catalogue.
 * `cle` relie une mise à jour à son interrupteur (table `fonctionnalites`) ; sans `cle`, la mise à jour n'est pas coupable à chaud
 * (parcours de l'argent, sécurité ou pur habillage) et la page l'indique clairement avec la raison.
 */
export interface MiseAJour {
  id: string;
  date: string;
  titre: string;
  resume: string;
  /** Interrupteur associé, s'il existe. */
  cle?: string;
  /** Pourquoi il n'y a pas d'interrupteur. */
  sansInterrupteur?: string;
  /** Comment vérifier que la mise à jour fonctionne (écran ou page à ouvrir). */
  verification: string;
}

export const MISES_A_JOUR: readonly MiseAJour[] = [
  {
    id: "envie-scenes",
    date: "2026-10-06",
    titre: "Bloc « Votre envie du moment ? » : scènes vectorielles animées",
    resume: "Quatre scènes (riz, grillades, fast-food, café) qui défilent au rythme des puces ; macaron replacé au-dessus de la carte.",
    cle: "scenes_envie_accueil",
    verification: "Accueil du site public : le bloc de droite du premier écran.",
  },
  {
    id: "animations-public",
    date: "2026-10-05",
    titre: "Couche d'animations du site public",
    resume: "Accroches qui tournent, macarons flottants, confettis, frises de suivi, illustrations vectorielles animées, interrupteur de pause dans le pied.",
    cle: "animations_public",
    verification: "Accueil, Restaurants, Aide, À propos : les boucles tournent ; le pied de page propose la pause.",
  },
  {
    id: "commande-a-table",
    date: "2026-10-05",
    titre: "Commande à table",
    resume: "Mode « à table » avec numéro de table, QR par table, filtre dédié dans la console restaurant.",
    cle: "commande_a_table",
    verification: "Fiche d'un restaurant avec « à table » activé : le choix du mode apparaît dans le panier.",
  },
  {
    id: "lien-court-scans",
    date: "2026-10-05",
    titre: "Lien court, QR, affiche et comptage des scans",
    resume: "Lien /r/<code> par restaurant, affiche imprimable, comptage anonyme par source.",
    cle: "lien_court_scans",
    verification: "Console restaurant, rubrique Affiche : les compteurs par source.",
  },
  {
    id: "documents",
    date: "2026-10-05",
    titre: "Reçus et factures numérotés",
    resume: "Documents numérotés par restaurant, figés à l'émission, non fiscaux par défaut ; régime « fiscal déclaré » en option.",
    cle: "documents_recus",
    verification: "Console restaurant, rubrique Documents, et page de suivi du client après paiement confirmé.",
  },
  {
    id: "paiement-code-marchand",
    date: "2026-10-04",
    titre: "Paiement par code marchand et reçus numériques",
    resume: "Le client déclare son paiement, le restaurateur le confirme ; Speedfood ne détient jamais d'argent.",
    sansInterrupteur: "Parcours de l'argent : on ne le coupe pas à chaud, cela laisserait des commandes sans moyen de paiement. À retirer par déploiement.",
    verification: "Page de suivi d'une commande : panneau de paiement.",
  },
  {
    id: "habillage-b",
    date: "2026-10-05",
    titre: "Direction B étendue aux consoles, connexion et inscription",
    resume: "Habillage visuel de la console restaurateur, de la console super admin et des écrans de connexion et d'inscription.",
    sansInterrupteur: "Pur habillage, sans effet sur les données ni sur les règles : pas d'interrupteur utile.",
    verification: "Connexion, inscription, consoles restaurateur et super admin.",
  },
];
