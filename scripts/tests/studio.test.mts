import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REGISTRE,
  MAX_BLOCS_PAGE,
  analyserParagraphe,
  compterBlocs,
  pageVide,
  schemaPage,
  validerPage,
} from "../../src/lib/studio/registre";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const page = (content: unknown[], root: unknown = { props: {} }) => ({ content, root });
const valide = (json: unknown) => validerPage(json).ok;
const erreurs = (json: unknown) => {
  const r = validerPage(json);
  return r.ok ? [] : r.erreurs;
};
const titre = (props: Record<string, unknown> = {}) => ({ type: "Titre", props: { texte: "Bienvenue", niveau: 2, alignement: "gauche", ...props } });
const bouton = (props: Record<string, unknown> = {}) => ({ type: "Bouton", props: { libelle: "Commander", lien: "/restaurants", style: "principal", ...props } });

// --- Registre ----------------------------------------------------------------------------------------------------
verifier("registre : 5 blocs dans l'ordre", REGISTRE.map((e) => e.type), ["Titre", "Paragraphe", "Bouton", "Separateur", "Espace"]);
for (const e of REGISTRE) {
  verifier(`registre : défauts valides (${e.type})`, e.schemaProps.safeParse(e.defauts).success, true);
  verifier(`registre : page avec le bloc par défaut (${e.type})`, valide(page([{ type: e.type, props: e.defauts }])), true);
}
verifier("pageVide valide, 0 bloc", [valide(pageVide()), compterBlocs(pageVide())], [true, 0]);

// --- Blocs valides -----------------------------------------------------------------------------------------------
const complete = page(
  [
    titre({ id: "Titre-1a2b" }),
    { type: "Paragraphe", props: { texte: "Du **gras**, un [lien](/aide)\n- un\n- deux" } },
    bouton({ lien: "https://exemple.org/x", style: "secondaire" }),
    { type: "Separateur", props: { style: "vide" } },
    { type: "Espace", props: { hauteur: 96 } },
    titre({ niveau: 4, alignement: "centre" }),
  ],
  { props: { titre: "Accueil" } }
);
const r = validerPage(complete);
verifier("page complète valide", r.ok, true);
verifier("page complète : 6 blocs", r.ok ? compterBlocs(r.page) : -1, 6);
// Mêmes données (l'ordre des clés peut changer : le schéma ne transforme ni n'ajoute aucune valeur).
const canonique = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonique) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonique(x)])) : v;
verifier("page complète : contenu inchangé par la validation", r.ok ? JSON.stringify(canonique(r.page)) === JSON.stringify(canonique(complete)) : false, true);
verifier("schemaPage accepte aussi la page complète", schemaPage.safeParse(complete).success, true);
verifier("200 blocs acceptés", valide(page(Array.from({ length: MAX_BLOCS_PAGE }, () => titre()))), true);

// --- Refus -------------------------------------------------------------------------------------------------------
verifier("type inconnu refusé", erreurs(page([{ type: "Image", props: {} }])), ["Bloc 1 : type de bloc inconnu."]);
verifier("type __proto__ refusé", valide(page([{ type: "__proto__", props: {} }])), false);
verifier("type constructor refusé", valide(page([{ type: "constructor", props: {} }])), false);
verifier("type en minuscules refusé", valide(page([{ type: "titre", props: titre().props }])), false);
verifier("propriété en trop refusée (strict)", erreurs(page([titre({ onclick: "x" })])), ["Bloc 1 (Titre) : propriété non autorisée."]);
verifier("clé en trop au niveau du bloc refusée", valide(page([{ ...titre(), html: "<b>" }])), false);
verifier("clé en trop à la racine du document refusée", valide({ ...pageVide(), zones: {} }), false);
verifier("root.props inconnue refusée", valide(page([], { props: { titre: "x", style: "y" } })), false);
verifier("root absent refusé", valide({ content: [] }), false);
verifier("content absent refusé", valide({ root: { props: {} } }), false);
verifier("titre de page > 200 refusé", valide(page([], { props: { titre: "x".repeat(201) } })), false);
verifier("message sans valeur saisie (clé inconnue non reprise)", erreurs(page([titre({ cleSecrete: "valeurSecrete" })])).join(" ").includes("Secrete"), false);
verifier("message sans valeur saisie (type inconnu non repris)", erreurs(page([{ type: "BlocMalveillant", props: {} }])).join(" ").includes("Malveillant"), false);

