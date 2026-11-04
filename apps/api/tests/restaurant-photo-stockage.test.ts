import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lot D4c, de bout en bout côté serveur SANS réseau : le VRAI `images.ts` du site (type, taille 5 Mo, signature réelle des octets, quota, nom aléatoire, garde de suppression) enchaîné avec le VRAI
 * `photo.ts` de l'API. Seuls les accès lourds sont remplacés : `server-only`, le client administrateur (un faux bucket `medias` + des comptages de références) et le limiteur (un faux compteur).
 *
 * Garanties visées : un fichier invalide (type, signature, taille, vide) n'atteint NI le quota NI le stockage NI la base ; le quota par restaurant est appliqué AVANT l'envoi ; l'ancienne image n'est
 * supprimée que si aucune autre ligne ne la référence ; un nouveau fichier non rattaché est supprimé.
 */
const racineApi = fileURLToPath(new URL("..", import.meta.url));
const IMAGES = join(racineApi, "..", "web", "src", "lib", "storage", "images.ts");
const PHOTO = join(racineApi, "src", "restaurant", "photo.ts");
const HOTE = "https://ggldjdizqrtpetdiohxy.supabase.co";

type Ligne = Record<string, unknown>;
interface Etat {
  televersements: Array<{ chemin: string; type: string; upsert: unknown; taille: number }>;
  suppressions: string[][];
  quotas: string[];
  journal: string[];
  /** Références existantes : table, colonne, valeur. */
  references: Array<{ table: string; colonne: string; valeur: string }>;
  echecUpload: boolean;
  echecComptage: boolean;
  quotaDepasse: boolean;
}
const g = globalThis as unknown as { __etatPhoto: Etat; __adminPhoto: () => unknown; __quotaPhoto: (id: string) => Promise<void>; __ErreurMetierPhoto: new (code: string, message: string) => Error };

