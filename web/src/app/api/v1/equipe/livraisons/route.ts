import { repondre } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerLivraisonsAdmin, listerLivreursAdmin } from "@/lib/livraison/admin-lectures";

/**
 * Livraisons et livreurs de l'exploitation (mêmes lectures que `/system/livraisons` et `/system/livraisons/livreurs`) : courses en cours, livreur sollicité ou affecté,
 * fiches des livreurs. Permission `commande.support`. Le dossier d'identité d'un livreur n'est jamais renvoyé (il reste réservé au super administrateur, sur le site).
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "commande.support");
  if (!auth.ok) return auth.reponse;
  const [livraisons, livreurs] = await Promise.all([listerLivraisonsAdmin(), listerLivreursAdmin()]);
  return repondre({ ok: true, livraisons, livreurs });
}

export const dynamic = "force-dynamic";
