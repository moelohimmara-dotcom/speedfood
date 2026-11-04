import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ORIGINE_CATALOGUE } from '../catalogue/client';
import { gestion } from '../connexion/gestion';
import { creerAppareil } from './enregistrement';
import { lireJetonNatif, memoireDemande, natif, notificationsDisponibles } from './natif';
import { creerServiceNotifications } from './service';

const plateforme = notificationsDisponibles ? (Platform.OS === 'ios' ? 'ios' : 'android') : null;
const appareil = creerAppareil({ origine: ORIGINE_CATALOGUE, fetcher: fetch, plateforme, versionApp: Constants.expoConfig?.version ?? null, lireJeton: lireJetonNatif });

/** Fenêtre « Mon compte » ouverte sur le suivi : fournie par l'écran principal au montage (l'appli réelle ne monte pas de routeur). */
let ouvrirSuivi: () => void = () => undefined;
export function brancherOuvertureSuivi(f: () => void) { ouvrirSuivi = f; return () => { if (ouvrirSuivi === f) ouvrirSuivi = () => undefined; }; }

export const notifications = creerServiceNotifications({ natif, appareil, memoire: memoireDemande, obtenirAcces: () => gestion.acces(), ouvrirSuivi: () => ouvrirSuivi() });
// La déconnexion retire l'appareil AVANT d'effacer la session ; le branchement est fait ici pour que `gestion.ts` ne dépende pas du natif.
gestion.avantDeconnexion = acces => notifications.avantDeconnexion(acces);
gestion.apresOuverture = () => { void notifications.sessionOuverte(); };