const FAUX: Record<string, string> = {
  "server-only": "export {};",
  "@/lib/db/admin": "export function creerClientAdmin() { return globalThis.__adminPhoto(); }",
  "@/lib/securite/limitation-debit": "export async function limiterTeleversement(id) { return globalThis.__quotaPhoto(id); }",
};
const fauxModules: Plugin = {
  name: "faux-modules",
  setup(b) {
    const filtre = new RegExp(`^(${Object.keys(FAUX).map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: filtre }, (args) => ({ path: args.path, namespace: "faux" }));
    b.onLoad({ filter: /.*/, namespace: "faux" }, (args) => ({ contents: FAUX[args.path], loader: "js", resolveDir: join(racineApi, "src") }));
  },
};

type Resultat = { ok: true } | { ok: false; erreur: { code: string; message: string } };
let definirPhotoPlat: (db: unknown, restaurantId: string, platId: string, fichier: File, stockage: unknown) => Promise<Resultat>;
let retirerPhotoPlat: (db: unknown, restaurantId: string, platId: string, stockage: unknown) => Promise<Resultat>;
let televerserImage: (fichier: File | null, dossier: string, restaurantId?: string) => Promise<string>;
let supprimerImage: (url: string | null) => Promise<void>;
let supprimerTeleversementOrphelin: (url: string | null | undefined) => Promise<void>;
let dossier: string;
let urlAvant: string | undefined;
let ErreurMetierPhoto: new (code: string, message: string) => Error;

g.__adminPhoto = () => ({
  storage: {
    from(bucket: string) {
      assert.equal(bucket, "medias");
      return {
        async upload(chemin: string, fichier: File, options: { contentType: string; upsert: unknown }) {
          const e = g.__etatPhoto;
          e.journal.push("upload");
          if (e.echecUpload) return { data: null, error: { message: "stockage en panne" } };
          e.televersements.push({ chemin, type: options.contentType, upsert: options.upsert, taille: fichier.size });
          return { data: { path: chemin }, error: null };
        },
        getPublicUrl(chemin: string) { return { data: { publicUrl: `${HOTE}/storage/v1/object/public/medias/${chemin}` } }; },
        async remove(chemins: string[]) { g.__etatPhoto.journal.push("remove"); g.__etatPhoto.suppressions.push(chemins); return { data: [], error: null }; },
      };
    },
  },
  from(table: string) {
    let colonne = ""; let valeur = "";
    const chaine: Record<string, unknown> = {
      select: () => chaine,
      eq: (c: string, v: string) => { colonne = c; valeur = v; return chaine; },
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(() => {
        const e = g.__etatPhoto;
        e.journal.push("comptage");
        if (e.echecComptage) return { count: null, error: { message: "base en panne" } };
        return { count: e.references.filter((r) => r.table === table && r.colonne === colonne && r.valeur === valeur).length, error: null };
      }).then(ok, ko),
    };
    return chaine;
  },
});
g.__quotaPhoto = async (id: string) => {
  const e = g.__etatPhoto;
  e.journal.push("quota");
  e.quotas.push(id);
  if (e.quotaDepasse) throw new g.__ErreurMetierPhoto("TROP_DE_REQUETES", "Trop d'images envoyées. Réessayez plus tard.");
};

before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "speedfood-photo-"));
  const chemin = (p: string) => JSON.stringify(p.split("\\").join("/"));
  const contents = [
    `export { televerserImage, supprimerImage, supprimerTeleversementOrphelin } from ${chemin(IMAGES)};`,
    `export { definirPhotoPlat, retirerPhotoPlat } from ${chemin(PHOTO)};`,
    `export { ErreurMetier } from "@speedfood/shared/contracts/erreurs";`,
  ].join("\n");
  const sortie = join(dossier, "photo.mjs");
  await build({ stdin: { contents, resolveDir: racineApi, loader: "ts" }, outfile: sortie, bundle: true, format: "esm", platform: "node", target: "es2022", tsconfig: join(racineApi, "tsconfig.json"), plugins: [fauxModules], logLevel: "error", external: ["@supabase/supabase-js"] });
  const module = await import(pathToFileURL(sortie).href);
  ({ definirPhotoPlat, retirerPhotoPlat, televerserImage, supprimerImage, supprimerTeleversementOrphelin } = module);
  ErreurMetierPhoto = module.ErreurMetier;
  g.__ErreurMetierPhoto = ErreurMetierPhoto;
  urlAvant = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = HOTE;
});
after(() => {
  rmSync(dossier, { recursive: true, force: true });
  if (urlAvant === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = urlAvant;
});
beforeEach(() => {
  g.__etatPhoto = { televersements: [], suppressions: [], quotas: [], journal: [], references: [], echecUpload: false, echecComptage: false, quotaDepasse: false };
});

const RESTAURANT_A = "11111111-1111-4111-8111-111111111111";
const PLAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ANCIENNE_CHEMIN = "plats/11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg";
const ANCIENNE = `${HOTE}/storage/v1/object/public/medias/${ANCIENNE_CHEMIN}`;

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const HTML = [...new TextEncoder().encode("<html><script>alert(1)</script>")];
const fichier = (octets: number[] | Uint8Array, type: string, nom = "photo.jpg") => new File([Uint8Array.from(octets)], nom, { type });
const grand = (entete: number[], taille: number) => { const o = new Uint8Array(taille); o.set(entete); return o; };

/** Faux client de base de données lié au jeton : un plat de A avec son ancienne photo, écriture notée. */
function faussebase(options: { ecritureEnErreur?: boolean } = {}) {
  const plat: Ligne = { id: PLAT_A, restaurant_id: RESTAURANT_A, photo_url: ANCIENNE, archive_le: null };
  const ecritures: Ligne[] = [];
  const db = {
    from() {
      let ecriture: Ligne | null = null;
      const chaine: Record<string, unknown> = {
        select: () => chaine, eq: () => chaine, is: () => chaine,
        update: (v: Ligne) => { ecriture = v; return chaine; },
        maybeSingle: async () => ({ data: { photo_url: plat.photo_url }, error: null }),
        then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(() => {
          g.__etatPhoto.journal.push("ecriture");
          ecritures.push(ecriture!);
          if (options.ecritureEnErreur) return { data: null, error: { message: "refusé" } };
          Object.assign(plat, ecriture);
          return { data: [{ id: PLAT_A }], error: null };
        }).then(ok, ko),
      };
      return chaine;
    },
  } as unknown as SupabaseClient;
  return { db, plat, ecritures };
}
const stockageReel = () => ({ televerser: (f: File, d: string, r: string) => televerserImage(f, d, r), supprimerOrphelin: (u: string) => supprimerTeleversementOrphelin(u), supprimerAncienne: (u: string | null) => supprimerImage(u) });
const refuse = (r: Resultat, code: string, message?: string) => { assert.equal(r.ok, false); if (!r.ok) { assert.equal(r.erreur.code, code); if (message) assert.equal(r.erreur.message, message); } };

// ---------- chemin heureux ----------
test("D4c stockage : JPEG valide : quota du restaurant AVANT l'envoi, un seul envoi (nom aléatoire serveur, `upsert: false`), URL du projet écrite dans `photo_url`, ancienne image retirée APRÈS", async () => {
  const b = faussebase();
  const r = await definirPhotoPlat(b.db, RESTAURANT_A, PLAT_A, fichier(JPEG, "image/jpeg", "../../evil.jpg"), stockageReel());
  assert.deepEqual(r, { ok: true });
  const e = g.__etatPhoto;
  assert.deepEqual(e.quotas, [RESTAURANT_A]);
  assert.equal(e.televersements.length, 1);
  assert.match(e.televersements[0].chemin, /^plats\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/, "nom généré côté serveur, jamais celui du client");
  assert.equal(e.televersements[0].upsert, false);
  assert.equal(e.televersements[0].type, "image/jpeg");
  assert.equal(b.plat.photo_url, `${HOTE}/storage/v1/object/public/medias/${e.televersements[0].chemin}`);
  assert.deepEqual(e.suppressions, [[ANCIENNE_CHEMIN]]);
  assert.deepEqual(e.journal.filter((x) => ["quota", "upload", "ecriture", "remove"].includes(x)), ["quota", "upload", "ecriture", "remove"], "quota, nouveau fichier, rattachement, PUIS suppression de l'ancien");
});

test("D4c stockage : PNG et WebP valides sont acceptés (extensions png et webp)", async () => {
  for (const [octets, type, extension] of [[PNG, "image/png", "png"], [WEBP, "image/webp", "webp"]] as const) {
    g.__etatPhoto.televersements.length = 0;
    const b = faussebase();
    assert.deepEqual(await definirPhotoPlat(b.db, RESTAURANT_A, PLAT_A, fichier(octets, type), stockageReel()), { ok: true });
    assert.match(g.__etatPhoto.televersements[0].chemin, new RegExp(`\\.${extension}$`));
  }
});

test("D4c stockage : exactement 5 Mo est accepté", async () => {
  const b = faussebase();
  assert.deepEqual(await definirPhotoPlat(b.db, RESTAURANT_A, PLAT_A, fichier(grand(JPEG, 5 * 1024 * 1024), "image/jpeg"), stockageReel()), { ok: true });
  assert.equal(g.__etatPhoto.televersements[0].taille, 5 * 1024 * 1024);
});

// ---------- fichiers invalides : refus AVANT le quota, le stockage et la base ----------
test("D4c stockage : fichier invalide (type interdit, signature fausse, vide, plus de 5 Mo) : VALIDATION, ni quota, ni envoi, ni écriture, ni suppression", async () => {
  const cas: Array<[string, File, string]> = [
    ["type gif", fichier(JPEG, "image/gif", "a.gif"), "Format d'image non pris en charge (JPEG, PNG ou WebP uniquement)."],
    ["type svg", fichier(HTML, "image/svg+xml", "a.svg"), "Format d'image non pris en charge (JPEG, PNG ou WebP uniquement)."],
    ["type texte", fichier(JPEG, "text/plain", "a.jpg"), "Format d'image non pris en charge (JPEG, PNG ou WebP uniquement)."],
    ["extension .jpg, octets PNG", fichier(PNG, "image/jpeg", "a.jpg"), "Le fichier n'est pas une image valide."],
    ["déclaré PNG, octets JPEG", fichier(JPEG, "image/png", "a.png"), "Le fichier n'est pas une image valide."],
    ["déclaré WebP, octets PNG", fichier(PNG, "image/webp", "a.webp"), "Le fichier n'est pas une image valide."],
    ["RIFF sans WEBP", fichier([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45], "image/webp", "a.webp"), "Le fichier n'est pas une image valide."],
    ["HTML déclaré JPEG", fichier(HTML, "image/jpeg", "a.jpg"), "Le fichier n'est pas une image valide."],
    ["fichier vide", fichier([], "image/jpeg"), "Aucun fichier reçu."],
    ["5 Mo + 1 octet", fichier(grand(JPEG, 5 * 1024 * 1024 + 1), "image/jpeg"), "L'image ne peut pas dépasser 5 Mo."],
  ];
  for (const [nom, f, message] of cas) {
    g.__etatPhoto = { televersements: [], suppressions: [], quotas: [], journal: [], references: [], echecUpload: false, echecComptage: false, quotaDepasse: false };
    const b = faussebase();
    const r = await definirPhotoPlat(b.db, RESTAURANT_A, PLAT_A, f, stockageReel());
    refuse(r, "VALIDATION", message);
    assert.deepEqual(g.__etatPhoto.journal.filter((x) => x !== "lecture"), [], `${nom} : rien n'atteint le quota, le stockage ni la base`);
    assert.equal(b.ecritures.length, 0, nom);
    assert.equal(b.plat.photo_url, ANCIENNE, nom);
  }
});

