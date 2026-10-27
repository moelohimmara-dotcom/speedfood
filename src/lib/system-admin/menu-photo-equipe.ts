import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireMenuAvecIA } from "@/lib/menu/chefIaModele";
import { PLATS_MAX_PAR_ANALYSE, analyserReponseModele } from "@/lib/menu/chefMenu";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { ecarterPlatsExistants, platsDepuisLecture, type LectureMenu } from "@/lib/referencement/candidature";
import { limiterChefIa } from "@/lib/securite/limitation-debit";
import { validerImage } from "@/lib/storage/images";
import type { TraceActionSysteme } from "./audit";

/**
 * Menu d'un établissement tenu par l'équipe, lu depuis une photo (lot R5) : le moteur du Chef IA (`docs/CHEF-IA.md`) lit la photo, qui n'est NI conservée NI stockée ; la liste revient
 * à l'application de l'équipe, qui la fait relire ; seuls les plats cochés sont ensuite ajoutés, après une revalidation complète ici. Un plat déjà au menu n'est jamais ajouté en double.
 */
const db = () => creerClientAdmin() as unknown as SupabaseClient;

async function etablissementTenu(id: unknown): Promise<{ id: string; nom: string } | null> {
  if (!estUuid(id)) return null;
  const { data } = await db().from("restaurants").select("id, nom, mode_vente").eq("id", id).maybeSingle();
  return data && data.mode_vente === "speedfood" ? { id: data.id as string, nom: data.nom as string } : null;
}

export type ResultatLectureEquipe = { ok: true; lecture: LectureMenu } | { ok: false; code: "VALIDATION" | "TROP_DE_REQUETES" | "ERREUR_SERVEUR"; message: string };

export async function lireMenuPhotoEquipe(restaurantId: unknown, fichier: File | null): Promise<ResultatLectureEquipe> {
  const etab = await etablissementTenu(restaurantId);
  if (!etab) return { ok: false, code: "VALIDATION", message: "Établissement introuvable ou non tenu par l'équipe." };
  try {
    await validerImage(fichier);
  } catch (erreur) {
    return { ok: false, code: "VALIDATION", message: erreur instanceof ErreurMetier ? erreur.message : "Cette photo n'a pas pu être lue." };
  }
  const image = fichier as File;
  try {
    await limiterChefIa(etab.id);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return { ok: false, code: "TROP_DE_REQUETES", message: "Trop d'analyses pour cet établissement en peu de temps. Réessayez dans une heure." };
    return { ok: false, code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." };
  }
  let reponse: string;
  try {
    reponse = await lireMenuAvecIA(`data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`);
  } catch (erreur) {
    return { ok: false, code: "ERREUR_SERVEUR", message: erreur instanceof ErreurMetier ? erreur.message : "La photo n'a pas pu être analysée. Saisissez les plats à la main." };
  }
  const [{ prixPlatMaxGnf }, { data: existants }] = await Promise.all([
    obtenirParametresApplication(),
    db().from("menu_items").select("nom").eq("restaurant_id", etab.id).is("archive_le", null).limit(500),
  ]);
  const analyse = analyserReponseModele(reponse, { prixMax: prixPlatMaxGnf, sections: [] });
  const lecture = platsDepuisLecture({ plats: analyse.plats.map((p) => ({ nom: p.nom, prix: p.prix })), refuses: analyse.refuses, etat: analyse.etat });
  return { ok: true, lecture: ecarterPlatsExistants(lecture, ((existants ?? []) as { nom: string }[]).map((p) => p.nom)) };
}

export type ResultatImportEquipe = { ok: true; message: string; ajoutes: number; trace: TraceActionSysteme } | { ok: false; message: string };

/** Ajoute les plats relus. Revalidation complète (nom, prix entier dans la limite du paramètre, au plus 30 par envoi, jamais un doublon) : rien n'est ajouté si une ligne est invalide. */
export async function importerPlatsEquipe(restaurantId: unknown, brut: unknown): Promise<ResultatImportEquipe> {
  const etab = await etablissementTenu(restaurantId);
  if (!etab) return { ok: false, message: "Établissement introuvable ou non tenu par l'équipe." };
  if (!Array.isArray(brut) || brut.length === 0) return { ok: false, message: "Aucun plat à ajouter." };
  if (brut.length > PLATS_MAX_PAR_ANALYSE) return { ok: false, message: `Au plus ${PLATS_MAX_PAR_ANALYSE} plats par envoi.` };
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const plats: { nom: string; prix: number }[] = [];
  for (const [i, ligne] of brut.entries()) {
    const l = (typeof ligne === "object" && ligne !== null ? ligne : {}) as Record<string, unknown>;
    const nom = typeof l.nom === "string" ? l.nom.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
    const prix = l.prix;
    if (nom.length < 2 || nom.length > 120) return { ok: false, message: `Ligne ${i + 1} : le nom doit faire entre 2 et 120 caractères.` };
    if (typeof prix !== "number" || !Number.isInteger(prix) || prix < 0 || prix > prixPlatMaxGnf) return { ok: false, message: `Ligne ${i + 1} (${nom}) : le prix doit être un entier en GNF, de 0 à ${prixPlatMaxGnf}.` };
    plats.push({ nom, prix });
  }
  const { data: existants } = await db().from("menu_items").select("nom").eq("restaurant_id", etab.id).is("archive_le", null).limit(500);
  const connus = new Set(((existants ?? []) as { nom: string }[]).map((p) => p.nom.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()));
  const doublon = plats.find((p) => connus.has(p.nom.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()));
  if (doublon) return { ok: false, message: `« ${doublon.nom} » est déjà au menu : rien n'a été ajouté.` };
  const { error } = await db().from("menu_items").insert(plats.map((p) => ({ restaurant_id: etab.id, nom: p.nom, prix: p.prix, disponible: true })));
  if (error) return { ok: false, message: "Les plats n'ont pas pu être ajoutés. Réessayez dans un instant." };
  return {
    ok: true,
    message: `${plats.length} plat(s) ajouté(s) au menu de ${etab.nom}. Ils sont à confirmer avant la vente.`,
    ajoutes: plats.length,
    trace: { action: "menu.import_photo", cibleType: "restaurants", cibleId: etab.id, motif: `${plats.length} plat(s) lus depuis une photo` },
  };
}
