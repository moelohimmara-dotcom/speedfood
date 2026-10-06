import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REGISTRE, MAX_BLOCS_PAGE, validerPage, pageVide } from "../../src/lib/studio/registre";
import { documentVersPuck, empreinte, estModifie, libelleBloc, puckVersDocument } from "../../src/lib/studio/editeur-donnees";
import { calculerPossibilites, libelleStatut, permissionsEditeur, LIBELLE_NON_ENREGISTRE } from "../../src/lib/studio/possibilites";
import { ZONE_RACINE, extraitBloc, nomsActions, planifierOperation, pluriel, type ActionPanneau } from "../../src/lib/studio/panneau-blocs";
import { MESSAGE_CONCURRENCE, jetonPerime } from "../../src/lib/studio/concurrence";
import {
  CHAINES_ANGLAISES,
  CONSIGNE_GLISSER,
  DICTIONNAIRE_PUCK,
  ROLE_GLISSER,
  TAILLES_APERCU,
  TITRE_APERCU,
  libelleDepuisIdentifiant,
  traduireAnnonceGlisser,
  trouverChainesAnglaises,
} from "../../src/lib/studio/francisation";

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

// --- Registre : les champs de l'éditeur couvrent exactement chaque schéma ---------------------------------------------
for (const e of REGISTRE) {
  const proprietes = Object.keys(e.schemaProps.shape).filter((c) => c !== "id");
  verifier(`champs = propriétés du schéma (${e.type})`, Object.keys(e.champs).sort(), proprietes.sort());
  for (const [cle, champ] of Object.entries(e.champs) as [string, { genre: string; options?: { valeur: unknown }[] }][]) {
    if (champ.genre !== "choix") continue;
    const valides = (champ.options ?? []).every((o) => e.schemaProps.safeParse({ ...e.defauts, [cle]: o.valeur }).success);
    verifier(`options valides (${e.type}.${cle})`, valides, true);
    // Toute valeur refusée par le schéma n'est pas proposée ; et une valeur hors liste est bien refusée.
    verifier(`valeur hors liste refusée (${e.type}.${cle})`, e.schemaProps.safeParse({ ...e.defauts, [cle]: "__autre__" }).success, false);
  }
}
verifier("options de niveau : 2, 3, 4", (REGISTRE[0].champs as Record<string, { options?: { valeur: unknown }[] }>).niveau.options?.map((o) => o.valeur), [2, 3, 4]);
verifier("options d'espace : 8 à 96", (REGISTRE[4].champs as Record<string, { options?: { valeur: unknown }[] }>).hauteur.options?.map((o) => o.valeur), [8, 16, 32, 64, 96]);

