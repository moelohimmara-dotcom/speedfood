import { openDatabaseAsync } from 'expo-sqlite';
import { creerOuvreurEnSerie } from './file-ouverture';

/**
 * Ouvre les bases SQLite de l'application UNE À LA FOIS. Essai du 18/11/2026 : au tout premier lancement, le panier puis le catalogue déclaraient une erreur (« Panier non restauré »,
 * « Le catalogue est indisponible ») alors que le serveur répondait, et un simple « Réessayer » les réparait : les bases (panier, cache du catalogue, commandes) étaient ouvertes en même temps,
 * sur une installation toute neuve. Ouvertes en file, elles ne se disputent plus la création du dossier des bases (voir `file-ouverture.ts`).
 */
export const ouvrirBaseEnSerie = creerOuvreurEnSerie(openDatabaseAsync);
