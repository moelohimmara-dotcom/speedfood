import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REGISTRE, TYPES_ACCUEIL, estTypeAccueil, validerPage } from "../../src/lib/studio/registre";
import { decider, pageAccueilParDefaut, planTitre } from "../../src/lib/studio/accueil";
import { planifierOperation } from "../../src/lib/studio/panneau-blocs";
import { trouverChainesAnglaises } from "../../src/lib/studio/francisation";
import { ANCRES_RESERVEES } from "../../src/lib/studio/reglages";

/**
 * Tests de l'accueil en blocs (tâche 9) : schémas des sections d'accueil, disposition par défaut, décision d'affichage de « / »
 * (repli par défaut), règle du h1, rétrocompatibilité des pages des tâches 6 à 8 et gardes statiques sur le code.
 */

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
const lire = (chemin: string) => readFileSync(join(racine, chemin), "utf8");

const bloc = (type: string, props: Record<string, unknown> = {}) => ({ type, props });
const page = (...content: unknown[]) => ({ content, root: { props: {} } });
const ok = (json: unknown, slug?: string) => validerPage(json, slug === undefined ? {} : { slug }).ok;
const erreurs = (json: unknown, slug?: string) => {
  const r = validerPage(json, slug === undefined ? {} : { slug });
  return r.ok ? [] : r.erreurs;
};

// --- Schémas des sections d'accueil ---------------------------------------------------------------------------------------
verifier("sept sections d'accueil, dans l'ordre de la page d'origine", [...TYPES_ACCUEIL], [
  "AccueilAccroche",
  "AccueilBandeau",
  "AccueilRestaurants",
  "AccueilQuartiers",
  "AccueilEtapes",
  "AccueilSuivi",
  "AccueilPro",
]);
for (const type of TYPES_ACCUEIL) {
  verifier(`${type} : valide sur la page « accueil »`, ok(page(bloc(type)), "accueil"), true);
  verifier(`${type} : refusé sur une autre page`, ok(page(bloc(type)), "comment-commander"), false);
  verifier(`${type} : refusé si l'adresse est inconnue (prudence)`, ok(page(bloc(type))), false);
  verifier(`${type} : refusé deux fois dans la même page`, ok(page(bloc(type), bloc(type)), "accueil"), false);
  verifier(`${type} : refusé dans une colonne`, ok(page(bloc("Colonnes", { nombre: 2, ecart: 16, colonne1: [bloc(type)], colonne2: [] })), "accueil"), false);
  verifier(`${type} : aucune propriété de contenu (texte refusé)`, ok(page(bloc(type, { texte: "x" })), "accueil"), false);
  verifier(`${type} : réglages d'espace, visibilité et ancre acceptés`, ok(page(bloc(type, { reglages: { espaceHaut: 32, espaceBas: 0, visibilite: "mobile", ancre: "ma-section" } })), "accueil"), true);
  verifier(`${type} : fond, alignement et largeur refusés (cassent la mise en page)`, [
    ok(page(bloc(type, { reglages: { fond: "rouge" } })), "accueil"),
    ok(page(bloc(type, { reglages: { alignement: "centre" } })), "accueil"),
    ok(page(bloc(type, { reglages: { largeur: "etroite" } })), "accueil"),
  ], [false, false, false]);
}
verifier("message clair hors de l'accueil", erreurs(page(bloc("AccueilPro")), "p1").some((e) => e.includes("n'est autorisée que dans la page d'accueil")), true);
verifier("message clair pour un doublon", erreurs(page(bloc("AccueilPro"), bloc("AccueilPro")), "accueil").some((e) => e.includes("une seule fois par page")), true);
verifier("message clair dans une colonne", erreurs(page(bloc("Colonnes", { nombre: 2, ecart: 16, colonne1: [bloc("AccueilPro")] })), "accueil").some((e) => e.includes("ne peut pas être placé dans une colonne")), true);
verifier("identifiants des sections réservés comme ancres", ["accueil-titre", "accueil-carte", "accueil-quartiers", "accueil-etapes", "accueil-ticket", "accueil-pro"].every((a) => (ANCRES_RESERVEES as readonly string[]).includes(a)), true);
verifier("ancre réservée refusée", ok(page(bloc("AccueilPro", { reglages: { ancre: "accueil-pro" } })), "accueil"), false);
verifier("une section d'accueil peut côtoyer des blocs ordinaires (mode mixte)", ok(page(bloc("Titre", { texte: "Hello", niveau: 2, alignement: "gauche" }), bloc("AccueilAccroche"), bloc("Separateur", { style: "trait" })), "accueil"), true);
verifier("200 blocs maximum, sections comprises", ok({ content: [...Array(199).fill(bloc("Separateur", { style: "trait" })), bloc("AccueilPro"), bloc("AccueilEtapes")], root: { props: {} } }, "accueil"), false);

