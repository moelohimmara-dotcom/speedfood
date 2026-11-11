import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decider } from "../../src/lib/paiement/en-ligne/litiges";
import { assemblerDossier, cibleDeDecision, litigeRetenu, regleAutomatiqueDe, totalCommande, type BrutDossier } from "../../src/lib/paiement/en-ligne/remboursement-dossier-assemblage";
import { categorieActeur, dateTexte, dossierEnMarkdown, dossierEnSections, montantTexte, type DossierDonnees } from "../../src/lib/paiement/en-ligne/remboursement-dossier";
import type { DecisionEnregistree } from "../../src/lib/paiement/en-ligne/remboursement-decision-service";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const lire = (rel: string) => readFileSync(join(racine, rel), "utf8");

// ---------------------------------------------------------------------------------------------------------------- données d'essai
const decision = (id: string, remplaceId: string | null, decideLe: string, extra: Partial<DecisionEnregistree> = {}): DecisionEnregistree => ({
  id,
  orderId: "ordre-1",
  paiementId: "paiement-1",
  litigeId: "litige-1",
  modeOrigine: "chapchap",
  issue: "rembourser_total",
  moyen: "mobile_money_manuel",
  montantGnf: 30_000,
  motif: "Annulation par le restaurant",
  referenceAvis: null,
  ecartRegle: "conforme",
  regleAutomatique: "restaurant_refuse_ou_annule",
  argentChezRestaurantReconnu: false,
  remplaceId,
  decideParId: "11111111-2222-4333-8444-555555555555",
  decideLe,
  ...extra,
});

const brutEnLigne = (): BrutDossier => ({
  commande: {
    id: "ordre-1",
    reference: "SF-REF01",
    restaurantNom: "Chez Fatou",
    mode: "livraison",
    statut: "annulee",
    sousTotalGnf: 25_000,
    fraisLivraisonGnf: 5_000,
    modePaiement: "speedfood",
    statutPaiement: "non_demande",
    paiementDeclareLe: null,
    paiementRecuLe: null,
    creeLe: "2026-11-09T10:00:00.000Z",
  },
  evenements: [
    { de: "acceptee", vers: "annulee", acteur: "restaurant:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", le: "2026-11-09T11:00:00.000Z" },
    { de: null, vers: "en_attente", acteur: "client:SF-ABCDE", le: "2026-11-09T10:00:00.000Z" },
    { de: "en_attente", vers: "acceptee", acteur: "restaurant:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", le: "2026-11-09T10:05:00.000Z" },
  ],
  paiement: {
    id: "paiement-1",
    fournisseur: "chapchap",
    operateur: "orange_money",
    etat: "en_litige",
    repasGnf: 25_000,
    fraisLivraisonGnf: 5_000,
    totalGnf: 30_000,
    restaurantGnf: 23_500,
    livreurGnf: 5_000,
    speedfoodBrutGnf: 1_500,
    fraisPrestataireGnf: 800,
    rembourseGnf: 0,
    creeLe: "2026-11-09T10:10:00.000Z",
    confirmeLe: "2026-11-09T10:12:00.000Z",
    libereLe: null,
  },
  versements: [],
  litiges: [
    { id: "litige-0", situation: "client_injoignable", etat: "clos", ouvertPar: "systeme", montantDemandeGnf: null, preuveDeclaree: false, decision: "aucun_remboursement", regle: "client_injoignable", remboursementGnf: 0, creeLe: "2026-11-08T10:00:00.000Z", closLe: "2026-11-08T11:00:00.000Z", motifClotureRenseigne: true },
    { id: "litige-1", situation: "restaurant_refuse_ou_annule", etat: "a_humain", ouvertPar: "systeme", montantDemandeGnf: null, preuveDeclaree: false, decision: "rembourser_total", regle: "restaurant_refuse_ou_annule", remboursementGnf: null, creeLe: "2026-11-09T11:01:00.000Z", closLe: null, motifClotureRenseigne: false },
  ],
  livraison: { mode: "speedfood", statut: "annulee", assigneeLe: "2026-11-09T10:30:00.000Z", recupereeLe: null, livreeLe: null, essaisCode: 0, raisonRenseignee: true },
  remboursementManuel: null,
  decisions: [],
  reglages: { plafondRemboursementAutoPermille: 300, seuilLitigeHumainGnf: 50_000 },
});

