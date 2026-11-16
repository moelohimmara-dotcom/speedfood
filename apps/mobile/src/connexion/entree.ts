import type { RolesCompte } from './restaurateur.ts';
/**
 * Premier écran « Qui êtes-vous ? » (parité Kotlin, écart G17, `EntreeScreen`) : des pistes séparées dès le départ. Le client parcourt les restaurants sans compte ; le restaurateur,
 * le livreur et l'équipe ont chacun leur piste. Une piste mène à son espace si le compte en a le droit ; sinon un message précis (textes de l'ancienne appli). Cette décision n'est
 * qu'un confort d'orientation : chaque route de chaque espace revérifie le droit côté serveur.
 */
export type PisteEntree = 'client' | 'restaurateur' | 'livreur' | 'equipe';
export type EspaceEntree = 'restaurateur' | 'livreur' | 'equipe';
export interface DescriptionPiste { id: 'client' | 'restaurateur' | 'livreur'; titre: string; texte: string; bouton: string }
/** Les trois cartes principales ; « Équipe Speedfood » est un lien discret à part, comme dans l'ancienne appli. */
export const PISTES: DescriptionPiste[] = [
  { id: 'client', titre: 'Je suis client', texte: 'Je veux commander, retrouver mes commandes, mes adresses et mes restaurants favoris.', bouton: 'Parcourir les restaurants' },
  { id: 'restaurateur', titre: 'Je suis restaurateur', texte: 'Je tiens un restaurant et je veux recevoir des commandes, gérer mon menu et mes plats du jour.', bouton: 'Espace restaurateur' },
  { id: 'livreur', titre: 'Je suis livreur', texte: 'Je livre pour Speedfood ou pour un restaurant : je reçois des courses, je suis mon trajet et je remets la commande avec le code du client.', bouton: 'Espace livreur' },
];
export interface EtatEntree { connectee: boolean; roles: RolesCompte | null }
export type DestinationEntree =
  | { genre: 'catalogue' }
  | { genre: 'espace'; espace: EspaceEntree }
  | { genre: 'connexion'; message: string }
  | { genre: 'refus'; message: string; assistance: boolean; candidature: boolean }
  | { genre: 'indisponible'; message: string };
const MESSAGE_INDISPONIBLE = 'Impossible de vérifier les droits de ce compte pour le moment. Réessayez dans un instant.';
export function destinationPiste(piste: PisteEntree, etat: EtatEntree): DestinationEntree {
  if (piste === 'client') return { genre: 'catalogue' };
  if (!etat.connectee) {
    return { genre: 'connexion', message: {
      restaurateur: 'Connectez-vous avec le compte de votre restaurant. Pas encore partenaire ? Touchez « J’ai un restaurant » pour faire votre demande.',
      livreur: 'Connectez-vous avec le compte livreur que l’équipe Speedfood vous a ouvert.',
      equipe: 'Connectez-vous avec votre compte de l’équipe.',
    }[piste] };
  }
  // Droits non lus (réseau, panne) : jamais un refus à tort.
  if (etat.roles === null) return { genre: 'indisponible', message: MESSAGE_INDISPONIBLE };
  if (piste === 'restaurateur') return etat.roles.restaurateur !== null ? { genre: 'espace', espace: 'restaurateur' } : { genre: 'refus', message: 'Ce compte n’est rattaché à aucun restaurant. Pas encore partenaire ? Touchez « J’ai un restaurant » pour faire votre demande.', assistance: false, candidature: true };
  if (piste === 'livreur') return etat.roles.livreur ? { genre: 'espace', espace: 'livreur' } : { genre: 'refus', message: 'Ce compte n’est pas un compte livreur. Les comptes livreurs sont créés par l’équipe Speedfood : contactez-la si vous souhaitez livrer.', assistance: true, candidature: false };
  return etat.roles.equipe !== null ? { genre: 'espace', espace: 'equipe' } : { genre: 'refus', message: 'Cet espace est réservé à l’équipe Speedfood.', assistance: false, candidature: false };
}
export const CLE_ENTREE_VUE = 'entree_vue';
/** L'écran n'est proposé automatiquement qu'au premier lancement ; il reste rouvrable depuis le catalogue. */
export const doitProposerEntree = (dejaVue: boolean): boolean => !dejaVue;
