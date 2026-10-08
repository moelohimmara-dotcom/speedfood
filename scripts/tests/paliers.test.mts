import fs from "node:fs";
import path from "node:path";
import {
  ACTIFS,
  ACTIFS_COUVERTS_EN_APPLICATION,
  ACTIFS_STUDIO,
  CORRESPONDANCE_PERMISSIONS,
  MINIMUMS_STUDIO,
  PALIERS,
  REGEX_ACTIF,
  actifCouvre,
  actifEstGarde,
  actifsSansCouverture,
  deciderAcces,
  descriptionCouverture,
  expirationDepuisSaisie,
  explicationPalier,
  lectureNecessaire,
  palierEffectif,
  paliersPreset,
  validerCible,
  validerHabilitation,
  type Habilitation,
  type Palier,
} from "../../src/lib/system-admin/paliers";
import { ROLES_SYSTEME, PERMISSIONS_PAR_ROLE, roleAPermission, groupesNavPourRole, sousSectionsAccessibles, type Permission } from "../../src/lib/system-admin/permissions";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const MAINTENANT = Date.parse("2026-10-06T12:00:00Z");
const DEMAIN = "2026-10-07T12:00:00.000Z";
const HIER = "2026-10-05T12:00:00.000Z";
const h = (actif: string, palier: number, plafond: boolean, expire_le: string | null = null): Habilitation => ({ actif, palier, plafond, expire_le });
const eff = (role: (typeof ROLES_SYSTEME)[number], habilitations: Habilitation[], actif: string) =>
  palierEffectif({ role, habilitations, actif, maintenant: MAINTENANT });

// --- Catalogue -----------------------------------------------------------------
verifier("paliers 0 à 5, dans l'ordre", PALIERS.map((p) => p.valeur), [0, 1, 2, 3, 4, 5]);
verifier("seul le palier 5 n'est pas attribuable", PALIERS.filter((p) => !p.attribuable).map((p) => p.valeur), [5]);
verifier("actifs uniques", new Set(ACTIFS.map((a) => a.code)).size, ACTIFS.length);
verifier("actifs conformes au CHECK de la table", ACTIFS.filter((a) => !REGEX_ACTIF.test(a.code)).map((a) => a.code), []);
verifier("parents des actifs connus", ACTIFS.filter((a) => a.parent && !ACTIFS.some((b) => b.code === a.parent)).map((a) => a.code), []);
verifier("actifs du Studio au catalogue", ACTIFS_STUDIO.filter((a) => !ACTIFS.some((b) => b.code === a)), []);
verifier("actifs de la correspondance au catalogue", CORRESPONDANCE_PERMISSIONS.filter((c) => !ACTIFS.some((a) => a.code === c.actif)).map((c) => c.actif), []);

// --- actifCouvre -----------------------------------------------------------------
verifier("* couvre tout", ACTIFS.every((a) => actifCouvre("*", a.code)), true);
verifier("actif identique", actifCouvre("contenu:pages", "contenu:pages"), true);
verifier("parent couvre enfant", actifCouvre("contenu", "contenu:pages"), true);
verifier("parent couvre tous ses enfants", ["contenu:pages", "contenu:bannieres", "contenu:textes"].every((a) => actifCouvre("contenu", a)), true);
verifier("enfant ne couvre pas le parent", actifCouvre("contenu:pages", "contenu"), false);
verifier("enfant ne couvre pas un frère", actifCouvre("contenu:pages", "contenu:bannieres"), false);
verifier("préfixe sans « : » ne couvre pas", actifCouvre("contenu", "contenus"), false);
verifier("actif sans rapport", actifCouvre("theme", "contenu:pages"), false);
verifier("seul * couvre *", [actifCouvre("contenu", "*"), actifCouvre("*", "*")], [false, true]);

// --- Préréglages : table documentée et fidélité à la matrice -------------------------
verifier("préréglage super_admin", paliersPreset("super_admin"), { "*": 5 });
verifier("préréglage operations", paliersPreset("operations"), { restaurants: 2, comptes: 2, audit: 0 });
verifier("préréglage content_editor", paliersPreset("content_editor"), { restaurants: 0, contenu: 2, medias: 2, audit: 0 });
verifier("préréglage support", paliersPreset("support"), { restaurants: 0, commandes: 2, audit: 0 });

