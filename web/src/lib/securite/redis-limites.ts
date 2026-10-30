import type { CommandeRedis } from "./redis-client";

/**
 * Règles pures de la limitation de débit sur Redis (compteur à fenêtre fixe, comme la fonction de la base `fn_limiter_debit`) : aucune entrée-sortie ici, tout
 * est testable sans réseau. Préfixe `sf:v1:` : il versionne les clés (changer de format = changer de version, sans collision avec l'ancien).
 */

export const PREFIXE_REDIS = "sf:v1:";
/** Offre gratuite d'Upstash : 500 000 commandes par mois (à confirmer sur leur page ; réglable par `UPSTASH_QUOTA_MENSUEL`). */
export const QUOTA_MENSUEL_PAR_DEFAUT = 500_000;

export interface LimiteDemandee {
  /** Clé complète du compteur (jamais d'adresse ni de téléphone en clair : une empreinte). */
  cle: string;
  max: number;
  fenetreSecondes: number;
}

export function cleCompteur(nomRegle: string, empreinte: string): string {
  return `${PREFIXE_REDIS}rl:${nomRegle}:${empreinte}`;
}

export function cleConsommation(maintenant: Date): string {
  return `${PREFIXE_REDIS}conso:${maintenant.getUTCFullYear()}-${String(maintenant.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Deux commandes par limite : « crée le compteur à 0 avec sa durée de vie s'il n'existe pas » puis « ajoute 1 ». La durée de vie part du premier passage : c'est
 * une fenêtre fixe. Une dernière commande compte la consommation du mois (pour l'alerte de quota) : elle renvoie le total.
 */
export function commandesLimites(limites: readonly LimiteDemandee[], maintenant: Date): CommandeRedis[] {
  const commandes: CommandeRedis[] = limites.flatMap((l) => [["SET", l.cle, "0", "EX", l.fenetreSecondes, "NX"], ["INCR", l.cle]] as CommandeRedis[]);
  commandes.push(["INCRBY", cleConsommation(maintenant), commandes.length + 1]);
  return commandes;
}

export interface DecisionLimites {
  /** Vrai si TOUTES les limites sont respectées. */
  autorise: boolean;
  /** Total des commandes Redis consommées ce mois-ci (après ce lot), ou null si illisible. */
  consommationMois: number | null;
  /** Nombre de commandes Redis de ce lot. */
  commandesDuLot: number;
}

/** Lit les valeurs du lot : pour chaque limite, le compteur est au rang impair ; le dernier élément est la consommation du mois. Illisible = null (repli). */
export function decider(limites: readonly LimiteDemandee[], valeurs: readonly unknown[]): DecisionLimites | null {
  if (valeurs.length !== limites.length * 2 + 1) return null;
  let autorise = true;
  for (let i = 0; i < limites.length; i++) {
    const compteur = Number(valeurs[i * 2 + 1]);
    if (!Number.isFinite(compteur)) return null;
    if (compteur > limites[i].max) autorise = false;
  }
  const total = Number(valeurs[valeurs.length - 1]);
  return { autorise, consommationMois: Number.isFinite(total) ? total : null, commandesDuLot: valeurs.length };
}

/** Vrai quand ce lot fait passer la consommation au-dessus de `part` (0 à 1) du quota : l'alerte ne part qu'une fois par seuil. */
export function franchitSeuil(consommationMois: number, commandesDuLot: number, quota: number, part: number): boolean {
  const seuil = quota * part;
  return consommationMois >= seuil && consommationMois - commandesDuLot < seuil;
}
