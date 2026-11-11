// Mutations du lot R2 (décisions de remboursement, espèces derrière un réglage, dossier de litige).
// Principe : on casse UNE règle à la fois dans la source, on rejoue les tests, et la casse DOIT être vue. Une mutation survivante fait échouer
// le script (code 1). Zéro réseau, aucune base réelle : le SQL est rejoué sur PGlite par `cloisonnement.mjs`.
// Sécurité : toutes les sources sont gardées en Buffer et restaurées dans un `finally` (et sur Ctrl+C) ; vérification finale octet par octet.
// Usage (depuis apps/web) : node scripts/muter-remboursement-r2.mjs            (toutes)
//                           node scripts/muter-remboursement-r2.mjs --unit     (seulement les mutations du TypeScript)
//                           node scripts/muter-remboursement-r2.mjs --sql      (seulement celles de la migration)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { creerCopieur } from "./outils/copie-tmp.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const depot = join(racine, "..", "..");
const W = (rel) => join(racine, rel);
const EN = "src/lib/paiement/en-ligne/";
const DECISION = W(`${EN}remboursement-decision.ts`);
const SERVICE = W(`${EN}remboursement-decision-service.ts`);
const ASSEMBLAGE = W(`${EN}remboursement-dossier-assemblage.ts`);
const DOSSIER = W(`${EN}remboursement-dossier.ts`);
const LECTURE = W(`${EN}remboursement-lecture.ts`);
const LITIGES = W(`${EN}litiges.ts`);
const PAIEMENTS = W("src/lib/system-admin/paiements.ts");
const ACTIONS_UI = W("src/app/system/paiements/ActionsPaiement.tsx");
const EXPORT = W("src/app/system/paiements/dossier/[id]/export/route.ts");
const PAGE_DOSSIER = W("src/app/system/paiements/dossier/[id]/page.tsx");
const ACTIONS_DECISION = W("src/lib/system-admin/remboursement-decisions.ts");
const SQL = join(depot, "supabase", "migrations", "20261110120000_remboursement_decisions.sql");

