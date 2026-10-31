import type { Deps } from "../src/types.ts";

const ECHEC = async () => { throw new Error("dépendance non prévue dans ce test"); };
const refus = async () => null;

/** Dépendances d'essai : tout échoue bruyamment par défaut ; chaque test ne fournit que ce qu'il utilise. */
export function depsEssai(surcharge: Partial<Deps> = {}): Deps {
  return {
    version: { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 1 },
    lireAssistance: async () => ({ whatsapp: null }),
    connexionClientActive: ECHEC,
    verificateurs: { strict: refus, local: refus },
    limiterClientApplication: async () => {},
    lireRoles: ECHEC,
    client: { lireEspace: ECHEC, basculerFavori: ECHEC, enregistrerProfil: ECHEC, actionAdresse: ECHEC, supprimerCompte: ECHEC },
    estimerPourClient: ECHEC,
    secretRelais: () => undefined,
    ...surcharge,
  };
}
