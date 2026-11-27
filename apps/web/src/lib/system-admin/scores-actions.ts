"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { calculerScoresMois, lireReglagesScore } from "@/lib/restaurant/score-service";

export interface EtatReglagesScore {
  erreur?: string;
  succes?: string;
}

const chemin = "/system/scores-qualite";

function entier(formData: FormData, champ: string, min: number, max: number, libelle: string): { valeur: number } | { erreur: string } {
  const brut = String(formData.get(champ) ?? "").trim();
  if (!/^\d{1,4}$/.test(brut)) return { erreur: `${libelle} : entrez un nombre entier.` };
  const valeur = Number(brut);
  if (valeur < min || valeur > max) return { erreur: `${libelle} : entre ${min} et ${max}.` };
  return { valeur };
}

/** Seuils des paliers et délai d'acceptation du score : écrits en base, relus à chaque calcul mensuel. Journalisé. */
export async function enregistrerReglagesScoreAction(_etat: EtatReglagesScore, formData: FormData): Promise<EtatReglagesScore> {
  const contexte = await verifierPermission("parametres.editer");
  const excellent = entier(formData, "seuil_excellent", 1, 100, "Seuil excellent");
  if ("erreur" in excellent) return excellent;
  const tresBon = entier(formData, "seuil_tres_bon", 1, 99, "Seuil très bon");
  if ("erreur" in tresBon) return tresBon;
  const bon = entier(formData, "seuil_bon", 1, 98, "Seuil bon");
  if ("erreur" in bon) return bon;
  const moyen = entier(formData, "seuil_moyen", 1, 97, "Seuil moyen");
  if ("erreur" in moyen) return moyen;
  if (!(excellent.valeur > tresBon.valeur && tresBon.valeur > bon.valeur && bon.valeur > moyen.valeur)) {
    return { erreur: "Les seuils doivent être strictement décroissants : excellent, puis très bon, puis bon, puis moyen." };
  }
  const delaiMinutes = entier(formData, "delai_acceptation_minutes", 1, 120, "Délai d'acceptation (minutes)");
  if ("erreur" in delaiMinutes) return delaiMinutes;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table absente des types générés (migrations campagnes et score)
  const admin = creerClientAdmin() as unknown as { from: (table: string) => any };
  const { data: touchees, error } = await admin.from("parametres_score").upsert({
    id: true,
    seuil_excellent: excellent.valeur,
    seuil_tres_bon: tresBon.valeur,
    seuil_bon: bon.valeur,
    seuil_moyen: moyen.valeur,
    delai_acceptation_secondes: delaiMinutes.valeur * 60,
    mis_a_jour_le: new Date().toISOString(),
  }).select("id");
  if (error || !touchees || touchees.length === 0) {
    if (error) return { erreur: "Les réglages n'ont pas pu être enregistrés : la base n'est peut-être pas encore à jour pour les réglages du score." };
    return { erreur: "Les réglages n'ont pas pu être enregistrés. Réessayez dans un instant." };
  }
  await journaliserActionSysteme(contexte, {
    action: "score.reglages_modifies",
    cibleType: "parametres_score",
    cibleId: "global",
    motif: `seuils ${excellent.valeur}/${tresBon.valeur}/${bon.valeur}/${moyen.valeur}, délai d'acceptation ${delaiMinutes.valeur} minute(s)`,
  });
  revalidatePath(chemin);
  return { succes: "Réglages enregistrés : ils s'appliqueront au prochain calcul." };
}

/** Recalcule le mois écoulé maintenant, sans attendre le déclenchement mensuel. Journalisé avec le nombre de restaurants calculés. */
export async function recalculerScoresAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("parametres.editer");
  void formData;
  const { restaurants } = await calculerScoresMois();
  await journaliserActionSysteme(contexte, {
    action: "score.recalcul_manuel",
    cibleType: "scores_qualite_mensuels",
    cibleId: "mois_ecoule",
    motif: `recalcul manuel déclenché depuis la console : ${restaurants} restaurant(s) calculé(s)`,
  });
  revalidatePath(chemin);
}

/** Trace l'action prise sur l'échelle de dégradation (avertissement envoyé, contact fait) : la décision reste humaine, la trace est écrite. */
export async function marquerEtapeDegradationAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("parametres.editer");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const etape = String(formData.get("etape") ?? "");
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(restaurantId)) return;
  if (!["avertissement_1", "avertissement_2_contact", "retrait_avantages", "suspension"].includes(etape)) return;
  await journaliserActionSysteme(contexte, {
    action: "score.etape_degradation",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif: `étape marquée comme prise par l'équipe : ${etape}`,
  });
  revalidatePath(chemin);
}

export { lireReglagesScore };