// --- Conversion Puck <-> document -------------------------------------------------------------------------------------
const donneesPuck = {
  content: [
    { type: "Titre", props: { id: "Titre-abc", texte: "Bonjour", niveau: 2, alignement: "gauche", puck: { x: 1 }, editMode: true } },
    { type: "Paragraphe", props: { texte: "Texte", id: "Paragraphe-1" } },
    { type: "Bouton", props: { libelle: "Go", lien: "/restaurants", style: "principal" } },
  ],
  root: { props: { title: "anglais", titre: "Racine" } },
  zones: {},
};
const doc = puckVersDocument(donneesPuck);
verifier("puck -> document : zones retirées", Object.keys(doc), ["content", "root"]);
verifier("puck -> document : props réduites au schéma, id d'abord", doc.content[0].props, { id: "Titre-abc", texte: "Bonjour", niveau: 2, alignement: "gauche" });
verifier("puck -> document : ordre des champs du registre", Object.keys(doc.content[1].props), ["id", "texte"]);
verifier("puck -> document : racine réduite au titre", doc.root, { props: { titre: "Racine" } });
verifier("puck -> document : valide pour le registre", validerPage(doc).ok, true);
const inconnu = puckVersDocument({ content: [{ type: "Carrousel", props: { a: 1 } }], root: {} });
verifier("type inconnu gardé (signalé par la validation, jamais retiré en silence)", [inconnu.content[0].type, validerPage(inconnu).ok], ["Carrousel", false]);
verifier("type inconnu : message numéroté", (validerPage(inconnu) as { erreurs: string[] }).erreurs[0], "Bloc 1 : type de bloc inconnu.");
verifier("document -> puck : illisible -> page vide", [documentVersPuck(null), documentVersPuck("x"), documentVersPuck({ content: 3 })], [pageVide(), pageVide(), pageVide()]);
const illisibles = documentVersPuck({ content: [null, { type: "Titre", props: { texte: "a" } }, { props: {} }], root: { props: { titre: "t" } } });
verifier("document -> puck : blocs illisibles ignorés", [illisibles.content.map((b) => [b.type, b.props.texte]), illisibles.root], [[["Titre", "a"]], { props: { titre: "t" } }]);
const allerRetour = documentVersPuck(JSON.parse(JSON.stringify(doc)));
verifier("aller-retour document -> puck -> document identique (aux identifiants près)", empreinte(puckVersDocument(allerRetour)), empreinte(doc));
verifier("__proto__ ne pollue rien", (() => {
  const d = puckVersDocument(JSON.parse('{"content":[{"type":"__proto__","props":{"x":1}}],"root":{}}'));
  return [validerPage(d).ok, ({} as Record<string, unknown>).x];
})(), [false, undefined]);

// --- État « modifié » -------------------------------------------------------------------------------------------------
const reference = empreinte(doc);
verifier("non modifié : mêmes données", estModifie(donneesPuck, reference), false);
verifier("non modifié : seuls les identifiants changent (ajoutés par l'éditeur)", estModifie({ ...donneesPuck, content: donneesPuck.content.map((b, i) => ({ ...b, props: { ...b.props, id: `autre-${i}` } })) }, reference), false);
verifier("non modifié : props parasites de Puck ignorées", estModifie({ ...donneesPuck, content: donneesPuck.content.map((b) => ({ ...b, props: { ...b.props, puck: 2 } })) }, reference), false);
verifier("modifié : texte changé", estModifie({ ...donneesPuck, content: [{ ...donneesPuck.content[0], props: { ...donneesPuck.content[0].props, texte: "Autre" } }, ...donneesPuck.content.slice(1)] }, reference), true);
verifier("modifié : ordre changé", estModifie({ ...donneesPuck, content: [...donneesPuck.content].reverse() }, reference), true);
verifier("modifié : bloc supprimé", estModifie({ ...donneesPuck, content: donneesPuck.content.slice(1) }, reference), true);
verifier("page vide non modifiée", estModifie(documentVersPuck(pageVide()), empreinte(pageVide())), false);

// --- Possibilités d'après le palier (calcul serveur) ------------------------------------------------------------------
const tableau = ([0, 1, 2, 3, 4, 5] as const).flatMap((palier) =>
  ["brouillon", "publie"].map((statut) => {
    const p = calculerPossibilites(palier, statut);
    return `${palier}/${statut}:${+p.peutEnregistrer}${+p.peutPublier}${+p.peutRestaurer}`;
  })
);
verifier("possibilités : tableau complet", tableau, [
  "0/brouillon:000", "0/publie:000",
  "1/brouillon:100", "1/publie:000",
  "2/brouillon:111", "2/publie:111",
  "3/brouillon:111", "3/publie:111",
  "4/brouillon:111", "4/publie:111",
  "5/brouillon:111", "5/publie:111",
]);
const p1 = calculerPossibilites(1, "publie");
verifier("palier 1 page en ligne : explication de la lecture seule", [p1.explications.enregistrer?.startsWith("Cette page est en ligne"), p1.explications.enregistrer?.endsWith("L'éditeur est en lecture seule.")], [true, true]);
verifier("palier 1 : publication expliquée (palier Éditeur)", p1.explications.publier?.includes("le palier Éditeur"), true);
verifier("palier 2 : aucune explication", calculerPossibilites(2, "publie").explications, { enregistrer: null, publier: null, restaurer: null });
verifier("lecture seule : toutes les permissions de Puck fermées", permissionsEditeur({ peutEnregistrer: false }), { drag: false, edit: false, insert: false, delete: false, duplicate: false });
verifier("modification : permissions ouvertes", Object.values(permissionsEditeur({ peutEnregistrer: true })).every(Boolean), true);
verifier("statut : brouillon", libelleStatut("brouillon", 0), { texte: "Brouillon", ton: "neutre" });
verifier("statut : publiée version N", libelleStatut("publie", 4), { texte: "Publiée, version 4", ton: "succes" });
verifier("libellé non enregistré", LIBELLE_NON_ENREGISTRE, "Modifications non enregistrées");

