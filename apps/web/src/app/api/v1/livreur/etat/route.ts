import { lireEtatLivreur } from "@/lib/livraison/livreur";
import { livreurAuthentifie } from "@/lib/api/v1-livreur";
import { repondre } from "@/lib/api/v1";

/**
 * État du livreur pour l'application : sa fiche, l'offre en cours, sa course, la dernière livraison à noter. `etat: null` = ce compte n'est pas un compte livreur.
 * Les coordonnées du client ne sont révélées qu'après la récupération de la commande (règle de `lireEtatLivreur`).
 */
export async function GET(request: Request) {
  const auth = await livreurAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  return repondre({ ok: true, etat: await lireEtatLivreur(auth.utilisateurId) });
}

export const dynamic = "force-dynamic";
