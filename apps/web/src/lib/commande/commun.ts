import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { STATUTS_COMMANDE, type StatutCommande } from "@/lib/contracts/statuts";
import type { StatutProposition } from "@/lib/contracts/commande";

/**
 * Client Supabase typé utilisé par les modules de commande, qu'il soit lié à une
 * session membre (`creerClientServeur`, RLS) ou en service-role
 * (`creerClientAdmin`, parcours invité sans policy anon) — voir ADR-011.
 */
export type ClientCommandeDb = SupabaseClient<Database>;

const STATUTS_PROPOSITION: readonly StatutProposition[] = [
  "en_attente",
  "acceptee",
  "refusee",
  "expiree",
];

/**
 * Convertit un statut stocké (texte en base) en statut typé, en le validant.
 * Les colonnes `statut` sont typées `string` par Supabase : sans ce garde-fou,
 * une valeur inattendue passerait silencieusement dans toute la chaîne.
 */
export function versStatutCommande(valeur: string): StatutCommande {
  if ((STATUTS_COMMANDE as readonly string[]).includes(valeur)) {
    return valeur as StatutCommande;
  }
  throw new ErreurMetier("ERREUR_SERVEUR", `Statut de commande inconnu en base : ${valeur}`);
}

export function versStatutProposition(valeur: string): StatutProposition {
  if ((STATUTS_PROPOSITION as readonly string[]).includes(valeur)) {
    return valeur as StatutProposition;
  }
  throw new ErreurMetier("ERREUR_SERVEUR", `Statut de proposition inconnu en base : ${valeur}`);
}

/** Montant GNF entier, borné — jamais de virgule flottante (ADR-006). */
export function estMontantGnfEntier(valeur: unknown): valeur is number {
  return typeof valeur === "number" && Number.isInteger(valeur) && valeur >= 0 && valeur <= 10_000_000;
}

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function estUuid(valeur: unknown): valeur is string {
  return typeof valeur === "string" && REGEX_UUID.test(valeur);
}
