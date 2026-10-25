// Règles pures de la supervision (testables seules : npm run test:unit). Aucune lecture réseau ni base ici : `supervision.ts` mesure, ce fichier juge.

export type EtatService = "ok" | "degrade" | "panne" | "inconnu";

export interface ServiceSupervise {
  cle: string;
  libelle: string;
  etat: EtatService;
  /** Phrase lisible : ce qui a été constaté, jamais un secret ni une donnée personnelle. */
  detail: string;
  /** Temps de réponse mesuré, en millisecondes ; absent si le service ne se mesure pas par un appel. */
  mesureMs?: number;
}

/** Seuils de temps de réponse (ms) : au-delà du premier le service est « lent », au-delà du second il est considéré comme dégradé sévèrement. */
export const SEUIL_LENT_MS = 800;
export const SEUIL_TRES_LENT_MS = 2500;

/** Une mesure absente (`null`) veut dire que l'appel a échoué : c'est une panne, pas une lenteur. */
export function classerLatence(ms: number | null): EtatService {
  if (ms === null) return "panne";
  if (ms > SEUIL_TRES_LENT_MS) return "degrade";
  return "ok";
}

/** « Lent » est signalé dans le détail sans changer l'état : une base à 1 s reste utilisable, la panne et la forte lenteur seules alertent. */
export function libelleLatence(ms: number | null): string {
  if (ms === null) return "ne répond pas";
  if (ms > SEUIL_TRES_LENT_MS) return `très lent (${ms} ms)`;
  if (ms > SEUIL_LENT_MS) return `lent (${ms} ms)`;
  return `répond en ${ms} ms`;
}

const GRAVITE_ETAT: Record<EtatService, number> = { ok: 0, inconnu: 1, degrade: 2, panne: 3 };

/** État d'ensemble : le pire des services (un service « inconnu » ne masque jamais une panne, mais ne passe pas pour « ok »). */
export function etatGlobal(services: readonly ServiceSupervise[]): EtatService {
  let pire: EtatService = "ok";
  for (const s of services) if (GRAVITE_ETAT[s.etat] > GRAVITE_ETAT[pire]) pire = s.etat;
  return pire;
}

export interface MesuresOperationnelles {
  /** Commandes toujours « en attente » depuis plus de `delaiCommandeMinutes`. */
  commandesSansReponse: number;
  delaiCommandeMinutes: number;
  versementsEchoues: number;
  litigesAHumain: number;
  fcmConfigure: boolean;
  appareilsPush: number;
  paiementActif: boolean;
  paiementValide: boolean;
}

export interface AlerteSupervision {
  cle: string;
  gravite: "attention" | "critique";
  libelle: string;
  /** Où agir dans l'administration. */
  lien?: string;
}

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

/** Alertes à afficher, de la plus grave à la moins grave. Une liste vide = rien à signaler. */
export function alertesDepuis(m: MesuresOperationnelles): AlerteSupervision[] {
  const alertes: AlerteSupervision[] = [];
  if (m.commandesSansReponse > 0) {
    alertes.push({
      cle: "commandes_sans_reponse",
      gravite: "critique",
      libelle: `${m.commandesSansReponse} ${pluriel(m.commandesSansReponse, "commande attend", "commandes attendent")} une réponse depuis plus de ${m.delaiCommandeMinutes} minutes.`,
      lien: "/system/repartition",
    });
  }
  if (m.versementsEchoues > 0) {
    alertes.push({
      cle: "versements_echoues",
      gravite: "critique",
      libelle: `${m.versementsEchoues} ${pluriel(m.versementsEchoues, "versement a échoué", "versements ont échoué")} : le restaurant ou le livreur n'a pas été payé.`,
      lien: "/system/paiements",
    });
  }
  if (m.paiementActif && !m.paiementValide) {
    alertes.push({
      cle: "paiement_sans_bareme",
      gravite: "critique",
      libelle: "Le paiement en ligne est actif alors que le barème n'est pas validé.",
      lien: "/system/paiements",
    });
  }
  if (m.litigesAHumain > 0) {
    alertes.push({
      cle: "litiges_a_traiter",
      gravite: "attention",
      libelle: `${m.litigesAHumain} ${pluriel(m.litigesAHumain, "litige attend", "litiges attendent")} une décision humaine.`,
      lien: "/system/paiements",
    });
  }
  if (!m.fcmConfigure) {
    alertes.push({
      cle: "notifications_non_configurees",
      gravite: "attention",
      libelle: "Les notifications poussées ne sont pas configurées : personne ne reçoit d'alerte de commande sur son téléphone.",
    });
  } else if (m.appareilsPush === 0) {
    alertes.push({
      cle: "aucun_appareil",
      gravite: "attention",
      libelle: "Aucun téléphone n'est enregistré pour les notifications poussées.",
    });
  }
  const ordre = { critique: 0, attention: 1 } as const;
  return alertes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
}