// Chaque permission tenue donne au moins son palier ; aucune permission non tenue n'en donne (pas de droit inventé).
for (const role of ROLES_SYSTEME) {
  const manques = CORRESPONDANCE_PERMISSIONS.filter(
    (c) => roleAPermission(role, c.permission) && (eff(role, [], c.actif) ?? -1) < c.palier
  ).map((c) => `${c.permission}→${c.actif}`);
  verifier(`${role} : toute permission tenue se retrouve dans le préréglage`, manques, []);
  if (role !== "super_admin") {
    const inventes = Object.entries(paliersPreset(role)).filter(
      ([actif, palier]) => !CORRESPONDANCE_PERMISSIONS.some((c) => c.actif === actif && c.palier === palier && roleAPermission(role, c.permission))
    );
    verifier(`${role} : aucun palier sans permission correspondante`, inventes, []);
  }
}

// PREUVE DEMANDÉE : pour chaque rôle et chaque action protégée du Studio, l'ancienne règle (`contenu.editer`) et le nouveau
// contrôle combiné (permission + palier, sans habilitation, lecture réussie) donnent EXACTEMENT la même réponse.
const ACTIONS_STUDIO: { nom: string; minimum: Palier }[] = [
  { nom: "lire", minimum: MINIMUMS_STUDIO.lire },
  { nom: "créer/modifier un brouillon", minimum: MINIMUMS_STUDIO.brouillon },
  { nom: "publier/dépublier/supprimer/rétablir", minimum: MINIMUMS_STUDIO.publier },
];
const ecarts: string[] = [];
for (const role of ROLES_SYSTEME) {
  for (const actif of ACTIFS_STUDIO) {
    for (const action of ACTIONS_STUDIO) {
      const ancien = roleAPermission(role, "contenu.editer");
      for (const lecture of [{ ok: true as const, habilitations: [] }, ...(role === "super_admin" ? [null, { ok: false as const }] : [])]) {
        const nouveau = deciderAcces({ role, permission: "contenu.editer", actif, minimum: action.minimum, lecture, maintenant: MAINTENANT }).autorise;
        if (ancien !== nouveau) ecarts.push(`${role} ${actif} ${action.nom} : avant ${ancien}, après ${nouveau}`);
      }
    }
  }
}
verifier("comportement des 4 rôles inchangé sur les 3 actifs × 3 actions du Studio", ecarts, []);
verifier("matrice couverte : 4 rôles", ROLES_SYSTEME.length, 4);
verifier("seuls super_admin et content_editor accèdent au Studio", ROLES_SYSTEME.filter((r) => roleAPermission(r, "contenu.editer")), ["super_admin", "content_editor"]);

// Même preuve, plus large : pour toute permission du catalogue de correspondance, le palier du préréglage autorise.
const ecartsLarges: string[] = [];
for (const role of ROLES_SYSTEME) {
  for (const c of CORRESPONDANCE_PERMISSIONS) {
    const ancien = roleAPermission(role, c.permission);
    const nouveau = deciderAcces({ role, permission: c.permission, actif: c.actif, minimum: c.palier, lecture: { ok: true, habilitations: [] }, maintenant: MAINTENANT }).autorise;
    if (ancien !== nouveau) ecartsLarges.push(`${role} ${c.permission}`);
  }
}
verifier("toutes les permissions correspondantes : comportement inchangé", ecartsLarges, []);

