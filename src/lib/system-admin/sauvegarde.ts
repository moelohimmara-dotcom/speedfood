import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Sauvegarde complète avant la réinitialisation : toutes les tables du schéma public en JSON, la liste des comptes (sans
 * aucun mot de passe) et une copie des fichiers du stockage `medias`, dans le bucket PRIVÉ `sauvegardes` (aucune règle
 * d'accès : seule la clé de service y accède). Si une seule étape échoue, la fonction lève une erreur et la
 * réinitialisation n'a pas lieu. Ces fichiers contiennent des données personnelles : à télécharger puis supprimer.
 */

export const TABLES_SAUVEGARDE = [
  "audit_events", "client_profils", "content_banners", "content_pages", "featured_placements", "menu_categories",
  "menu_item_options", "menu_items", "menu_sections", "neighborhoods", "order_item_options", "order_items",
  "order_proposals", "order_status_events", "orders", "parametres_application", "push_subscriptions",
  "restaurant_memberships", "restaurants", "system_admin_memberships",
] as const;

const TAILLE_PAGE = 1000;
const BUCKET_SAUVEGARDE = "sauvegardes";
const BUCKET_MEDIAS = "medias";

type RequeteTable = { select: (c: string) => { range: (a: number, b: number) => Promise<{ data: unknown[] | null; error: unknown }> } };

export interface ResultatSauvegarde {
  dossier: string;
  lignes: Record<string, number>;
  comptes: number;
  fichiers: number;
}

/** Chemins de tous les fichiers du bucket `medias` (parcours des sous-dossiers, par pages). */
export async function listerFichiersMedias(): Promise<string[]> {
  const admin = creerClientAdmin();
  const chemins: string[] = [];
  const pile: string[] = [""];
  while (pile.length > 0) {
    const prefixe = pile.pop() as string;
    for (let debut = 0; ; debut += TAILLE_PAGE) {
      const { data, error } = await admin.storage.from(BUCKET_MEDIAS).list(prefixe, { limit: TAILLE_PAGE, offset: debut });
      if (error) throw new Error("Lecture du stockage impossible.");
      for (const e of data ?? []) {
        const chemin = prefixe ? `${prefixe}/${e.name}` : e.name;
        if (e.id === null) pile.push(chemin);
        else chemins.push(chemin);
      }
      if (!data || data.length < TAILLE_PAGE) break;
    }
  }
  return chemins;
}

export async function sauvegarderAvantReinitialisation(): Promise<ResultatSauvegarde> {
  const admin = creerClientAdmin();
  const dossier = new Date().toISOString().replace(/[:.]/g, "-");
  const televerser = async (nom: string, contenu: Blob | string, type: string) => {
    const { error } = await admin.storage
      .from(BUCKET_SAUVEGARDE)
      .upload(`${dossier}/${nom}`, contenu, { contentType: type, upsert: false });
    if (error) throw new Error(`Écriture de la sauvegarde impossible (${nom}).`);
  };

  const lignes: Record<string, number> = {};
  for (const table of TABLES_SAUVEGARDE) {
    const toutes: unknown[] = [];
    for (let debut = 0; ; debut += TAILLE_PAGE) {
      const { data, error } = await (admin as unknown as { from: (t: string) => RequeteTable })
        .from(table)
        .select("*")
        .range(debut, debut + TAILLE_PAGE - 1);
      if (error) throw new Error(`Lecture impossible (${table}).`);
      toutes.push(...(data ?? []));
      if (!data || data.length < TAILLE_PAGE) break;
    }
    lignes[table] = toutes.length;
    await televerser(`tables/${table}.json`, JSON.stringify(toutes), "application/json");
  }

  const comptes: unknown[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: TAILLE_PAGE });
    if (error) throw new Error("Lecture des comptes impossible.");
    for (const u of data.users) {
      comptes.push({
        id: u.id,
        email: u.email,
        cree_le: u.created_at,
        derniere_connexion: u.last_sign_in_at,
        fournisseurs: u.app_metadata?.providers ?? [],
      });
    }
    if (data.users.length < TAILLE_PAGE) break;
  }
  await televerser("comptes.json", JSON.stringify(comptes), "application/json");

  const fichiers = await listerFichiersMedias();
  for (const chemin of fichiers) {
    const { data, error } = await admin.storage.from(BUCKET_MEDIAS).download(chemin);
    if (error || !data) throw new Error(`Copie d'un fichier impossible (${chemin}).`);
    await televerser(`medias/${chemin}`, data, data.type || "application/octet-stream");
  }

  await televerser(
    "manifeste.json",
    JSON.stringify({ cree_le: new Date().toISOString(), tables: lignes, comptes: comptes.length, fichiers: fichiers.length }, null, 1),
    "application/json",
  );
  return { dossier, lignes, comptes: comptes.length, fichiers: fichiers.length };
}
