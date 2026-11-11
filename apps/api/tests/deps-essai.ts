import type { ExecutionContext } from "hono";
import type { Deps } from "../src/types.ts";

const ECHEC = async () => { throw new Error("dépendance non prévue dans ce test"); };
const refus = async () => null;

/** Faux `ExecutionContext` : compte les `waitUntil` et permet d'attendre leur fin. */
export function ctxEssai(): { ctx: ExecutionContext; attendre(): Promise<void>; enregistrees(): number } {
  const promesses: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => { promesses.push(p); },
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
  return {
    ctx,
    attendre: async () => {
      const bilan = await Promise.allSettled(promesses);
      const echec = bilan.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (echec) throw echec.reason;
    },
    enregistrees: () => promesses.length,
  };
}

/** Dépendances d'essai : tout échoue bruyamment par défaut ; chaque test ne fournit que ce qu'il utilise. */
export function depsEssai(surcharge: Partial<Deps> = {}): Deps {
  return {
    configurationConnexion: () => null,
    catalogue: { restaurants: ECHEC, menu: ECHEC, quartiers: ECHEC },
    version: { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 1 },
    lireAssistance: async () => ({ whatsapp: null }),
    connexionClientActive: ECHEC,
    verificateurs: { strict: refus, local: refus },
    limiterClientApplication: async () => {},
    limiterDisponibiliteReservation: async () => {},
    lireRoles: ECHEC,
    client: { lireEspace: ECHEC, basculerFavori: ECHEC, enregistrerProfil: ECHEC, actionAdresse: ECHEC, supprimerCompte: ECHEC },
    estimerPourClient: ECHEC,
    secretRelais: () => undefined,
    suivi: {
      jetonValide: (j: unknown): j is string => typeof j === "string" && /^[A-Za-z0-9_-]{40}$/.test(j),
      limiterLecture: async () => {},
      lire: ECHEC,
      limiterAnnulation: async () => {},
      annuler: ECHEC,
      limiterReponseProposition: async () => {},
      repondreProposition: ECHEC,
      declarerPaiement: ECHEC,
    },
    restaurant: { contexte: ECHEC, lister: ECHEC, traiter: ECHEC, confirmerPaiement: ECHEC, proposer: ECHEC, modifierStatut: ECHEC, lireReglages: ECHEC, enregistrerReglages: ECHEC, lireMenu: ECHEC, actionMenu: ECHEC, definirPhoto: ECHEC, retirerPhoto: ECHEC, agirSurLivraison: ECHEC },
    appareils: { limiter: async () => {}, enregistrer: ECHEC, retirer: ECHEC },
    livreur: { limiter: async () => {}, lireFiche: ECHEC, lireEtat: ECHEC, basculer: ECHEC, avancerOffres: ECHEC, repondreOffre: ECHEC, avancerCourse: ECHEC },
    reservations: { creer: ECHEC, lister: ECHEC, lire: ECHEC, annuler: ECHEC, disponibilite: ECHEC },
    reservationsRestaurant: { lister: ECHEC, decider: ECHEC, lireReglage: ECHEC, ecrireReglage: ECHEC },
    commandes: { valider: () => { throw new Error("ECHEC : dépendance non prévue dans ce test"); }, creer: ECHEC, lister: ECHEC },
    ...surcharge,
  };
}
