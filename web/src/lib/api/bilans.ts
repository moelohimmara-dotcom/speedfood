/**
 * Bilans d'activité des espaces professionnels de l'application (restaurateur : « Activité » ; livreur : « Gains »). Calculs purs, testés : le serveur regroupe des lignes
 * déjà lues (avec l'identité du compte) par jour. Le fuseau de Conakry est celui de l'heure universelle (GMT+0) : le « jour » est le jour UTC.
 */
export interface Bilan {
  /** Nombre de commandes (restaurateur) ou de courses (livreur). */
  nombre: number;
  /** Montant en GNF, entier (jamais de flottant). */
  montantGnf: number;
}

export interface LigneDatee {
  quand: string;
  montantGnf: number;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Début du jour (00:00 UTC) contenant `maintenant`. */
export function debutDuJour(maintenant: number): number {
  return Math.floor(maintenant / JOUR_MS) * JOUR_MS;
}

/** Bilan d'aujourd'hui et des 7 derniers jours (aujourd'hui compris) à partir de lignes datées. Une date illisible est ignorée. */
export function bilansJourEtSemaine(lignes: LigneDatee[], maintenant: number): { aujourdhui: Bilan; semaine: Bilan } {
  const debutJour = debutDuJour(maintenant);
  const debutSemaine = debutJour - 6 * JOUR_MS;
  const aujourdhui: Bilan = { nombre: 0, montantGnf: 0 };
  const semaine: Bilan = { nombre: 0, montantGnf: 0 };
  for (const l of lignes) {
    const t = Date.parse(l.quand);
    if (!Number.isFinite(t) || t > maintenant + 60_000) continue;
    const montant = Number.isInteger(l.montantGnf) && l.montantGnf > 0 ? l.montantGnf : 0;
    if (t >= debutSemaine) {
      semaine.nombre += 1;
      semaine.montantGnf += montant;
    }
    if (t >= debutJour) {
      aujourdhui.nombre += 1;
      aujourdhui.montantGnf += montant;
    }
  }
  return { aujourdhui, semaine };
}

export interface RepartitionStatuts {
  recues: number;
  terminees: number;
  refusees: number;
  annulees: number;
  enCours: number;
}

/** Répartition des commandes d'un restaurant par issue (reçues = toutes ; en cours = ni terminées, ni refusées, ni annulées). */
export function repartitionStatuts(statuts: string[]): RepartitionStatuts {
  const r: RepartitionStatuts = { recues: statuts.length, terminees: 0, refusees: 0, annulees: 0, enCours: 0 };
  for (const s of statuts) {
    if (s === "terminee") r.terminees += 1;
    else if (s === "refusee") r.refusees += 1;
    else if (s === "annulee") r.annulees += 1;
    else r.enCours += 1;
  }
  return r;
}

export interface PaiementPourCompteurs {
  etat: string;
  versements: Array<{ etat: string }>;
  litiges: Array<{ etat: string }>;
}

/** Les trois chiffres de tête de l'écran des paiements : en attente du client, versements à traiter (à verser ou échoués), litiges confiés à l'exploitation. */
export function compteursPaiements(paiements: PaiementPourCompteurs[]): { enAttente: number; versementsATraiter: number; litigesAHumain: number } {
  return {
    enAttente: paiements.filter((p) => p.etat === "en_attente").length,
    versementsATraiter: paiements.flatMap((p) => p.versements).filter((v) => v.etat === "a_verser" || v.etat === "echoue").length,
    litigesAHumain: paiements.flatMap((p) => p.litiges).filter((l) => l.etat === "a_humain").length,
  };
}
