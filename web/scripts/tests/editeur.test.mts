import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REGISTRE, MAX_BLOCS_PAGE, validerPage, pageVide } from "../../src/lib/studio/registre";
import { documentVersPuck, empreinte, estModifie, libelleBloc, puckVersDocument } from "../../src/lib/studio/editeur-donnees";
import { calculerPossibilites, libelleStatut, permissionsEditeur, LIBELLE_NON_ENREGISTRE } from "../../src/lib/studio/possibilites";
import { ZONE_RACINE, construirePlan, extraitBloc, nomsActions, planifierOperation, pluriel, zoneColonne, type ActionPanneau, type BlocContenu } from "../../src/lib/studio/panneau-blocs";
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
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://projet-test.supabase.co";
const IMAGE_VALIDE = "https://projet-test.supabase.co/storage/v1/object/public/medias/studio/0b1c2d3e-aaaa-4bbb-8ccc-111122223333.jpg";
// Blocs ajoutés « à compléter » : de quoi les rendre valides pour tester leurs options.
const COMPLEMENTS: Record<string, Record<string, unknown>> = {
  Image: { src: IMAGE_VALIDE, alt: "Un plat" },
  CarteRestaurant: { restaurantId: "0b1c2d3e-aaaa-4bbb-8ccc-111122223333" },
};
for (const e of REGISTRE) {
  const proprietes = Object.keys(e.schemaProps.shape).filter((c) => c !== "id");
  verifier(`champs = propriétés du schéma (${e.type})`, Object.keys(e.champs).sort(), proprietes.sort());
  const base = { ...e.defauts, ...(COMPLEMENTS[e.type] ?? {}) };
  verifier(`base de test valide (${e.type})`, e.schemaProps.safeParse(base).success, true);
  for (const [cle, champ] of Object.entries(e.champs) as [string, { genre: string; options?: { valeur: unknown }[] }][]) {
    if (champ.genre !== "choix") continue;
    const valides = (champ.options ?? []).every((o) => e.schemaProps.safeParse({ ...base, [cle]: o.valeur }).success);
    verifier(`options valides (${e.type}.${cle})`, valides, true);
    // Toute valeur refusée par le schéma n'est pas proposée ; et une valeur hors liste est bien refusée.
    verifier(`valeur hors liste refusée (${e.type}.${cle})`, e.schemaProps.safeParse({ ...base, [cle]: "__autre__" }).success, false);
  }
}
verifier("options de niveau : 2, 3, 4", (REGISTRE[0].champs as Record<string, { options?: { valeur: unknown }[] }>).niveau.options?.map((o) => o.valeur), [2, 3, 4]);
verifier("options d'espace : 8 à 96", (REGISTRE.find((e) => e.type === "Espace")!.champs as Record<string, { options?: { valeur: unknown }[] }>).hauteur.options?.map((o) => o.valeur), [8, 16, 32, 64, 96]);

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
const contenuDe = (l: Bloc[]) => l.map((b) => ({ type: b.type, props: { id: b.id } }));
/** Cible du focus : le rang pour un bloc de la page, l'objet {zone, index} pour une colonne, `null` si la page est vide. */
const cibleDe = (p: ReturnType<typeof planifierOperation>) => (!p.ok ? false : p.cible === null ? null : p.cible.zone === ZONE_RACINE ? p.cible.index : p.cible);
const ids = (l: Bloc[]) => l.map((b) => b.id);
const executer = (l: Bloc[], op: Parameters<typeof planifierOperation>[0]) => {
  const plan = planifierOperation(op, contenuDe(l));
  return { plan, liste: plan.ok ? appliquer(l, plan.action) : l };
};

