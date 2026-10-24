"use server";

import { revalidatePath } from "next/cache";
import { estUuid } from "@/lib/commande/commun";
import { marquerVersementEffectueAction } from "./paiements";
import { verifierPermission } from "./contexte";

/** Le versement réel reste hors de l'application ; cette action ne fait que réutiliser le journal de paiement existant. */
export async function marquerPaieLivreurAction(versementId: string, reference: string): Promise<{ erreur?: string; succes?: string }> {
  await verifierPermission("parametres.editer");
  if (!estUuid(versementId)) return { erreur: "Versement invalide." };
  const resultat = await marquerVersementEffectueAction(versementId, reference);
  if (resultat.erreur) return { erreur: resultat.erreur };
  revalidatePath("/system/livraisons/paie");
  return { succes: resultat.succes ?? "Versement simulé enregistré et audité." };
}
