import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Sauvegarde complète avant la réinitialisation : toutes les tables du schéma public en JSON, la liste des comptes (sans
 * aucun mot de passe) et une copie des fichiers du stockage `medias`, dans le bucket PRIVÉ `sauvegardes` (aucune règle
 * d'accès : seule la clé de service y accède). Si une seule étape échoue, la fonction lève une erreur et la
 * réinitialisation n'a pas lieu. Ces fichiers contiennent des données personnelles : à télécharger puis supprimer.
 */

/**
 * Tables copiées avant la réinitialisation.
 *
 * À maintenir avec `fn_reinitialiser_application` (`20261004162230`). Deux catégories à ne pas confondre :
 * - les tables que la fonction `delete` explicitement : il faut toutes les lister ici ;
 * - les tables qu'elle ne nomme pas mais qui disparaissent **en cascade** parce qu'elles référencent une table
 *   supprimée. Elles disparaissent tout autant, donc elles doivent être listées aussi.
 *
 * Colonnes de la seconde catégorie, vérifiées dans les migrations (toutes en `on delete cascade`) :
 * - `content_pages_versions.page_id` -> `content_pages` (migration `20261006094626`) ;
 * - `documents_commande.order_id` -> `orders`, et `.restaurant_id` -> `restaurants` (`20261005173049`) ;
 * - `restaurant_codes_marchand`, `restaurant_compteurs_documents`, `restaurant_identite_documents`,
 *   `restaurant_scans`.restaurant_id` -> `restaurants` (`20261005171122` et `20261005173049`).
 *
 * Troisième catégorie, à connaître avant d'ajouter une table : `rate_limits` est elle aussi supprimée
 * explicitement (`delete from rate_limits`, migration `20261004162230` ligne 109) et figure ici depuis le
 * 7 octobre 2026. Elle ne contient que des compteurs de limitation de débit, donc la perdre n'a aucune
 * conséquence métier — mais l'invariant « tout ce que la réinitialisation détruit est sauvegardé » doit
 * rester vrai, sinon plus personne ne peut s'y fier.
 *
 * Ne sont pas listées parce qu'elles survivent à la réinitialisation : `fonctionnalites`, `contenu_emplacements`,
 * `acces_paliers`. Y sont aussi `menu_categories`, `neighborhoods` et `parametres_application`, qui sont des
 * données de configuration réinjectées par les migrations. `audit_events` est en revanche listée : elle survit
 * elle aussi, mais on la conserve pour garder la trace de ce que la réinitialisation a détruit.
 */
export const TABLES_SAUVEGARDE = [
  "audit_events", "client_profils", "content_banners", "content_pages", "content_pages_versions", "documents_commande",
  "featured_placements", "menu_categories", "menu_item_options", "menu_items", "menu_sections", "neighborhoods",
  "order_item_options", "order_items", "order_proposals", "order_status_events", "orders", "parametres_application",
  "push_subscriptions", "rate_limits", "restaurant_codes_marchand", "restaurant_compteurs_documents",
  "restaurant_identite_documents", "restaurant_memberships", "restaurant_scans", "restaurants", "system_admin_memberships",
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