// suite : "unit" (les trois fichiers de tests R2) | "sql" (cloisonnement sur PGlite)
// edits : liste de [cible, remplace] ; chaque cible doit exister UNE seule fois dans le fichier.
const mutations = [
  // --- Moyens et réserve de Chap Chap Pay ---
  { suite: "unit", nom: "M01. Chap Chap Pay déclaré capable de rembourser", fichier: DECISION, edits: [["export const CHAPCHAP_SAIT_REMBOURSER = false;", "export const CHAPCHAP_SAIT_REMBOURSER = true;"]] },
  { suite: "unit", nom: "M02. le moyen chapchap n'est plus refusé quand le système ne sait pas rembourser", fichier: DECISION, edits: [["else if (!chapchapOk) raisonChapchap = MESSAGE_CHAPCHAP_INDISPONIBLE;", "else if (false) raisonChapchap = MESSAGE_CHAPCHAP_INDISPONIBLE;"]] },
  { suite: "unit", nom: "M03. chapchap proposé aussi pour un paiement de démonstration (simulé)", fichier: DECISION, edits: [['if (e.modeOrigine === "simulation") raisonChapchap = "Non disponible : ce paiement est une démonstration, aucun argent réel n\'a bougé.";\n  else if (e.modeOrigine === "code_marchand")', 'if (false) raisonChapchap = "x";\n  else if (e.modeOrigine === "code_marchand")']] },
  { suite: "unit", nom: "M04. l'exécution par le prestataire est acceptée sans que le système sache rembourser", fichier: DECISION, edits: [["return CHAPCHAP_SAIT_REMBOURSER ? { ok: true, decisionId: decision.id } : { ok: false, erreur: MESSAGE_CHAPCHAP_INDISPONIBLE };", "return { ok: true, decisionId: decision.id };"]] },
  // --- Espèces ---
  { suite: "unit", nom: "M05. espèces proposées même quand le réglage est faux", fichier: DECISION, edits: [["const raisonEspeces = !e.especesAutorise ? MESSAGE_ESPECES_DESACTIVEES : sansRemboursement", "const raisonEspeces = false ? MESSAGE_ESPECES_DESACTIVEES : sansRemboursement"]] },
  { suite: "unit", nom: "M06. exécution en espèces acceptée quand le réglage est faux", fichier: DECISION, edits: [['if (action.type === "rembourser_manuel" && action.moyenManuel === "especes" && !especesAutorise) {', "if (false) {"]] },
  { suite: "unit", nom: "M07. exécution en espèces acceptée sans décision enregistrée", fichier: DECISION, edits: [['    if (action.type === "rembourser_manuel" && action.moyenManuel === "especes") {\n', "    if (false) {\n"]] },
  { suite: "unit", nom: "M08. le service lit le réglage en échec comme « espèces autorisées »", fichier: SERVICE, edits: [["especesAutorise = false; // en cas de doute, les espèces restent fermées", "especesAutorise = true;"]] },
  // --- Référence de l'avis juridique ---
  { suite: "unit", nom: "M09. référence d'avis jamais obligatoire", fichier: DECISION, edits: [['return ecart !== "conforme" || moyen === "especes_dernier_recours";', "return false;"]] },
  { suite: "unit", nom: "M10. référence d'avis non exigée pour les espèces", fichier: DECISION, edits: [['return ecart !== "conforme" || moyen === "especes_dernier_recours";', 'return ecart !== "conforme";']] },
  { suite: "unit", nom: "M11. une décision sans règle applicable est comptée « conforme »", fichier: DECISION, edits: [['if (regle === null || regle.decision === "humain") return "sans_regle";', 'if (regle === null) return "sans_regle";\n  if (regle.decision === "humain") return "conforme";']] },
  // --- Montants (entiers, bornes, total donné par le serveur) ---
  { suite: "unit", nom: "M12. montant partiel non entier accepté", fichier: DECISION, edits: [['if (typeof s.montantGnf !== "number" || !Number.isSafeInteger(s.montantGnf))', 'if (typeof s.montantGnf !== "number")']] },
  { suite: "unit", nom: "M13. remboursement « partiel » égal au total accepté", fichier: DECISION, edits: [["s.montantGnf <= 0 || s.montantGnf >= c.totalGnf", "s.montantGnf <= 0 || s.montantGnf > c.totalGnf"]] },
  {
    suite: "unit",
    nom: "M14. le montant d'un remboursement total peut être imposé par le navigateur",
    fichier: DECISION,
    edits: [
      ['s.montantGnf !== "" && s.montantGnf !== c.totalGnf) return refus("Un remboursement total', 's.montantGnf !== "" && false) return refus("Un remboursement total'],
      ["    montantGnf = c.totalGnf;\n  } else if", '    montantGnf = typeof s.montantGnf === "number" ? s.montantGnf : c.totalGnf;\n  } else if'],
    ],
  },
  { suite: "unit", nom: "M15. le service prend le total dans la saisie au lieu de la base", fichier: SERVICE, edits: [["totalGnf: cible.totalGnf,", "totalGnf: Number((entree.saisie as { totalGnf?: number }).totalGnf ?? cible.totalGnf),"]] },
  // --- Code marchand ---
  { suite: "unit", nom: "M16. code marchand : la reconnaissance « l'argent est chez le restaurant » n'est plus exigée", fichier: DECISION, edits: [['s.reconnaitArgentChezRestaurant !== true) {', "false) {"]] },
  { suite: "unit", nom: "M17. code marchand : la décision ne porte plus la reconnaissance", fichier: DECISION, edits: [['argentChezRestaurantReconnu: c.modeOrigine === "code_marchand",', "argentChezRestaurantReconnu: false,"]] },
  // --- Service : droits, historique, réglage ---
  { suite: "unit", nom: "M18. enregistrer une décision sans être super administrateur", fichier: SERVICE, edits: [['  if (!entree.aPermission("parametres.editer")) return { ok: false, erreur: REFUS_PERMISSION };\n  if (typeof entree.utilisateurId', "  if (typeof entree.utilisateurId"]] },
  { suite: "unit", nom: "M19. changer le réglage des espèces sans être super administrateur", fichier: SERVICE, edits: [['  if (!entree.aPermission("parametres.editer")) return { ok: false, erreur: REFUS_PERMISSION };\n  if (typeof entree.valeur', "  if (typeof entree.valeur"]] },
  { suite: "unit", nom: "M20. une correction ne remplace plus la décision précédente (bifurcation)", fichier: SERVICE, edits: [["remplaceId: precedente?.id ?? null,\n    decideParId", "remplaceId: null,\n    decideParId"]] },
  { suite: "unit", nom: "M21. changement du réglage accepté sans motif", fichier: SERVICE, edits: [['if (motif.length < 5) return { ok: false, erreur: "Indiquez le motif du changement', 'if (false) return { ok: false, erreur: "Indiquez le motif du changement']] },
  // --- Garde sur les actions d'argent existantes ---
  { suite: "unit", nom: "M22. remboursement à la main : la garde de décision est retirée", fichier: PAIEMENTS, edits: [['  const garde = await gardeDecision(paiementId, { type: "rembourser_manuel", moyenManuel: moyen });\n  if ("erreur" in garde) return { erreur: garde.erreur };\n', ""]] },
  { suite: "unit", nom: "M23. trancher un litige : la garde de décision est retirée", fichier: PAIEMENTS, edits: [['  const garde = await gardeDecision(paiementId, decision === "liberer" ? { type: "liberer" } : { type: "rembourser_prestataire" });\n  if ("erreur" in garde) return { erreur: garde.erreur };\n', ""]] },
  { suite: "unit", nom: "M24. une décision illisible n'empêche plus l'action d'argent", fichier: PAIEMENTS, edits: [['  if (!lecture.ok) return { erreur: "La décision enregistrée n\'a pas pu être lue. Rien n\'a été modifié." };\n', ""]] },
  { suite: "unit", nom: "M25. libérer l'argent reste possible malgré une décision de rembourser", fichier: DECISION, edits: [['if (decision.issue !== "ne_pas_rembourser") return { ok: false, erreur: "La décision enregistrée est un remboursement : libérer', 'if (false) return { ok: false, erreur: "La décision enregistrée est un remboursement : libérer']] },
  { suite: "unit", nom: "M26. un remboursement partiel devient exécutable", fichier: DECISION, edits: [['if (decision.issue === "rembourser_partiel") return { ok: false,', 'if (false) return { ok: false,']] },
  { suite: "unit", nom: "M27. l'écran propose les espèces malgré le réglage", fichier: ACTIONS_UI, edits: [['(peutEspeces && especesAutorise)', "peutEspeces"]] },
  // --- Dossier et export ---
  { suite: "unit", nom: "M28. export : plus de contrôle de permission (n'importe quel connecté)", fichier: EXPORT, edits: [['if (!systeme || !roleAPermission(systeme.role, "commande.support"))', "if (!systeme)"]] },
  { suite: "unit", nom: "M29. lecture du dossier : le téléphone du client est lu", fichier: LECTURE, edits: [['"id, reference, mode, statut, sous_total, frais_livraison_estime,', '"id, reference, client_telephone, mode, statut, sous_total, frais_livraison_estime,']] },
  { suite: "unit", nom: "M30. l'export Markdown n'est plus servi sans mise en cache interdite", fichier: EXPORT, edits: [['"cache-control": "no-store",', '"cache-control": "public, max-age=3600",']] },
  { suite: "unit", nom: "M31. page de dossier : le formulaire est offert sans la permission de modifier", fichier: PAGE_DOSSIER, edits: [['const peutDecider = roleAPermission(contexte.role, "parametres.editer");', "const peutDecider = true;"]] },
  // --- Règles automatiques : R2 ne doit pas les toucher ---
  { suite: "unit", nom: "M32. règle automatique modifiée (plafond du partiel 300 pour mille devient 301)", fichier: LITIGES, edits: [["plafondRemboursementAutoPourMille: 300, seuilHumainGnf: 50_000", "plafondRemboursementAutoPourMille: 301, seuilHumainGnf: 50_000"]] },
  { suite: "unit", nom: "M33. règle automatique modifiée (seuil humain 50 000 devient 60 000)", fichier: LITIGES, edits: [["plafondRemboursementAutoPourMille: 300, seuilHumainGnf: 50_000", "plafondRemboursementAutoPourMille: 300, seuilHumainGnf: 60_000"]] },
  // --- Actions serveur ---
  { suite: "unit", nom: "M34. action serveur : la permission de modifier est retirée", fichier: ACTIONS_DECISION, edits: [['return await verifierPermission("parametres.editer");', 'return await verifierPermission("commande.support");']] },
  // --- Migration (PGlite) ---
  { suite: "sql", nom: "S01. réglage des espèces VRAI par défaut", fichier: SQL, edits: [["remboursement_especes_autorise boolean not null default false,", "remboursement_especes_autorise boolean not null default true,"]] },
  { suite: "sql", nom: "S02. la base n'écarte plus les espèces d'une décision quand le réglage est faux", fichier: SQL, edits: [["  if new.moyen = 'especes_dernier_recours'\n     and not coalesce", "  if false and new.moyen = 'especes_dernier_recours'\n     and not coalesce"]] },
  { suite: "sql", nom: "S03. la base n'écarte plus un remboursement à la main en espèces", fichier: SQL, edits: [["  if new.moyen = 'especes'\n     and not coalesce", "  if false and new.moyen = 'especes'\n     and not coalesce"]] },
  { suite: "sql", nom: "S04. une décision peut être modifiée (déclencheur d'ajout seul neutralisé)", fichier: SQL, edits: [["for each row execute function public.fn_remboursement_decisions_ajout_seul();", "for each row when (false) execute function public.fn_remboursement_decisions_ajout_seul();"]] },
  { suite: "sql", nom: "S05. une décision peut être effacée en masse (garde du vidage neutralisée)", fichier: SQL, edits: [["for each statement execute function public.fn_remboursement_decisions_ajout_seul();", "for each statement when (false) execute function public.fn_remboursement_decisions_ajout_seul();"]] },
  { suite: "sql", nom: "S06. le support lit les décisions (policy élargie)", fichier: SQL, edits: [["create policy \"super_admin_lecture_remboursement_decisions\" on public.remboursement_decisions\n  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));", "create policy \"super_admin_lecture_remboursement_decisions\" on public.remboursement_decisions\n  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));"]] },
  { suite: "sql", nom: "S07. policy du réglage sans restriction de rôle (évaluée aussi pour anon)", fichier: SQL, edits: [["on public.parametres_remboursement\n  for select to authenticated using", "on public.parametres_remboursement\n  for select using"]] },
  { suite: "sql", nom: "S08. l'API peut écrire une décision (droit d'insertion accordé)", fichier: SQL, edits: [["grant select on table public.remboursement_decisions, public.parametres_remboursement, public.parametres_remboursement_journal to authenticated;", "grant select, insert on table public.remboursement_decisions, public.parametres_remboursement, public.parametres_remboursement_journal to authenticated;"]] },
  { suite: "sql", nom: "S09. la référence d'avis n'est plus exigée par la base", fichier: SQL, edits: [["    reference_avis is not null or (ecart_regle = 'conforme' and moyen <> 'especes_dernier_recours')", "    reference_avis is not null or true"]] },
  { suite: "sql", nom: "S10. la chaîne de corrections peut bifurquer (unicité du remplacement retirée)", fichier: SQL, edits: [["create unique index remboursement_decisions_remplace_uq", "create index remboursement_decisions_remplace_uq"]] },
  { suite: "sql", nom: "S11. plusieurs décisions « de tête » par commande (unicité retirée)", fichier: SQL, edits: [["create unique index remboursement_decisions_tete_uq", "create index remboursement_decisions_tete_uq"]] },
  { suite: "sql", nom: "S12. chapchap accepté pour un paiement qui n'est pas Chap Chap Pay", fichier: SQL, edits: [["check (moyen <> 'chapchap' or mode_paiement_origine = 'chapchap')", "check (true)"]] },
  { suite: "sql", nom: "S13. code marchand : la reconnaissance n'est plus exigée par la base", fichier: SQL, edits: [["    and (mode_paiement_origine <> 'code_marchand' or argent_chez_restaurant_reconnu)", "    and true"]] },
  { suite: "sql", nom: "S14. le changement de réglage n'exige plus ni auteur ni motif", fichier: SQL, edits: [["    if new.mis_a_jour_par is null or new.dernier_motif is null then", "    if false then"]] },
  { suite: "sql", nom: "S15. le changement de réglage n'est plus journalisé", fichier: SQL, edits: [["    insert into public.parametres_remboursement_journal (reglage, ancienne_valeur, nouvelle_valeur, motif, change_par)\n      values", "    perform 1; -- journal retiré\n    if false then insert into public.parametres_remboursement_journal (reglage, ancienne_valeur, nouvelle_valeur, motif, change_par)\n      values"], ["new.dernier_motif, new.mis_a_jour_par);\n    new.mis_a_jour_le := now();", "new.dernier_motif, new.mis_a_jour_par); end if;\n    new.mis_a_jour_le := now();"]] },
  { suite: "sql", nom: "S16. la RLS du réglage est désactivée", fichier: SQL, edits: [["alter table public.parametres_remboursement enable row level security;", "alter table public.parametres_remboursement disable row level security;"]] },
  { suite: "sql", nom: "S17. le journal des réglages peut être réécrit (garde neutralisée)", fichier: SQL, edits: [["for each row execute function public.fn_parametres_remboursement_journal_ajout_seul();", "for each row when (false) execute function public.fn_parametres_remboursement_journal_ajout_seul();"]] },
  { suite: "sql", nom: "S18. un remboursement peut pointer vers une décision inexistante (clé étrangère retirée)", fichier: SQL, edits: [["add column decision_id uuid references public.remboursement_decisions (id) on delete restrict;", "add column decision_id uuid;"]] },
].filter((m) => m.edits.length > 0); // garde-fou : une entrée sans modification serait une fausse mutation

