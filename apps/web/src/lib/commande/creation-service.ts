import "server-only";
import { after } from "next/server";
import type { CreationCommandePayload, ResultatCreationCommande } from "@/lib/contracts/commande";
import { executerCreationCoeur } from "./creation-coeur";

/** Enveloppe du site : exécute le cœur et planifie l'alerte du restaurant avec `after` de Next. L'API (Worker) appelle le cœur avec `waitUntil`. */
export async function executerCreationCommande(
  valeurs: CreationCommandePayload,
  utilisateurId: string | null,
  options: { antiRobot: boolean }
): Promise<ResultatCreationCommande> {
  return executerCreationCoeur(valeurs, utilisateurId, { ...options, apres: (tache) => after(tache) });
}