const brutMarchand = (): BrutDossier => ({
  ...brutEnLigne(),
  commande: { ...brutEnLigne().commande, modePaiement: "orange_money", statutPaiement: "recu", paiementDeclareLe: "2026-11-09T10:20:00.000Z", paiementRecuLe: "2026-11-09T10:25:00.000Z" },
  paiement: null,
  versements: [],
  litiges: [],
  livraison: null,
});

// ---------------------------------------------------------------------------------------------------------------- formats
verifier("montant lisible en GNF entiers", [montantTexte(25_000), montantTexte(0), montantTexte(1_234_567)], ["25 000 GNF", "0 GNF", "1 234 567 GNF"]);
verifier("date stable en UTC", dateTexte("2026-11-10T14:32:00.000Z"), "2026-11-10 14:32 UTC");
verifier("date absente ou illisible", [dateTexte(null), dateTexte("pas une date")], ["—", "date inconnue"]);
verifier("acteur : seule la catégorie est gardée", [categorieActeur("client:SF-ABCDE"), categorieActeur("restaurant:abc"), categorieActeur("systeme"), categorieActeur("livreur:x")], ["client", "restaurant", "systeme", "autre"]);

// ---------------------------------------------------------------------------------------------------------------- règle automatique : réutilisée, pas recalculée
{
  const b = brutEnLigne();
  const attendu = decider({ situation: "restaurant_refuse_ou_annule", repasGnf: 25_000, fraisLivraisonGnf: 5_000, montantDemandeGnf: undefined, commandeRecupereeParLivreur: false, preuveFournie: false });
  verifier("la règle du dossier est celle de `decider` (litige en attente retenu)", regleAutomatiqueDe(b), attendu);
  verifier("le litige retenu est celui qui attend une décision, pas le plus récent clos", litigeRetenu(b.litiges)?.id, "litige-1");
  verifier("sans litige ouvert, le plus récent est retenu", litigeRetenu([{ etat: "clos", creeLe: "2026-01-01" }, { etat: "clos", creeLe: "2026-02-01" }])?.creeLe, "2026-02-01");
  verifier("sans litige : aucune règle", litigeRetenu([]), null);
  const apres = brutEnLigne();
  apres.litiges = [{ ...apres.litiges[1]!, situation: "livreur_ne_livre_pas" }];
  apres.livraison = { ...apres.livraison!, recupereeLe: "2026-11-09T10:50:00.000Z", statut: "echec" };
  verifier("livreur : « déjà récupérée » vient de la livraison", regleAutomatiqueDe(apres), decider({ situation: "livreur_ne_livre_pas", repasGnf: 25_000, fraisLivraisonGnf: 5_000, commandeRecupereeParLivreur: true }));
  const plat = brutEnLigne();
  plat.litiges = [{ ...plat.litiges[1]!, situation: "plat_manquant_ou_errone", montantDemandeGnf: 5_000, preuveDeclaree: true }];
  verifier("plat manquant : le montant demandé et la preuve viennent du litige", regleAutomatiqueDe(plat)?.decision, "rembourser_partiel");
  const seuil = brutEnLigne();
  seuil.litiges = [{ ...seuil.litiges[1]!, situation: "plat_manquant_ou_errone", montantDemandeGnf: 5_000, preuveDeclaree: true }];
  seuil.reglages = { plafondRemboursementAutoPermille: 100, seuilLitigeHumainGnf: 50_000 };
  verifier("les réglages courants (plafond) sont passés à la règle", regleAutomatiqueDe(seuil)?.decision, "humain");
  verifier("code marchand : aucune règle automatique", regleAutomatiqueDe(brutMarchand()), null);
}

// ---------------------------------------------------------------------------------------------------------------- cible d'une décision (lue par le serveur)
{
  const c = cibleDeDecision(brutEnLigne());
  verifier("cible en ligne : total du paiement, paiement et litige retenus", c && { total: c.totalGnf, p: c.paiementId, l: c.litigeId, m: c.modeOrigine }, { total: 30_000, p: "paiement-1", l: "litige-1", m: "chapchap" });
  const m = cibleDeDecision(brutMarchand());
  verifier("cible code marchand : total = repas + livraison, pas de paiement ni de litige", m && { total: m.totalGnf, p: m.paiementId, l: m.litigeId, mode: m.modeOrigine, regle: m.regleAutomatique }, { total: 30_000, p: null, l: null, mode: "code_marchand", regle: null });
  const rien = brutMarchand();
  rien.commande.modePaiement = null;
  verifier("rien payé : pas de cible", cibleDeDecision(rien), null);
  const ancien = brutMarchand();
  ancien.commande.modePaiement = "especes";
  verifier("ancien mode espèces : pas de cible dans le système", cibleDeDecision(ancien), null);
  const simulation = brutEnLigne();
  simulation.paiement = { ...simulation.paiement!, fournisseur: "simulation" };
  verifier("démonstration : mode d'origine « simulation »", cibleDeDecision(simulation)?.modeOrigine, "simulation");
  verifier("total d'une commande en ligne : celui du paiement", totalCommande(brutEnLigne()), 30_000);
}

