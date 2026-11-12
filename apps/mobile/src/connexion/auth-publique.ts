import { normaliserTelephone } from '../../../../packages/shared/src/commande/telephone.ts';
/**
 * Inscription et mot de passe oublié (parité Kotlin, lot 1, lignes A2 et A3) : règles locales (vérifiées AVANT le réseau) et messages en français pour les réponses du service d'authentification.
 * Mêmes règles que l'ancienne appli et que le site. Aucune de ces fonctions ne voit ni ne répète un mot de passe.
 */
export const LONGUEUR_MIN_MOT_DE_PASSE = 12;
const MESSAGE_EMAIL = 'Indiquez une adresse e-mail valide.';
const MESSAGE_MOT_DE_PASSE = 'Le mot de passe doit contenir au moins ' + LONGUEUR_MIN_MOT_DE_PASSE + ' caractères.';

export interface SaisieInscription { nom: string; telephone: string; email: string; motDePasse: string }

/** Premier problème trouvé, ou `null`. Même ordre que l'ancienne appli : nom, téléphone, e-mail, mot de passe. */
export function verifierInscription(s: SaisieInscription): string | null {
  if (s.nom.trim().length < 2) return 'Indiquez votre nom (2 caractères au moins).';
  if (normaliserTelephone(s.telephone) === null) return 'Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (par exemple 622 12 34 56).';
  if (!s.email.includes('@') || s.email.trim().length < 6) return MESSAGE_EMAIL;
  if (s.motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) return MESSAGE_MOT_DE_PASSE;
  return null;
}

/** Mot de passe oublié : une adresse plausible suffit (le serveur ne dit jamais si le compte existe). */
export function verifierEmail(email: string): string | null {
  return !email.includes('@') || email.trim().length < 6 ? 'Indiquez l’adresse e-mail de votre compte.' : null;
}

/** Messages en français pour les réponses du service d'authentification, sans jargon ni détail technique (le texte brut n'est jamais renvoyé). */
export function traduireErreurAuth(statut: number, corps: string): string {
  const t = corps.toLowerCase();
  if (statut === 429 || t.includes('rate limit') || t.includes('too many')) return 'Trop de tentatives. Patientez quelques minutes puis réessayez.';
  if (t.includes('banned')) return 'Votre inscription est en cours de vérification par l’équipe Speedfood (adresse proche d’un compte existant). Connectez-vous avec votre première adresse, ou attendez la réponse sous 48 h.';
  if (t.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (t.includes('email not confirmed')) return 'Confirmez d’abord votre adresse : ouvrez le lien reçu par e-mail (regardez aussi les courriers indésirables).';
  if (t.includes('pwned') || t.includes('compromised') || t.includes('weak')) return 'Ce mot de passe est trop faible ou connu dans des fuites de données. Choisissez-en un autre.';
  if (t.includes('at least') && t.includes('password')) return MESSAGE_MOT_DE_PASSE;
  if (t.includes('already registered') || t.includes('already exists')) return 'Un compte existe déjà avec cet e-mail.';
  if (statut >= 500 && statut <= 599) return 'Speedfood est momentanément indisponible. Réessayez dans un instant.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}