// ---------------------------------------------------------------------------------------------------------------------------------
const fichiers = [...new Set(mutations.map((m) => m.fichier))];
const originaux = new Map(fichiers.map((f) => [f, readFileSync(f)]));
const restaurer = () => {
  for (const [f, octets] of originaux) writeFileSync(f, octets);
};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restaurer();
    process.exit(1);
  });
}

function appliquer(octets, edits, nom) {
  let courant = octets;
  for (const [cible, remplace] of edits) {
    let c = Buffer.from(cible);
    if (courant.indexOf(c) < 0 && cible.includes("\n")) c = Buffer.from(cible.replace(/\n/g, "\r\n"));
    const debut = courant.indexOf(c);
    if (debut < 0 || courant.indexOf(c, debut + 1) >= 0) throw new Error(`CIBLE_ABSENTE_OU_NON_UNIQUE : ${nom} : ${cible.slice(0, 80)}`);
    const crlf = c.includes("\r\n");
    courant = Buffer.concat([courant.subarray(0, debut), Buffer.from(crlf ? remplace.replace(/\r?\n/g, "\r\n") : remplace), courant.subarray(debut + c.length)]);
  }
  return courant;
}

// Sources TypeScript copiées pour les tests purs (les tests qui LISENT les sources le font dans le dépôt, via SPEEDFOOD_RACINE).
const SOURCES = [
  `${EN}litiges.ts`,
  `${EN}types.ts`,
  "src/lib/system-admin/permissions.ts",
  `${EN}remboursement-decision.ts`,
  `${EN}remboursement-decision-service.ts`,
  `${EN}remboursement-dossier.ts`,
  `${EN}remboursement-dossier-assemblage.ts`,
];
const TESTS = ["remboursement-decision", "remboursement-decision-service", "remboursement-dossier"];