// ---------------------------------------------------------------------------------------------------------------- dossier et export
{
  const b = brutEnLigne();
  b.decisions = [
    decision("dec-2", "dec-1", "2026-11-12T09:00:00.000Z", { issue: "ne_pas_rembourser", moyen: "aucun", montantGnf: 0, ecartRegle: "ecart", referenceAvis: "Avis du conseil du 12 novembre, point 4", motif: "Avis reçu.\nPas de remboursement | cas particulier" }),
    decision("dec-1", null, "2026-11-11T09:00:00.000Z"),
  ];
  b.remboursementManuel = null;
  const d = assemblerDossier(b, "2026-11-12T10:00:00.000Z", false)!;
  verifier("dossier : les décisions sont classées de la plus ancienne à la plus récente", d.decisions.map((x) => x.id), ["dec-1", "dec-2"]);
  verifier("dossier : seule la plus récente est en vigueur", d.decisions.map((x) => x.remplacee), [true, false]);
  verifier("dossier : la règle automatique est portée", d.regleAutomatique?.decision, "rembourser_total");
  verifier("dossier : pas de remboursement exécuté", d.remboursementExecute, null);
  verifier("dossier : changements de statut classés par date", d.commande.historique.map((e) => e.vers), ["en_attente", "acceptee", "annulee"]);

  const md = dossierEnMarkdown(d);
  verifier("export : le numéro de commande", md.includes("SF-REF01"), true);
  verifier("export : les montants en GNF entiers", md.includes("25 000 GNF") && md.includes("30 000 GNF") && md.includes("5 000 GNF"), true);
  verifier("export : les statuts et les dates", md.includes("annulée") && md.includes("2026-11-09 11:00 UTC"), true);
  verifier("export : le mode de paiement d'origine", md.includes("Paiement en ligne (Chap Chap Pay)"), true);
  verifier("export : la règle automatique « à titre indicatif »", md.includes("à titre indicatif") && md.includes("rembourser en totalité"), true);
  verifier("export : la référence de l'avis juridique", md.includes("Avis du conseil du 12 novembre, point 4"), true);
  verifier("export : les deux décisions, la première marquée remplacée", md.includes("Décision 1 (remplacée par une décision plus récente)") && md.includes("Décision 2 (décision en vigueur)"), true);
  verifier("export : le motif libre tient sur une ligne, sans barre verticale", md.includes("Motif : Avis reçu. Pas de remboursement / cas particulier") || md.includes("Motif : Avis reçu. Pas de remboursement cas particulier"), true);
  verifier("export : « ce n'est pas un avis juridique »", md.includes("n'est pas un avis juridique"), true);
  verifier("export : aucun remboursement exécuté, dit clairement", md.includes("Non : aucun remboursement n'a été exécuté"), true);
  verifier("export : l'acteur n'est qu'une catégorie", md.includes("(par : restaurant)") && md.includes("(par : client)"), true);
  verifier("export : ni l'identifiant du membre du restaurant ni la référence du client", !md.includes("aaaaaaaa-bbbb") && !md.includes("SF-ABCDE"), true);
  verifier("export : ni l'identifiant du compte auteur de la décision", !md.includes("11111111-2222"), true);
  verifier("export : les textes libres du livreur ne sont pas repris, leur présence oui", md.includes("Raison d'échec ou d'annulation renseignée : oui (texte non repris)"), true);
  verifier("export : les sections sont numérotées dans l'ordre", ["## 1. Situation", "## 2. Mode de paiement d'origine", "## 3. Preuves existantes", "## 4. Ce que la règle", "## 5. Décisions humaines", "## 6. Remboursement exécuté"].every((t, i, tous) => md.includes(t) && (i === 0 || md.indexOf(t) > md.indexOf(tous[i - 1]!))), true);

  // L'export ne peut pas fuiter ce qui n'est pas dans `DossierDonnees` : on le prouve en y glissant, de force, des champs interdits.
  const piege = {
    ...d,
    client: { nom: "Mamadou Diallo", telephone: "622123456", adresse: "Kaloum, rue KA-012" },
    commande: { ...d.commande, client_nom: "Mamadou Diallo", client_telephone: "622123456", client_adresse: "Kaloum, rue KA-012", jeton_suivi: "JETON-SECRET-XYZ" },
    paiement: { ...d.paiement!, numero: "+224620000001", referenceExterne: "CCP-EXTERNE-777" },
    livraison: { ...d.livraison!, codeRemise: "4821", livreurNom: "Ibrahima Barry", raison: "Client Mamadou ne répond pas au 622123456" },
  } as unknown as DossierDonnees;
  const mdPiege = dossierEnMarkdown(piege);
  verifier("export : aucun nom, téléphone, adresse, jeton, numéro, code de remise ni texte libre même si présents dans l'objet", ["Mamadou", "622123456", "Kaloum", "JETON-SECRET", "+224620000001", "CCP-EXTERNE", "4821", "Ibrahima", "ne répond pas"].filter((x) => mdPiege.includes(x)), []);
  verifier("export : l'export du dossier piégé est identique à celui du dossier propre", mdPiege, md);

  // Écran et export affichent les mêmes lignes.
  const sections = dossierEnSections(d);
  verifier("sections : six sections dans l'ordre", sections.map((s) => s.id), ["situation", "paiement", "preuves", "regle", "decisions", "execution"]);
  verifier("sections : chaque ligne de l'écran est dans l'export", sections.every((s) => s.lignes.every((l) => md.includes(`- ${l}`))), true);
  verifier("sections : pas d'avertissement hors code marchand", sections.every((s) => s.avertissement === undefined), true);
}

