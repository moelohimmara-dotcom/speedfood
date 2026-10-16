// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Hub « Mon restaurant » du restaurateur : l'état de chaque carte, calculé à partir de données que les écrans lisent déjà. Une carte n'a un état
 * (« Prêt » / « À compléter ») que si on peut le calculer honnêtement ; les autres sont de simples liens et ne comptent pas dans les tampons.
 */
export interface DonneesHub {
  publie: boolean;
  photo: boolean;
  logo: boolean;
  horaires: boolean;
  /** Au moins un moyen de paiement accepté. */
  paiement: boolean;
  /** Le restaurant a choisi son quartier. */
  quartierChoisi: boolean;
  /** Nombre de zones de livraison déclarées. */
  zonesDesservies: number;
  /** Une raison sociale figure sur les reçus et factures. */
  identiteDocuments: boolean;
}

export type CleCarteHub = "page" | "zones" | "affiche" | "documents" | "securite";

export interface CarteHub {
  cle: CleCarteHub;
  /** `null` : carte sans état (simple lien), non comptée. */
  etat: "pret" | "a_completer" | null;
  /** Texte de l'autocollant. */
  etiquette: string | null;
}

export interface ResumeHub {
  cartes: CarteHub[];
  pretes: number;
  /** Nombre de cartes qui ont un état (celles qui comptent). */
  total: number;
}

export function etatsHub(d: DonneesHub): ResumeHub {
  let manque: string | null = null;
  if (!d.photo) manque = "Photo manquante";
  else if (!d.logo) manque = "Logo manquant";
  else if (!d.horaires) manque = "Horaires manquants";
  else if (!d.paiement) manque = "Paiement à choisir";

  const cartes: CarteHub[] = [
    { cle: "page", etat: manque ? "a_completer" : "pret", etiquette: manque ?? "Prêt" },
    {
      cle: "zones",
      etat: d.quartierChoisi ? "pret" : "a_completer",
      etiquette: !d.quartierChoisi ? "Quartier à choisir" : d.zonesDesservies > 0 ? `${d.zonesDesservies} zone${d.zonesDesservies > 1 ? "s" : ""}` : "Prêt",
    },
    // L'affiche n'a de sens qu'une fois la page visible : avant la publication, le QR mènerait à une page introuvable.
    { cle: "affiche", etat: d.publie ? "pret" : "a_completer", etiquette: d.publie ? "Prêt" : "Après publication" },
    { cle: "documents", etat: d.identiteDocuments ? "pret" : "a_completer", etiquette: d.identiteDocuments ? "Prêt" : "À compléter" },
    { cle: "securite", etat: null, etiquette: null },
  ];
  const comptees = cartes.filter((c) => c.etat !== null);
  return { cartes, pretes: comptees.filter((c) => c.etat === "pret").length, total: comptees.length };
}

/** Phrase d'en-tête du hub, selon l'avancement. */
export function motHub(pretes: number, total: number): string {
  if (total > 0 && pretes === total) return "Tout est en place : votre vitrine est prête pour le service.";
  const reste = total - pretes;
  return `Votre vitrine est prête à ${pretes} sur ${total}. ${reste === 1 ? "Un petit détail" : `${reste} petits détails`} et vos clients ne verront que du beau.`;
}
