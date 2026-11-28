/**
 * Parcours d'accueil du premier lancement (choix de Malika, 27/11/2026) : logo animé, quatre écrans de visite illustrés, puis « Qui êtes-vous ? »
 * (client, restaurateur, livreur) avec « Nouveau, je crée mon compte » ou « J'ai déjà un compte ». Après la connexion, l'appli ouvre l'espace du profil choisi.
 * Logique PURE, sans React : les écrans n'ont plus qu'à l'afficher.
 */
export type ProfilAccueil = 'client' | 'restaurateur' | 'livreur';
export type ActionAccueil = 'nouveau' | 'existant';
/** `reprise: 'commande'` : la personne venait de « Commander » ; après connexion, l'appli rouvre la validation de la commande avec le panier gardé. */
export interface OrientationAccueil { profil: ProfilAccueil; action: ActionAccueil; reprise?: 'commande' }

/** Le parcours a été vu (ou passé) sur cet appareil : valeur non secrète. */
export const CLE_ACCUEIL_VU = 'speedfood.accueil.vu.v1';

export type SceneAccueil = 'restaurants' | 'commande' | 'livraison' | 'pros';
export interface DiapoAccueil { scene: SceneAccueil; titre: string; texte: string }

export const DIAPOS_ACCUEIL: readonly DiapoAccueil[] = [
  { scene: 'restaurants', titre: 'Les bons plats de votre quartier', texte: 'Des restaurants de Conakry et de toute la Guinée, avec des menus confirmés chaque jour.' },
  { scene: 'commande', titre: 'Commandez sans payer d’avance', texte: 'Le restaurant confirme votre plat, puis vous réglez par Orange Money, MTN MoMo ou en espèces.' },
  { scene: 'livraison', titre: 'Livré à votre repère', texte: 'Indiquez un repère connu ou partagez votre position : le livreur vous trouve, vous suivez la course en direct.' },
  { scene: 'pros', titre: 'Restaurateurs et livreurs, rejoignez-nous', texte: 'Recevez des commandes, gérez votre menu ou faites des courses : Speedfood vous accompagne.' },
];

export interface ChoixProfil { profil: ProfilAccueil; titre: string; texte: string }
export const PROFILS_ACCUEIL: readonly ChoixProfil[] = [
  { profil: 'client', titre: 'Je veux commander', texte: 'Trouvez un plat, commandez, suivez votre livraison.' },
  { profil: 'restaurateur', titre: 'J’ai un restaurant', texte: 'Recevez des commandes et tenez votre menu à jour.' },
  { profil: 'livreur', titre: 'Je suis livreur', texte: 'Acceptez des courses près de vous et suivez vos gains.' },
];

/** Le parcours s'affiche au premier lancement seulement, et jamais à une personne déjà connectée (mise à jour de l'appli). */
export function doitAfficherAccueil(vu: string | null | undefined, connectee: boolean): boolean {
  return !connectee && vu !== '1';
}

/** Écran suivant de la visite ; après le dernier, on passe au choix du profil. */
export function etapeAccueil(page: number, total: number): { page: number; versChoix: boolean } {
  const derniere = Math.max(0, total - 1);
  const p = Math.min(Math.max(0, Math.trunc(page)), derniere);
  return p >= derniere ? { page: derniere, versChoix: true } : { page: p + 1, versChoix: false };
}

export type DecisionOrientation =
  | { genre: 'attendre' }
  | { genre: 'espace'; espace: 'restaurateur' | 'livreur' }
  | { genre: 'catalogue' }
  | { genre: 'candidature' }
  | { genre: 'message'; message: string };

export const MESSAGE_LIVREUR_A_ACTIVER = 'Votre compte est créé. Pour devenir livreur Speedfood, l’équipe vérifie votre dossier (pièce d’identité, véhicule) puis active votre espace livreur : écrivez-nous depuis « Aide et contact ».';
export const MESSAGE_PAS_RESTAURATEUR = 'Ce compte n’est rattaché à aucun restaurant. Si vous en avez un, touchez « J’ai un restaurant » pour demander votre référencement.';
export const MESSAGE_PAS_LIVREUR = 'Ce compte n’a pas encore d’espace livreur. L’équipe Speedfood l’active après vérification de votre dossier : écrivez-nous depuis « Aide et contact ».';

/**
 * Où mener la personne une fois connectée, selon le profil choisi à l'accueil et les rôles que le serveur lui reconnaît (`restaurateur` null = pas encore lus).
 * Le rôle vient toujours du serveur : choisir « restaurateur » à l'accueil ne donne aucun droit.
 */
export function orienterApresConnexion(o: OrientationAccueil, roles: { restaurateur: boolean | null; livreur: boolean }): DecisionOrientation {
  if (roles.restaurateur === null) return { genre: 'attendre' };
  if (o.profil === 'client') return { genre: 'catalogue' };
  if (o.profil === 'restaurateur') {
    if (roles.restaurateur) return { genre: 'espace', espace: 'restaurateur' };
    return o.action === 'nouveau' ? { genre: 'candidature' } : { genre: 'message', message: MESSAGE_PAS_RESTAURATEUR };
  }
  if (roles.livreur) return { genre: 'espace', espace: 'livreur' };
  return { genre: 'message', message: o.action === 'nouveau' ? MESSAGE_LIVREUR_A_ACTIVER : MESSAGE_PAS_LIVREUR };
}

/** Écran de connexion ouvert selon le bouton touché : création de compte ou connexion. */
export const accesDepuisAction = (a: ActionAccueil): 'inscription' | 'connexion' => (a === 'nouveau' ? 'inscription' : 'connexion');
