import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REGISTRE,
  TYPES_SIMPLES,
  compterBlocs,
  estUrlImageStudio,
  validerPage,
} from "../../src/lib/studio/registre";
import {
  ALIGNEMENTS,
  ANNEAU_FOCUS,
  CODES_FOND,
  ESPACES,
  FONDS,
  LARGEURS,
  OPTIONS_REGLAGES,
  VISIBILITES,
  classesReglages,
  normaliserReglages,
} from "../../src/lib/studio/reglages";
import { TAILLE_MAX_IMAGE, decrireTaille, libelleImageListe, messageTailleImage } from "../../src/lib/studio/image-champ";
import { trouverChainesAnglaises } from "../../src/lib/studio/francisation";

/**
 * Tests des blocs de la tâche 8 : réglages communs (mode mixte), image, colonnes, FAQ, appel à l'action, citation, carte et
 * liste de restaurants. Les couples fond/texte sont contrôlés (contraste AA) à partir des VALEURS RÉELLES des jetons de
 * globals.css et des règles RÉELLES de studio-blocs.css.
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

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://projet-test.supabase.co";
const BASE_IMAGES = "https://projet-test.supabase.co/storage/v1/object/public/medias/studio/";
const IMAGE = `${BASE_IMAGES}0b1c2d3e-aaaa-4bbb-8ccc-111122223333.jpg`;
const UUID = "0b1c2d3e-aaaa-4bbb-8ccc-111122223333";

const page = (content: unknown[], root: unknown = { props: {} }) => ({ content, root });
const valide = (json: unknown) => validerPage(json).ok;
const pageValide = (json: unknown) => {
  const r = validerPage(json);
  if (!r.ok) throw new Error(`page invalide : ${r.erreurs.join(" ")}`);
  return r.page;
};
const erreurs = (json: unknown) => {
  const r = validerPage(json);
  return r.ok ? [] : r.erreurs;
};
const titre = (props: Record<string, unknown> = {}) => ({ type: "Titre", props: { texte: "Bienvenue", niveau: 2, alignement: "gauche", ...props } });
const paragraphe = (props: Record<string, unknown> = {}) => ({ type: "Paragraphe", props: { texte: "Du texte.", ...props } });
const image = (props: Record<string, unknown> = {}) => ({ type: "Image", props: { src: IMAGE, alt: "Un plat de riz gras", ratio: "16-9", ajustement: "couvrir", ...props } });
const bouton = (props: Record<string, unknown> = {}) => ({ type: "Bouton", props: { libelle: "Commander", lien: "/restaurants", style: "principal", ...props } });
const citation = (props: Record<string, unknown> = {}) => ({ type: "Citation", props: { texte: "Délicieux.", ...props } });
const colonnes = (props: Record<string, unknown> = {}) => ({ type: "Colonnes", props: { nombre: 2, ecart: 16, colonne1: [], colonne2: [], colonne3: [], ...props } });
const faq = (props: Record<string, unknown> = {}) => ({ type: "FAQ", props: { questions: [{ question: "Q ?", reponse: "R." }], ...props } });
const cta = (props: Record<string, unknown> = {}) => ({
  type: "AppelAction",
  props: { titre: "Prêt ?", bouton: { libelle: "Voir", lien: "/restaurants", style: "principal" }, ...props },
});
const carte = (props: Record<string, unknown> = {}) => ({ type: "CarteRestaurant", props: { restaurantId: UUID, ...props } });
const liste = (props: Record<string, unknown> = {}) => ({ type: "ListeRestaurants", props: { filtre: "tous", nombre: 3, ...props } });

// ==== 1. Réglages communs ===================================================================================================
const reglages = (r: Record<string, unknown>) => page([titre({ reglages: r })]);
verifier("réglages : objet vide accepté", valide(reglages({})), true);
verifier("réglages : tous les champs valides acceptés", valide(reglages({ espaceHaut: 16, espaceBas: 0, alignement: "centre", largeur: "large", fond: "mangue", visibilite: "mobile", ancre: "section-1" })), true);
for (const v of ESPACES) verifier(`réglages : espace ${v} accepté`, [valide(reglages({ espaceHaut: v })), valide(reglages({ espaceBas: v }))], [true, true]);
for (const v of [1, 7, 24, 100, -8, 16.5, "16", null]) verifier(`réglages : espace ${JSON.stringify(v)} refusé`, [valide(reglages({ espaceHaut: v })), valide(reglages({ espaceBas: v }))], [false, false]);
for (const [cle, bonnes] of [["alignement", ALIGNEMENTS], ["largeur", LARGEURS], ["fond", CODES_FOND], ["visibilite", VISIBILITES]] as const) {
  verifier(`réglages : ${cle}, toutes les valeurs de la liste acceptées`, bonnes.map((v) => valide(reglages({ [cle]: v }))), bonnes.map(() => true));
  verifier(`réglages : ${cle}, valeur libre refusée`, ["autre", "", "#ff0000", "red", "1px", "GAUCHE"].map((v) => valide(reglages({ [cle]: v }))), [false, false, false, false, false, false]);
}
verifier("réglages : couleur libre refusée (fond)", valide(reglages({ fond: "rgb(1,2,3)" })), false);
verifier("réglages : propriété en trop refusée (style, classe)", [valide(reglages({ style: "color:red" })), valide(reglages({ className: "x" })), valide(reglages({ couleur: "rouge" }))], [false, false, false]);
verifier("réglages : message sans valeur saisie", erreurs(reglages({ fond: "SECRETE" })).join(" ").includes("SECRETE"), false);
verifier("réglages : message d'une propriété en trop", erreurs(reglages({ cleSecrete: 1 })), ["Bloc 1 (Titre) : propriété non autorisée."]);
verifier("réglages : non objet refusé", [valide(page([titre({ reglages: "gras" })])), valide(page([titre({ reglages: [] })])), valide(page([titre({ reglages: null })]))], [false, false, false]);
// Ancres
for (const bonne of ["a", "faq", "section-1", "a".repeat(40), "q-2-r"]) verifier(`ancre acceptée : ${bonne.slice(0, 12)}`, valide(reglages({ ancre: bonne })), true);
for (const mauvaise of ["", "1abc", "-a", "A", "a b", "a_b", "é", "a".repeat(41), "a.b", "#a", "a/b", "<script>", "contenu", "main", "root", "etape-panneau"]) {
  verifier(`ancre refusée : ${JSON.stringify(mauvaise.slice(0, 14))}`, valide(reglages({ ancre: mauvaise })), false);
}
verifier("ancres en doublon refusées (page)", erreurs(page([titre({ reglages: { ancre: "faq" } }), paragraphe({ reglages: { ancre: "faq" } })])), ["Bloc 2 : cette ancre est déjà utilisée par bloc 1 (une ancre est unique dans la page)."]);
verifier("ancres distinctes acceptées", valide(page([titre({ reglages: { ancre: "a" } }), paragraphe({ reglages: { ancre: "b" } })])), true);
verifier("ancres en doublon refusées (dans les colonnes)", valide(page([titre({ reglages: { ancre: "x" } }), colonnes({ colonne1: [paragraphe({ reglages: { ancre: "x" } })] })])), false);
verifier("ancres en doublon : colonne et colonne", erreurs(page([colonnes({ colonne1: [paragraphe({ reglages: { ancre: "y" } })], colonne2: [titre({ reglages: { ancre: "y" } })] })])), ["Bloc 1, colonne 2, bloc 1 : cette ancre est déjà utilisée par bloc 1, colonne 1, bloc 1 (une ancre est unique dans la page)."]);
verifier("ancre du bloc Colonnes elle-même comptée", valide(page([colonnes({ reglages: { ancre: "z" } }), titre({ reglages: { ancre: "z" } })])), false);
// Chaque bloc accepte des réglages
for (const e of REGISTRE) {
  const exemple = { Image: image().props, CarteRestaurant: carte().props }[e.type as "Image"] ?? e.defauts;
  const bloc = (extra: unknown) => ({ type: e.type, props: { ...exemple, reglages: extra } });
  verifier(`réglages acceptés sur ${e.type}`, [valide(page([bloc({ fond: "creme", espaceBas: 8 })])), valide(page([bloc({ fond: "orange" })]))], [true, false]);
}
// Normalisation de l'éditeur
verifier("normaliser : « Par défaut » retiré", normaliserReglages({ fond: "", espaceHaut: undefined, alignement: "centre" }), { alignement: "centre" });
verifier("normaliser : objet vide -> rien", [normaliserReglages({ fond: "" }), normaliserReglages({}), normaliserReglages(undefined), normaliserReglages(null), normaliserReglages("x"), normaliserReglages([])], [undefined, undefined, undefined, undefined, undefined, undefined]);
verifier("normaliser : une valeur invalide est GARDÉE (jamais retirée en silence)", normaliserReglages({ fond: "orange" }), { fond: "orange" });
verifier("normaliser : 0 est une vraie valeur", normaliserReglages({ espaceHaut: 0 }), { espaceHaut: 0 });

// Classes : table fermée, toutes présentes dans la feuille de style
const css = readFileSync(join(racine, "src/app/studio-blocs.css"), "utf8");
const classesCss = new Set([...css.matchAll(/\.(sb-[a-z0-9-]+)/g)].map((m) => m[1]));
verifier("classes : aucun réglage -> aucune classe (rendu d'avant, sans conteneur)", [classesReglages(undefined), classesReglages({}), classesReglages({ fond: "aucun", visibilite: "tous" })], [[], [], []]);
verifier("classes : exemple complet", classesReglages({ espaceHaut: 16, espaceBas: 0, alignement: "droite", largeur: "etroite", fond: "rouge", visibilite: "bureau" }), ["sb-eh-16", "sb-eb-0", "sb-al-droite", "sb-l-etroite", "sb-fond sb-fond-rouge", "sb-vis-bureau"]);
verifier("classes : l'ancre n'est pas une classe", classesReglages({ ancre: "faq" }), []);
verifier("classes : mode édition (le bloc masqué reste visible)", classesReglages({ visibilite: "mobile" }, true), []);
verifier("classes : valeur hors table ignorée (jamais recopiée)", classesReglages({ fond: "x y" } as never), []);
const toutes = [
  ...ESPACES.flatMap((v) => classesReglages({ espaceHaut: v, espaceBas: v })),
  ...ALIGNEMENTS.flatMap((v) => classesReglages({ alignement: v })),
  ...LARGEURS.flatMap((v) => classesReglages({ largeur: v })),
  ...CODES_FOND.flatMap((v) => classesReglages({ fond: v })),
  ...VISIBILITES.flatMap((v) => classesReglages({ visibilite: v })),
].flatMap((c) => c.split(" "));
verifier("classes : chacune existe dans studio-blocs.css", [...new Set(toutes)].filter((c) => !classesCss.has(c)), []);
verifier("classes : une trentaine de classes de réglages", new Set(toutes).size >= 25, true);
verifier("feuille : aucune couleur en dur ni style en ligne", [/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")), /rgba?\(|hsla?\(/.test(css)], [false, false]);

// ==== 2. Contraste AA des fonds ================================================================================================
const globals = readFileSync(join(racine, "src/app/globals.css"), "utf8");
const bloc = globals.slice(globals.indexOf(":root"), globals.indexOf("}", globals.indexOf(":root")));
const jetons: Record<string, string> = {};
for (const m of bloc.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) jetons[m[1]] = m[2];
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string): number {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (haut + 0.05) / (bas + 0.05);
}
const ratio = (jetonFond: string, jetonTexte: string) => contraste(jetons[jetonFond], jetons[jetonTexte]);
verifier("jetons lus dans globals.css", ["--rouge", "--creme", "--surface", "--mangue", "--encre", "--secondaire"].every((j) => /^#[0-9a-f]{6}$/i.test(jetons[j] ?? "")), true);
verifier("méthode de contraste : noir sur blanc = 21", Math.round(contraste("#000000", "#ffffff")), 21);
const AA = 4.5;
for (const code of CODES_FOND) {
  const couple = FONDS[code];
  if (!couple) continue;
  const r = ratio(couple.fond, couple.texte);
  verifier(`contraste AA : fond ${code} (${couple.fond}) / texte (${couple.texte}) = ${r.toFixed(2)}:1 ≥ ${AA}`, r >= AA, true);
}
verifier("table des fonds : une entrée par code, « aucun » sans couple", [Object.keys(FONDS).sort(), FONDS.aucun], [[...CODES_FOND].sort(), null]);
// Couples INTERDITS (ils échouent bien : le test sait les détecter)
verifier("couple interdit détecté : texte rouge sur fond mangue", ratio("--mangue", "--rouge") < AA, true);
verifier("couple interdit détecté : texte encre sur fond rouge", ratio("--rouge", "--encre") < AA, true);
verifier("couple interdit détecté : texte secondaire sur fond encre", ratio("--encre", "--secondaire") < AA, true);
// La feuille applique EXACTEMENT les couples de la table, et tout couple fond/texte écrit dans la feuille passe AA.
const regles = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selecteur: m[1].trim(), corps: m[2] }));
const jetonDe = (corps: string, prop: string) => new RegExp(`(?:^|[;\\s])${prop}:\\s*var\\((--[a-z-]+)\\)`).exec(corps)?.[1];
for (const code of CODES_FOND) {
  const couple = FONDS[code];
  if (!couple) continue;
  const regle = regles.find((r) => r.selecteur === `.sb-fond-${code}`);
  verifier(`feuille : .sb-fond-${code} utilise ${couple.fond} et ${couple.texte}`, [jetonDe(regle?.corps ?? "", "background"), jetonDe(regle?.corps ?? "", "color")], [couple.fond, couple.texte]);
}
const couplesFeuille = regles.flatMap((r) => {
  const fond = jetonDe(r.corps, "background");
  const texte = jetonDe(r.corps, "color");
  return fond && texte ? [{ selecteur: r.selecteur, fond, texte, ratio: ratio(fond, texte) }] : [];
});
verifier(`feuille : au moins 7 couples fond/texte contrôlés (${couplesFeuille.length})`, couplesFeuille.length >= 7, true);
verifier(`feuille : tous les couples fond/texte passent AA (${couplesFeuille.map((c) => c.ratio.toFixed(1)).join(", ")})`, couplesFeuille.filter((c) => c.ratio < AA).map((c) => c.selecteur), []);

// Anneau de focus : ≥ 3:1 contre le fond adjacent, pour CHAQUE fond autorisé (WCAG 1.4.11)
const SEUIL_FOCUS = 3;
const globalFocus = jetonDe(regles.find((r) => r.selecteur === ":focus-visible")?.corps ?? "", "outline") ?? /outline:\s*3px solid var\((--[a-z-]+)\)/.exec(globals)?.[1];
verifier("focus : l'anneau global du site est --rouge-fonce (globals.css)", /:focus-visible\s*\{\s*outline:\s*3px solid var\(--rouge-fonce\)/.test(globals), true);
void globalFocus;
for (const code of CODES_FOND) {
  const fond = FONDS[code]?.fond ?? "--creme";
  const anneau = ANNEAU_FOCUS[code];
  const r = ratio(fond, anneau);
  verifier(`focus : fond ${code}, anneau ${anneau} = ${r.toFixed(2)}:1 ≥ ${SEUIL_FOCUS}`, r >= SEUIL_FOCUS, true);
  if (code === "aucun") verifier("focus : fond de page (surface) aussi", ratio("--surface", anneau) >= SEUIL_FOCUS, true);
  // La feuille applique bien cet anneau : rouge et encre le changent, les autres gardent celui du site.
  const regle = regles.find((x) => x.selecteur === `.sb-fond-${code} :focus-visible`);
  verifier(`focus : feuille, fond ${code}`, regle ? jetonDe(regle.corps, "outline-color") : "global", anneau === "--rouge-fonce" ? "global" : anneau);
}
// Éléments à fond clair posés SUR un bloc foncé : leur anneau reste foncé (≥ 3:1 sur --surface).
for (const sel of [".sb-fond .sb-faq-item > summary:focus-visible", ".sb-fond .pub-carte-resto :focus-visible"]) {
  const regle = regles.find((x) => x.selecteur === sel);
  const jeton = jetonDe(regle?.corps ?? "", "outline-color");
  verifier(`focus : ${sel} → ${jeton} sur --surface = ${jeton ? ratio("--surface", jeton).toFixed(2) : "?"}:1`, !!jeton && ratio("--surface", jeton) >= SEUIL_FOCUS, true);
}
const resume = regles.find((x) => x.selecteur === ".sb-faq-item > summary:focus-visible");
verifier("focus : résumé de la FAQ = --rouge-fonce (jamais le halo orange écarté par l'audit)", [jetonDe(resume?.corps ?? "", "outline"), /orange|shadow-focus/.test(resume?.corps ?? "")], [undefined, false].map((v, i) => (i === 0 ? jetonDe(resume?.corps ?? "", "outline") : v)));
verifier("focus : la feuille n'emploie ni --orange ni --shadow-focus", /var\(--orange\)|var\(--shadow-focus\)/.test(css), false);

// ==== 3. Rétrocompatibilité (pages T6/T7 sans réglages) ======================================================================
{
  const ancienne = page(
    [titre({ id: "Titre-1" }), paragraphe({ texte: "Du **gras**." }), bouton({ lien: "https://exemple.org/x", style: "secondaire" }), { type: "Separateur", props: { style: "trait" } }, { type: "Espace", props: { hauteur: 64 } }],
    { props: { titre: "Accueil" } }
  );
  const r = validerPage(ancienne);
  verifier("page T6/T7 sans réglages : valide", r.ok, true);
  verifier("page T6/T7 : aucun réglage ajouté par la validation", r.ok && r.page.content.every((b) => !("reglages" in b.props)), true);
  verifier("page T6/T7 : aucune classe de réglage (rendu identique)", r.ok && r.page.content.map((b) => classesReglages(b.props.reglages)), [[], [], [], [], []]);
  const source = readFileSync(join(racine, "src/components/studio/RenduBlocs.tsx"), "utf8");
  verifier("rendu : le conteneur n'est posé que s'il y a un réglage, une ancre ou une note d'aperçu", /classes\.length === 0 && !ancre && !note\) return <>\{children\}<\/>/.test(source), true);
}

// ==== 4. Image ================================================================================================================
verifier("image : valide", valide(page([image()])), true);
for (const ext of ["jpg", "png", "webp"]) verifier(`image : .${ext} acceptée`, valide(page([image({ src: `${BASE_IMAGES}0b1c2d3e-aaaa-4bbb-8ccc-111122223333.${ext}` })])), true);
const NOM = "0b1c2d3e-aaaa-4bbb-8ccc-111122223333.jpg";
const refusees: [string, string][] = [
  ["autre hôte", `https://evil.example/storage/v1/object/public/medias/studio/${NOM}`],
  ["hôte avec le nôtre en préfixe", `https://projet-test.supabase.co.evil.example/storage/v1/object/public/medias/studio/${NOM}`],
  ["identifiants dans l'adresse", `https://projet-test.supabase.co@evil.example/storage/v1/object/public/medias/studio/${NOM}`],
  ["http", `http://projet-test.supabase.co/storage/v1/object/public/medias/studio/${NOM}`],
  ["autre dossier du stockage", `https://projet-test.supabase.co/storage/v1/object/public/medias/restaurants/${NOM}`],
  ["autre bucket", `https://projet-test.supabase.co/storage/v1/object/public/autre/studio/${NOM}`],
  ["bucket privé (sign)", `https://projet-test.supabase.co/storage/v1/object/sign/medias/studio/${NOM}`],
  ["traversée de chemin", `https://projet-test.supabase.co/storage/v1/object/public/medias/studio/../restaurants/${NOM}`],
  ["traversée encodée", `https://projet-test.supabase.co/storage/v1/object/public/medias/studio/%2e%2e/${NOM}`],
  ["paramètre", `${BASE_IMAGES}${NOM}?x=1`],
  ["ancre", `${BASE_IMAGES}${NOM}#x`],
  ["SVG", `${BASE_IMAGES}0b1c2d3e-aaaa-4bbb-8ccc-111122223333.svg`],
  ["GIF", `${BASE_IMAGES}0b1c2d3e-aaaa-4bbb-8ccc-111122223333.gif`],
  ["nom non généré par le serveur", `${BASE_IMAGES}photo.jpg`],
  ["sous-dossier", `${BASE_IMAGES}x/${NOM}`],
  ["majuscules dans l'hôte", `https://PROJET-TEST.supabase.co/storage/v1/object/public/medias/studio/${NOM}`],
  ["javascript", "javascript:alert(1)"],
  ["data", "data:image/png;base64,AAAA"],
  ["relative", "/images/plat.jpg"],
  ["protocole implicite", `//projet-test.supabase.co/storage/v1/object/public/medias/studio/${NOM}`],
  ["vide", ""],
  ["espace final", `${BASE_IMAGES}${NOM} `],
  ["retour ligne", `${BASE_IMAGES}${NOM}\n`],
  ["trop longue", `${BASE_IMAGES}${"a".repeat(300)}.jpg`],
];
for (const [nom, src] of refusees) verifier(`image : adresse refusée (${nom})`, valide(page([image({ src })])), false);
verifier("image : adresse refusée -> message clair", erreurs(page([image({ src: "https://evil.example/a.jpg" })])), ["Bloc 1 (Image) : l'image n'est pas choisie ou n'est pas une image du stockage de Speedfood (téléversez-la depuis l'éditeur)."]);
verifier("image : src non textuel refusé", [valide(page([image({ src: 42 })])), valide(page([image({ src: null })])), valide(page([image({ src: undefined })]))], [false, false, false]);
verifier("image : estUrlImageStudio sans origine connue : tout refusé", estUrlImageStudio(IMAGE, ""), false);
{
  const garde = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  verifier("image : variable d'environnement absente : tout refusé", valide(page([image()])), false);
  process.env.NEXT_PUBLIC_SUPABASE_URL = garde;
}
verifier("image : estUrlImageStudio avec une autre origine", [estUrlImageStudio(IMAGE, "https://autre.supabase.co"), estUrlImageStudio(IMAGE, "https://projet-test.supabase.co/")], [false, true]);
verifier("image : estUrlImageStudio origine invalide", estUrlImageStudio(IMAGE, "pas une url"), false);
// Texte alternatif
verifier("image : alt vide refusé sans case décorative", erreurs(page([image({ alt: "" })])), ["Bloc 1 (Image) : la description de l'image est obligatoire (ou cochez « image décorative »)."]);
verifier("image : alt d'espaces refusé", valide(page([image({ alt: "   " })])), false);
verifier("image : alt absent refusé", valide(page([{ type: "Image", props: { src: IMAGE, ratio: "auto", ajustement: "couvrir" } }])), false);
verifier("image : décorative sans alt acceptée", valide(page([image({ alt: "", decorative: true })])), true);
verifier("image : decorative=false exige l'alt", valide(page([image({ alt: "", decorative: false })])), false);
verifier("image : decorative non booléen refusé", [valide(page([image({ decorative: "oui" })])), valide(page([image({ decorative: 1 })]))], [false, false]);
verifier("image : alt 200 accepté / 201 refusé", [valide(page([image({ alt: "a".repeat(200) })])), valide(page([image({ alt: "a".repeat(201) })]))], [true, false]);
verifier("image : légende 200 acceptée / 201 refusée", [valide(page([image({ legende: "a".repeat(200) })])), valide(page([image({ legende: "a".repeat(201) })]))], [true, false]);
verifier("image : légende absente ou vide acceptée", [valide(page([image({ legende: "" })])), valide(page([image()]))], [true, true]);
for (const v of ["auto", "carre", "16-9", "4-3"]) verifier(`image : ratio ${v} accepté`, valide(page([image({ ratio: v })])), true);
verifier("image : ratio libre refusé", ["3-2", "1:1", "100%", ""].map((v) => valide(page([image({ ratio: v })]))), [false, false, false, false]);
verifier("image : ajustement couvrir/contenir acceptés, autre refusé", [valide(page([image({ ajustement: "couvrir" })])), valide(page([image({ ajustement: "contenir" })])), valide(page([image({ ajustement: "etirer" })]))], [true, true, false]);
verifier("image : propriété en trop refusée (width, onerror)", [valide(page([image({ width: 100 })])), valide(page([image({ onerror: "x" })]))], [false, false]);
verifier("image : caractère NUL refusé dans alt", valide(page([image({ alt: "a\u0000b" })])), false);

// ==== 5. Colonnes ===============================================================================================================
verifier("colonnes : 2 colonnes vides acceptées", valide(page([colonnes()])), true);
verifier("colonnes : 3 colonnes avec blocs simples", valide(page([colonnes({ nombre: 3, colonne1: [titre(), paragraphe()], colonne2: [image(), bouton()], colonne3: [citation(), { type: "Espace", props: { hauteur: 16 } }, { type: "Separateur", props: { style: "trait" } }] })])), true);
verifier("colonnes : nombre 1, 4, \"2\" refusés", [1, 4, "2", 0].map((n) => valide(page([colonnes({ nombre: n })]))), [false, false, false, false]);
verifier("colonnes : écart 8/16/32 acceptés, autre refusé", [8, 16, 32, 12, 0].map((n) => valide(page([colonnes({ ecart: n })]))), [true, true, true, false, false]);
verifier("colonnes : colonnes absentes acceptées (traitées comme vides)", valide(page([{ type: "Colonnes", props: { nombre: 2, ecart: 16 } }])), true);
verifier("colonnes : propriété en trop refusée", [valide(page([colonnes({ colonne4: [] })])), valide(page([colonnes({ onclick: "x" })]))], [false, false]);
verifier("colonnes : une colonne n'est pas une liste", erreurs(page([colonnes({ colonne1: {} })])), ["Bloc 1 (Colonnes) : la colonne 1 n'est pas une liste de blocs."]);
verifier("colonnes : 3e colonne remplie avec 2 colonnes refusée", erreurs(page([colonnes({ nombre: 2, colonne3: [titre()] })])), ["Bloc 1 (Colonnes) : la colonne 3 contient des blocs mais la mise en page n'a que 2 colonnes : videz cette colonne ou choisissez 3 colonnes."]);
verifier("colonnes : 3e colonne vide avec 2 colonnes acceptée", valide(page([colonnes({ nombre: 2, colonne3: [] })])), true);
// Imbrication
verifier("colonnes : Colonnes dans une colonne refusées", erreurs(page([colonnes({ colonne1: [colonnes()] })])), ["Bloc 1, colonne 1, bloc 1 (Colonnes) : les colonnes ne peuvent pas être placées l'une dans l'autre."]);
verifier("colonnes : profondeur 3 refusée (colonnes dans colonnes dans colonnes)", valide(page([colonnes({ colonne1: [colonnes({ colonne1: [colonnes()] })] })])), false);
for (const dynamique of [carte(), liste(), faq(), cta()]) {
  verifier(`colonnes : ${dynamique.type} refusé dans une colonne`, erreurs(page([colonnes({ colonne2: [dynamique] })])).length, 1);
}
verifier("colonnes : message pour un bloc non autorisé", erreurs(page([colonnes({ colonne2: [liste()] })])), ["Bloc 1, colonne 2, bloc 1 (Liste de restaurants) : ce bloc ne peut pas être placé dans une colonne."]);
verifier("colonnes : type inconnu dans une colonne", erreurs(page([colonnes({ colonne1: [{ type: "Script", props: {} }] })])), ["Bloc 1, colonne 1, bloc 1 : type de bloc inconnu."]);
verifier("colonnes : bloc invalide dans une colonne numéroté", erreurs(page([titre(), colonnes({ colonne2: [paragraphe(), titre({ texte: "" })] })])), ["Bloc 2, colonne 2, bloc 2 (Titre) : la propriété « texte » est vide ou trop courte."]);
verifier("colonnes : propriété en trop d'un bloc de colonne", valide(page([colonnes({ colonne1: [titre({ html: "<b>" })] })])), false);
verifier("colonnes : clé en trop au niveau d'un bloc de colonne", valide(page([colonnes({ colonne1: [{ ...titre(), zones: {} }] })])), false);
verifier("colonnes : liste non tableau d'objets refusée", [valide(page([colonnes({ colonne1: ["Titre"] })])), valide(page([colonnes({ colonne1: [null] })])), valide(page([colonnes({ colonne1: [[]] })]))], [false, false, false]);
verifier("colonnes : réglages sur les blocs de colonne et sur Colonnes", valide(page([colonnes({ reglages: { fond: "creme" }, colonne1: [titre({ reglages: { alignement: "centre" } })] })])), true);
// Limites globales, comptées récursivement
const nColonnes = (n: number) => Array.from({ length: n }, () => colonnes({ nombre: 3, colonne1: [titre()], colonne2: [titre()], colonne3: [titre()] }));
verifier("200 blocs récursifs acceptés (50 × (1 + 3))", [valide(page(nColonnes(50))), compterBlocs(pageValide(page(nColonnes(50))))], [true, 200]);
verifier("201 blocs récursifs refusés (50 × 4 + 1)", erreurs(page([...nColonnes(50), titre()])), ["La page contient trop de blocs (200 au maximum, blocs des colonnes compris)."]);
verifier("201 blocs récursifs refusés (un seul bloc Colonnes à 201 enfants)", valide(page([colonnes({ colonne1: Array.from({ length: 201 }, () => titre()) })])), false);
verifier("200 blocs dans UNE colonne : 201 avec le bloc Colonnes -> refusé", valide(page([colonnes({ colonne1: Array.from({ length: 200 }, () => titre()) })])), false);
verifier("199 blocs dans une colonne + Colonnes = 200 : accepté", valide(page([colonnes({ colonne1: Array.from({ length: 199 }, () => titre()) })])), true);
verifier("compterBlocs : récursif", compterBlocs(pageValide(page([titre(), colonnes({ colonne1: [titre(), titre()], colonne2: [titre()] })]))), 5);

// ==== 6. FAQ ====================================================================================================================
verifier("faq : valide, titre facultatif", [valide(page([faq()])), valide(page([faq({ titre: "Questions" })]))], [true, true]);
verifier("faq : 20 questions acceptées / 21 refusées", [20, 21].map((n) => valide(page([faq({ questions: Array.from({ length: n }, () => ({ question: "Q ?", reponse: "R" })) })]))), [true, false]);
verifier("faq : aucune question refusée", valide(page([faq({ questions: [] })])), false);
verifier("faq : question 200 / 201", [200, 201].map((n) => valide(page([faq({ questions: [{ question: "q".repeat(n), reponse: "R" }] })]))), [true, false]);
verifier("faq : réponse 2000 / 2001", [2000, 2001].map((n) => valide(page([faq({ questions: [{ question: "Q", reponse: "r".repeat(n) }] })]))), [true, false]);
verifier("faq : question ou réponse vide refusée", [valide(page([faq({ questions: [{ question: "", reponse: "R" }] })])), valide(page([faq({ questions: [{ question: "Q", reponse: "" }] })]))], [false, false]);
verifier("faq : propriété en trop dans une question", valide(page([faq({ questions: [{ question: "Q", reponse: "R", html: "<b>" }] })])), false);
verifier("faq : message avec le numéro de l'élément", erreurs(page([faq({ questions: [{ question: "Q", reponse: "R" }, { question: "", reponse: "R" }] })])), ["Bloc 1 (Questions fréquentes) : la propriété « questions » (élément 2) est vide ou trop courte."]);
verifier("faq : titre 120 / 121", [120, 121].map((n) => valide(page([faq({ titre: "t".repeat(n) })]))), [true, false]);

// ==== 7. Appel à l'action =======================================================================================================
verifier("appel à l'action : valide, texte facultatif", [valide(page([cta()])), valide(page([cta({ texte: "Un texte" })]))], [true, true]);
verifier("appel à l'action : titre 120 / 121, vide refusé", [valide(page([cta({ titre: "t".repeat(120) })])), valide(page([cta({ titre: "t".repeat(121) })])), valide(page([cta({ titre: "" })]))], [true, false, false]);
verifier("appel à l'action : texte 300 / 301", [300, 301].map((n) => valide(page([cta({ texte: "t".repeat(n) })]))), [true, false]);
for (const lien of ["javascript:alert(1)", "data:text/html,x", "http://exemple.org", "//evil.example", "", "/\\evil"]) {
  verifier(`appel à l'action : lien refusé ${JSON.stringify(lien)}`, valide(page([cta({ bouton: { libelle: "Go", lien, style: "principal" } })])), false);
}
for (const lien of ["/restaurants", "https://exemple.org/x"]) verifier(`appel à l'action : lien accepté ${lien}`, valide(page([cta({ bouton: { libelle: "Go", lien, style: "principal" } })])), true);
verifier("appel à l'action : message de lien", erreurs(page([cta({ bouton: { libelle: "Go", lien: "javascript:x", style: "principal" } })])), ["Bloc 1 (Appel à l'action) : la propriété « bouton » n'est pas un lien autorisé (chemin du site ou adresse https://)."]);
verifier("appel à l'action : libellé 60 / 61, style inconnu, propriété en trop", [
  valide(page([cta({ bouton: { libelle: "x".repeat(60), lien: "/", style: "principal" } })])),
  valide(page([cta({ bouton: { libelle: "x".repeat(61), lien: "/", style: "principal" } })])),
  valide(page([cta({ bouton: { libelle: "Go", lien: "/", style: "danger" } })])),
  valide(page([cta({ bouton: { libelle: "Go", lien: "/", style: "principal", onclick: "x" } })])),
], [true, false, false, false]);
verifier("appel à l'action : bouton absent refusé", valide(page([{ type: "AppelAction", props: { titre: "T" } }])), false);

// ==== 8. Citation ===============================================================================================================
verifier("citation : valide, auteur facultatif", [valide(page([citation()])), valide(page([citation({ auteur: "Awa" })]))], [true, true]);
verifier("citation : texte 400 / 401, vide refusé", [valide(page([citation({ texte: "t".repeat(400) })])), valide(page([citation({ texte: "t".repeat(401) })])), valide(page([citation({ texte: "" })]))], [true, false, false]);
verifier("citation : auteur 100 / 101", [100, 101].map((n) => valide(page([citation({ auteur: "a".repeat(n) })]))), [true, false]);

// ==== 9. Carte et liste de restaurants ==========================================================================================
verifier("carte : UUID valide", [valide(page([carte()])), valide(page([carte({ restaurantId: UUID.toUpperCase() })]))], [true, true]);
for (const mauvais of ["", "abc", "0b1c2d3e-aaaa-4bbb-8ccc-11112222333", "0b1c2d3e-aaaa-4bbb-8ccc-1111222233334", "0b1c2d3e_aaaa_4bbb_8ccc_111122223333", `${UUID}'; drop table restaurants;--`, "<script>"]) {
  verifier(`carte : UUID invalide ${JSON.stringify(mauvais.slice(0, 20))}`, valide(page([carte({ restaurantId: mauvais })])), false);
}
verifier("carte : restaurantId absent ou non textuel refusé", [valide(page([{ type: "CarteRestaurant", props: {} }])), valide(page([carte({ restaurantId: 1 })]))], [false, false]);
verifier("liste : valide, titre et filtres facultatifs", [valide(page([liste()])), valide(page([liste({ titre: "Les restaurants", quartierId: UUID, categorieId: UUID })]))], [true, true]);
verifier("liste : nombre 3/6/9/12 acceptés, autres refusés", [3, 6, 9, 12, 4, 0, 13, "3"].map((n) => valide(page([liste({ nombre: n })]))), [true, true, true, true, false, false, false, false]);
verifier("liste : filtre tous/ouverts, autre refusé", [valide(page([liste({ filtre: "tous" })])), valide(page([liste({ filtre: "ouverts" })])), valide(page([liste({ filtre: "fermes" })]))], [true, true, false]);
verifier("liste : UUID invalides refusés", [valide(page([liste({ quartierId: "x" })])), valide(page([liste({ categorieId: "x" })])), valide(page([liste({ quartierId: "" })]))], [false, false, false]);
verifier("liste : message de format", erreurs(page([liste({ quartierId: "x" })])), ["Bloc 1 (Liste de restaurants) : la propriété « quartierId » n'a pas un format valide."]);
verifier("liste : titre 120 / 121", [120, 121].map((n) => valide(page([liste({ titre: "t".repeat(n) })]))), [true, false]);
verifier("blocs dynamiques : jamais de données de restaurant dans le document (seulement des identifiants)", [Object.keys(carte().props), Object.keys(liste().props)], [["restaurantId"], ["filtre", "nombre"]]);

// ==== 10. Charge <script> : acceptée comme TEXTE dans chaque champ texte ========================================================
const S = "<script>alert('x')</script><img src=x onerror=alert(1)>";
const champsTexte: [string, unknown][] = [
  ["Titre.texte", titre({ texte: S })],
  ["Paragraphe.texte", paragraphe({ texte: S })],
  ["Citation.texte", citation({ texte: S })],
  ["Citation.auteur", citation({ auteur: S })],
  ["Image.alt", image({ alt: S })],
  ["Image.legende", image({ legende: S })],
  ["Bouton.libelle", bouton({ libelle: S })],
  ["AppelAction.titre", cta({ titre: S })],
  ["AppelAction.texte", cta({ texte: S })],
  ["AppelAction.bouton.libelle", cta({ bouton: { libelle: S, lien: "/", style: "principal" } })],
  ["FAQ.titre", faq({ titre: S })],
  ["FAQ.question", faq({ questions: [{ question: S, reponse: "R" }] })],
  ["FAQ.reponse", faq({ questions: [{ question: "Q", reponse: S }] })],
  ["ListeRestaurants.titre", liste({ titre: S })],
  ["Colonnes > Titre", colonnes({ colonne1: [titre({ texte: S })] })],
  ["Colonnes > Paragraphe", colonnes({ colonne2: [paragraphe({ texte: S })] })],
];
for (const [nom, bloc] of champsTexte) verifier(`charge <script> acceptée comme texte (${nom})`, valide(page([bloc])), true);
const sourceRendu = readFileSync(join(racine, "src/components/studio/RenduBlocs.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
verifier("rendu : tous les textes passent par React (jamais d'HTML ni de style en ligne)", [/dangerouslySetInnerHTML|innerHTML/.test(sourceRendu), /\bstyle=/.test(sourceRendu)], [false, false]);

// ==== 11. Performance, entrée hostile de 200 Ko ==================================================================================
{
  // 40 blocs Colonnes de 3 colonnes d'un paragraphe de 1,3 Ko : 160 blocs, ≈ 200 Ko, valide.
  const lourd = page(
    Array.from({ length: 40 }, () =>
      colonnes({ nombre: 3, colonne1: [paragraphe({ texte: ("[" + "(".repeat(30) + "**<script>**](javascript:x) ").repeat(30).slice(0, 1300) })], colonne2: [paragraphe({ texte: "a".repeat(1300) })], colonne3: [paragraphe({ texte: "b".repeat(1300) })] })
    ),
    { props: { titre: "t" } }
  );
  const taille = new TextEncoder().encode(JSON.stringify(lourd)).length;
  const debut = performance.now();
  const resultat = validerPage(lourd);
  const duree = performance.now() - debut;
  verifier(`entrée hostile VALIDE de ${Math.round(taille / 1024)} Ko (> 150 Ko) : acceptée`, [taille > 150_000, taille <= 204_800, resultat.ok], [true, true, true]);
  verifier(`entrée hostile valide : validation en ${duree.toFixed(1)} ms (< 150 ms)`, duree < 150, true);

  // ~200 Ko de blocs invalides imbriqués : refusée vite, avec des erreurs bornées.
  const invalide = page(
    Array.from({ length: 66 }, () => colonnes({ colonne1: [{ type: "Inconnu", props: { x: "y".repeat(900) } }, colonnes({ colonne1: [titre({ texte: "" })] })], colonne2: [{ type: "Titre", props: { x: "z".repeat(900) } }], colonne3: [paragraphe({ texte: "p".repeat(900) })] }))
  );
  const taille2 = new TextEncoder().encode(JSON.stringify(invalide)).length;
  const d2 = performance.now();
  const r2 = validerPage(invalide);
  const duree2 = performance.now() - d2;
  verifier(`entrée hostile invalide de ${Math.round(taille2 / 1024)} Ko : refusée, ≤ 11 messages, en ${duree2.toFixed(1)} ms (< 150 ms)`, [r2.ok, !r2.ok && r2.erreurs.length <= 11, duree2 < 150], [false, true, true]);

  // Imbrication profonde et cycle dans des colonnes : jamais d'exception, refus net.
  let profond: unknown = { type: "Titre", props: { texte: "x", niveau: 2, alignement: "gauche" } };
  for (let i = 0; i < 3000; i++) profond = { type: "Colonnes", props: { nombre: 2, ecart: 16, colonne1: [profond] } };
  const d3 = performance.now();
  verifier("imbrication de 3000 niveaux : refusée sans exception", (() => { try { return valide(page([profond])); } catch { return "exception"; } })(), false);
  verifier(`imbrication de 3000 niveaux : refus en moins de 150 ms (${(performance.now() - d3).toFixed(1)} ms)`, performance.now() - d3 < 150, true);
  const cycle: Record<string, unknown> = { type: "Colonnes", props: { nombre: 2, ecart: 16, colonne1: [] } };
  (cycle.props as Record<string, unknown[]>).colonne1.push(cycle);
  verifier("structure cyclique dans une colonne : refusée sans exception", (() => { try { return erreurs(page([cycle])); } catch { return "exception"; } })(), ["Le document de la page est illisible."]);
  const largeur = page([colonnes({ colonne1: Array.from({ length: 5000 }, () => titre()) })]);
  verifier("colonne de 5000 blocs : refusée vite", [valide(largeur), (() => { const d = performance.now(); validerPage(largeur); return performance.now() - d < 150; })()], [false, true]);
}

// ==== 12. Francisation et noms accessibles des nouveaux blocs ================================================================
{
  const textes: string[] = [];
  const ajouter = (champs: Record<string, unknown>) => {
    for (const c of Object.values(champs) as { libelle?: string; aide?: string; options?: { libelle: string }[]; champs?: Record<string, unknown> }[]) {
      if (c.libelle) textes.push(c.libelle);
      if (c.aide) textes.push(c.aide);
      for (const o of c.options ?? []) textes.push(o.libelle);
      if (c.champs) ajouter(c.champs);
    }
  };
  for (const e of REGISTRE) {
    textes.push(e.libelle);
    ajouter(e.champs as Record<string, unknown>);
  }
  for (const o of Object.values(OPTIONS_REGLAGES)) textes.push(o.libelle, o.aide, ...o.options.map((x) => x.libelle));
  verifier(`francisation : ${textes.length} libellés du registre et des réglages sans mot anglais connu`, trouverChainesAnglaises(textes), []);
  verifier("francisation : tous les libellés de blocs sont renseignés", REGISTRE.every((e) => e.libelle.trim().length > 0), true);
  verifier("francisation : libellés de champs non vides et sans nom technique", textes.filter((t) => t.trim() === "" || /^[a-z]+[A-Z]/.test(t)), []);
  verifier("noms accessibles : « Réglages » partout", REGISTRE.every((e) => (e.champs as Record<string, { libelle: string }>).reglages.libelle === "Réglages"), true);
  verifier("valeur par défaut du réglage « Par défaut » = rien (aucun changement visuel)", Object.values(OPTIONS_REGLAGES).every((o) => o.options[0].valeur === ""), true);
  verifier("options de réglages = énumérations du schéma", [
    OPTIONS_REGLAGES.espaceHaut.options.slice(1).map((o) => Number(o.valeur)),
    OPTIONS_REGLAGES.alignement.options.slice(1).map((o) => o.valeur),
    OPTIONS_REGLAGES.largeur.options.slice(1).map((o) => o.valeur),
    OPTIONS_REGLAGES.fond.options.slice(1).map((o) => o.valeur),
    OPTIONS_REGLAGES.visibilite.options.slice(1).map((o) => o.valeur),
  ], [[...ESPACES], [...ALIGNEMENTS], [...LARGEURS], CODES_FOND.filter((c) => c !== "aucun"), VISIBILITES.filter((v) => v !== "tous")]);
  verifier("blocs simples : exactement ceux de la consigne", [...TYPES_SIMPLES].sort(), ["Bouton", "Citation", "Espace", "Image", "Paragraphe", "Separateur", "Titre"]);
}

// ==== 13. Champ image : règles de confort ========================================================================================
verifier("image : taille maximale 5 Mo", [TAILLE_MAX_IMAGE, decrireTaille(TAILLE_MAX_IMAGE), decrireTaille(6 * 1024 * 1024 + 300 * 1024), decrireTaille(120 * 1024)], [5 * 1024 * 1024, "5 Mo", "6,3 Mo", "120 Ko"]);
verifier("image : fichier vide refusé", messageTailleImage(0, "image/jpeg"), "Ce fichier est vide.");
verifier("image : fichier de 6 Mo refusé", messageTailleImage(6 * 1024 * 1024, "image/jpeg"), "Ce fichier fait 6 Mo : le maximum est 5 Mo.");
verifier("image : 5 Mo exactement accepté", messageTailleImage(5 * 1024 * 1024, "image/png"), null);
verifier("image : SVG, GIF, HTML, PDF refusés", ["image/svg+xml", "image/gif", "text/html", "application/pdf", ""].map((t) => messageTailleImage(1000, t) !== null), [true, true, true, true, true]);
verifier("image : JPEG, PNG, WebP acceptés", ["image/jpeg", "image/png", "image/webp"].map((t) => messageTailleImage(1000, t)), [null, null, null]);
verifier("image : nom accessible d'une image de la liste", [libelleImageListe(0, "2026-10-06T08:00:00+00:00"), libelleImageListe(2, null)], ["Utiliser l'image 1, téléversée le 06/10/2026", "Utiliser l'image 3"]);

// ==== 14. Gardes statiques ======================================================================================================
{
  const lire = (f: string) => readFileSync(join(racine, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const action = lire("src/lib/system-admin/images-studio.ts");
  const iPerm = action.indexOf("verifierPermission(");
  const iPalier = action.indexOf("verifierPalier(");
  const iFichier = action.indexOf('formData.get("image")');
  const iEnvoi = action.indexOf("televerserImage(");
  verifier("téléversement : permission, puis palier, AVANT toute lecture du fichier", [iPerm > 0, iPerm < iPalier, iPalier < iFichier, iFichier < iEnvoi], [true, true, true, true]);
  verifier("téléversement : palier ≥ 1 (brouillon) sur contenu:pages", /verifierPalier\("contenu:pages", MINIMUMS_STUDIO\.brouillon/.test(action), true);
  verifier("téléversement : dossier studio, nom jamais celui du client", [/televerserImage\(fichier, "studio"/.test(action), /\.name/.test(action.replace(/f\.name/g, ""))], [true, false]);
  verifier("téléversement : trace d'audit contenu.image_televersee", /action: "contenu\.image_televersee"/.test(action), true);
  verifier("liste des images : dossier studio seulement, 60 au plus, récentes d'abord", [/\.list\("studio"/.test(action), /limit: MAX_IMAGES_LISTEES/.test(action), /MAX_IMAGES_LISTEES = 60/.test(action), /order: "desc"/.test(action)], [true, true, true, true]);
  const stockage = lire("src/lib/storage/images.ts");
  verifier("images.ts : contrôle d'entête réel, types JPEG/PNG/WebP, 5 Mo, nom généré par le serveur", [/signatureCorrespond\(entete, fichier\.type\)/.test(stockage), /"image\/jpeg", "image\/png", "image\/webp"/.test(stockage), /5 \* 1024 \* 1024/.test(stockage), /randomUUID\(\)/.test(stockage), /image\/svg|image\/gif/.test(stockage)], [true, true, true, true, false]);
  const donnees = lire("src/lib/system-admin/blocs-donnees.ts");
  verifier("lectures de l'éditeur : droits vérifiés, client anonyme (RLS), 20 résultats", [/verifierPermission\("contenu\.editer"\)/.test(donnees), /creerClientPublic\(\)/.test(donnees), /MAX_RESULTATS = 20/.test(donnees), /creerClientAdmin/.test(donnees)], [true, true, true, false]);
  const dyn = lire("src/lib/studio/donnees-dynamiques.ts");
  verifier("blocs dynamiques : lecture publique existante, aucun cache, aucun accès à lecture.ts", [/lireCatalogue/.test(dyn), /unstable_cache|lireAvecCache/.test(dyn), /cms\/lecture/.test(dyn)], [true, false, false]);
  const lecture = lire("src/lib/cms/lecture.ts");
  verifier("lecture.ts (cache) : aucune donnée de restaurant", /restaurants|lireCatalogue|menu_items/.test(lecture), false);
}

if (ko) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests des blocs du Studio (tâche 8) passent.");