let r = executer(page3, { type: "monter", index: 0 });
verifier("monter le premier : refusé", [r.plan.ok, r.plan.annonce], [false, "Ce bloc est déjà en première position."]);
r = executer(page3, { type: "descendre", index: 2 });
verifier("descendre le dernier : refusé", [r.plan.ok, r.plan.annonce], [false, "Ce bloc est déjà en dernière position."]);
r = executer(page3, { type: "monter", index: 2 });
verifier("monter le 3e", [ids(r.liste), r.plan.annonce, cibleDe(r.plan)], [["a", "c", "b"], "Bloc déplacé en position 2 sur 3.", 1]);
verifier("monter : action reorder dans la zone racine", r.plan.ok && r.plan.action, { type: "reorder", sourceIndex: 2, destinationIndex: 1, destinationZone: ZONE_RACINE });
r = executer(page3, { type: "descendre", index: 0 });
verifier("descendre le 1er", [ids(r.liste), r.plan.annonce, cibleDe(r.plan)], [["b", "a", "c"], "Bloc déplacé en position 2 sur 3.", 1]);
r = executer(page3, { type: "dupliquer", index: 1 });
verifier("dupliquer le 2e : copie juste après, focus sur la copie", [types(r.liste), cibleDe(r.plan), r.plan.annonce], [["Titre", "Paragraphe", "Paragraphe", "Bouton"], 2, "Bloc Paragraphe dupliqué : la copie est en position 3 sur 4."]);
r = executer(page3, { type: "supprimer", index: 2 });
verifier("supprimer le dernier : focus sur le nouveau dernier", [ids(r.liste), cibleDe(r.plan), r.plan.annonce], [["a", "b"], 1, "Bloc 3, Bouton, supprimé. La page compte maintenant 2 blocs."]);
r = executer(page3, { type: "supprimer", index: 0 });
verifier("supprimer le premier : focus sur la même position", [ids(r.liste), cibleDe(r.plan)], [["b", "c"], 0]);
r = executer([{ type: "Titre", id: "x" }], { type: "supprimer", index: 0 });
verifier("supprimer le seul bloc : focus sur « Ajouter un bloc »", [r.liste.length, cibleDe(r.plan), r.plan.annonce], [0, null, "Bloc 1, Titre, supprimé. La page compte maintenant 0 bloc."]);
r = executer(page3, { type: "ajouter", typeBloc: "Espace", apres: null });
verifier("ajouter en fin", [types(r.liste), cibleDe(r.plan), r.plan.annonce], [["Titre", "Paragraphe", "Bouton", "Espace"], 3, "Bloc Espace ajouté en position 4 sur 4."]);
r = executer(page3, { type: "ajouter", typeBloc: "Separateur", apres: 0 });
verifier("ajouter après le bloc sélectionné", [types(r.liste), cibleDe(r.plan), r.plan.annonce], [["Titre", "Separateur", "Paragraphe", "Bouton"], 1, "Bloc Séparateur ajouté en position 2 sur 4."]);
r = executer([], { type: "ajouter", typeBloc: "Titre", apres: null });
verifier("ajouter dans une page vide", [types(r.liste), cibleDe(r.plan)], [["Titre"], 0]);
r = executer(page3, { type: "ajouter", typeBloc: "Script", apres: null });
verifier("ajouter un type inconnu : refusé", [r.plan.ok, r.plan.annonce], [false, "Ce type de bloc n'existe pas."]);
r = executer(page3, { type: "ajouter", typeBloc: "__proto__", apres: null });
verifier("ajouter __proto__ : refusé", r.plan.ok, false);
r = executer(page3, { type: "ajouter", typeBloc: "Titre", apres: 99 });
verifier("ajouter après un index disparu : en fin", cibleDe(r.plan), 3);
const pleine = Array.from({ length: MAX_BLOCS_PAGE }, (_, i) => ({ type: "Espace", id: String(i) }));
verifier("page pleine : ajout refusé", executer(pleine, { type: "ajouter", typeBloc: "Titre", apres: null }).plan.annonce, `La page compte déjà ${MAX_BLOCS_PAGE} blocs, le maximum.`);
verifier("page pleine : duplication refusée", executer(pleine, { type: "dupliquer", index: 0 }).plan.ok, false);
verifier("index hors bornes : refusé sans exception", ["monter", "descendre", "dupliquer", "supprimer"].map((t) => planifierOperation({ type: t as "monter", index: 7 }, contenuDe(page3)).ok), [false, false, false, false]);
verifier("index non entier : refusé", planifierOperation({ type: "supprimer", index: 0.5 }, contenuDe(page3)).ok, false);
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