test("D4c stockage : quota d'envois du restaurant dépassé : 429 TROP_DE_REQUETES, aucun fichier envoyé, aucune écriture", async () => {
  g.__etatPhoto.quotaDepasse = true;
  const b = faussebase();
  const r = await definirPhotoPlat(b.db, RESTAURANT_A, PLAT_A, fichier(JPEG, "image/jpeg"), stockageReel());
  refuse(r, "TROP_DE_REQUETES");
  assert.deepEqual(g.__etatPhoto.televersements, []);
  assert.equal(b.ecritures.length, 0);
  assert.equal(b.plat.photo_url, ANCIENNE);
});

test("D4c stockage : panne du bucket : ERREUR_SERVEUR, rien n'est écrit en base, l'ancienne photo est gardée", async () => {
  g.__etatPhoto.echecUpload = true;
  const b = faussebase();
  refuse(await definirPhotoPlat(b.db, RESTAURANT_A, PLAT_A, fichier(JPEG, "image/jpeg"), stockageReel()), "ERREUR_SERVEUR");
  assert.equal(b.ecritures.length, 0);
  assert.deepEqual(g.__etatPhoto.suppressions, []);
});

// ---------- orphelin et ancienne image ----------
test("D4c stockage : si la base refuse le rattachement, le NOUVEAU fichier est supprimé du bucket (pas d'orphelin) et l'ancien est gardé", async () => {
  const b = faussebase({ ecritureEnErreur: true });
  refuse(await definirPhotoPlat(b.db, RESTAURANT_A, PLAT_A, fichier(JPEG, "image/jpeg"), stockageReel()), "ERREUR_SERVEUR");
  const cheminNouveau = g.__etatPhoto.televersements[0].chemin;
  assert.deepEqual(g.__etatPhoto.suppressions, [[cheminNouveau]], "seul le nouveau fichier est supprimé");
  assert.ok(!g.__etatPhoto.suppressions.flat().includes(ANCIENNE_CHEMIN));
});