// --- Panneau « Blocs de la page » : opérations, bornes, annonces ------------------------------------------------------
type Bloc = { type: string; id: string };
let compteurId = 0;
/** Simulation de référence des actions de Puck utilisées (mêmes règles que ses réducteurs). */
function appliquer(liste: Bloc[], action: ActionPanneau): Bloc[] {
  const l = [...liste];
  switch (action.type) {
    case "reorder": {
      const [b] = l.splice(action.sourceIndex, 1);
      l.splice(action.destinationIndex, 0, b);
      return l;
    }
    case "duplicate":
      l.splice(action.sourceIndex + 1, 0, { ...l[action.sourceIndex], id: `copie-${++compteurId}` });
      return l;
    case "remove":
      l.splice(action.index, 1);
      return l;
    case "insert":
      l.splice(action.destinationIndex, 0, { type: action.componentType, id: `neuf-${++compteurId}` });
      return l;
  }
}
const page3: Bloc[] = [{ type: "Titre", id: "a" }, { type: "Paragraphe", id: "b" }, { type: "Bouton", id: "c" }];
const types = (l: Bloc[]) => l.map((b) => b.type);
const ids = (l: Bloc[]) => l.map((b) => b.id);
const executer = (l: Bloc[], op: Parameters<typeof planifierOperation>[0]) => {
  const plan = planifierOperation(op, types(l));
  return { plan, liste: plan.ok ? appliquer(l, plan.action) : l };
};