// --- Panneau : blocs DANS une colonne (tâche 8) ------------------------------------------------------------------------
{
  const bloc = (type: string, id: string, extra: Record<string, unknown> = {}): BlocContenu => ({ type, props: { id, ...extra } });
  const cols = (id: string, nombre: number, c1: BlocContenu[], c2: BlocContenu[] = [], c3: BlocContenu[] = []): BlocContenu => bloc("Colonnes", id, { nombre, colonne1: c1, colonne2: c2, colonne3: c3 });
  const z1 = zoneColonne("C", 1);
  const z3 = zoneColonne("C", 3);
  const page = [bloc("Titre", "t"), cols("C", 2, [bloc("Titre", "a"), bloc("Paragraphe", "b"), bloc("Image", "c")], [bloc("Bouton", "d")]), bloc("Espace", "e")];

  verifier("zone d'une colonne : <id>:colonneN", z1, "C:colonne1");
  let r = planifierOperation({ type: "monter", index: 2, zone: z1 }, page);
  verifier("colonne : monter le 3e bloc", [r.ok && r.action, r.annonce, cibleDe(r)], [{ type: "reorder", sourceIndex: 2, destinationIndex: 1, destinationZone: z1 }, "Bloc déplacé en position 2 sur 3 dans la colonne 1.", { zone: z1, index: 1 }]);
  r = planifierOperation({ type: "monter", index: 0, zone: z1 }, page);
  verifier("colonne : monter le premier refusé", [r.ok, r.annonce], [false, "Ce bloc est déjà en première position."]);
  r = planifierOperation({ type: "descendre", index: 2, zone: z1 }, page);
  verifier("colonne : descendre le dernier refusé (bornes de la colonne, pas de la page)", [r.ok, r.annonce], [false, "Ce bloc est déjà en dernière position."]);
  r = planifierOperation({ type: "descendre", index: 0, zone: zoneColonne("C", 2) }, page);
  verifier("colonne : un seul bloc, rien à déplacer", r.ok, false);
  r = planifierOperation({ type: "dupliquer", index: 1, zone: z1 }, page);
  verifier("colonne : dupliquer", [r.ok && r.action, r.annonce, cibleDe(r)], [{ type: "duplicate", sourceIndex: 1, sourceZone: z1 }, "Bloc Paragraphe dupliqué : la copie est en position 3 sur 4 dans la colonne 1.", { zone: z1, index: 2 }]);
  r = planifierOperation({ type: "supprimer", index: 0, zone: zoneColonne("C", 2) }, page);
  verifier("colonne : supprimer le seul bloc -> le focus revient au bloc Colonnes", [r.ok && r.action, r.annonce, cibleDe(r)], [{ type: "remove", index: 0, zone: "C:colonne2" }, "Bloc 1, Bouton, supprimé de la colonne 2. Cette colonne compte maintenant 0 bloc.", 1]);
  r = planifierOperation({ type: "supprimer", index: 2, zone: z1 }, page);
  verifier("colonne : supprimer le dernier -> focus sur le nouveau dernier", [r.annonce, cibleDe(r)], ["Bloc 3, Image, supprimé de la colonne 1. Cette colonne compte maintenant 2 blocs.", { zone: z1, index: 1 }]);
  r = planifierOperation({ type: "ajouter", typeBloc: "Citation", apres: 0, zone: z1 }, page);
  verifier("colonne : ajouter après le 1er", [r.ok && r.action, r.annonce, cibleDe(r)], [{ type: "insert", componentType: "Citation", destinationIndex: 1, destinationZone: z1 }, "Bloc Citation ajouté en position 2 sur 4 dans la colonne 1.", { zone: z1, index: 1 }]);
  r = planifierOperation({ type: "ajouter", typeBloc: "Titre", apres: null, zone: zoneColonne("C", 2) }, page);
  verifier("colonne : ajouter en fin", cibleDe(r), { zone: "C:colonne2", index: 1 });
  for (const interdit of ["Colonnes", "FAQ", "AppelAction", "CarteRestaurant", "ListeRestaurants"]) {
    r = planifierOperation({ type: "ajouter", typeBloc: interdit, apres: null, zone: z1 }, page);
    verifier(`colonne : ${interdit} refusé dans une colonne`, r.ok, false);
  }
  verifier("colonne : message pour un bloc interdit", planifierOperation({ type: "ajouter", typeBloc: "Colonnes", apres: null, zone: z1 }, page).annonce, "Le bloc Colonnes ne peut pas être placé dans une colonne.");
  r = planifierOperation({ type: "ajouter", typeBloc: "Titre", apres: null, zone: z3 }, page);
  verifier("colonne non affichée : ajout refusé", [r.ok, r.annonce], [false, "La colonne 3 n'est pas affichée : choisissez 3 colonnes pour l'utiliser."]);
  verifier("zone inconnue ou bloc disparu : refusé sans exception", [
    planifierOperation({ type: "monter", index: 0, zone: "X:colonne1" }, page).ok,
    planifierOperation({ type: "monter", index: 0, zone: "C:colonne9" }, page).ok,
    planifierOperation({ type: "monter", index: 0, zone: "__proto__:colonne1" }, page).ok,
    planifierOperation({ type: "monter", index: 0, zone: "" }, page).ok,
    planifierOperation({ type: "monter", index: 9, zone: z1 }, page).ok,
  ], [false, false, false, false, false]);
  // Limite globale de 200 blocs, colonnes comprises
  const presque = [cols("C", 2, Array.from({ length: 150 }, (_, i) => bloc("Espace", `s${i}`))), ...Array.from({ length: 48 }, (_, i) => bloc("Espace", `r${i}`))];
  verifier("limite : 199 blocs au total (colonnes comprises) -> un ajout reste possible", [planifierOperation({ type: "ajouter", typeBloc: "Titre", apres: null, zone: z1 }, presque).ok, planifierOperation({ type: "ajouter", typeBloc: "Titre", apres: null }, presque).ok], [true, true]);
  const pleine200 = [...presque, bloc("Espace", "dernier")];
  verifier("limite : page à 200 blocs -> ajout refusé dans une colonne comme à la racine", [planifierOperation({ type: "ajouter", typeBloc: "Titre", apres: null, zone: z1 }, pleine200).ok, planifierOperation({ type: "ajouter", typeBloc: "Titre", apres: null }, pleine200).ok], [false, false]);
  verifier("limite : dupliquer un bloc Colonnes compte ses enfants", planifierOperation({ type: "dupliquer", index: 0 }, [cols("C", 2, Array.from({ length: 150 }, (_, i) => bloc("Espace", `s${i}`))), cols("D", 2, Array.from({ length: 40 }, (_, i) => bloc("Espace", `u${i}`)))]).ok, false);
  r = planifierOperation({ type: "supprimer", index: 1 }, page);
  verifier("supprimer un bloc Colonnes : annonce le nombre de blocs perdus", r.annonce, "Bloc 2, Colonnes, supprimé (avec les 4 blocs de ses colonnes). La page compte maintenant 2 blocs.");
  // Plan du panneau
  const plan = construirePlan(page);
  verifier("plan : 3 blocs à la racine", plan.map((l) => [l.bloc.type, l.index, l.total]), [["Titre", 0, 3], ["Colonnes", 1, 3], ["Espace", 2, 3]]);
  verifier("plan : colonnes du bloc Colonnes, zones et situation", plan[1].colonnes?.map((c) => [c.numero, c.zone, c.affichee, c.lignes.map((l) => [l.bloc.type, l.index, l.total, l.situation])]), [
    [1, "C:colonne1", true, [["Titre", 0, 3, { parent: 1, colonne: 1 }], ["Paragraphe", 1, 3, { parent: 1, colonne: 1 }], ["Image", 2, 3, { parent: 1, colonne: 1 }]]],
    [2, "C:colonne2", true, [["Bouton", 0, 1, { parent: 1, colonne: 2 }]]],
  ]);
  verifier("plan : 3e colonne remplie mais non affichée -> listée « à vider »", construirePlan([cols("C", 2, [], [], [bloc("Titre", "x")])])[0].colonnes?.map((c) => [c.numero, c.affichee]), [[1, true], [2, true], [3, false]]);
  verifier("plan : bloc Colonnes sans identifiant -> pas de colonnes (jamais d'exception)", construirePlan([{ type: "Colonnes", props: { nombre: 2 } }])[0].colonnes, undefined);
  verifier("noms accessibles dans une colonne", nomsActions(1, "Paragraphe", { parent: 1, colonne: 2 }).monter, "Monter le bloc 2, Paragraphe, de la colonne 2 du bloc 2");
  verifier("extraits des nouveaux blocs", [
    extraitBloc("Citation", { texte: "Délicieux" }),
    extraitBloc("Image", { alt: "Un plat" }),
    extraitBloc("Image", { decorative: true, alt: "" }),
    extraitBloc("Image", { alt: "" }),
    extraitBloc("Colonnes", { nombre: 3 }),
    extraitBloc("AppelAction", { titre: "Prêt ?" }),
    extraitBloc("FAQ", { questions: [1, 2] }),
    extraitBloc("FAQ", { titre: "Aide", questions: [] }),
    extraitBloc("CarteRestaurant", { restaurantId: "" }),
    extraitBloc("CarteRestaurant", { restaurantId: "0b1c2d3e-aaaa-4bbb-8ccc-111122223333" }),
    extraitBloc("ListeRestaurants", { nombre: 6 }),
  ], ["Délicieux", "Un plat", "(image décorative)", "(à compléter)", "3 colonnes", "Prêt ?", "2 questions", "Aide", "(restaurant à choisir)", "Restaurant choisi", "6 restaurants"]);
}