// Longueurs
verifier("titre : 200 car. accepté", valide(page([titre({ texte: "é".repeat(200) })])), true);
verifier("titre : 201 car. refusé", erreurs(page([titre({ texte: "x".repeat(201) })])), ["Bloc 1 (Titre) : la propriété « texte » est trop longue ou trop grande (maximum 200)."]);
verifier("titre : vide refusé", valide(page([titre({ texte: "" })])), false);
verifier("titre : texte manquant", erreurs(page([{ type: "Titre", props: { niveau: 2, alignement: "gauche" } }])), ["Bloc 1 (Titre) : la propriété « texte » est manquante."]);
verifier("titre : texte non textuel", erreurs(page([titre({ texte: 42 })])), ["Bloc 1 (Titre) : la propriété « texte » n'a pas le bon type."]);
verifier("paragraphe : 5 000 car. accepté", valide(page([{ type: "Paragraphe", props: { texte: "a".repeat(5000) } }])), true);
verifier("paragraphe : 5 001 car. refusé", valide(page([{ type: "Paragraphe", props: { texte: "a".repeat(5001) } }])), false);
verifier("bouton : libellé 60 accepté / 61 refusé", [valide(page([bouton({ libelle: "x".repeat(60) })])), valide(page([bouton({ libelle: "x".repeat(61) })]))], [true, false]);
verifier("caractère NUL refusé", valide(page([titre({ texte: "a\u0000b" })])), false);
verifier("identifiant : caractères non sûrs refusés", valide(page([titre({ id: "a b<" })])), false);

// Énumérations
verifier("titre : niveau 1 refusé (un seul h1 par page)", valide(page([titre({ niveau: 1 })])), false);
verifier("titre : niveau 5 refusé", valide(page([titre({ niveau: 5 })])), false);
verifier("titre : niveau \"2\" (texte) refusé", valide(page([titre({ niveau: "2" })])), false);
verifier("titre : alignement droite refusé", erreurs(page([titre({ alignement: "droite" })])), ["Bloc 1 (Titre) : la propriété « alignement » a une valeur non autorisée."]);
verifier("bouton : style inconnu refusé", valide(page([bouton({ style: "danger" })])), false);
verifier("séparateur : style inconnu refusé", valide(page([{ type: "Separateur", props: { style: "pointille" } }])), false);
verifier("espace : 8/16/32/64/96 acceptés", [8, 16, 32, 64, 96].map((h) => valide(page([{ type: "Espace", props: { hauteur: h } }]))), [true, true, true, true, true]);
verifier("espace : 0, 24, 9999, -8, 16.5 refusés", [0, 24, 9999, -8, 16.5].map((h) => valide(page([{ type: "Espace", props: { hauteur: h } }]))), [false, false, false, false, false]);

// Liens
for (const lien of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.example", "http://exemple.org", "/\\evil", " /aide", "vbscript:x", "", "https://", "/a\nb"]) {
  verifier(`lien refusé : ${JSON.stringify(lien)}`, valide(page([bouton({ lien })])), false);
}
verifier("lien refusé : message clair", erreurs(page([bouton({ lien: "javascript:alert(1)" })])), ["Bloc 1 (Bouton) : la propriété « lien » n'est pas un lien autorisé (chemin du site ou adresse https://)."]);
for (const lien of ["/restaurants", "/p/a-propos", "https://exemple.org/page?x=1"]) {
  verifier(`lien accepté : ${lien}`, valide(page([bouton({ lien })])), true);
}

// Nombre de blocs, formes
verifier("201 blocs refusés", erreurs(page(Array.from({ length: MAX_BLOCS_PAGE + 1 }, () => titre()))), ["La page contient trop de blocs (200 au maximum)."]);
for (const [nom, json] of [["null", null], ["chaîne", "{}"], ["nombre", 3], ["tableau", []], ["Date", new Date()], ["Map", new Map()]] as const) {
  verifier(`JSON non objet refusé (${nom})`, erreurs(json), ["Le document de la page n'est pas un objet."]);
}
verifier("content non tableau refusé", erreurs({ content: {}, root: { props: {} } }), ["La liste des blocs est absente."]);
verifier("bloc non objet refusé", erreurs(page(["Titre"])), ["Bloc 1 : bloc illisible."]);
verifier("props absentes refusées", erreurs(page([{ type: "Titre" }])), ["Bloc 1 (Titre) : propriétés absentes."]);
const cycle: Record<string, unknown> = { content: [], root: { props: {} } };
cycle.moi = cycle;
verifier("document cyclique refusé sans exception", erreurs(cycle), ["Le document de la page est illisible."]);

// Imbrication : profondeur 1 seulement
let profond: unknown = "x";
for (let i = 0; i < 5000; i++) profond = [profond];
verifier("tableau profond dans un bloc refusé", valide(page([titre({ texte: profond })])), false);
verifier("tableau profond comme content refusé", valide(page([profond])), false);
let tresProfond: unknown = {};
for (let i = 0; i < 100_000; i++) tresProfond = { a: tresProfond };
verifier("profondeur extrême refusée sans exception", valide(page([], tresProfond)), false);
verifier("bloc imbriqué (zone) refusé", valide(page([{ type: "Titre", props: { ...titre().props, content: [titre()] } }])), false);