// --- Registre : libellés, catégorie ---------------------------------------------------------------------------------------
const entrees = REGISTRE.filter((e) => estTypeAccueil(e.type));
verifier("libellés « Section d'accueil : … » et catégorie « Sections d'accueil »", entrees.every((e) => e.libelle.startsWith("Section d'accueil : ") && e.categorie === "accueil"), true);
verifier("francisation des libellés des sections", trouverChainesAnglaises(entrees.map((e) => e.libelle)), []);
verifier("champ de réglages restreint pour chaque section", entrees.every((e) => (e.champs as Record<string, { genre: string }>).reglages?.genre === "reglagesAccueil" && Object.keys(e.champs).length === 1), true);

// --- Disposition par défaut -----------------------------------------------------------------------------------------------
const defaut = pageAccueilParDefaut();
verifier("disposition par défaut : valide sur « accueil »", ok(defaut, "accueil"), true);
verifier("disposition par défaut : chaque section une fois, sans réglage", defaut.content.map((b) => [b.type, Object.keys(b.props).length]), TYPES_ACCUEIL.map((t) => [t, 0]));
verifier("disposition par défaut : refusée ailleurs que sur « accueil »", ok(defaut, "autre"), false);
const sourcePage = lire("src/app/page.tsx");
const reperePage = sourcePage.slice(sourcePage.indexOf("function AccueilRepli"));
const ordrePage = [...reperePage.slice(0, reperePage.indexOf("</main>")).matchAll(/<(Accueil[A-Za-z]+) \/>/g)].map((m) => m[1]);
verifier("disposition par défaut : même ordre que la page de repli (page.tsx)", defaut.content.map((b) => b.type), ordrePage);
verifier("deux appels donnent des documents indépendants", pageAccueilParDefaut() !== pageAccueilParDefaut(), true);

// --- Décision d'affichage --------------------------------------------------------------------------------------------------
const valide = JSON.parse(JSON.stringify(defaut));
const publiee = (blocs: unknown, format = "blocs") => ({ format, blocs, titre: "Accueil" });
const mode = (e: Parameters<typeof decider>[0]) => decider(e).mode;
verifier("interrupteur actif + page publiée valide : blocs", mode({ interrupteurActif: true, publiee: publiee(valide), apercu: null }), "blocs");
verifier("interrupteur coupé : repli", mode({ interrupteurActif: false, publiee: publiee(valide), apercu: null }), "repli");
verifier("aucune page publiée : repli", mode({ interrupteurActif: true, publiee: null, apercu: null }), "repli");
verifier("page de format texte : repli", mode({ interrupteurActif: true, publiee: publiee(valide, "texte"), apercu: null }), "repli");
verifier("JSON publié invalide (propriété en trop) : repli", mode({ interrupteurActif: true, publiee: publiee(page({ type: "AccueilPro", props: { x: 1 } })), apercu: null }), "repli");
verifier("JSON publié invalide (doublon) : repli", mode({ interrupteurActif: true, publiee: publiee(page(bloc("AccueilPro"), bloc("AccueilPro"))), apercu: null }), "repli");
verifier("JSON publié non objet / absent : repli", [null, undefined, 3, "x", []].map((j) => mode({ interrupteurActif: true, publiee: publiee(j), apercu: null })), Array(5).fill("repli"));
verifier("page publiée vide (aucun bloc) : blocs (choix assumé de l'équipe)", mode({ interrupteurActif: true, publiee: publiee(page()), apercu: null }), "blocs");
verifier("aperçu autorisé : brouillon, même interrupteur coupé", mode({ interrupteurActif: false, publiee: null, apercu: { page: { ...publiee(valide), enLigne: false } } }), "apercu");
verifier("aperçu autorisé sans page : repli", mode({ interrupteurActif: true, publiee: null, apercu: { page: null } }), "repli");
verifier("aperçu autorisé, brouillon invalide : liste des erreurs", mode({ interrupteurActif: true, publiee: null, apercu: { page: { ...publiee(page(bloc("Inconnu"))), enLigne: true } } }), "apercu-invalide");
verifier("aperçu non autorisé (apercu null) : page publique normale", mode({ interrupteurActif: true, publiee: publiee(valide), apercu: null }), "blocs");
const toutes: string[] = [];
for (const interrupteurActif of [true, false]) for (const p of [null, publiee(valide), publiee(page(bloc("Inconnu"))), publiee(valide, "texte")]) for (const apercu of [null, { page: null }]) toutes.push(mode({ interrupteurActif, publiee: p, apercu }));
verifier("table complète : blocs seulement pour interrupteur actif + page publiée valide (avec ou sans aperçu vide)", toutes.filter((m) => m === "blocs").length, 2);
verifier("table complète : jamais d'aperçu sans aperçu autorisé", toutes.some((m) => m.startsWith("apercu")), false);

