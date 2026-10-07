import "server-only";
import { cache } from "react";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Lecture applicative des interrupteurs de fonctionnalités (`fonctionnalites`, piloté par le super administrateur dans
 * `/system/mises-a-jour`). Service-role : le visiteur n'a aucune session de rôle système. Les valeurs sont lues une seule fois par
 * requête (`cache`). En cas d'échec de lecture, une fonctionnalité reste ACTIVE : une panne de lecture ne doit pas couper le service
 * (l'interrupteur d'urgence agit quand la lecture fonctionne ; un état inconnu ne durcit rien).
 */
export type CleFonctionnalite = "animations_public" | "scenes_envie_accueil" | "commande_a_table" | "documents_recus" | "lien_court_scans" | "accueil_en_blocs";

const lireToutes = cache(async (): Promise<Record<string, boolean>> => {
  try {
    const { data, error } = await creerClientAdmin().from("fonctionnalites").select("cle, active");
    if (error || !data) return {};
    return Object.fromEntries(data.map((l) => [l.cle, l.active]));
  } catch {
    return {};
  }
});

export async function fonctionnaliteActive(cle: CleFonctionnalite): Promise<boolean> {
  return (await lireToutes())[cle] ?? true;
}