test("D4c stockage : l'ancienne image est GARDÉE tant qu'une autre ligne la référence (autre plat, restaurant, bannière), ou si le comptage échoue", async () => {
  for (const reference of [{ table: "menu_items", colonne: "photo_url", valeur: ANCIENNE }, { table: "restaurants", colonne: "photo_url", valeur: ANCIENNE }, { table: "restaurants", colonne: "logo_url", valeur: ANCIENNE }, { table: "content_banners", colonne: "image_url", valeur: ANCIENNE }]) {
    g.__etatPhoto = { televersements: [], suppressions: [], quotas: [], journal: [], references: [reference], echecUpload: false, echecComptage: false, quotaDepasse: false };
    const b = faussebase();
    assert.deepEqual(await definirPhotoPlat(b.db, RESTAURANT_A, PLAT_A, fichier(JPEG, "image/jpeg"), stockageReel()), { ok: true });
    assert.deepEqual(g.__etatPhoto.suppressions, [], `${reference.table}.${reference.colonne}`);
  }
  g.__etatPhoto = { televersements: [], suppressions: [], quotas: [], journal: [], references: [], echecUpload: false, echecComptage: true, quotaDepasse: false };
  assert.deepEqual(await definirPhotoPlat(faussebase().db, RESTAURANT_A, PLAT_A, fichier(JPEG, "image/jpeg"), stockageReel()), { ok: true });
  assert.deepEqual(g.__etatPhoto.suppressions, [], "en cas de doute, on garde le fichier");
});