// --- Un seul h1 ------------------------------------------------------------------------------------------------------------
const pl = (...blocs: unknown[]) => planTitre(page(...blocs) as never);
verifier("h1 : l'accroche le porte, aucun h1 en plus", pl(bloc("AccueilAccroche"), bloc("AccueilPro")), { masque: false });
verifier("h1 : sans accroche, un h1 masqué (titre de la page)", pl(bloc("AccueilPro")), { masque: true });
verifier("h1 : page vide, un h1 masqué", pl(), { masque: true });
verifier("h1 : accroche réservée au téléphone, h1 masqué pour l'ordinateur", pl(bloc("AccueilAccroche", { reglages: { visibilite: "mobile" } })), { masque: true, visibilite: "bureau" });
verifier("h1 : accroche réservée à l'ordinateur, h1 masqué pour le téléphone", pl(bloc("AccueilAccroche", { reglages: { visibilite: "bureau" } })), { masque: true, visibilite: "mobile" });
verifier("h1 : accroche pour tous les écrans (réglage explicite), aucun h1 en plus", pl(bloc("AccueilAccroche", { reglages: { visibilite: "tous" } })), { masque: false });

// --- Panneau de blocs ------------------------------------------------------------------------------------------------------
const contenu = [{ type: "AccueilPro", props: { id: "p1" } }];
verifier("panneau : dupliquer une section d'accueil refusé", planifierOperation({ type: "dupliquer", index: 0 }, contenu).ok, false);
verifier("panneau : ajouter une section déjà présente refusé", planifierOperation({ type: "ajouter", typeBloc: "AccueilPro", apres: null }, contenu).ok, false);
verifier("panneau : ajouter une section absente accepté", planifierOperation({ type: "ajouter", typeBloc: "AccueilEtapes", apres: null }, contenu).ok, true);

// --- Rétrocompatibilité des pages des tâches 6 à 8 -------------------------------------------------------------------------
const ancienne = page(
  bloc("Titre", { texte: "Titre", niveau: 2, alignement: "gauche" }),
  bloc("Paragraphe", { texte: "Texte" }),
  bloc("Bouton", { libelle: "Ok", lien: "/restaurants", style: "principal" }),
  bloc("ListeRestaurants", { filtre: "tous", nombre: 3 }),
  bloc("Titre", { texte: "Fond", niveau: 3, alignement: "centre", reglages: { fond: "rouge", largeur: "pleine", alignement: "centre" } })
);
verifier("page des tâches 6 à 8 : valide avec ou sans adresse", [ok(ancienne), ok(ancienne, "comment-commander"), ok(ancienne, "accueil")], [true, true, true]);
verifier("fond, largeur et alignement toujours permis sur les blocs ordinaires de l'accueil", ok(page(bloc("Paragraphe", { texte: "x", reglages: { fond: "encre", largeur: "etroite" } })), "accueil"), true);

