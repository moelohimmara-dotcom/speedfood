import { ORIGINE_CATALOGUE } from '../catalogue/client.ts';

/**
 * Aide et contact (parité Kotlin, lot 1, ligne A11) : numéro WhatsApp de l'assistance renseigné par l'administration, centre d'aide du site, questions fréquentes, liens légaux.
 * Route PUBLIQUE du Worker API (`GET /api/v1/aide`) : aucun jeton, aucun cookie, un seul essai. Toute anomalie donne « pas de numéro » : l'aide est un confort, jamais une erreur affichée.
 */
export const SITE_WEB = 'https://speedfood-app.moelohimmara.workers.dev';

/** Pages du site ouvertes dans le navigateur (mêmes adresses que l'appli Kotlin). */
export const LIENS_AIDE = {
  centre: SITE_WEB + '/aide',
  apropos: SITE_WEB + '/a-propos',
  conditions: SITE_WEB + '/conditions',
  confidentialite: SITE_WEB + '/confidentialite',
} as const;

/** Chiffres seuls, indicatif inclus, de 8 à 15 chiffres (comme l'appli Kotlin) ; sinon `null`. */
export function lireNumeroAide(corps: unknown): string | null {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return null;
  const r = corps as { ok?: unknown; whatsapp?: unknown };
  if (r.ok !== true || typeof r.whatsapp !== 'string') return null;
  const chiffres = r.whatsapp.replace(/\D/g, '');
  return chiffres.length >= 8 && chiffres.length <= 15 ? chiffres : null;
}

const NUMERO_VALIDE = /^\d{8,15}$/;
/** Jamais un texte libre dans une adresse : seul un numéro de 8 à 15 chiffres en construit une. */
export function adresseWhatsApp(numero: string | null): string | null { return numero !== null && NUMERO_VALIDE.test(numero) ? 'https://wa.me/' + numero : null; }
export function adresseAppel(numero: string | null): string | null { return numero !== null && NUMERO_VALIDE.test(numero) ? 'tel:+' + numero : null; }

/** Numéro d'assistance, ou `null` (réseau coupé, statut d'erreur, réponse illisible). Un seul essai, 8 secondes au plus. */
export async function lireAide(fetcher: typeof fetch = fetch): Promise<string | null> {
  const controle = new AbortController(); const minuterie = setTimeout(() => controle.abort(), 8000);
  try {
    const r = await fetcher(ORIGINE_CATALOGUE + '/api/v1/aide', { method: 'GET', credentials: 'omit', signal: controle.signal, headers: { Accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/json')) return null;
    const texte = await r.text(); if (texte.length > 8192) return null;
    return lireNumeroAide(JSON.parse(texte));
  } catch { return null; } finally { clearTimeout(minuterie); }
}

export interface QuestionAide { question: string; reponse: string }

/**
 * Questions fréquentes, fidèles à CETTE application (pas d'onglets, pas de connexion Google). Chaque réponse décrit seulement ce qui existe : une entrée est ajoutée quand la
 * fonction qu'elle explique est livrée (suppression de compte, réponse à une proposition de prix, test des notifications).
 */
export const QUESTIONS_AIDE: QuestionAide[] = [
  { question: 'Comment passer une commande ?', reponse: 'Choisissez un restaurant, ajoutez des plats au panier, ouvrez le panier puis touchez « Commander ». Il faut être connecté à votre compte Speedfood. Le restaurant confirme ensuite votre commande : elle n’est ferme qu’à ce moment-là.' },
  { question: 'Comment payer ?', reponse: 'Vous réglez directement le restaurant, selon les moyens qu’il accepte. Une fois votre commande acceptée, vous pouvez déclarer votre règlement dans « Mon compte ». Le paiement en ligne n’est pas encore disponible dans l’application.' },
  { question: 'Où suivre ma commande ?', reponse: 'Dans « Mon compte », touchez « Voir ou actualiser mes commandes » puis « Suivre » sur la commande voulue. Actualisez le suivi pour lire son état courant ; une notification vous prévient aussi à chaque étape si vous les avez autorisées.' },
  { question: 'Je ne reçois pas les notifications.', reponse: 'Vérifiez dans les réglages du téléphone que les notifications de Speedfood sont autorisées, et que vous êtes connecté. Elles nécessitent les services Google du téléphone. Sinon, actualisez le suivi dans « Mon compte ».' },
];

/** Questions du restaurateur (espace restaurateur de l'application). */
export const QUESTIONS_AIDE_RESTAURATEUR: QuestionAide[] = [
  { question: 'Où voir les commandes de mon restaurant ?', reponse: 'Dans « Mon compte », touchez « Espace restaurateur ». Les commandes à traiter s’y affichent ; vous pouvez les accepter, les refuser, les marquer prêtes ou terminées, ou proposer un autre prix.' },
  { question: 'Comment mettre à jour mon menu et mes horaires ?', reponse: 'Dans l’espace restaurateur, ouvrez le service et le menu : vous pouvez changer la disponibilité d’un plat, ses photos, vos horaires et le délai de préparation.' },
];