{
  const b = brutEnLigne();
  b.paiement = { ...b.paiement!, etat: "rembourse", rembourseGnf: 30_000 };
  b.remboursementManuel = { moyen: "orange_money", montantGnf: 30_000, referenceRenseignee: true, decisionId: "dec-1", le: "2026-11-12T12:00:00.000Z" };
  b.decisions = [decision("dec-1", null, "2026-11-11T09:00:00.000Z")];
  const md = dossierEnMarkdown(assemblerDossier(b, "2026-11-12T13:00:00.000Z", true)!);
  verifier("remboursement exécuté : moyen, montant, date, lien à la décision", md.includes("Oui : 30 000 GNF par Orange Money le 2026-11-12 12:00 UTC") && md.includes("Lié à une décision enregistrée : oui"), true);
  verifier("remboursement exécuté : la référence de la transaction n'est pas reprise", md.includes("référence de la transaction renseignée : oui"), true);
  verifier("réglage espèces affiché dans le dossier", md.includes("Remboursement en espèces autorisé dans les réglages de la plateforme : oui"), true);
  const auto = brutEnLigne();
  auto.paiement = { ...auto.paiement!, etat: "rembourse", rembourseGnf: 30_000 };
  verifier("remboursé par le prestataire : exécuté, sans lien de décision", assemblerDossier(auto, "2026-11-12T13:00:00.000Z", false)!.remboursementExecute?.moyen, "prestataire");
}

{
  const d = assemblerDossier(brutMarchand(), "2026-11-12T10:00:00.000Z", false)!;
  const md = dossierEnMarkdown(d);
  const sections = dossierEnSections(d);
  verifier("code marchand : avertissement « l'argent est chez le restaurant » dans la section paiement", sections.find((s) => s.id === "paiement")?.avertissement?.includes("chez le restaurant") ?? false, true);
  verifier("code marchand : l'avertissement figure dans l'export", md.includes("**Attention : Le client a payé directement le restaurant."), true);
  verifier("code marchand : remboursement non vérifiable", md.includes("Non vérifiable"), true);
  verifier("code marchand : aucune règle automatique applicable", md.includes("Aucune règle automatique applicable"), true);
  verifier("code marchand : la référence de transaction déclarée n'est pas reprise", /référence/i.test(sections.find((s) => s.id === "paiement")!.lignes.join(" ")), false);
  verifier("code marchand : aucune livraison enregistrée dite clairement", md.includes("aucune livraison enregistrée"), true);
}