// --- Conversion Puck <-> document : colonnes, réglages, champs facultatifs (tâche 8) ----------------------------------------
{
  const IMG = "https://projet-test.supabase.co/storage/v1/object/public/medias/studio/0b1c2d3e-aaaa-4bbb-8ccc-111122223333.png";
  const donnees = {
    content: [
      { type: "Colonnes", props: { id: "Colonnes-1", nombre: 2, ecart: 16, reglages: { fond: "creme", espaceHaut: "", alignement: undefined }, colonne1: [{ type: "Image", props: { id: "Image-1", src: IMG, alt: "Plat", decorative: false, legende: "", ratio: "4-3", ajustement: "couvrir", reglages: { visibilite: "" } } }], colonne2: [{ type: "Citation", props: { id: "Citation-1", texte: "Bon", auteur: "" } }], colonne3: [] } },
      { type: "ListeRestaurants", props: { id: "Liste-1", titre: "", filtre: "tous", nombre: 3, quartierId: "", categorieId: "" } },
      { type: "FAQ", props: { id: "FAQ-1", titre: "", questions: [{ question: "Q ?", reponse: "R" }], reglages: {} } },
      { type: "AppelAction", props: { id: "A-1", titre: "T", texte: "", bouton: { libelle: "Go", lien: "/restaurants", style: "principal" }, reglages: { fond: "mangue" } } },
    ],
    root: { props: {} },
  };
  const doc = puckVersDocument(donnees);
  verifier("conversion : colonnes réduites récursivement, « Par défaut » et champs facultatifs vides retirés", doc.content, [
    { type: "Colonnes", props: { id: "Colonnes-1", nombre: 2, ecart: 16, colonne1: [{ type: "Image", props: { id: "Image-1", src: IMG, alt: "Plat", decorative: false, ratio: "4-3", ajustement: "couvrir" } }], colonne2: [{ type: "Citation", props: { id: "Citation-1", texte: "Bon" } }], colonne3: [], reglages: { fond: "creme" } } },
    { type: "ListeRestaurants", props: { id: "Liste-1", filtre: "tous", nombre: 3 } },
    { type: "FAQ", props: { id: "FAQ-1", questions: [{ question: "Q ?", reponse: "R" }] } },
    { type: "AppelAction", props: { id: "A-1", titre: "T", bouton: { libelle: "Go", lien: "/restaurants", style: "principal" }, reglages: { fond: "mangue" } } },
  ]);
  verifier("conversion : le résultat est valide pour le registre", validerPage(doc).ok, true);
  const dansPuck = documentVersPuck(JSON.parse(JSON.stringify(doc)));
  verifier("document -> puck : tous les blocs imbriqués ont un identifiant", [(dansPuck.content[0].props.colonne1 as BlocContenu[])[0].props.id, (dansPuck.content[0].props.colonne2 as BlocContenu[])[0].props.id], ["Image-1", "Citation-1"]);
  const sansIds = documentVersPuck({ content: [{ type: "Colonnes", props: { nombre: 2, ecart: 16, colonne1: [{ type: "Titre", props: { texte: "a", niveau: 2, alignement: "gauche" } }] } }], root: { props: {} } });
  const enfant = (sansIds.content[0].props.colonne1 as BlocContenu[])[0];
  verifier("document -> puck : identifiants ajoutés aux blocs imbriqués, colonnes absentes créées vides", [/^Titre-[0-9a-f-]{36}$/.test(String(enfant.props.id)), sansIds.content[0].props.colonne2, sansIds.content[0].props.colonne3], [true, [], []]);
  verifier("document -> puck : blocs de colonne illisibles ignorés", (documentVersPuck({ content: [{ type: "Colonnes", props: { colonne1: [null, 3, { props: {} }, { type: "Titre", props: {} }] } }], root: {} }).content[0].props.colonne1 as BlocContenu[]).length, 1);
  const reference = empreinte(doc);
  verifier("modifié : non, après aller-retour (identifiants ajoutés ignorés, colonnes comprises)", estModifie(documentVersPuck(JSON.parse(JSON.stringify(doc))) as never, reference), false);
  const modif = JSON.parse(JSON.stringify(donnees));
  modif.content[0].props.colonne1[0].props.alt = "Autre";
  verifier("modifié : oui, si un bloc d'une colonne change", estModifie(modif, reference), true);
  const deplace = JSON.parse(JSON.stringify(donnees));
  deplace.content[0].props.colonne2.push(deplace.content[0].props.colonne1.pop());
  verifier("modifié : oui, si un bloc passe d'une colonne à l'autre", estModifie(deplace, reference), true);
  const reglageChange = JSON.parse(JSON.stringify(donnees));
  reglageChange.content[0].props.reglages = { fond: "rouge" };
  verifier("modifié : oui, si un réglage change ; non si « Par défaut » → absent", [estModifie(reglageChange, reference), estModifie({ ...donnees, content: donnees.content.map((b) => ({ ...b, props: { ...b.props, reglages: b.props.reglages ?? {} } })) }, reference)], [true, false]);
  const imbriqueInconnu = puckVersDocument({ content: [{ type: "Colonnes", props: { id: "C", nombre: 2, ecart: 16, colonne1: [{ type: "Carrousel", props: { x: 1 } }] } }], root: {} });
  verifier("type inconnu dans une colonne : gardé et signalé (jamais retiré en silence)", (validerPage(imbriqueInconnu) as { erreurs: string[] }).erreurs, ["Bloc 1, colonne 1, bloc 1 : type de bloc inconnu."]);
}

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
