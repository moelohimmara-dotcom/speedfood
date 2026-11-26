import { repondre, repondreErreur } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { lireFinances } from "@/lib/system-admin/finances-service";

/** Lecture seule des relevés réels pour l'application : les taux se règlent sur le site (Paramètres, Paiement), les versements s'y suivent (Paiements). */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "parametres.editer");
  if (!auth.ok) return auth.reponse;
  try {
    const url = new URL(request.url);
    const debut = url.searchParams.get("debut");
    const fin = url.searchParams.get("fin");
    const debutDate = debut ? new Date(`${debut}T00:00:00Z`) : undefined;
    const finDate = fin ? new Date(`${fin}T00:00:00Z`) : undefined;
    const donnees = await lireFinances(
      debutDate && !Number.isNaN(debutDate.getTime()) ? debutDate : undefined,
      finDate && !Number.isNaN(finDate.getTime()) ? finDate : undefined,
    );
    return repondre({ ok: true, parametres: { tauxDefaut: donnees.parametres.tauxDefaut, rythme: donnees.parametres.rythme, devise: donnees.parametres.devise }, contrats: donnees.contrats, releve: donnees.lignes });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les finances n'ont pas pu être chargées. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
