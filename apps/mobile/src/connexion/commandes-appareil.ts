/**
 * Commandes de cet appareil (parité Kotlin, écart G12, `CommandesLocales`) : la référence et le jeton de suivi de chaque commande envoyée depuis ce téléphone sont gardés
 * ICI pour la retrouver et suivre son état même déconnecté. Commander exige toujours un compte (règle du serveur) : ce n'est PAS une commande sans compte.
 *
 * Règles de sécurité :
 *  - le jeton de suivi est une clé (suivre, mais aussi annuler, répondre au restaurant, déclarer un paiement) : il ne se garde que dans le coffre du téléphone,
 *    JAMAIS dans la liste des métadonnées (`encoderMetadonnees` ne l'écrit pas) et ne remonte jamais jusqu'à l'écran (`VueCommandeAppareil` n'en porte pas) ;
 *  - déconnecté, on ne fait que LIRE l'état : annuler, répondre et régler exigent une session ouverte ;
 *  - 50 commandes au plus, les plus récentes d'abord ; au moindre doute sur une ligne lue, elle est écartée (jamais devinée).
 */
export interface CommandeAppareil { reference: string; jeton: string; restaurantNom: string; creeLe: number; totalGnf: number; mode: string }
export type MetadonneesCommande = Omit<CommandeAppareil, 'jeton'>;
/** Ce que l'écran voit : jamais le jeton. `cle` désigne la commande dans les lectures de l'appareil. */
export interface VueCommandeAppareil { cle: string; reference: string; restaurantNom: string; creeLe: number; totalGnf: number; mode: string }
/** Dépôt des commandes de l'appareil : métadonnées d'un côté, jetons dans le coffre de l'autre (voir `stockage/commandes-appareil.ts`). */
export interface MemoireAppareil {
  lire(): Promise<CommandeAppareil[]>;
  enregistrer(nouvelles: readonly CommandeAppareil[]): Promise<void>;
  oublier(): Promise<void>;
}

export const COMMANDES_APPAREIL_MAX = 50;
/** Même forme que le jeton de suivi du serveur : 40 caractères. */
export const jetonSuiviValide = (j: unknown): j is string => typeof j === 'string' && /^[A-Za-z0-9_-]{40}$/.test(j);
const REFERENCE = /^[A-Za-z0-9-]{3,40}$/;
const MODES = new Set(['retrait', 'livraison', 'sur_place']);

function invalide(): never { throw Error('COMMANDE_APPAREIL_INVALIDE'); }

export function metadonneesValides(x: unknown): MetadonneesCommande {
  const o = x as { reference?: unknown; restaurantNom?: unknown; creeLe?: unknown; totalGnf?: unknown; mode?: unknown } | null;
  if (!o || typeof o !== 'object') return invalide();
  if (typeof o.reference !== 'string' || !REFERENCE.test(o.reference)) return invalide();
  if (typeof o.restaurantNom !== 'string' || o.restaurantNom.length > 200 || /[\x00-\x1f]/.test(o.restaurantNom)) return invalide();
  if (typeof o.creeLe !== 'number' || !Number.isSafeInteger(o.creeLe) || o.creeLe < 0) return invalide();
  if (typeof o.totalGnf !== 'number' || !Number.isSafeInteger(o.totalGnf) || o.totalGnf < 0) return invalide();
  if (typeof o.mode !== 'string' || !MODES.has(o.mode)) return invalide();
  return { reference: o.reference, restaurantNom: o.restaurantNom, creeLe: o.creeLe, totalGnf: o.totalGnf, mode: o.mode };
}
export function commandeAppareilValide(x: unknown): CommandeAppareil {
  const m = metadonneesValides(x);
  const jeton = (x as { jeton?: unknown }).jeton;
  if (!jetonSuiviValide(jeton)) return invalide();
  return { ...m, jeton };
}

/**
 * Fusionne de nouvelles informations dans la liste : une commande par référence ; une information plus complète (nom du restaurant, total) remplace une vide,
 * jamais l'inverse. Les lignes invalides sont écartées. Plus récentes d'abord, 50 au plus.
 */