test("D4c stockage : jamais supprimer un fichier hors de ce projet ou de forme inattendue (autre hôte, traversée de chemin, dossier inconnu, extension inconnue)", async () => {
  const pasLesNotres = [
    "https://autre-projet.supabase.co/storage/v1/object/public/medias/plats/11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg",
    `${HOTE}/storage/v1/object/public/medias/plats/../restaurants/x.jpg`,
    `${HOTE}/storage/v1/object/public/medias/secret/11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`,
    `${HOTE}/storage/v1/object/public/medias/plats/11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa.gif`,
    `${HOTE}/storage/v1/object/public/medias/plats/pas-un-uuid.jpg`,
    "https://exemple.test/photo.jpg",
    "",
  ];
  for (const url of pasLesNotres) {
    await supprimerImage(url);
    await supprimerTeleversementOrphelin(url);
  }
  assert.deepEqual(g.__etatPhoto.suppressions, []);
});

// ---------- retrait ----------
test("D4c stockage : retrait : `photo_url` à null, puis le fichier est retiré du bucket s'il n'est plus référencé ; gardé s'il l'est", async () => {
  const libre = faussebase();
  assert.deepEqual(await retirerPhotoPlat(libre.db, RESTAURANT_A, PLAT_A, stockageReel()), { ok: true });
  assert.equal(libre.plat.photo_url, null);
  assert.deepEqual(g.__etatPhoto.suppressions, [[ANCIENNE_CHEMIN]]);
  assert.deepEqual(g.__etatPhoto.televersements, [], "un retrait n'envoie jamais de fichier");

  g.__etatPhoto = { televersements: [], suppressions: [], quotas: [], journal: [], references: [{ table: "menu_items", colonne: "photo_url", valeur: ANCIENNE }], echecUpload: false, echecComptage: false, quotaDepasse: false };
  const partage = faussebase();
  assert.deepEqual(await retirerPhotoPlat(partage.db, RESTAURANT_A, PLAT_A, stockageReel()), { ok: true });
  assert.deepEqual(g.__etatPhoto.suppressions, []);
});
