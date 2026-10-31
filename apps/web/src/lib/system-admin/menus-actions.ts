"use server";

import { revalidatePath } from "next/cache";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { appliquerCopie, appliquerImport, appliquerPrixLot, apercuCopie, apercuImport, apercuPrixLot } from "./menus-service";
import { validerPrixLot } from "./menus-regles";

export type EtatMenus = { succes?: string; erreur?: string; apercu?: unknown };
const chemin = "/system/catalogue/menus";

export async function apercuPrixLotAction(_etat: EtatMenus, formData: FormData): Promise<EtatMenus> {
  await verifierPermission("restaurant.moderer");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const ids = String(formData.get("plat_ids") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const prix = validerPrixLot(formData.get("prix")); if (!prix.ok) return { erreur: prix.erreur };
  const apercu = await apercuPrixLot(restaurantId, ids, prix.prix); return apercu ? { succes: `Aperçu prêt : ${apercu.lignes} plat(s), empreinte ${apercu.empreinte}.`, apercu } : { erreur: "Aperçu impossible : sélection ou établissement invalide." };
}
export async function appliquerPrixLotAction(_etat: EtatMenus, formData: FormData): Promise<EtatMenus> {
  const contexte = await verifierPermission("restaurant.moderer");
  if (formData.get("confirmation") !== "oui") return { erreur: "Confirmez explicitement l'application après avoir relu l'aperçu." };
  const restaurantId = String(formData.get("restaurant_id") ?? ""); const ids = String(formData.get("plat_ids") ?? "").split(",").filter(Boolean); const prix = validerPrixLot(formData.get("prix")); if (!prix.ok) return { erreur: prix.erreur };
  const apercu = await apercuPrixLot(restaurantId, ids, prix.prix); if (!apercu || apercu.empreinte !== String(formData.get("empreinte") ?? "")) return { erreur: "L'aperçu a changé ou manque : relancez l'aperçu." };
  await journaliserActionSysteme(contexte, { action: "catalogue.menus_prix_lot", cibleType: "menu_items", cibleId: restaurantId, motif: `${ids.length} plat(s), nouveau prix ${prix.prix} GNF` });
  const resultat = await appliquerPrixLot(restaurantId, ids, prix.prix); if (!resultat.ok) return { erreur: resultat.message }; revalidatePath(chemin); return { succes: resultat.message };
}
export async function apercuCopieAction(_etat: EtatMenus, formData: FormData): Promise<EtatMenus> { await verifierPermission("restaurant.moderer"); const a = await apercuCopie(String(formData.get("source_id") ?? ""), String(formData.get("destination_id") ?? "")); return a ? { succes: `Aperçu prêt : ${a.lignes} plat(s).`, apercu: a } : { erreur: "Source ou destination invalide." }; }
export async function appliquerCopieAction(_etat: EtatMenus, formData: FormData): Promise<EtatMenus> { const contexte = await verifierPermission("restaurant.moderer"); if (formData.get("confirmation") !== "oui") return { erreur: "Confirmez explicitement la copie après avoir relu l'aperçu." }; const sourceId = String(formData.get("source_id") ?? ""); const destinationId = String(formData.get("destination_id") ?? ""); const a = await apercuCopie(sourceId, destinationId); if (!a || a.empreinte !== String(formData.get("empreinte") ?? "")) return { erreur: "L'aperçu a changé ou manque : relancez l'aperçu." }; await journaliserActionSysteme(contexte, { action: "catalogue.menus_copie", cibleType: "restaurants", cibleId: destinationId, motif: `copie depuis ${sourceId}` }); const r = await appliquerCopie(sourceId, destinationId); if (!r.ok) return { erreur: r.message }; revalidatePath(chemin); return { succes: r.message }; }
export async function apercuImportAction(_etat: EtatMenus, formData: FormData): Promise<EtatMenus> { await verifierPermission("restaurant.moderer"); const restaurantId = String(formData.get("restaurant_id") ?? ""); const fichier = formData.get("fichier"); if (!(fichier instanceof File)) return { erreur: "Fichier CSV manquant : choisissez un fichier lisible." }; const contenu = await fichier.text(); const a = await apercuImport(restaurantId, contenu); if (!a) return { erreur: "Établissement invalide." }; if ("erreur" in a) return { erreur: a.erreur }; return { succes: `Aperçu prêt : ${a.rapport?.lignes.length ?? 0} ligne(s), ${a.rapport?.rejetees ?? 0} rejetée(s).`, apercu: a }; }
export async function appliquerImportAction(_etat: EtatMenus, formData: FormData): Promise<EtatMenus> { const contexte = await verifierPermission("restaurant.moderer"); if (formData.get("confirmation") !== "oui") return { erreur: "Confirmez explicitement l'import après avoir relu le rapport." }; const restaurantId = String(formData.get("restaurant_id") ?? ""); const contenu = String(formData.get("contenu") ?? ""); const a = await apercuImport(restaurantId, contenu); if (!a || "erreur" in a || a.empreinte !== String(formData.get("empreinte") ?? "")) return { erreur: "Le rapport a changé ou manque : relancez l'aperçu." }; await journaliserActionSysteme(contexte, { action: "catalogue.menus_import", cibleType: "restaurants", cibleId: restaurantId, motif: `import CSV ${a.lignes} ligne(s)` }); const r = await appliquerImport(restaurantId, a.rapport!); if (!r.ok) return { erreur: r.message }; revalidatePath(chemin); return { succes: r.message }; }
