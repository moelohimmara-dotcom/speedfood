/**
 * Catalogue des identifiants d'action utilisés par `journaliserActionSysteme`
 * à travers tout le CMS système — sert uniquement à peupler le filtre du
 * journal d'audit (bloc 8d). Volontairement dans un fichier SANS "use server" :
 * une constante (pas une fonction) ne peut pas être exportée d'un fichier
 * "use server" (règle Next.js : uniquement des fonctions async).
 */
export const ACTIONS_AUDIT_CONNUES = [
  "restaurant.approbation",
  "restaurant.demande_correction",
  "restaurant.suspension",
  "restaurant.reactivation",
  "compte.invitation",
  "compte.revocation",
  "taxonomie.creation",
  "taxonomie.modification",
  "taxonomie.suppression",
  "contenu.page_creation",
  "contenu.page_modification",
  "contenu.page_publication",
  "contenu.page_depublication",
  "contenu.banniere_creation",
  "contenu.banniere_publication",
  "contenu.banniere_depublication",
  "contenu.banniere_suppression",
  "mise_en_avant.creation",
  "mise_en_avant.activation",
  "mise_en_avant.desactivation",
  "mise_en_avant.suppression",
  "coordonnees.revelation",
  "commande.support_transition",
  "systeme.attribution_role",
  "systeme.retrait_role",
  "parametres.modification",
] as const;