// --- Relèvement, plafond, expiration, combinaison ---------------------------------------
verifier("sans habilitation : content_editor Éditeur sur les pages", eff("content_editor", [], "contenu:pages"), 2);
verifier("sans habilitation : operations sans accès au contenu", eff("operations", [], "contenu:pages"), null);
verifier("relèvement : max(préréglage, relèvement)", eff("content_editor", [h("contenu:pages", 3, false)], "contenu:pages"), 3);
verifier("relèvement inférieur au préréglage : sans effet", eff("content_editor", [h("contenu:pages", 1, false)], "contenu:pages"), 2);
verifier("relèvement sur un actif sans préréglage", eff("operations", [h("contenu:pages", 1, false)], "contenu:pages"), 1);
verifier("plafond : accès partiel", eff("content_editor", [h("contenu:pages", 1, true)], "contenu:pages"), 1);
verifier("plafond supérieur au palier : sans effet", eff("content_editor", [h("contenu:pages", 4, true)], "contenu:pages"), 2);
verifier("plafond sur pages ne gêne pas les bannières", eff("content_editor", [h("contenu:pages", 1, true)], "contenu:bannieres"), 2);
verifier("plafond sur le parent vaut pour l'enfant", eff("content_editor", [h("contenu", 0, true)], "contenu:textes"), 0);
verifier("plafond sur * vaut pour tout", eff("content_editor", [h("*", 1, true)], "contenu:bannieres"), 1);
verifier("plafond sur un enfant ne limite pas le parent", eff("content_editor", [h("contenu:pages", 0, true)], "contenu"), 2);
verifier("plafond sans accès de base : toujours aucun accès", eff("operations", [h("contenu:pages", 3, true)], "contenu:pages"), null);
verifier("combinaison min(max(préréglage, relèvements), plafonds)", eff("content_editor", [h("contenu", 4, false), h("contenu:pages", 3, true)], "contenu:pages"), 3);
verifier("plusieurs plafonds : le plus bas l'emporte", eff("content_editor", [h("contenu", 1, true), h("contenu:pages", 0, true)], "contenu:pages"), 0);
verifier("relèvement et plafond sur le même actif", eff("operations", [h("contenu:pages", 3, false), h("contenu:pages", 1, true)], "contenu:pages"), 1);
verifier("relèvement expiré ignoré", eff("content_editor", [h("contenu:pages", 4, false, HIER)], "contenu:pages"), 2);
verifier("plafond expiré ignoré", eff("content_editor", [h("contenu:pages", 1, true, HIER)], "contenu:pages"), 2);
verifier("plafond non expiré appliqué", eff("content_editor", [h("contenu:pages", 1, true, DEMAIN)], "contenu:pages"), 1);
verifier("expiration à l'instant même : expirée", eff("content_editor", [h("contenu:pages", 1, true, new Date(MAINTENANT).toISOString())], "contenu:pages"), 2);
verifier("date illisible : relèvement ignoré", eff("content_editor", [h("contenu:pages", 4, false, "n'importe quoi")], "contenu:pages"), 2);
verifier("date illisible : plafond maintenu", eff("content_editor", [h("contenu:pages", 1, true, "n'importe quoi")], "contenu:pages"), 1);
verifier("relèvement au palier 5 (ligne invalide) : ignoré", eff("content_editor", [h("contenu:pages", 5, false)], "contenu:pages"), 2);
verifier("relèvement non entier : ignoré", eff("operations", [h("contenu:pages", 1.5, false)], "contenu:pages"), null);
verifier("plafond invalide : limite à 0", eff("content_editor", [h("contenu:pages", 9, true)], "contenu:pages"), 0);
verifier("super_admin ignore toute habilitation", eff("super_admin", [h("*", 0, true), h("contenu:pages", 0, true)], "contenu:pages"), 5);
verifier("habilitation sur un autre actif ignorée", eff("content_editor", [h("theme", 0, true)], "contenu:pages"), 2);

// --- Politique d'échec fermé (lecture des habilitations) -----------------------------------
const decider = (role: (typeof ROLES_SYSTEME)[number], lecture: Parameters<typeof deciderAcces>[0]["lecture"], minimum: Palier, permission: Permission | undefined = "contenu.editer") =>
  deciderAcces({ role, permission, actif: "contenu:pages", minimum, lecture, maintenant: MAINTENANT });
verifier("super_admin : aucune lecture nécessaire", lectureNecessaire("super_admin"), false);
verifier("autres rôles : lecture nécessaire", ROLES_SYSTEME.filter((r) => r !== "super_admin").every(lectureNecessaire), true);
verifier("super_admin, lecture non faite : autorisé (palier 5)", decider("super_admin", null, 2), { autorise: true, palier: 5 });
verifier("super_admin, lecture en échec : autorisé", decider("super_admin", { ok: false }, 2), { autorise: true, palier: 5 });
verifier("content_editor, lecture en échec : REFUSÉ", decider("content_editor", { ok: false }, 0), { autorise: false, raison: "illisible", palier: null });
verifier("content_editor, lecture non faite : REFUSÉ", decider("content_editor", null, 0), { autorise: false, raison: "illisible", palier: null });
verifier("content_editor, lecture réussie vide : autorisé", decider("content_editor", { ok: true, habilitations: [] }, 2), { autorise: true, palier: 2 });
verifier("content_editor plafonné à 1 : publication refusée", decider("content_editor", { ok: true, habilitations: [h("contenu:pages", 1, true)] }, 2), { autorise: false, raison: "palier", palier: 1 });
verifier("content_editor plafonné à 1 : brouillon autorisé", decider("content_editor", { ok: true, habilitations: [h("contenu:pages", 1, true)] }, 1), { autorise: true, palier: 1 });
verifier("permission absente : refus avant toute lecture", decider("operations", { ok: false }, 0), { autorise: false, raison: "permission", palier: null });
verifier("permission absente malgré un relèvement : refus", decider("operations", { ok: true, habilitations: [h("contenu", 4, false)] }, 0), { autorise: false, raison: "permission", palier: null });
verifier("sans permission exigée : palier seul", deciderAcces({ role: "operations", actif: "contenu:pages", minimum: 2, lecture: { ok: true, habilitations: [h("contenu", 2, false)] }, maintenant: MAINTENANT }), { autorise: true, palier: 2 });