export function fusionnerCommandes(liste: readonly CommandeAppareil[], nouvelles: readonly CommandeAppareil[]): CommandeAppareil[] {
  const parReference = new Map<string, CommandeAppareil>();
  for (const brute of liste) { try { const c = commandeAppareilValide(brute); parReference.set(c.reference, c); } catch { /* ligne douteuse écartée */ } }
  for (const brute of nouvelles) {
    let n: CommandeAppareil;
    try { n = commandeAppareilValide(brute); } catch { continue; }
    const ancienne = parReference.get(n.reference);
    parReference.set(n.reference, !ancienne ? n : {
      reference: n.reference,
      jeton: n.jeton,
      restaurantNom: n.restaurantNom !== '' ? n.restaurantNom : ancienne.restaurantNom,
      totalGnf: n.totalGnf > 0 ? n.totalGnf : ancienne.totalGnf,
      mode: n.mode,
      creeLe: n.creeLe > 0 && (ancienne.creeLe === 0 || n.restaurantNom !== '') ? n.creeLe : ancienne.creeLe,
    });
  }
  return [...parReference.values()].sort((a, b) => b.creeLe - a.creeLe).slice(0, COMMANDES_APPAREIL_MAX);
}

/** Les commandes du compte (avec leur jeton, réservé au titulaire) vues comme commandes de l'appareil ; une ligne sans jeton valable ou à la date illisible est ignorée. */
export function depuisCompte(lignes: readonly { reference: string; creeLe: string; restaurantNom: string; mode: string; totalGnf: number; jeton: string | null }[]): CommandeAppareil[] {
  const sortie: CommandeAppareil[] = [];
  for (const l of lignes) {
    const date = Date.parse(l.creeLe);
    if (!jetonSuiviValide(l.jeton) || !Number.isFinite(date)) continue;
    try { sortie.push(commandeAppareilValide({ reference: l.reference, jeton: l.jeton, restaurantNom: l.restaurantNom, creeLe: date, totalGnf: l.totalGnf, mode: l.mode })); } catch { /* écartée */ }
  }
  return sortie;
}

/** Texte des métadonnées : JAMAIS le jeton (il vit dans le coffre). */
export function encoderMetadonnees(liste: readonly CommandeAppareil[]): string {
  const m: MetadonneesCommande[] = liste.slice(0, COMMANDES_APPAREIL_MAX).map(({ reference, restaurantNom, creeLe, totalGnf, mode }) => ({ reference, restaurantNom, creeLe, totalGnf, mode }));
  return JSON.stringify({ version: 1, commandes: m });
}
/** Lecture prudente : au moindre doute sur la version ou la taille, liste vide ; une ligne invalide est écartée. */
export function decoderMetadonnees(texte: string | null): MetadonneesCommande[] {
  if (texte === null || texte.length > 65536) return [];
  try {
    const o = JSON.parse(texte);
    if (o?.version !== 1 || !Array.isArray(o.commandes) || o.commandes.length > COMMANDES_APPAREIL_MAX) return [];
    const vues = new Set<string>(); const sortie: MetadonneesCommande[] = [];
    for (const x of o.commandes) { try { const m = metadonneesValides(x); if (!vues.has(m.reference)) { vues.add(m.reference); sortie.push(m); } } catch { /* écartée */ } }
    return sortie;
  } catch { return []; }
}

/** Clé du coffre pour le jeton d'une commande (le coffre n'accepte que lettres, chiffres, point, tiret et soulignement). */
export const cleCoffreSuivi = (reference: string): string => 'suivi_' + reference.replace(/[^A-Za-z0-9._-]/g, '_');
export const cleAppareil = (reference: string): string => 'appareil:' + reference;
export const referenceDeCle = (cle: string): string | null => cle.startsWith('appareil:') && REFERENCE.test(cle.slice(9)) ? cle.slice(9) : null;
export function versVue(c: CommandeAppareil): VueCommandeAppareil { return { cle: cleAppareil(c.reference), reference: c.reference, restaurantNom: c.restaurantNom, creeLe: c.creeLe, totalGnf: c.totalGnf, mode: c.mode }; }

/** Au plus ce nombre de statuts relus d'un coup (chaque lecture est plafonnée par jeton côté serveur). */
export const RELECTURES_APPAREIL_MAX = 5;
