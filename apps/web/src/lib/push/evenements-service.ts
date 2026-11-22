import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { notifierRestaurant } from "./envoi";
import { cleEvenement, estAbandonne, prochaineTentative } from "./evenements";

/**
 * File d'événements de commande, côté serveur seulement (clé de service). `journaliserCommandeNouvelle`
 * écrit l'événement à la création d'une commande, sans jamais faire échouer la création ; la tâche
 * planifiée du site appelle `traiterFileEvenements` toutes les 5 minutes pour (ré)envoyer les alertes
 * en attente. Un événement envoyé avec au moins un échec d'appareil est repris : mieux vaut une alerte
 * en double qu'une commande jamais vue (la console, elle, ne sonne qu'à la première vue).
 */

type Admin = ReturnType<typeof creerClientAdmin>;

export async function journaliserCommandeNouvelle(commandeId: string, restaurantId: string): Promise<void> {
  try {
    const admin = creerClientAdmin() as unknown as Admin;
    const { error } = await admin.from("evenements_commande" as never).upsert(
      { commande_id: commandeId, restaurant_id: restaurantId, type: "commande_nouvelle", cle: cleEvenement(commandeId, "commande_nouvelle") } as never,
      { onConflict: "cle", ignoreDuplicates: true } as never,
    );
    // supabase-js ne lève pas : une erreur renvoyée (table absente, clé étrangère) doit se voir, sinon l'événement est perdu en silence.
    if (error) console.error("evenement_journalisation_echec", error.code ?? "erreur");
  } catch {
    console.error("evenement_journalisation_echec");
  }
}

/** Marque l'événement « nouvelle commande » comme envoyé après l'alerte immédiate de la création : la file ne le renverra pas en double. */
export async function marquerCommandeNouvelleEnvoyee(commandeId: string): Promise<void> {
  try {
    const admin = creerClientAdmin() as unknown as Admin;
    const { error } = await admin
      .from("evenements_commande" as never)
      .update({ statut: "envoye", envoye_le: new Date().toISOString() } as never)
      .eq("cle", cleEvenement(commandeId, "commande_nouvelle"))
      .eq("statut", "en_attente");
    if (error) console.error("evenement_marquage_echec", error.code ?? "erreur");
  } catch {
    console.error("evenement_marquage_echec");
  }
}

interface LigneEvenement {
  id: string;
  commande_id: string;
  restaurant_id: string;
  essais: number;
}

export interface BilanFile {
  dus: number;
  envoyes: number;
  repris: number;
  abandonnes: number;
}

export async function traiterFileEvenements(maintenant = new Date()): Promise<BilanFile> {
  const admin = creerClientAdmin() as unknown as Admin;
  const { data, error } = await admin
    .from("evenements_commande" as never)
    .select("id, commande_id, restaurant_id, essais")
    .eq("statut", "en_attente")
    .lte("prochaine_tentative_le", maintenant.toISOString())
    .order("prochaine_tentative_le")
    .limit(20);
  // Une erreur de lecture n'est pas « rien à faire » : elle remonte, la route répondra 500 et l'échec se verra.
  if (error) throw new Error("evenements_lecture_impossible");
  if (!data) return { dus: 0, envoyes: 0, repris: 0, abandonnes: 0 };
  const lignes = data as unknown as LigneEvenement[];
  const bilan: BilanFile = { dus: lignes.length, envoyes: 0, repris: 0, abandonnes: 0 };
  for (const ligne of lignes) {
    // Prise de bail : on repousse la prochaine tentative avant d'envoyer ; un second traitement concurrent trouve la ligne déjà repoussée et la saute.
    const bail = new Date(maintenant.getTime() + 10 * 60_000).toISOString();
    const { data: prises, error: erreurBail } = await admin
      .from("evenements_commande" as never)
      .update({ prochaine_tentative_le: bail } as never)
      .eq("id", ligne.id)
      .eq("essais", ligne.essais)
      .select("id");
    if (erreurBail) { console.error("evenement_bail_echec", erreurBail.code ?? "erreur"); continue; }
    if (!prises || (prises as unknown[]).length === 0) continue;
    let echec = false;
    try {
      const envoi = await notifierRestaurant(ligne.restaurant_id);
      // Bilan absent : le push web n'est pas configuré, les canaux natifs sont déjà partis en meilleur effort à la création ; seuls les échecs d'appareils comptent.
      if (envoi !== null && envoi.echecs > 0) echec = true;
    } catch {
      echec = true;
    }
    if (!echec) {
      bilan.envoyes += 1;
      const { error } = await admin.from("evenements_commande" as never).update({ statut: "envoye", envoye_le: maintenant.toISOString() } as never).eq("id", ligne.id);
      if (error) console.error("evenement_mise_a_jour_echec", error.code ?? "erreur");
      continue;
    }
    const essais = ligne.essais + 1;
    if (estAbandonne(essais)) {
      bilan.abandonnes += 1;
      const { error } = await admin.from("evenements_commande" as never).update({ statut: "abandonne", essais } as never).eq("id", ligne.id);
      if (error) console.error("evenement_mise_a_jour_echec", error.code ?? "erreur");
      console.error("evenement_abandonne", ligne.commande_id);
    } else {
      bilan.repris += 1;
      // `essais` déjà incrémentés : le délai se lit à partir du nombre d'échecs précédents (premier échec, premier délai).
      const { error } = await admin
        .from("evenements_commande" as never)
        .update({ essais, prochaine_tentative_le: prochaineTentative(essais - 1, maintenant).toISOString() } as never)
        .eq("id", ligne.id);
      if (error) console.error("evenement_mise_a_jour_echec", error.code ?? "erreur");
    }
  }
  return bilan;
}
