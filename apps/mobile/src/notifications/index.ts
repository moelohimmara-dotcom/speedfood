import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { brancherSession, plateformeDe } from './cablage';
import { ORIGINE_CATALOGUE } from '../catalogue/client';
import { gestion } from '../connexion/gestion';
import { creerAppareil } from './enregistrement';
import { lireJetonNatif, memoireDemande, natif, notificationsDisponibles } from './natif';
import { creerServiceNotifications } from './service';

const plateforme = notificationsDisponibles ? plateformeDe(Platform.OS) : null;
const appareil = creerAppareil({ origine: ORIGINE_CATALOGUE, fetcher: fetch, plateforme, versionApp: Constants.expoConfig?.version ?? null, lireJeton: lireJetonNatif });

/** Fenêtre « Mon compte » ouverte sur le suivi : fournie par l'écran principal au montage (l'appli réelle ne monte pas de routeur). */
let ouvrirSuivi: () => void = () => undefined;
export function brancherOuvertureSuivi(f: () => void) { ouvrirSuivi = f; return () => { if (ouvrirSuivi === f) ouvrirSuivi = () => undefined; }; }

/** Espace restaurateur : fourni par l'écran principal (appui sur `commande_nouvelle`). */
let ouvrirRestaurateur: () => void = () => undefined;
export function brancherOuvertureRestaurateur(f: () => void) { ouvrirRestaurateur = f; return () => { if (ouvrirRestaurateur === f) ouvrirRestaurateur = () => undefined; }; }

/** « Mon compte » ouvert sans lecture automatique (appui sur la réponse du restaurant à une réservation) : fourni par l'écran principal (lot M4c). */
let ouvrirReservations: () => void = () => undefined;
export function brancherOuvertureReservations(f: () => void) { ouvrirReservations = f; return () => { if (ouvrirReservations === f) ouvrirReservations = () => undefined; }; }

export const notifications = creerServiceNotifications({
  natif, appareil, memoire: memoireDemande, obtenirAcces: () => gestion.acces(),
  lireGeneration: () => gestion.generationNotifications,
  ouvrirSuivi: () => ouvrirSuivi(), ouvrirRestaurateur: () => ouvrirRestaurateur(),
  ouvrirReservations: () => ouvrirReservations(),
  lireEstRestaurateur: async () => {
    try { return (await gestion.moi()).restaurateur !== null; } catch { return false; }
  },
});
// La déconnexion retire l'appareil AVANT d'effacer la session ; le branchement est fait ici pour que `gestion.ts` ne dépende pas du natif.
brancherSession(gestion, notifications);