// --- Validation d'une attribution -----------------------------------------------------------
const base = { actif: "contenu:pages", palier: "1", type: "plafond", expiration: "", maintenant: MAINTENANT };
verifier("attribution valide (plafond, sans expiration)", validerHabilitation(base), { ok: true, valeur: { actif: "contenu:pages", palier: 1, plafond: true, expire_le: null } });
verifier("attribution valide (relèvement, expiration)", validerHabilitation({ ...base, type: "relevement", palier: 3, expiration: "2026-10-20" }), { ok: true, valeur: { actif: "contenu:pages", palier: 3, plafond: false, expire_le: "2026-10-20T23:59:59.000Z" } });
verifier("palier 5 refusé (message dédié)", validerHabilitation({ ...base, palier: "5" }).ok === false && JSON.stringify(validerHabilitation({ ...base, palier: "5" })).includes("Propriétaire"), true);
verifier("palier 5 en nombre refusé", validerHabilitation({ ...base, palier: 5 }).ok, false);
for (const mauvais of ["6", "-1", "1.5", "", "un", "01", " 2x"]) verifier(`palier « ${mauvais} » refusé`, validerHabilitation({ ...base, palier: mauvais }).ok, false);
for (const mauvais of ["inconnu", "contenu:inconnu", "CONTENU", "contenu:pages:x", "", "* "]) verifier(`actif « ${mauvais} » refusé`, validerHabilitation({ ...base, actif: mauvais }).ok, false);
verifier("actif * accepté", validerHabilitation({ ...base, actif: "*" }).ok, true);
verifier("type inconnu refusé", validerHabilitation({ ...base, type: "total" }).ok, false);
verifier("expiration passée refusée", validerHabilitation({ ...base, expiration: "2026-10-01" }).ok, false);
verifier("expiration aujourd'hui (fin de journée) acceptée", validerHabilitation({ ...base, expiration: "2026-10-06" }).ok, true);
verifier("expiration invalide refusée", validerHabilitation({ ...base, expiration: "2026-02-30" }).ok, false);
verifier("expiration mal formée refusée", validerHabilitation({ ...base, expiration: "06/10/2026" }).ok, false);
verifier("saisie de date vide : sans expiration", expirationDepuisSaisie("  "), null);
verifier("cible sans rôle refusée", validerCible(null) !== null, true);
verifier("cible super_admin refusée", validerCible("super_admin") !== null, true);
verifier("cible rôle inconnu refusée", validerCible("pirate") !== null, true);
verifier("cibles content_editor/operations/support acceptées", ["content_editor", "operations", "support"].map(validerCible), [null, null, null]);
verifier("explication d'un bouton indisponible", explicationPalier(1, 2).includes("Contributeur") && explicationPalier(1, 2).includes("Éditeur"), true);
verifier("matrice inchangée (garde-fou de ce test)", Object.keys(PERMISSIONS_PAR_ROLE), ["super_admin", "operations", "content_editor", "support"]);

// --- Navigation hiérarchisée (refonte du 8 octobre 2026) ---------------------------------------
//
// La barre latérale affiche désormais chaque famille et TOUTES ses sous-sections accessibles
// (l'ancienne `entreesNavPourRole` n'en gardait qu'une). Le filtrage par permission doit rester
// identique : la barre ne doit montrer AUCUNE entrée que le rôle ne peut pas ouvrir.