function lancerUnit() {
  const tmp = mkdtempSync(join(tmpdir(), "speedfood-r2-mut-"));
  try {
    const copier = creerCopieur({ tmp, racine, paquets: { "zod/mini": import.meta.resolve("zod/mini") } });
    for (const s of SOURCES) copier(s);
    for (const t of TESTS) copier(`scripts/tests/${t}.test.mts`);
    const echecs = [];
    for (const t of TESTS) {
      const r = spawnSync(process.execPath, [join(tmp, `scripts/tests/${t}.test.mts`)], { encoding: "utf8", env: { ...process.env, SPEEDFOOD_RACINE: racine }, timeout: 120000 });
      if (r.status !== 0) echecs.push(`${t} (code ${r.status})`);
    }
    return echecs;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function lancerSql() {
  const r = spawnSync(process.execPath, [join(racine, "scripts", "tests", "cloisonnement.mjs")], { encoding: "utf8", timeout: 400000, maxBuffer: 64 * 1024 * 1024 });
  const sortie = `${r.stdout}\n${r.stderr}`;
  if (/ECHEC migration/.test(sortie)) return { invalide: true, echecs: [] };
  const echecs = [...sortie.matchAll(/^ECHEC (.+)$/gm)].map((m) => m[1]);
  return { invalide: false, echecs: r.status === 0 ? [] : echecs.length ? echecs : [`sortie en erreur (code ${r.status})`] };
}

const filtre = process.argv.includes("--unit") ? "unit" : process.argv.includes("--sql") ? "sql" : null;
const aJouer = mutations.filter((m) => filtre === null || m.suite === filtre);
let survivantes = 0;
let invalides = 0;
try {
  // Référence : tout doit passer AVANT de muter, sinon une « détection » ne prouverait rien.
  if (filtre !== "sql") {
    const base = lancerUnit();
    if (base.length) throw new Error(`REFERENCE_UNIT_ROUGE : ${base.join(", ")}`);
    console.log("Référence tests purs : verte");
  }
  if (filtre !== "unit") {
    const base = lancerSql();
    if (base.invalide || base.echecs.length) throw new Error(`REFERENCE_SQL_ROUGE : ${base.echecs.join(" | ")}`);
    console.log("Référence cloisonnement : verte");
  }
  // Toutes les mutations sont préparées AVANT la première écriture (une cible introuvable ne laisse rien de modifié).
  const plans = aJouer.map((m) => ({ m, octets: appliquer(originaux.get(m.fichier), m.edits, m.nom) }));
  for (const { m, octets } of plans) {
    writeFileSync(m.fichier, octets);
    try {
      const resultat = m.suite === "unit" ? { invalide: false, echecs: lancerUnit() } : lancerSql();
      if (resultat.invalide) {
        invalides += 1;
        console.log(`INVALIDE   ${m.nom} (la migration mutée ne se rejoue pas : mutation à corriger)`);
      } else if (resultat.echecs.length === 0) {
        survivantes += 1;
        console.log(`SURVIVANTE ${m.nom}`);
      } else {
        console.log(`détectée   ${m.nom}  <- ${resultat.echecs[0].slice(0, 110)}`);
      }
    } finally {
      writeFileSync(m.fichier, originaux.get(m.fichier));
    }
  }
} finally {
  restaurer();
}

// Vérification finale : chaque source est revenue octet pour octet.
let identique = true;
for (const [f, octets] of originaux) if (!readFileSync(f).equals(octets)) identique = false;
console.log(`\n${aJouer.length} mutations jouées, ${aJouer.length - survivantes - invalides} détectées, ${survivantes} survivante(s), ${invalides} invalide(s). Sources restaurées octet pour octet : ${identique ? "oui" : "NON"}.`);
process.exit(survivantes === 0 && invalides === 0 && identique ? 0 : 1);
