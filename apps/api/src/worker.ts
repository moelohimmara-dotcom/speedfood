import { VERSION_APPLICATION } from "@speedfood/shared/application/version";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { connexionClientActive } from "@/lib/client/reglage";
import { creerApp } from "./app.ts";

/** Valeur provisoire : la Tâche 7 la remplace par le vrai câblage. Aucune route montée ne l'appelle encore. */
const NON_CABLE = async (): Promise<never> => { throw new Error("non câblé"); };

// Câblage de PRODUCTION : les routes reçoivent les services du site, jamais une copie de leurs règles.
const app = creerApp({
  version: VERSION_APPLICATION,
  lireAssistance: async () => {
    const { whatsapp } = await lireReglagesAssistance();
    return { whatsapp };
  },
  connexionClientActive,
  // Provisoires (Tâche 7) :
  verificateurs: { strict: NON_CABLE, local: NON_CABLE },
  limiterClientApplication: NON_CABLE,
  lireRoles: NON_CABLE,
  client: { lireEspace: NON_CABLE, basculerFavori: NON_CABLE, enregistrerProfil: NON_CABLE, actionAdresse: NON_CABLE, supprimerCompte: NON_CABLE },
  estimerPourClient: NON_CABLE,
  secretRelais: () => undefined,
});

export default { fetch: app.fetch };
