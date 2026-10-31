import type { ExecutionContext } from "hono";
import { VERSION_APPLICATION } from "@speedfood/shared/application/version";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { connexionClientActive } from "@/lib/client/reglage";
import { lireRolesCompte } from "@/lib/api/moi-service";
import { creerClientAdmin } from "@/lib/db/admin";
import { limiterClientApplication } from "@/lib/securite/limitation-debit";
import { actionAdresseClient, basculerFavoriClient, enregistrerProfilClient, lireEspaceClient, supprimerCompteClient } from "@/lib/client/espace-service";
import { estimerPourClient } from "@/lib/livraison/estimation-service";
import { creerApp } from "./app.ts";
import { configJetonSupabase, creerVerificateurLocal, creerVerificateurStrict } from "./identite/jeton.ts";

// Câblage de PRODUCTION : les routes reçoivent les services du site, jamais une copie de leurs règles. Les secrets sont lus à l'APPEL (jamais au chargement du module).
const nonCable = async (): Promise<never> => { throw new Error("non câblé"); };
let local: ReturnType<typeof creerVerificateurLocal> | undefined;

const app = creerApp({
  version: VERSION_APPLICATION,
  lireAssistance: async () => {
    const { whatsapp } = await lireReglagesAssistance();
    return { whatsapp };
  },
  connexionClientActive,
  verificateurs: {
    strict: creerVerificateurStrict(() => creerClientAdmin()),
    // Mode local : les clés publiques sont lues une fois par isolat. Non utilisé par les routes de ce plan (toutes strictes) ; câblé pour le plan 1c.
    local: (jeton) => {
      local ??= creerVerificateurLocal(configJetonSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""));
      return local(jeton);
    },
  },
  limiterClientApplication,
  lireRoles: lireRolesCompte,
  client: {
    lireEspace: lireEspaceClient,
    basculerFavori: basculerFavoriClient,
    enregistrerProfil: enregistrerProfilClient,
    actionAdresse: actionAdresseClient,
    supprimerCompte: supprimerCompteClient,
  },
  estimerPourClient,
  secretRelais: () => process.env.RELAIS_SECRET,
  // Provisoire (Tâche 2) : aucune route n'est encore montée, le câblage réel vient avec les routes.
  suivi: {
    jetonValide: (jeton: unknown): jeton is string => typeof jeton === "string" && /^[A-Za-z0-9_-]{40}$/.test(jeton),
    limiterLecture: nonCable,
    lire: nonCable,
    limiterAnnulation: nonCable,
    annuler: nonCable,
    limiterReponseProposition: nonCable,
    repondreProposition: nonCable,
  },
  commandes: { valider: () => { throw new Error("non câblé"); }, creer: nonCable, lister: nonCable },
});

// Le troisième argument (contexte d'exécution) est transmis explicitement : `c.executionCtx` en dépend (`waitUntil`).
export default { fetch: (requete: Request, env: unknown, ctx: ExecutionContext) => app.fetch(requete, env, ctx) };