let r = executer(page3, { type: "monter", index: 0 });
verifier("monter le premier : refusé", [r.plan.ok, r.plan.annonce], [false, "Ce bloc est déjà en première position."]);
r = executer(page3, { type: "descendre", index: 2 });
verifier("descendre le dernier : refusé", [r.plan.ok, r.plan.annonce], [false, "Ce bloc est déjà en dernière position."]);
r = executer(page3, { type: "monter", index: 2 });
verifier("monter le 3e", [ids(r.liste), r.plan.annonce, r.plan.ok && r.plan.cible], [["a", "c", "b"], "Bloc déplacé en position 2 sur 3.", 1]);
verifier("monter : action reorder dans la zone racine", r.plan.ok && r.plan.action, { type: "reorder", sourceIndex: 2, destinationIndex: 1, destinationZone: ZONE_RACINE });
r = executer(page3, { type: "descendre", index: 0 });
verifier("descendre le 1er", [ids(r.liste), r.plan.annonce, r.plan.ok && r.plan.cible], [["b", "a", "c"], "Bloc déplacé en position 2 sur 3.", 1]);
r = executer(page3, { type: "dupliquer", index: 1 });
verifier("dupliquer le 2e : copie juste après, focus sur la copie", [types(r.liste), r.plan.ok && r.plan.cible, r.plan.annonce], [["Titre", "Paragraphe", "Paragraphe", "Bouton"], 2, "Bloc Paragraphe dupliqué : la copie est en position 3 sur 4."]);
r = executer(page3, { type: "supprimer", index: 2 });
verifier("supprimer le dernier : focus sur le nouveau dernier", [ids(r.liste), r.plan.ok && r.plan.cible, r.plan.annonce], [["a", "b"], 1, "Bloc 3, Bouton, supprimé. La page compte maintenant 2 blocs."]);
r = executer(page3, { type: "supprimer", index: 0 });
verifier("supprimer le premier : focus sur la même position", [ids(r.liste), r.plan.ok && r.plan.cible], [["b", "c"], 0]);
r = executer([{ type: "Titre", id: "x" }], { type: "supprimer", index: 0 });
verifier("supprimer le seul bloc : focus sur « Ajouter un bloc »", [r.liste.length, r.plan.ok && r.plan.cible, r.plan.annonce], [0, null, "Bloc 1, Titre, supprimé. La page compte maintenant 0 bloc."]);
r = executer(page3, { type: "ajouter", typeBloc: "Espace", apres: null });
verifier("ajouter en fin", [types(r.liste), r.plan.ok && r.plan.cible, r.plan.annonce], [["Titre", "Paragraphe", "Bouton", "Espace"], 3, "Bloc Espace ajouté en position 4 sur 4."]);
r = executer(page3, { type: "ajouter", typeBloc: "Separateur", apres: 0 });
verifier("ajouter après le bloc sélectionné", [types(r.liste), r.plan.ok && r.plan.cible, r.plan.annonce], [["Titre", "Separateur", "Paragraphe", "Bouton"], 1, "Bloc Séparateur ajouté en position 2 sur 4."]);
r = executer([], { type: "ajouter", typeBloc: "Titre", apres: null });
verifier("ajouter dans une page vide", [types(r.liste), r.plan.ok && r.plan.cible], [["Titre"], 0]);
r = executer(page3, { type: "ajouter", typeBloc: "Script", apres: null });
verifier("ajouter un type inconnu : refusé", [r.plan.ok, r.plan.annonce], [false, "Ce type de bloc n'existe pas."]);
r = executer(page3, { type: "ajouter", typeBloc: "__proto__", apres: null });
verifier("ajouter __proto__ : refusé", r.plan.ok, false);
r = executer(page3, { type: "ajouter", typeBloc: "Titre", apres: 99 });
verifier("ajouter après un index disparu : en fin", r.plan.ok && r.plan.cible, 3);
const pleine = Array.from({ length: MAX_BLOCS_PAGE }, (_, i) => ({ type: "Espace", id: String(i) }));
verifier("page pleine : ajout refusé", executer(pleine, { type: "ajouter", typeBloc: "Titre", apres: null }).plan.annonce, `La page compte déjà ${MAX_BLOCS_PAGE} blocs, le maximum.`);
verifier("page pleine : duplication refusée", executer(pleine, { type: "dupliquer", index: 0 }).plan.ok, false);
verifier("index hors bornes : refusé sans exception", ["monter", "descendre", "dupliquer", "supprimer"].map((t) => planifierOperation({ type: t as "monter", index: 7 }, types(page3)).ok), [false, false, false, false]);
verifier("index non entier : refusé", planifierOperation({ type: "supprimer", index: 0.5 }, types(page3)).ok, false);
{
  // Suite d'opérations au clavier : l'ordre final est celui attendu, aucun bloc perdu ni inventé.
  let l = page3;
  for (const op of [
    { type: "descendre", index: 0 },
    { type: "descendre", index: 1 },
    { type: "dupliquer", index: 0 },
    { type: "supprimer", index: 3 },
    { type: "ajouter", typeBloc: "Titre", apres: null },
    { type: "monter", index: 3 },
  ] as const) l = executer(l, op).liste;
  verifier("suite d'opérations", types(l), ["Paragraphe", "Paragraphe", "Titre", "Bouton"]);
}
verifier("noms accessibles explicites", nomsActions(2, "Titre"), {
  monter: "Monter le bloc 3, Titre",
  descendre: "Descendre le bloc 3, Titre",
  dupliquer: "Dupliquer le bloc 3, Titre",
  supprimer: "Supprimer le bloc 3, Titre",
});
verifier("libellé d'un type connu / inconnu", [libelleBloc("Separateur"), libelleBloc("Carrousel")], ["Séparateur", "Bloc inconnu (Carrousel)"]);
verifier("pluriel", [pluriel(0, "bloc"), pluriel(1, "bloc"), pluriel(2, "bloc")], ["0 bloc", "1 bloc", "2 blocs"]);
verifier("extraits", [
  extraitBloc("Titre", { texte: "Bienvenue chez Speedfood" }),
  extraitBloc("Paragraphe", { texte: "a\n\nb" }),
  extraitBloc("Paragraphe", { texte: "x".repeat(80) }).length,
  extraitBloc("Bouton", { libelle: "Commander", lien: "/restaurants" }),
  extraitBloc("Separateur", { style: "vide" }),
  extraitBloc("Espace", { hauteur: 64 }),
  extraitBloc("Titre", { texte: "" }),
  extraitBloc("Titre", { texte: "<script>alert(1)</script>" }),
], ["Bienvenue chez Speedfood", "a b", 60, "Commander → /restaurants", "Espace vide", "Grande (64 px)", "(vide)", "<script>alert(1)</script>"]);