// --- Gardes statiques ------------------------------------------------------------------------------------------------------
const sections = readdirSync(join(racine, "src/components/accueil")).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
const sourceSections = sections.map((f) => lire(`src/components/accueil/${f}`)).join("\n");
verifier("sections : aucun HTML libre, aucune couleur en dur propre aux blocs", [/dangerouslySetInnerHTML/.test(sourceSections), /style=\{\{/.test(sourceSections)], [false, false]);
verifier("sections : les mots viennent des emplacements (lireTextes) et de la promesse, pas de propriétés de bloc", [/lireTextes/.test(sourceSections), /lirePromesse|promesseDeLaRequete/.test(sourceSections), /props\./.test(sourceSections)], [true, true, false]);
verifier("sections : lectures mutualisées (cache) pour les données de l'accueil", [/export const lireAccueil = cache\(/.test(lire("src/lib/site/accueil.ts")), /cache\(lirePromesse\)/.test(lire("src/components/accueil/lectures.ts"))], [true, true]);
const pageRacine = lire("src/app/page.tsx");
verifier("page « / » : décision par `decider`, interrupteur et page publiée lus, repli par défaut sans exception", [
  /decider\(\{/.test(pageRacine),
  /fonctionnaliteActive\("accueil_en_blocs"\)/.test(pageRacine),
  /lirePagePubliee\(SLUG_ACCUEIL\)/.test(pageRacine),
  /catch \{[\s\S]*mode: "repli"/.test(pageRacine),
  /canonical: "\/"/.test(pageRacine),
  /Les restaurants de Conakry/.test(pageRacine),
], [true, true, true, true, true, true]);
verifier("page « / » : lectures des sections préchargées avant l'attente de l'interrupteur et de la page (pas de cascade)", [
  /precharger\(\);\s+const decision = await choisirAffichage/.test(pageRacine),
  /lireAccueil\(\), lireTextes\(\), promesseDeLaRequete\(\)/.test(pageRacine),
], [true, true]);
verifier("page « / » : l'aperçu exige la permission d'équipe (peutVoirApercu) et reste hors index", [/peutVoirApercu\(\)/.test(pageRacine), /robots: \{ index: false/.test(pageRacine)], [true, true]);
verifier("page « / » : la page publiée n'est lue que si l'interrupteur est actif", /interrupteurActif && !entreeApercu\?\.page/.test(pageRacine), true);
const pagesBlocs = lire("src/lib/system-admin/pages-blocs.ts");
verifier("actions : toute validation de page reçoit l'adresse de la page", [...pagesBlocs.matchAll(/validerPage\(([^)]*)\)/g)].every((m) => /slug/.test(m[1])), true);
verifier("action de création : l'adresse « accueil » est réservée", /slug === SLUG_ACCUEIL/.test(pagesBlocs), true);
verifier("publication de l'accueil : mention « Accueil publié » dans l'audit", /Accueil publié/.test(pagesBlocs), true);
const contenus = lire("src/lib/system-admin/contenus.ts");
const debutCreation = contenus.indexOf("export async function creerPageAction");
const corpsCreation = contenus.slice(debutCreation, contenus.indexOf("export async function modifierPageAction"));
verifier("pages de texte : l'adresse « accueil » est réservée (message exact), avant toute écriture", [
  /if \(slug === "accueil"\) \{\s+return \{ erreur: "Ce nom est réservé à la page d'accueil du site\. Utilisez le bouton « Créer l'accueil en blocs »\." \};/.test(corpsCreation),
  corpsCreation.indexOf('slug === "accueil"') < corpsCreation.indexOf(".insert("),
  corpsCreation.indexOf('slug === "accueil"') < corpsCreation.indexOf("verifierPermission"),
], [true, true, true]);
const creerAccueil = lire("src/lib/system-admin/accueil-blocs.ts");
verifier("création de l'accueil : permission, palier 1 (brouillon), brouillon seulement, refus si la page existe", [
  /verifierPermission\("contenu\.editer"\)/.test(creerAccueil),
  /MINIMUMS_STUDIO\.brouillon/.test(creerAccueil),
  /statut: "brouillon"/.test(creerAccueil),
  /blocs_publie/.test(creerAccueil),
  /existe: true/.test(creerAccueil),
  /pageAccueilParDefaut\(\)/.test(creerAccueil),
], [true, true, true, false, true, true]);
const routePage = lire("src/app/p/[slug]/page.tsx");
verifier("/p/accueil : redirection permanente vers « / » (aperçu conservé), jamais de doublon", [/permanentRedirect\(/.test(routePage), /slug === SLUG_ACCUEIL/.test(routePage)], [true, true]);
verifier("interrupteur : clé typée, catalogue des mises à jour", [/"accueil_en_blocs"/.test(lire("src/lib/fonctionnalites/lire.ts")), /cle: "accueil_en_blocs"/.test(lire("src/lib/system-admin/misesAJourCatalogue.ts"))], [true, true]);
const migrations = readdirSync(join(racine, "supabase/migrations")).filter((f) => f.endsWith("fonctionnalite_accueil_en_blocs.sql"));
verifier("migration de l'interrupteur : un fichier, une seule ligne d'insertion, active par défaut", [
  migrations.length,
  existsSync(join(racine, "supabase/migrations", migrations[0] ?? "x")) && /insert into fonctionnalites/.test(lire(`supabase/migrations/${migrations[0]}`)) && !/\bfalse\b/i.test(lire(`supabase/migrations/${migrations[0]}`)) && !/\b(update|delete|drop|alter)\b/i.test(lire(`supabase/migrations/${migrations[0]}`)),
], [1, true]);
const rendu = lire("src/components/studio/RenduBlocs.tsx");
verifier("rendu : sections sans conteneur sb-page ni sb-bloc, classe propre", [/sb-accueil-bloc/.test(rendu), /options\.accueil/.test(rendu)], [true, true]);

if (ko) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests de l'accueil en blocs (tâche 9) passent.");
