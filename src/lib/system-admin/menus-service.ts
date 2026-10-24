import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { analyserCsvMenu, creerEmpreinte, type ApercuMenu, type RapportImportMenu, type PlatMenuSaisi } from "./menus-regles";

const db = () => creerClientAdmin();
type Plat = { id: string; nom: string; description: string | null; prix: number; prix_promo: number | null; archive_le: string | null };
export type ResultatMenus = { ok: true; message: string; rapport?: RapportImportMenu } | { ok: false; message: string };

async function restaurantValide(id: string) {
  if (!estUuid(id)) return false;
  const { data } = await db().from("restaurants").select("id, mode_vente").eq("id", id).maybeSingle();
  return Boolean(data && data.mode_vente === "speedfood");
}
async function plats(restaurantId: string): Promise<Plat[]> {
  const { data } = await db().from("menu_items").select("id, nom, description, prix, prix_promo, archive_le").eq("restaurant_id", restaurantId).is("archive_le", null).order("cree_le", { ascending: true }).limit(2000);
  return (data ?? []) as Plat[];
}
export async function apercuPrixLot(restaurantId: string, ids: string[], nouveauPrix: number): Promise<ApercuMenu | null> {
  if (!(await restaurantValide(restaurantId)) || ids.length === 0 || ids.length > 500 || ids.some((id) => !estUuid(id))) return null;
  const selection = (await plats(restaurantId)).filter((p) => ids.includes(p.id));
  if (selection.length !== ids.length) return null;
  return { operation: "prix", lignes: selection.length, empreinte: creerEmpreinte(JSON.stringify({ restaurantId, ids: [...ids].sort(), nouveauPrix })) };
}
export async function apercuCopie(sourceId: string, destinationId: string): Promise<ApercuMenu | null> {
  if (sourceId === destinationId || !(await restaurantValide(sourceId)) || !(await restaurantValide(destinationId))) return null;
  const source = await plats(sourceId);
  return { operation: "copie", lignes: source.length, empreinte: creerEmpreinte(JSON.stringify({ sourceId, destinationId, ids: source.map((p) => p.id) })) };
}
export async function apercuImport(restaurantId: string, contenu: string): Promise<ApercuMenu | { erreur: string } | null> {
  if (!(await restaurantValide(restaurantId))) return null;
  const rapport = analyserCsvMenu(contenu);
  if ("erreur" in rapport) return rapport;
  return { operation: "import", lignes: rapport.lignes.length, empreinte: creerEmpreinte(contenu), rapport };
}
export async function appliquerPrixLot(restaurantId: string, ids: string[], nouveauPrix: number): Promise<ResultatMenus> {
  const apercu = await apercuPrixLot(restaurantId, ids, nouveauPrix); if (!apercu) return { ok: false, message: "Aperçu invalide ou plat inconnu : aucune modification." };
  const { error } = await db().from("menu_items").update({ prix: nouveauPrix, prix_promo: null }).eq("restaurant_id", restaurantId).in("id", ids).is("archive_le", null);
  return error ? { ok: false, message: "Le prix n'a pas été appliqué : réessayez, aucun rapport fiable n'est disponible." } : { ok: true, message: `${ids.length} prix appliqué(s).` };
}
export async function appliquerCopie(sourceId: string, destinationId: string): Promise<ResultatMenus> {
  const apercu = await apercuCopie(sourceId, destinationId); if (!apercu) return { ok: false, message: "Copie invalide : source ou destination inconnue." };
  const source = await plats(sourceId);
  const { error } = source.length ? await db().from("menu_items").insert(source.map((p) => ({ restaurant_id: destinationId, nom: p.nom, description: p.description ?? "", prix: p.prix, prix_promo: p.prix_promo }))) : { error: null };
  return error ? { ok: false, message: "La copie a échoué : aucune modification confirmée." } : { ok: true, message: `${source.length} plat(s) copié(s).` };
}
export async function appliquerImport(restaurantId: string, rapport: RapportImportMenu): Promise<ResultatMenus> {
  const valides = rapport.lignes.flatMap((l) => l.valeurs ? [{ restaurant_id: restaurantId, nom: l.valeurs.nom, description: l.valeurs.description, prix: l.valeurs.prix, prix_promo: l.valeurs.prixPromo }] : []);
  const { error } = valides.length ? await db().from("menu_items").insert(valides) : { error: null };
  if (error) return { ok: false, message: "Import non appliqué : la base a refusé les lignes valides." };
  return { ok: true, message: `${valides.length} ligne(s) appliquée(s), ${rapport.rejetees} rejetée(s).`, rapport: { ...rapport, appliquees: valides.length } };
}
