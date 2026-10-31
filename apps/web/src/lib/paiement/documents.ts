import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { estJetonValide } from "@/lib/commande/jetons";
import type { EmetteurDocument, RegimeDocument, TypeDocument } from "./documents-regles";

export interface LigneDocument {
  nom: string;
  prix: number;
  quantite: number;
  options: string[];
}

export interface DocumentEmis {
  type: TypeDocument;
  numero: string;
  emisLe: string;
  regime: RegimeDocument;
  emetteur: EmetteurDocument;
  clientNom: string | null;
  lignes: LigneDocument[];
  sousTotal: number;
  fraisLivraison: number;
  total: number;
  tvaTaux: number | null;
  tvaMontant: number | null;
}

function lireEmetteur(brut: unknown): EmetteurDocument {
  const o = (brut ?? {}) as Record<string, unknown>;
  const t = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
  return { nom: t(o.nom) ?? "Restaurant", adresse: t(o.adresse), telephone: t(o.telephone), nif: t(o.nif), rccm: t(o.rccm), mention: t(o.mention) };
}

function lireLignes(brut: unknown): LigneDocument[] {
  if (!Array.isArray(brut)) return [];
  return brut.map((l) => {
    const o = (l ?? {}) as Record<string, unknown>;
    return {
      nom: typeof o.nom === "string" ? o.nom : "",
      prix: typeof o.prix === "number" ? o.prix : 0,
      quantite: typeof o.quantite === "number" ? o.quantite : 1,
      options: Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === "string") : [],
    };
  });
}

/**
 * Documents établis pour la commande du jeton de suivi (le jeton, secret du client, est la clé d'accès). Lecture par le serveur
 * (service-role) : ces tables ne sont lisibles ni par le public ni par un autre restaurant.
 */
export async function chargerDocumentsParJeton(jeton: string): Promise<Partial<Record<TypeDocument, DocumentEmis>>> {
  if (!estJetonValide(jeton)) return {};
  const db = creerClientAdmin();
  const { data: commande } = await db.from("orders").select("id").eq("jeton_suivi", jeton).maybeSingle();
  if (!commande) return {};
  const { data } = await db.from("documents_commande").select("*").eq("order_id", commande.id);
  const resultat: Partial<Record<TypeDocument, DocumentEmis>> = {};
  for (const d of data ?? []) {
    if (d.type !== "recu" && d.type !== "facture") continue;
    resultat[d.type] = {
      type: d.type,
      numero: d.numero,
      emisLe: d.emis_le,
      regime: d.regime === "fiscal_declare" ? "fiscal_declare" : "non_fiscal",
      emetteur: lireEmetteur(d.emetteur),
      clientNom: d.client_nom,
      lignes: lireLignes(d.lignes),
      sousTotal: d.sous_total,
      fraisLivraison: d.frais_livraison,
      total: d.total,
      tvaTaux: d.tva_taux,
      tvaMontant: d.tva_montant,
    };
  }
  return resultat;
}
