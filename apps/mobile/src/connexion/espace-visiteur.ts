/**
 * « Mon compte » pour un visiteur (28/11/2026, audit du parcours client) : avant tout formulaire, la question « Comment souhaitez-vous utiliser Speedfood ? »
 * et le menu « Choisir mon espace » (client, restaurateur, livreur), sans choix fait d'avance. Chaque espace propose ses vraies démarches :
 * - client : connexion ou création de compte ;
 * - restaurateur : connexion, ou demande de référencement (formulaire natif de l'appli, compte requis) ;
 * - livreur : connexion, ou devenir livreur SUR INVITATION (Speedfood ou un restaurant envoie un lien d'activation, `/livreur/activer` ; aucune
 *   inscription libre n'existe) : l'appli explique la démarche et ouvre « Aide et contact » dans l'appli.
 * Le choix ne sert qu'à orienter : les droits viennent toujours des rôles que le serveur reconnaît au compte. Logique PURE, sans React.
 */
export type EspaceVisiteur = 'client' | 'restaurateur' | 'livreur';
export type GenreActionEspace = 'connexion' | 'inscription' | 'referencement' | 'devenir-livreur';
export interface ActionEspace { genre: GenreActionEspace; titre: string; principale: boolean }
export interface ChoixEspace { espace: EspaceVisiteur; titre: string; texte: string; actions: readonly ActionEspace[] }

export const QUESTION_ESPACE = 'Comment souhaitez-vous utiliser Speedfood ?';
export const LIBELLE_MENU_ESPACE = 'Choisir mon espace';

export const CHOIX_ESPACES: readonly ChoixEspace[] = [
  { espace: 'client', titre: 'Client', texte: 'Je veux commander un repas', actions: [
    { genre: 'connexion', titre: 'Me connecter à mon compte client', principale: true },
    { genre: 'inscription', titre: 'Créer un compte client', principale: false },
  ] },
  { espace: 'restaurateur', titre: 'Restaurateur', texte: 'Je gère un restaurant', actions: [
    { genre: 'connexion', titre: 'Me connecter à mon compte restaurateur', principale: true },
    { genre: 'referencement', titre: 'Faire référencer mon restaurant', principale: false },
  ] },
  { espace: 'livreur', titre: 'Livreur', texte: 'Je veux effectuer des livraisons', actions: [
    { genre: 'connexion', titre: 'Me connecter à mon compte livreur', principale: true },
    { genre: 'devenir-livreur', titre: 'Devenir livreur (sur invitation)', principale: false },
  ] },
];

/** Comment devenir livreur, tel que le service fonctionne réellement (activation par lien d'invitation, pas d'inscription libre). */
export const TEXTE_DEVENIR_LIVREUR = 'Les livreurs rejoignent Speedfood sur invitation : l’équipe Speedfood, ou un restaurant qui a ses propres livreurs, vous envoie un lien d’activation. Ouvrez-le une fois connecté avec votre compte, puis complétez votre dossier. Pour demander une invitation, contactez l’équipe.';
export const TEXTE_REFERENCEMENT = 'La demande de référencement se fait dans l’appli : présentez votre restaurant, vos horaires et vos plats. Il faut un compte Speedfood pour l’envoyer ; l’équipe vous recontacte.';

export const choixEspace = (e: EspaceVisiteur | null): ChoixEspace | null => (e === null ? null : CHOIX_ESPACES.find(c => c.espace === e) ?? null);

/** Titre du formulaire de connexion selon l'espace choisi. */
export function titreConnexion(e: EspaceVisiteur | null): string {
  if (e === 'restaurateur') return 'Connexion restaurateur';
  if (e === 'livreur') return 'Connexion livreur';
  return 'Connexion client';
}

/** Libellé accessible du menu : son nom, son état (ouvert/fermé) et l'espace choisi, tels que TalkBack les annonce. */
export function libelleMenuEspace(e: EspaceVisiteur | null): string {
  const c = choixEspace(e);
  return c ? `${LIBELLE_MENU_ESPACE} : ${c.titre} sélectionné` : `${LIBELLE_MENU_ESPACE} : aucun espace sélectionné`;
}
