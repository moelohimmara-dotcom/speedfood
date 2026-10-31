import type { ExecutionContext } from "hono";
import { VERSION_APPLICATION } from "@speedfood/shared/application/version";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { connexionClientActive } from "@/lib/client/reglage";
import { lireRolesCompte } from "@/lib/api/moi-service";
import { creerClientAdmin } from "@/lib/db/admin";
import { limiterAnnulationClient, limiterClientApplication, limiterLectureSuivi, limiterReponseProposition } from "@/lib/securite/limitation-debit";
import { estJetonValide } from "@/lib/commande/jetons";
import { chargerSuiviParJeton } from "@/lib/commande/requetes";
import { annulerParClient } from "@/lib/commande/annulation-client";
import { repondreProposition } from "@/lib/commande/propositions";
import { validerCreationCommande } from "@/lib/commande/validation";
import { executerCreationCoeur } from "@/lib/commande/creation-coeur";
import { listerMesCommandes } from "@/lib/client/mes-commandes";
import { actionAdresseClient, basculerFavoriClient, enregistrerProfilClient, lireEspaceClient, supprimerCompteClient } from "@/lib/client/espace-service";
import { estimerPourClient } from "@/lib/livraison/estimation-service";
import { creerApp } from "./app.ts";
import { configJetonSupabase, creerVerificateurLocal, creerVerificateurStrict } from "./identite/jeton.ts";

// Câblage de PRODUCTION : les routes reçoivent les services du site, jamais une copie de leurs règles. Les secrets sont lus à l'APPEL (jamais au chargement du module).
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
  // Suivi : le jeton de suivi (dans le corps) est la clé d'accès ; aucun jeton porteur.
  suivi: {
    jetonValide: estJetonValide,
    limiterLecture: limiterLectureSuivi,
    lire: chargerSuiviParJeton,
    limiterAnnulation: limiterAnnulationClient,
    annuler: annulerParClient,
    limiterReponseProposition,
    repondreProposition,
  },
  commandes: {
    valider: validerCreationCommande,
    // antiRobot: false : l'application native ne produit pas de jeton Turnstile ; la protection est le jeton porteur strict + les plafonds.
    // apres = ctx.waitUntil (fourni par la route) : l'alerte du restaurant part après la réponse, seulement pour une commande nouvelle.
    creer: (valeurs, utilisateurId, apres) => executerCreationCoeur(valeurs, utilisateurId, { antiRobot: false, apres }),
    lister: (utilisateurId) => listerMesCommandes(utilisateurId, { avecJeton: true }),
  },
});

// Le troisième argument (contexte d'exécution) est transmis explicitement : `c.executionCtx` en dépend (`waitUntil`).
export default { fetch: (requete: Request, env: unknown, ctx: ExecutionContext) => app.fetch(requete, env, ctx) };
