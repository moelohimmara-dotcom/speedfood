import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { compteServiceConfigure, envoyerFcm } from "./fcm-envoi";

/**
 * Annonce d'une nouvelle version de l'application à TOUS les appareils enregistrés (notification poussée « Mise à jour disponible », qui ouvre l'application ; elle propose
 * alors le téléchargement). Réservé au serveur, déclenché par un administrateur système. Une version ne s'annonce qu'une fois : la ligne de `annonces_versions` est écrite
 * AVANT l'envoi (deux clics ou deux administrateurs ne produisent pas deux vagues).
 */
const sansTypes = () => creerClientAdmin() as unknown as SupabaseClient;

const LOT = 100;
const SIMULTANES = 20;
const ECHECS_AVANT_SUPPRESSION = 5;

export type ResultatAnnonce =
  | { statut: "envoyee"; appareils: number; envoyes: number; expires: number; echecs: number }
  | { statut: "deja_annoncee"; annonceeLe: string }
  | { statut: "non_configuree" };

export async function annoncerVersion(versionCode: number, versionNom: string, administrateurId: string | null): Promise<ResultatAnnonce> {
  if (!compteServiceConfigure()) return { statut: "non_configuree" };
  const db = sansTypes();

  const { error } = await db.from("annonces_versions").insert({ version_code: versionCode, version_nom: versionNom, annoncee_par: administrateurId });
  if (error) {
    const { data } = await db.from("annonces_versions").select("annoncee_le").eq("version_code", versionCode).maybeSingle();
    if (data) return { statut: "deja_annoncee", annonceeLe: (data as { annoncee_le: string }).annoncee_le };
    throw new Error("annonce_ecriture_impossible");
  }

  const bilan = { appareils: 0, envoyes: 0, expires: 0, echecs: 0 };
  let depuis = "";
  for (;;) {
    const requete = db.from("appareils_push").select("id, jeton, echecs").order("id", { ascending: true }).limit(LOT);
    const { data } = await (depuis ? requete.gt("id", depuis) : requete);
    const lot = (data ?? []) as Array<{ id: string; jeton: string; echecs: number }>;
    if (lot.length === 0) break;
    depuis = lot[lot.length - 1].id;
    bilan.appareils += lot.length;
    for (let i = 0; i < lot.length; i += SIMULTANES) {
      await Promise.all(
        lot.slice(i, i + SIMULTANES).map(async (a) => {
          const issue = await envoyerFcm(a.jeton, "mise_a_jour");
          if (issue === "ok") {
            bilan.envoyes += 1;
          } else if (issue === "expire" || a.echecs + 1 >= ECHECS_AVANT_SUPPRESSION) {
            bilan.expires += 1;
            await db.from("appareils_push").delete().eq("id", a.id);
          } else {
            bilan.echecs += 1;
            await db.from("appareils_push").update({ echecs: a.echecs + 1 }).eq("id", a.id);
          }
        })
      );
    }
    if (lot.length < LOT) break;
  }
  await db.from("annonces_versions").update({ appareils: bilan.appareils, envoyes: bilan.envoyes }).eq("version_code", versionCode);
  console.log("annonce_version", JSON.stringify({ versionCode, ...bilan }));
  return { statut: "envoyee", ...bilan };
}

/** Dernière annonce enregistrée (pour l'affichage de l'administration). */
export async function derniereAnnonce(): Promise<{ versionCode: number; versionNom: string; annonceeLe: string; appareils: number; envoyes: number } | null> {
  const { data } = await sansTypes().from("annonces_versions").select("version_code, version_nom, annoncee_le, appareils, envoyes").order("version_code", { ascending: false }).limit(1).maybeSingle();
  const l = data as { version_code: number; version_nom: string; annoncee_le: string; appareils: number; envoyes: number } | null;
  return l ? { versionCode: l.version_code, versionNom: l.version_nom, annonceeLe: l.annoncee_le, appareils: l.appareils, envoyes: l.envoyes } : null;
}

/** Nombre d'appareils actuellement enregistrés (indicateur d'administration, sans identité). */
export async function compterAppareils(): Promise<number> {
  const { count } = await sansTypes().from("appareils_push").select("id", { count: "exact", head: true });
  return count ?? 0;
}