verifier("nav : super_admin voit les 6 familles", groupesNavPourRole("super_admin").map((g) => g.libelle), [
  "Catalogue",
  "Contenu",
  "Commandes",
  "Accès",
  "Paramètres",
  "Audit",
]);
verifier("nav : super_admin voit les 15 sous-sections", groupesNavPourRole("super_admin").reduce((n, g) => n + g.entrees.length, 0), 15);
verifier("nav : operations ne voit ni Commandes ni Paramètres", groupesNavPourRole("operations").map((g) => g.libelle), [
  "Catalogue",
  "Accès",
  "Audit",
]);
verifier("nav : operations voit Comptes mais pas Rôles ni Habilitations", groupesNavPourRole("operations").flatMap((g) => g.entrees.map((e) => e.libelle)), [
  "Restaurants",
  "Mises en avant",
  "Comptes utilisateurs",
  "Journal d'audit",
]);
verifier("nav : support ne voit que Commandes et Audit", groupesNavPourRole("support").map((g) => g.libelle), ["Commandes", "Audit"]);
verifier("nav : content_editor ne voit ni Commandes ni Accès ni Paramètres", groupesNavPourRole("content_editor").map((g) => g.libelle), [
  "Catalogue",
  "Contenu",
  "Audit",
]);

// Garde-fou : chaque entrée affichée est bien une sous-section dont le rôle a la permission.
// Une entrée « de trop » serait une fuite d'information dans la navigation (l'accès resterait
// refusé par la page, mais le lien existerait).
const entreesNonAutorisees: string[] = [];
for (const role of ROLES_SYSTEME) {
  for (const groupe of groupesNavPourRole(role)) {
    const attendues = sousSectionsAccessibles(groupe.libelle, role).map((s) => s.href);
    for (const entree of groupe.entrees) {
      if (!attendues.includes(entree.href)) entreesNonAutorisees.push(`${role} → ${entree.href}`);
    }
    // Et l'inverse : aucune sous-section accessible ne doit manquer (complétude).
    for (const href of attendues) {
      if (!groupe.entrees.some((e) => e.href === href)) entreesNonAutorisees.push(`${role} manquant → ${href}`);
    }
  }
}
verifier("nav : barre et sous-nav affichent exactement les mêmes entrées", entreesNonAutorisees, []);
verifier("nav : aucune famille vide", ROLES_SYSTEME.every((r) => groupesNavPourRole(r).every((g) => g.entrees.length > 0)), true);

// --- Couverture des paliers ------------------------------------------------------
//
// Le test le plus important de ce fichier. `ACTIFS_COUVERTS_EN_APPLICATION` est une liste
// tenue à la main ; sans confrontation automatique au code, elle vieillit en silence et
// l'écran des habilitations promet une garantie qui n'existe plus. On relit donc le code
// source et on exige que la liste corresponde exactement aux actifs réellement gardés.

const racineSrc = path.join(process.cwd(), "src");
const codesVerifies = new Set<string>();
for (const fichier of fs.readdirSync(path.join(racineSrc, "lib", "system-admin"), { withFileTypes: true })) {
  if (!fichier.isFile() || !fichier.name.endsWith(".ts")) continue;
  const source = fs.readFileSync(path.join(racineSrc, "lib", "system-admin", fichier.name), "utf8");
  // `verifierPalier("actif", ...)` et `exigerPalier("actif", ...)`
  for (const m of source.matchAll(/(?:verifierPalier|exigerPalier)\(\s*"([^"]+)"/g)) {
    codesVerifies.add(m[1]);
  }
}

const declares = ACTIFS_COUVERTS_EN_APPLICATION.slice().sort();
const reels = [...codesVerifies].sort();

verifier("la liste des actifs couverts correspond au code réel", declares, reels);
verifier("aucun actif couvert n'est absent du catalogue", declares.filter((c) => !ACTIFS.some((a) => a.code === c)), []);
verifier("tous les actifs Studio sont couverts", ACTIFS_STUDIO.every((a) => declares.includes(a)), true);
verifier("le parent 'contenu' est considéré comme couvert", actifEstGarde("contenu"), true);
verifier("un actif non couvert est signalé comme tel", actifEstGarde("restaurants"), false);
verifier("la couverture et le sans-couverture se complètent", [...actifsSansCouverture(), ...ACTIFS_COUVERTS_EN_APPLICATION].sort(), ACTIFS.map((a) => a.code).sort());
verifier("la description d'un actif couvert annonce la garantie", descriptionCouverture("contenu:pages").includes("Garde active"), true);
verifier(
  "la description d'un actif non couvert annonce l'absence d'effet",
  descriptionCouverture("restaurants").includes("Seule la permission limite"),
  true
);

// Garde-fou explicite : la surface de couverture ne doit pas rétrécir sans qu'on le voie.
verifier("les 3 espaces Studio restent couverts", ACTIFS_COUVERTS_EN_APPLICATION.length >= ACTIFS_STUDIO.length, true);

if (ko > 0) {
  console.log(`\n${ko} test(s) des paliers en échec.`);
  process.exit(1);
}
console.log("\nTous les tests des paliers passent.");