// --- Francisation -----------------------------------------------------------------------------------------------------
{
  const dist = join(racine, "node_modules/@puckeditor/core/dist");
  const fichier = readdirSync(dist).find((f) => /^index-.*\.d\.mts$/.test(f) && readFileSync(join(dist, f), "utf8").includes("defaultDictionary"));
  const source = fichier ? readFileSync(join(dist, fichier), "utf8") : "";
  const bloc = source.slice(source.indexOf("defaultDictionary"), source.indexOf("};", source.indexOf("defaultDictionary")));
  const clesPuck = [...bloc.matchAll(/readonly "([a-z0-9-]+)":/g)].map((m) => m[1]);
  verifier(`dictionnaire de Puck lu (${clesPuck.length} clés)`, clesPuck.length > 60, true);
  verifier("toutes les clés de Puck sont traduites", clesPuck.filter((c) => !(c in DICTIONNAIRE_PUCK)), []);
  verifier("aucune clé inventée", Object.keys(DICTIONNAIRE_PUCK).filter((c) => !clesPuck.includes(c)), []);
  // Les jetons {title}, {type}… doivent être conservés.
  const jetons = (t: string) => [...t.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).sort();
  const defauts = Object.fromEntries([...bloc.matchAll(/readonly "([a-z0-9-]+)": "([^"]*)"/g)].map((m) => [m[1], m[2]]));
  verifier("jetons conservés dans chaque traduction", Object.entries(DICTIONNAIRE_PUCK).filter(([c, t]) => JSON.stringify(jetons(t)) !== JSON.stringify(jetons(defauts[c] ?? ""))).map(([c]) => c), []);
  // Les jetons ({title}, {zoom}…) sont remplacés à l'affichage : ils ne comptent pas.
  verifier("aucune traduction anglaise", trouverChainesAnglaises(Object.values(DICTIONNAIRE_PUCK).map((t) => t.replace(/\{[a-z]+\}/g, ""))), []);
  verifier("le texte anglais par défaut de Puck est détecté", trouverChainesAnglaises(Object.values(defauts)).length > 30, true);
}
verifier("détection : chaînes de l'interface anglaise", trouverChainesAnglaises(["Publish", "Switch to Small viewport", "aria-label=Toggle left sidebar", "Outline", "Duplicate"]).sort(), ["Duplicate", "Outline", "Publish", "Small", "Switch to", "Toggle", "sidebar", "viewport"].sort());
verifier("détection : mots entiers seulement, accents compris", trouverChainesAnglaises(["Écran plus large", "3 résultats", "Supprimer le bloc", "Réglages", "Titre", "Publier", "Annuler", "Délai", "Page", "Aperçu de la page"]), []);
verifier("détection : insensible à la casse", trouverChainesAnglaises(["PUBLISH now"]), ["Publish"]);
verifier("liste anglaise sans doublon", new Set(CHAINES_ANGLAISES.map((c) => c.toLowerCase())).size, CHAINES_ANGLAISES.length);
verifier("tailles d'aperçu en français", TAILLES_APERCU.map((t) => `${t.libelle} ${t.largeur}`), ["Mobile 390", "Tablette 768", "Bureau 1280"]);
verifier("titre de l'iframe", TITRE_APERCU, "Aperçu de la page");
// Glisser-déposer (dnd-kit) : rôle, consigne et annonces en français
verifier("rôle et consigne de glisser en français", trouverChainesAnglaises([ROLE_GLISSER, CONSIGNE_GLISSER]), []);
verifier("consigne : renvoie au panneau clavier", CONSIGNE_GLISSER.includes("« Blocs de la page »"), true);
verifier("identifiant -> libellé", [libelleDepuisIdentifiant("Separateur-1f2e"), libelleDepuisIdentifiant("Titre-abc"), libelleDepuisIdentifiant("drawer"), libelleDepuisIdentifiant("constructor-1")], ["bloc Séparateur", "bloc Titre", "bloc", "bloc"]);
const id = "Titre-0b1c2d3e-aaaa-bbbb-cccc-111122223333";
verifier("annonces de dnd-kit traduites", [
  traduireAnnonceGlisser(`Picked up draggable item ${id}.`),
  traduireAnnonceGlisser(`Draggable item ${id} was moved over droppable target root:default-zone.`),
  traduireAnnonceGlisser(`Draggable item ${id} is no longer over a droppable target.`),
  traduireAnnonceGlisser(`Dragging was cancelled. Draggable item ${id} was dropped.`),
  traduireAnnonceGlisser(`Draggable item ${id} was dropped over droppable target root:default-zone`),
  traduireAnnonceGlisser(`Draggable item Bouton-1 was dropped.`),
], ["Bloc Titre saisi.", "Bloc Titre au-dessus d'une zone de dépôt.", "Bloc Titre hors de toute zone de dépôt.", "Déplacement annulé : bloc Titre relâché.", "Bloc Titre déposé.", "Bloc Bouton relâché."]);
verifier("annonce anglaise inconnue : vidée (jamais d'anglais lu)", traduireAnnonceGlisser("Some new dnd-kit announcement about a draggable item"), "");
verifier("traduction idempotente (le texte français reste tel quel)", ["Bloc Titre saisi.", "Déplacement annulé : bloc Titre relâché.", ""].map(traduireAnnonceGlisser), ["Bloc Titre saisi.", "Déplacement annulé : bloc Titre relâché.", ""]);

// --- Garde-fous : Puck reste confiné à l'éditeur différé -------------------------------------------------------------
{
  const lister = (dossier: string): string[] => {
    const abs = join(racine, dossier);
    if (!existsSync(abs)) return [];
    return readdirSync(abs).flatMap((n) => {
      const rel = `${dossier}/${n}`;
      return statSync(join(racine, rel)).isDirectory() ? lister(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
    });
  };
  const sansCommentaires = (f: string) => readFileSync(join(racine, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const avecPuck = lister("src").filter((f) => /@puckeditor/.test(sansCommentaires(f)));
  verifier("Puck importé seulement dans src/components/studio/editeur/", avecPuck.filter((f) => !f.startsWith("src/components/studio/editeur/")), []);
  verifier("modules purs du Studio sans Puck", lister("src/lib/studio").filter((f) => /puckeditor/.test(sansCommentaires(f))), []);
  verifier("prototype de la tâche 5 supprimé", [existsSync(join(racine, "src/app/system/studio")), existsSync(join(racine, "src/lib/studio/blocs"))], [false, false]);
  const tousEditeur = lister("src/components/studio/editeur").map((f) => sansCommentaires(f)).join("\n");
  verifier("feuille sans import externe seulement (jamais puck.css)", [/@puckeditor\/core\/no-external\.css/.test(tousEditeur), /puck\.css|core\/dist\/index\.css/.test(tousEditeur)], [true, false]);
  verifier("aucun Render de Puck", /\bRender\b/.test(tousEditeur.replace(/RenduPage|RenduBloc/g, "")), false);
  const differe = sansCommentaires("src/components/studio/editeur/EditeurDiffere.tsx");
  verifier("éditeur importé en différé, sans rendu serveur", [/dynamic\(\(\) => import\("\.\/Editeur"\)/.test(differe), /ssr: false/.test(differe), /@puckeditor/.test(differe)], [true, true, false]);
  const route = sansCommentaires("src/app/system/contenu/pages/[id]/blocs/page.tsx");
  verifier("route : permission, palier, puis lecture du brouillon", [route.indexOf("exigerPermissionPage") < route.indexOf("exigerPalier"), route.indexOf("exigerPalier") < route.indexOf("lireBrouillonBlocs("), /notFound\(\)/.test(route), /"use client"/.test(route)], [true, true, true, false]);
}

{
  const sansId = documentVersPuck({ content: [{ type: "Titre", props: { texte: "A", niveau: 2, alignement: "gauche" } }, { type: "Espace", props: { id: "Espace-fixe", hauteur: 16 } }], root: { props: {} } });
  verifier("bloc sans identifiant : un identifiant lui est donné (Puck en a besoin)", [/^Titre-[0-9a-f-]{36}$/.test(String(sansId.content[0].props.id)), sansId.content[1].props.id], [true, "Espace-fixe"]);
  verifier("identifiant ajouté : valide pour le schéma et sans effet sur « modifié »", [validerPage(puckVersDocument(sansId)).ok, estModifie(sansId, empreinte({ content: [{ type: "Titre", props: { texte: "A", niveau: 2, alignement: "gauche" } }, { type: "Espace", props: { hauteur: 16 } }], root: { props: {} } }))], [true, false]);
}

// --- Jeton de concurrence du brouillon (revue 7, I1) -------------------------------------------------------------------
{
  const T = "2026-10-06T19:31:00.123456+00:00";
  verifier("jeton absent : appel sans contrôle accepté (rétro-compatibilité)", jetonPerime(undefined, T), false);
  verifier("jeton égal : à jour", jetonPerime(T, T), false);
  verifier("jeton différent : périmé", jetonPerime("2026-10-06T19:30:00.000000+00:00", T), true);
  verifier("jeton vide, trop long ou de mauvais type : périmé", [jetonPerime("", T), jetonPerime("x".repeat(65), T), jetonPerime(42, T), jetonPerime(null, T)], [true, true, true, true]);
  verifier("jeton reçu mais page sans jeton lisible : périmé", jetonPerime(T, null), true);
  verifier("message de concurrence exact", MESSAGE_CONCURRENCE, "Le brouillon a été modifié ailleurs depuis que vous avez ouvert la page. Rechargez pour voir la dernière version avant d'enregistrer.");
  const actions = readFileSync(join(racine, "src/lib/system-admin/pages-blocs.ts"), "utf8");
  verifier("enregistrement : comparaison au jeton DANS la requête de mise à jour", /\.eq\("mis_a_jour_le", jeton\)/.test(actions), true);
  verifier("publication : jeton d'ouverture comparé avant la RPC", /jetonPerime\(jeton, page\.mis_a_jour_le\)/.test(actions), true);
  const edit = readFileSync(join(racine, "src/components/studio/editeur/Editeur.tsx"), "utf8");
  verifier("l'éditeur envoie le jeton à l'enregistrement ET à la publication", [/enregistrerBrouillonBlocsAction\(page\.id, [^)]*jetonRef\.current\)/.test(edit), /publierBlocsAction\(page\.id, motif, jetonRef\.current\)/.test(edit)], [true, true]);
}

if (ko) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests de l'éditeur de pages passent.");
