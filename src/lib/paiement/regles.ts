/**
 * Paiement par code marchand et reçu numérique : règles SANS dépendance (testables seules).
 *
 * Principe : Speedfood ne reçoit, ne détient ni ne vérifie jamais d'argent. Le client règle le restaurant avec le code
 * marchand de ce dernier (Orange Money, MTN MoMo) ou en espèces ; il DÉCLARE son paiement, le restaurateur le CONFIRME.
 * Le code n'est montré qu'APRÈS l'acceptation de la commande : tant que le restaurant peut encore la refuser ou changer le
 * prix, le client ne doit rien payer.
 */

export type ModePaiement = "especes" | "orange_money" | "mtn_momo";
export type StatutPaiement = "non_demande" | "especes" | "declare" | "recu" | "non_recu";

export interface CodesMarchand {
  orange: string | null;
  mtn: string | null;
}

export interface OptionPaiement {
  mode: ModePaiement;
  libelle: string;
  /** Code marchand à saisir sur le téléphone du client ; `null` pour les espèces. */
  code: string | null;
}

export const LIBELLES_MODE: Record<ModePaiement, string> = {
  especes: "Espèces",
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
};

const FORME_CODE = /^[0-9A-Za-z]{3,20}$/;
const FORME_REFERENCE = /^[A-Za-z0-9._ -]{4,40}$/;

/** `null` pour un champ vide, la valeur nettoyée pour un code valide, `"invalide"` sinon. */
export function lireCodeMarchand(brut: string): string | null | "invalide" {
  const v = brut.replace(/\s+/g, "").trim();
  if (v === "") return null;
  return FORME_CODE.test(v) ? v : "invalide";
}

/** Référence de transaction facultative donnée par le client : 4 à 40 caractères simples, ou vide. */
export function lireReferencePaiement(brut: string): { ok: true; valeur: string | null } | { ok: false } {
  const v = brut.trim().replace(/\s+/g, " ");
  if (v === "") return { ok: true, valeur: null };
  return FORME_REFERENCE.test(v) ? { ok: true, valeur: v } : { ok: false };
}

/**
 * Modes proposés au client : espèces si le restaurant les accepte (ou n'a rien déclaré), et chaque mobile money
 * seulement s'il est déclaré ET que le code marchand correspondant est renseigné.
 */
export function optionsPaiement(moyens: readonly string[], codes: CodesMarchand): OptionPaiement[] {
  const options: OptionPaiement[] = [];
  if (moyens.includes("orange_money") && codes.orange) options.push({ mode: "orange_money", libelle: LIBELLES_MODE.orange_money, code: codes.orange });
  if (moyens.includes("mtn_momo") && codes.mtn) options.push({ mode: "mtn_momo", libelle: LIBELLES_MODE.mtn_momo, code: codes.mtn });
  if (moyens.length === 0 || moyens.includes("especes")) options.push({ mode: "especes", libelle: LIBELLES_MODE.especes, code: null });
  return options;
}

/** Le paiement ne s'ouvre qu'une fois la commande acceptée (jamais en attente, refusée ou annulée). */
export function paiementOuvert(statutCommande: string, propositionActive: boolean): boolean {
  return !propositionActive && (statutCommande === "acceptee" || statutCommande === "prete" || statutCommande === "terminee");
}

/** Le client peut (re)déclarer tant que le restaurateur n'a pas confirmé la réception. */
export function peutDeclarer(statut: StatutPaiement): boolean {
  return statut !== "recu";
}

export function libelleStatutPaiement(statut: StatutPaiement, mode: ModePaiement | null): string {
  switch (statut) {
    case "recu":
      return mode === "especes" ? "Espèces encaissées" : "Paiement reçu par le restaurant";
    case "declare":
      return "Paiement déclaré, en attente de confirmation du restaurant";
    case "especes":
      return "À régler en espèces au restaurant";
    case "non_recu":
      return "Paiement non retrouvé par le restaurant";
    default:
      return "Paiement non demandé";
  }
}

/** Chiffres du numéro, indicatif compris, pour `wa.me` : « +224 622 00 00 00 » → « 224622000000 ». */
export function chiffresWhatsApp(telephone: string): string | null {
  const chiffres = telephone.replace(/\D/g, "");
  return chiffres.length >= 8 && chiffres.length <= 15 ? chiffres : null;
}

/** Lien WhatsApp vers un numéro précis avec un texte prérempli : la personne appuie elle-même sur « Envoyer ». */
export function lienWhatsAppVers(telephone: string, texte: string): string | null {
  const chiffres = chiffresWhatsApp(telephone);
  return chiffres ? `https://wa.me/${chiffres}?text=${encodeURIComponent(texte)}` : null;
}

export function formaterMontantGnf(montant: number): string {
  const arrondi = Math.round(montant);
  return `${String(Math.abs(arrondi)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} GNF`;
}

/**
 * Message qui accompagne le lien du reçu (WhatsApp). Il nomme le restaurant et la référence, donne le total, et ne dit
 * « payé » que si le restaurateur a confirmé la réception.
 */
export function texteRecuWhatsApp(o: { restaurant: string; reference: string; total: number; statut: StatutPaiement; lien: string }): string {
  const etat = o.statut === "recu" ? "Paiement confirmé." : "Récapitulatif de votre commande.";
  return `${o.restaurant} : votre reçu pour la commande ${o.reference} (${formaterMontantGnf(o.total)}). ${etat}\n${o.lien}`;
}
