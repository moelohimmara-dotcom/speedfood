import { VERSION_APPLICATION } from "@speedfood/shared/application/version";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { creerApp } from "./app.ts";

// Câblage de PRODUCTION : les routes reçoivent les services du site, jamais une copie de leurs règles.
const app = creerApp({
  version: VERSION_APPLICATION,
  lireAssistance: async () => {
    const { whatsapp } = await lireReglagesAssistance();
    return { whatsapp };
  },
});

export default { fetch: app.fetch };
