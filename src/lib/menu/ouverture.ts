/**
 * Lot « Menu du jour » : logique SANS dépendance (testable seule).
 *
 * - Rituel d'ouverture : le restaurateur dit, plat par plat, ce qu'il a ce matin (« oui » ou « épuisé »). Un « oui »
 *   remet l'horodatage de confirmation à maintenant : c'est la promesse de fraîcheur de Speedfood.
 * - Menu du jour : l'image à partager ne montre que les plats disponibles ET confirmés récemment, avec l'heure de
 *   confirmation. Elle ne promet jamais un stock.
 */

import { etatDisponibilite } from "../disponibilite/etat";

export const PLATS_MAX_PAR_OUVERTURE = 500;
export const LIGNES_MAX_MENU_DU_JOUR = 6;

const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PREFIXE_CHAMP = "plat_";

export interface ChoixOuverture {
  oui: string[];
  non: string[];
}

/**
 * Lit les champs `plat_<uuid>` = « oui » | « non » d'un formulaire. Tout le reste est ignoré : identifiant mal formé,
 * valeur inconnue, doublon (le dernier choix l'emporte). Le résultat est borné.
 */
export function lireChoixOuverture(entrees: Iterable<[string, unknown]>): ChoixOuverture {
  const choix = new Map<string, "oui" | "non">();
  for (const [cle, valeur] of entrees) {
    if (!cle.startsWith(PREFIXE_CHAMP)) continue;
    const id = cle.slice(PREFIXE_CHAMP.length).toLowerCase();
    if (!FORME_UUID.test(id)) continue;
    if (valeur !== "oui" && valeur !== "non") continue;
    choix.set(id, valeur);
    if (choix.size > PLATS_MAX_PAR_OUVERTURE) break;
  }
  const oui: string[] = [];
  const non: string[] = [];
  for (const [id, v] of choix) (v === "oui" ? oui : non).push(id);
  return { oui: oui.slice(0, PLATS_MAX_PAR_OUVERTURE), non: non.slice(0, PLATS_MAX_PAR_OUVERTURE) };
}

export interface PlatMenuDuJour {
  id: string;
  nom: string;
  prix: number;
  prixPromo: number | null;
  disponible: boolean;
  disponibiliteConfirmeeLe: string | null;
}

export interface LigneMenuDuJour {
  id: string;
  nom: string;
  /** Prix réellement demandé au client : le prix promo s'il existe, sinon le prix normal. */
  prix: number;
  /** Prix barré affiché à côté quand il y a une promo. */
  prixAvantPromo: number | null;
  confirmeLe: string;
}

/** Plats à proposer dans l'image : disponibles et confirmés dans le délai de fraîcheur, du plus récemment confirmé au plus ancien. */
export function platsDuMenuDuJour(plats: PlatMenuDuJour[], fraicheurHeures: number, maintenant: Date): LigneMenuDuJour[] {
  const lignes: LigneMenuDuJour[] = [];
  for (const plat of plats) {
    const etat = etatDisponibilite({ disponible: plat.disponible, confirmeLe: plat.disponibiliteConfirmeeLe }, fraicheurHeures, maintenant);
    if (etat.type !== "disponible" || !plat.disponibiliteConfirmeeLe) continue;
    const promo = plat.prixPromo !== null && plat.prixPromo < plat.prix;
    lignes.push({
      id: plat.id,
      nom: plat.nom,
      prix: promo ? (plat.prixPromo as number) : plat.prix,
      prixAvantPromo: promo ? plat.prix : null,
      confirmeLe: plat.disponibiliteConfirmeeLe,
    });
  }
  return lignes.sort((a, b) => b.confirmeLe.localeCompare(a.confirmeLe) || a.nom.localeCompare(b.nom, "fr"));
}

/** « 25 000 GNF » (espace insécable fine entre les milliers, comme le reste de l'application). */
export function formaterPrixGnf(montant: number): string {
  const arrondi = Math.round(montant);
  const chiffres = String(Math.abs(arrondi)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${arrondi < 0 ? "-" : ""}${chiffres} GNF`;
}

/** Heure locale de Conakry (UTC+0, sans changement d'heure) au format « 07 h 40 ». */
export function heureLisible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h} h ${m}`;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « mardi 6 octobre » (Conakry est à UTC+0). */
export function dateLisible(d: Date): string {
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

/** Texte joint à l'image ou copié seul pour WhatsApp. Cite Speedfood et l'heure de confirmation, n'annonce aucun stock. */
export function texteMenuDuJour(nomRestaurant: string, lignes: LigneMenuDuJour[], url: string, date: Date): string {
  const corps = lignes.map((l) => `• ${l.nom} : ${formaterPrixGnf(l.prix)}`).join("\n");
  const plusRecente = lignes.reduce<string | null>((max, l) => (max === null || l.confirmeLe > max ? l.confirmeLe : max), null);
  const heure = plusRecente ? ` (confirmé à ${heureLisible(plusRecente)})` : "";
  return `${nomRestaurant} : menu du ${dateLisible(date)}${heure}\n${corps}\nCommandez sur Speedfood : ${url}`;
}