// ---------------------------------------------------------------------------------------------------------------- confidentialité des lectures (sources)
const lecture = lire("src/lib/paiement/en-ligne/remboursement-lecture.ts");
const selects = [...lecture.matchAll(/\.select\(\s*(?:"([^"]*)"|(COLONNES_[A-Z]+))/g)].map((m) => m[1] ?? m[2] ?? "");
const colonnes = [...lecture.matchAll(/(?:const COLONNES_[A-Z]+\s*=\s*\n?\s*)"([^"]*)"/g)].map((m) => m[1]!);
const toutesColonnes = [...selects, ...colonnes].join(" ");
verifier("lecture : au moins six requêtes de lecture examinées", selects.length >= 6, true);
verifier("lecture : aucune colonne de coordonnées, de jeton, de code ou de numéro n'est demandée", ["client_nom", "client_telephone", "client_adresse", "jeton_suivi", "jeton_recu", "paiement_reference", "numero", "livraison_codes", "titulaire_nom", "latitude", "longitude"].filter((c) => toutesColonnes.includes(c)), []);
verifier("lecture : la table des codes de remise n'est jamais lue", lecture.includes("livraison_codes"), false);
verifier("lecture : les comptes de versement ne sont jamais lus", lecture.includes("comptes_versement"), false);
verifier("lecture : fichier réservé au serveur", lecture.startsWith('import "server-only"'), true);

// ---------------------------------------------------------------------------------------------------------------- accès à la page et à l'export (sources)
const exportRoute = lire("src/app/system/paiements/dossier/[id]/export/route.ts");
verifier("export : réservé à « commande.support », sinon 404", /roleAPermission\(systeme\.role, "commande\.support"\)\) return new Response\(null, \{ status: 404 \}\)/.test(exportRoute), true);
verifier("export : sans session système, 404", /!systeme \|\| /.test(exportRoute), true);
verifier("export : identifiant invalide, 404", /!estUuid\(id\)\) return new Response\(null, \{ status: 404 \}\)/.test(exportRoute), true);
verifier("export : jamais mis en cache", exportRoute.includes('"cache-control": "no-store"'), true);
verifier("export : généré par le serveur à partir du dossier", exportRoute.includes("dossierEnMarkdown(dossier)"), true);
const page = lire("src/app/system/paiements/dossier/[id]/page.tsx");
verifier("page du dossier : permission « commande.support » exigée", page.includes('exigerPermissionPage("commande.support")'), true);
verifier("page du dossier : le formulaire n'est montré qu'avec « parametres.editer »", /roleAPermission\(contexte\.role, "parametres\.editer"\)/.test(page) && /peutDecider \?/.test(page), true);
verifier("page du dossier : les lignes viennent de dossierEnSections (même texte que l'export)", page.includes("dossierEnSections(dossier)"), true);
const formulaire = lire("src/app/system/paiements/dossier/[id]/FormulaireDecision.tsx");
verifier("formulaire : la liste des moyens vient de la fonction pure", formulaire.includes("moyensDisponibles({ modeOrigine, especesAutorise, issue })"), true);
verifier("formulaire : confirmation avant d'enregistrer", formulaire.includes("Oui, enregistrer") && formulaire.includes("Aucun argent ne bouge à cette étape"), true);
verifier("formulaire : la case de reconnaissance du code marchand", formulaire.includes("l'argent est chez le restaurant") || formulaire.includes("l&apos;argent est chez le restaurant"), true);
verifier("formulaire : aucun appel à une action d'argent", /trancherLitigeAction|rembourserALaMainAction|reprendreVersementsAction/.test(formulaire), false);

// ---------------------------------------------------------------------------------------------------------------- migration (source) : le fichier existe, rien n'est appliqué par ces tests
const sql = lire("../../supabase/migrations/20261110120000_remboursement_decisions.sql");
verifier("migration : réglage espèces faux par défaut", /remboursement_especes_autorise boolean not null default false/.test(sql), true);
verifier("migration : RLS activée sur les trois tables", (sql.match(/enable row level security/g) ?? []).length, 3);
verifier("migration : toutes les policies sont `to authenticated` et réservées au super administrateur", (sql.match(/create policy [^;]*for select to authenticated using \(public\.fn_est_admin_systeme\(array\['super_admin'\]\)\)/g) ?? []).length, 3);
verifier("migration : aucune policy sans restriction de rôle", /create policy [^;]*for (all|insert|update|delete)/.test(sql), false);
verifier("migration : aucune fonction SECURITY DEFINER", /security definer/i.test(sql), false);
verifier("migration : triggers d'ajout seul sur les décisions et le journal", /trg_remboursement_decisions_ajout_seul/.test(sql) && /trg_parametres_remboursement_journal_ajout_seul/.test(sql), true);
verifier("migration : montants entiers", /montant_gnf integer not null/.test(sql) && !/numeric|float|double|real\b/.test(sql), true);

if (ko > 0) {
  console.log(`ECHEC remboursement-dossier : ${ko} verification(s) en echec`);
  process.exit(1);
}
console.log("OK remboursement-dossier");