// Taille
verifier("document > 200 Ko refusé", erreurs(page([{ type: "Paragraphe", props: { texte: "a".repeat(5000) } }], { props: { titre: "t", x: "b".repeat(210_000) } })), ["La page est trop volumineuse (200 Ko au maximum)."]);

// Charge <script> : acceptée comme TEXTE, jamais interprétée (aucun HTML produit par le module)
const script = "<script>alert('x')</script><img src=x onerror=alert(1)>";
verifier("charge <script> acceptée comme texte (titre)", valide(page([titre({ texte: script })])), true);
verifier("charge <script> acceptée comme texte (paragraphe)", valide(page([{ type: "Paragraphe", props: { texte: script } }])), true);
verifier("paragraphe : <script> reste un segment texte", analyserParagraphe(script), [{ type: "paragraphe", segments: [{ type: "texte", valeur: script }] }]);

// Paragraphe : sous-ensemble du texte riche
verifier("paragraphe : gras et lien", analyserParagraphe("a **b** [c](/d)"), [
  { type: "paragraphe", segments: [{ type: "texte", valeur: "a " }, { type: "gras", valeur: "b" }, { type: "texte", valeur: " " }, { type: "lien", libelle: "c", href: "/d" }] },
]);
verifier("paragraphe : lien javascript rendu en texte", analyserParagraphe("[x](javascript:alert(1))"), [{ type: "paragraphe", segments: [{ type: "texte", valeur: "x" }] }]);
verifier("paragraphe : liste", analyserParagraphe("- a\n- b"), [{ type: "liste", elements: [[{ type: "texte", valeur: "a" }], [{ type: "texte", valeur: "b" }]] }]);
verifier("paragraphe : pas de titre (# reste du texte)", analyserParagraphe("# Grand"), [{ type: "paragraphe", segments: [{ type: "texte", valeur: "# " }, { type: "texte", valeur: "Grand" }] }]);

// Performance : entrée hostile de ~200 Ko
{
  const hostile = page(
    Array.from({ length: 200 }, (_, i) =>
      i % 2
        ? { type: "Paragraphe", props: { texte: ("[" + "(".repeat(40) + "**<script>**](javascript:x) ").repeat(30).slice(0, 1400) } }
        : bouton({ libelle: "x".repeat(60), lien: "/" + "a".repeat(400) })
    ),
    { props: { titre: "t" } }
  );
  const taille = new TextEncoder().encode(JSON.stringify(hostile)).length;
  const debut = performance.now();
  const resultat = validerPage(hostile);
  const duree = performance.now() - debut;
  verifier(`entrée hostile de ${Math.round(taille / 1024)} Ko (> 190 Ko) validée`, [taille > 190_000, taille <= 204_800, resultat.ok], [true, true, true]);
  verifier(`entrée hostile : validation en ${duree.toFixed(1)} ms (< 150 ms)`, duree < 150, true);
  const refusee = page(Array.from({ length: 200 }, () => ({ type: "Inconnu", props: { x: "y".repeat(900) } })));
  const d2 = performance.now();
  const rr = validerPage(refusee);
  const duree2 = performance.now() - d2;
  verifier(`entrée hostile refusée : erreurs bornées (${rr.ok ? 0 : rr.erreurs.length}) en ${duree2.toFixed(1)} ms`, [rr.ok, !rr.ok && rr.erreurs.length === 11 && rr.erreurs[10] === "D'autres erreurs ne sont pas affichées.", duree2 < 150], [false, true, true]);
}

// --- Garde-fou : le registre reste pur (aucun import serveur ni de Puck) -----------------------------------------------
{
  const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
  const source = readFileSync(join(racine, "src/lib/studio/registre.ts"), "utf8");
  const imports = [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
  verifier("registre.ts : imports autorisés seulement", imports.filter((i) => !["zod/mini", "zod/v4/core", "../auth/redirection", "../cms/texte-riche"].includes(i)), []);
  const rendu = readFileSync(join(racine, "src/components/studio/RenduPage.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  verifier("RenduPage : aucun import de Puck", /puckeditor/.test(rendu), false);
  verifier("RenduPage : composant serveur (pas de \"use client\")", /["']use client["']/.test(rendu), false);
  verifier("RenduPage : aucun dangerouslySetInnerHTML", /dangerouslySetInnerHTML/.test(rendu), false);
}

if (ko) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests du Studio (blocs) passent.");
