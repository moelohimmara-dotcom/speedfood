/**
 * Reçus et factures établis par le restaurant : règles SANS dépendance (testables seules).
 *
 * Un document est établi PAR le restaurant, sous sa responsabilité. Par défaut il est « non fiscal ». Le mode « fiscal déclaré » affiche
 * seulement les mentions que le restaurant a saisies (NIF, RCCM, TVA incluse) : Speedfood n'est pas un système de facturation certifié
 * et ne garantit pas la conformité fiscale d'un document.
 */

export type TypeDocument = "recu" | "facture";
export type RegimeDocument = "non_fiscal" | "fiscal_declare";

export interface IdentiteDocuments {
  raisonSociale: string | null;
  adresse: string | null;
  telephone: string | null;
  nif: string | null;
  rccm: string | null;
  regime: RegimeDocument;
  tvaTaux: number | null;
  mention: string | null;
}

export interface EmetteurDocument {
  nom: string;
  adresse: string | null;
  telephone: string | null;
  nif: string | null;
  rccm: string | null;
  mention: string | null;
}

export function titreDocument(type: TypeDocument): string {
  return type === "recu" ? "Reçu de paiement" : "Facture";
}

/** Phrase obligatoire en bas du document : dit clairement s'il est fiscal ou non, et qui en est responsable. */
export function mentionRegime(regime: RegimeDocument): string {
  return regime === "fiscal_declare"
    ? "Document établi par le restaurant sous sa seule responsabilité, avec les mentions qu'il a déclarées. Speedfood ne reçoit aucun paiement et ne certifie pas ce document."
    : "Document non fiscal, établi par le restaurant à titre de justificatif de commande. Speedfood ne reçoit aucun paiement : le règlement est fait directement auprès du restaurant.";
}

/** TVA incluse dans un prix toutes taxes comprises, en GNF entiers. `null` quand il n'y a pas de TVA à afficher. */
export function tvaIncluse(totalTtc: number, taux: number | null): number | null {
  if (!taux || taux <= 0) return null;
  return Math.round((totalTtc * taux) / (100 + taux));
}

const FORME_NUMERO_FISCAL = /^[0-9A-Za-z./ -]{3,30}$/;

function texteFacultatif(brut: string, max: number): string | null | "invalide" {
  const v = brut.replace(/\s+/g, " ").trim();
  if (v === "") return null;
  return v.length <= max ? v : "invalide";
}

export type ResultatIdentite = { ok: true; valeur: IdentiteDocuments } | { ok: false; erreur: string };

/** Valide la saisie du formulaire « identité sur mes documents ». Aucun champ n'est obligatoire en mode non fiscal. */
export function lireIdentiteDocuments(champs: Record<string, string>): ResultatIdentite {
  const raison = texteFacultatif(champs.raison_sociale ?? "", 120);
  const adresse = texteFacultatif(champs.adresse ?? "", 200);
  const telephone = texteFacultatif(champs.telephone ?? "", 30);
  const mention = texteFacultatif(champs.mention ?? "", 200);
  const nif = texteFacultatif(champs.nif ?? "", 30);
  const rccm = texteFacultatif(champs.rccm ?? "", 30);
  if ([raison, adresse, telephone, mention, nif, rccm].includes("invalide")) {
    return { ok: false, erreur: "Un des champs est trop long." };
  }
  if (raison !== null && (raison as string).length < 2) {
    return { ok: false, erreur: "Le nom sur les documents doit faire au moins 2 caractères." };
  }
  for (const [valeur, libelle] of [[nif, "NIF"], [rccm, "RCCM"]] as const) {
    if (valeur && !FORME_NUMERO_FISCAL.test(valeur)) {
      return { ok: false, erreur: `Le ${libelle} ne peut contenir que des lettres, chiffres, points, tirets et barres.` };
    }
  }
  const regime: RegimeDocument = champs.regime === "fiscal_declare" ? "fiscal_declare" : "non_fiscal";
  let tvaTaux: number | null = null;
  const tvaBrut = (champs.tva_taux ?? "").trim();
  if (tvaBrut !== "") {
    if (!/^\d{1,2}$/.test(tvaBrut) || Number(tvaBrut) > 30) {
      return { ok: false, erreur: "Le taux de TVA est un nombre entier entre 0 et 30." };
    }
    tvaTaux = Number(tvaBrut);
  }
  if (regime === "fiscal_declare" && !nif) {
    return { ok: false, erreur: "Pour des documents « fiscal déclaré », renseignez votre NIF." };
  }
  return {
    ok: true,
    valeur: {
      raisonSociale: raison as string | null,
      adresse: adresse as string | null,
      telephone: telephone as string | null,
      nif: nif as string | null,
      rccm: rccm as string | null,
      regime,
      tvaTaux: regime === "fiscal_declare" ? tvaTaux : null,
      mention: mention as string | null,
    },
  };
}

/** Texte qui accompagne le lien d'un document (WhatsApp). */
export function texteDocumentWhatsApp(o: { type: TypeDocument; numero: string; restaurant: string; total: number; lien: string }): string {
  const total = String(Math.round(o.total)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${o.restaurant} : ${o.type === "recu" ? "votre reçu" : "votre facture"} ${o.numero} (${total} GNF).\n${o.lien}`;
}
