import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decider, REGLES_LITIGES_SIMULATION } from "../../src/lib/paiement/en-ligne/litiges";
import {
  AVERTISSEMENT_CODE_MARCHAND,
  CHAPCHAP_SAIT_REMBOURSER,
  ISSUES_DECISION,
  MODES_ORIGINE,
  MOYENS_DECISION,
  avisObligatoire,
  comparerALaRegle,
  modeOrigineDe,
  moyensDisponibles,
  validerDecision,
  verifierExecutionAutorisee,
  type ContexteDecision,
  type SaisieDecision,
} from "../../src/lib/paiement/en-ligne/remboursement-decision";

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

// ---------------------------------------------------------------------------------------------------------------- valeurs fermées
verifier("issues fermées", [...ISSUES_DECISION], ["rembourser_total", "rembourser_partiel", "ne_pas_rembourser"]);
verifier("moyens fermés, dont chapchap réservé", [...MOYENS_DECISION], ["chapchap", "mobile_money_manuel", "especes_dernier_recours", "aucun"]);
verifier("modes d'origine fermés", [...MODES_ORIGINE], ["chapchap", "simulation", "code_marchand"]);
verifier("Chap Chap Pay ne sait pas rembourser (aucun endpoint documenté)", CHAPCHAP_SAIT_REMBOURSER, false);

// ---------------------------------------------------------------------------------------------------------------- mode d'origine
verifier("mode d'origine : paiement en ligne Chap Chap Pay", modeOrigineDe({ fournisseurPaiement: "chapchap", modePaiementCommande: "speedfood" }), "chapchap");
verifier("mode d'origine : paiement de démonstration", modeOrigineDe({ fournisseurPaiement: "simulation", modePaiementCommande: "speedfood" }), "simulation");
verifier("mode d'origine : code marchand Orange Money", modeOrigineDe({ fournisseurPaiement: null, modePaiementCommande: "orange_money" }), "code_marchand");
verifier("mode d'origine : code marchand MTN MoMo", modeOrigineDe({ fournisseurPaiement: null, modePaiementCommande: "mtn_momo" }), "code_marchand");
verifier("mode d'origine : ancien mode espèces = aucun paiement à rembourser dans le système", modeOrigineDe({ fournisseurPaiement: null, modePaiementCommande: "especes" }), null);
verifier("mode d'origine : rien payé", modeOrigineDe({ fournisseurPaiement: null, modePaiementCommande: null }), null);
verifier("mode d'origine : fournisseur inconnu refusé", modeOrigineDe({ fournisseurPaiement: "autre", modePaiementCommande: "orange_money" }), null);

// ---------------------------------------------------------------------------------------------------------------- moyens disponibles (fonction pure)
const dispo = (e: Parameters<typeof moyensDisponibles>[0]) => Object.fromEntries(moyensDisponibles(e).map((m) => [m.moyen, m.disponible]));
verifier("moyens, Chap Chap Pay, espèces fermées : mobile money et aucun seulement", dispo({ modeOrigine: "chapchap", especesAutorise: false }), { chapchap: false, mobile_money_manuel: true, especes_dernier_recours: false, aucun: true });
verifier("moyens, espèces autorisées par le réglage", dispo({ modeOrigine: "chapchap", especesAutorise: true }).especes_dernier_recours, true);
const chapchapRefuse = moyensDisponibles({ modeOrigine: "chapchap", especesAutorise: true }).find((m) => m.moyen === "chapchap");
verifier("chapchap : refus clair « non disponible »", chapchapRefuse?.raison?.startsWith("Non disponible") ?? false, true);
verifier("chapchap : jamais simulé, même avec les espèces ouvertes", chapchapRefuse?.disponible, false);
verifier("chapchap utilisable le jour où le système sait rembourser (paramètre de test)", dispo({ modeOrigine: "chapchap", especesAutorise: false, chapchapSaitRembourser: true }).chapchap, true);
verifier("chapchap : jamais pour un paiement de démonstration", dispo({ modeOrigine: "simulation", especesAutorise: false, chapchapSaitRembourser: true }).chapchap, false);
verifier("chapchap : jamais pour un paiement par code marchand", dispo({ modeOrigine: "code_marchand", especesAutorise: false, chapchapSaitRembourser: true }).chapchap, false);
verifier("code marchand : avertissement porté par les moyens de remboursement", moyensDisponibles({ modeOrigine: "code_marchand", especesAutorise: false }).find((m) => m.moyen === "mobile_money_manuel")?.avertissement, AVERTISSEMENT_CODE_MARCHAND);
verifier("hors code marchand : aucun avertissement", moyensDisponibles({ modeOrigine: "chapchap", especesAutorise: false }).every((m) => m.avertissement === null), true);
verifier("issue « ne pas rembourser » : seul « aucun » est possible", dispo({ modeOrigine: "chapchap", especesAutorise: true, issue: "ne_pas_rembourser", chapchapSaitRembourser: true }), { chapchap: false, mobile_money_manuel: false, especes_dernier_recours: false, aucun: true });
verifier("issue remboursement : « aucun » n'est pas possible", dispo({ modeOrigine: "chapchap", especesAutorise: true, issue: "rembourser_total" }).aucun, false);
verifier("toute indisponibilité a une raison", moyensDisponibles({ modeOrigine: "code_marchand", especesAutorise: false, issue: "rembourser_total" }).every((m) => m.disponible || (m.raison ?? "").length > 0), true);

// ---------------------------------------------------------------------------------------------------------------- comparaison avec la règle automatique
const regleTotal = decider({ situation: "restaurant_refuse_ou_annule", repasGnf: 25_000, fraisLivraisonGnf: 5_000 });
const regleAucun = decider({ situation: "client_injoignable", repasGnf: 25_000, fraisLivraisonGnf: 5_000 });
const reglePartiel = decider({ situation: "plat_manquant_ou_errone", repasGnf: 25_000, fraisLivraisonGnf: 5_000, montantDemandeGnf: 5_000, preuveFournie: true });
const regleHumain = decider({ situation: "contestation_apres_liberation", repasGnf: 25_000, fraisLivraisonGnf: 5_000 });
verifier("comparaison : total / règle total = conforme", comparerALaRegle("rembourser_total", 30_000, regleTotal), "conforme");
verifier("comparaison : aucun / règle total = écart", comparerALaRegle("ne_pas_rembourser", 0, regleTotal), "ecart");
verifier("comparaison : aucun / règle aucun = conforme", comparerALaRegle("ne_pas_rembourser", 0, regleAucun), "conforme");
verifier("comparaison : total / règle aucun = écart", comparerALaRegle("rembourser_total", 30_000, regleAucun), "ecart");
verifier("comparaison : partiel au même montant = conforme", comparerALaRegle("rembourser_partiel", 5_000, reglePartiel), "conforme");
verifier("comparaison : partiel à un autre montant = écart", comparerALaRegle("rembourser_partiel", 6_000, reglePartiel), "ecart");
verifier("comparaison : règle « humain » = aucune règle applicable", comparerALaRegle("rembourser_total", 30_000, regleHumain), "sans_regle");
verifier("comparaison : pas de règle (code marchand) = aucune règle applicable", comparerALaRegle("rembourser_total", 30_000, null), "sans_regle");
verifier("avis facultatif seulement si conforme et moyen ordinaire", [avisObligatoire("conforme", "mobile_money_manuel"), avisObligatoire("conforme", "aucun"), avisObligatoire("conforme", "chapchap")], [false, false, false]);
verifier("avis obligatoire en cas d'écart", avisObligatoire("ecart", "mobile_money_manuel"), true);
verifier("avis obligatoire sans règle applicable", avisObligatoire("sans_regle", "aucun"), true);
verifier("avis obligatoire pour les espèces, même conformes", avisObligatoire("conforme", "especes_dernier_recours"), true);

// ---------------------------------------------------------------------------------------------------------------- les règles automatiques ne sont NI durcies NI assouplies (valeurs figées)
verifier("règles automatiques : valeurs de simulation inchangées", REGLES_LITIGES_SIMULATION, { plafondRemboursementAutoPourMille: 300, seuilHumainGnf: 50_000 });
const figees = [
  decider({ situation: "restaurant_refuse_ou_annule", repasGnf: 25_000, fraisLivraisonGnf: 5_000 }),
  decider({ situation: "livreur_ne_livre_pas", repasGnf: 25_000, fraisLivraisonGnf: 5_000 }),
  decider({ situation: "livreur_ne_livre_pas", repasGnf: 25_000, fraisLivraisonGnf: 5_000, commandeRecupereeParLivreur: true }),
  decider({ situation: "client_injoignable", repasGnf: 25_000, fraisLivraisonGnf: 5_000 }),
  decider({ situation: "plat_manquant_ou_errone", repasGnf: 25_000, fraisLivraisonGnf: 5_000, montantDemandeGnf: 7_500, preuveFournie: true }),
  decider({ situation: "plat_manquant_ou_errone", repasGnf: 25_000, fraisLivraisonGnf: 5_000, montantDemandeGnf: 7_501, preuveFournie: true }),
  decider({ situation: "plat_manquant_ou_errone", repasGnf: 25_000, fraisLivraisonGnf: 5_000, montantDemandeGnf: 5_000, preuveFournie: false }),
  decider({ situation: "plat_manquant_ou_errone", repasGnf: 200_000, fraisLivraisonGnf: 0, montantDemandeGnf: 50_001, preuveFournie: true }),
  decider({ situation: "contestation_apres_liberation", repasGnf: 25_000, fraisLivraisonGnf: 5_000 }),
].map((d) => `${d.decision}|${d.remboursementClientGnf}|${d.restaurantPaye}|${d.livreurPaye}|${d.perteSpeedfoodGnf}|${d.regle}`);
verifier("règles automatiques : conclusions inchangées sur neuf cas", figees, [
  "rembourser_total|30000|false|false|0|restaurant_refuse_ou_annule",
  "rembourser_total|30000|false|false|0|livreur_ne_livre_pas_avant_recuperation",
  "rembourser_total|30000|true|false|25000|livreur_ne_livre_pas_apres_recuperation",
  "aucun_remboursement|0|true|true|0|client_injoignable",
  "rembourser_partiel|7500|true|true|0|plat_manquant_partiel_automatique",
  "humain|0|false|false|0|montant_demande_au_dessus_du_plafond_automatique",
  "humain|0|false|false|0|preuve_absente",
  "humain|0|false|false|0|montant_demande_au_dessus_du_seuil",
  "humain|0|false|false|0|contestation_apres_liberation",
]);

// ---------------------------------------------------------------------------------------------------------------- validation d'une décision
const contexte = (c: Partial<ContexteDecision> = {}): ContexteDecision => ({ totalGnf: 30_000, modeOrigine: "chapchap", regleAutomatique: regleTotal, especesAutorise: false, ...c });
const saisie = (s: Partial<SaisieDecision> = {}): SaisieDecision => ({ issue: "rembourser_total", montantGnf: null, moyen: "mobile_money_manuel", motif: "Le restaurant a annulé après le paiement", referenceAvis: "", reconnaitArgentChezRestaurant: false, ...s });
const erreur = (s: Partial<SaisieDecision>, c: Partial<ContexteDecision> = {}) => {
  const r = validerDecision(saisie(s), contexte(c));
  return r.ok ? null : r.erreur;
};

const conforme = validerDecision(saisie(), contexte());
verifier("décision conforme à la règle, moyen ordinaire : avis facultatif, montant = total du serveur", conforme.ok && conforme.valeur.montantGnf === 30_000 && conforme.valeur.referenceAvis === null && conforme.valeur.ecartRegle === "conforme", true);
verifier("décision conforme : la règle comparée est celle de la règle automatique", conforme.ok && conforme.valeur.regleAutomatique, "restaurant_refuse_ou_annule");
verifier("décision conforme : l'avis peut quand même être renseigné", validerDecision(saisie({ referenceAvis: "  Avis du conseil du 12 novembre  " }), contexte()).ok && (validerDecision(saisie({ referenceAvis: "  Avis du conseil du 12 novembre  " }), contexte()) as { valeur: { referenceAvis: string } }).valeur.referenceAvis === "Avis du conseil du 12 novembre", true);
verifier("écart avec la règle sans avis : refusé", erreur({ issue: "ne_pas_rembourser", moyen: "aucun" })?.includes("référence de l'avis juridique") ?? false, true);
verifier("écart avec la règle, avis fourni : accepté, marqué écart", (() => { const r = validerDecision(saisie({ issue: "ne_pas_rembourser", moyen: "aucun", referenceAvis: "Avis du conseil, point 4" }), contexte()); return r.ok && r.valeur.ecartRegle === "ecart" && r.valeur.montantGnf === 0; })(), true);
verifier("aucune règle applicable sans avis : refusé", erreur({}, { regleAutomatique: null })?.includes("sans règle automatique") ?? false, true);
verifier("règle « humain » sans avis : refusé", erreur({}, { regleAutomatique: regleHumain })?.includes("sans règle automatique") ?? false, true);
verifier("avis trop court : refusé", erreur({ referenceAvis: "avis" })?.includes("trop courte") ?? false, true);
verifier("avis trop long : refusé", erreur({ referenceAvis: "a".repeat(201) })?.includes("trop longue") ?? false, true);

// espèces
verifier("espèces refusées quand le réglage est faux, même avec un avis", erreur({ moyen: "especes_dernier_recours", referenceAvis: "Avis du conseil, point 7" })?.startsWith("Non disponible : le remboursement en espèces est désactivé") ?? false, true);
verifier("espèces autorisées mais sans avis : refusé", erreur({ moyen: "especes_dernier_recours" }, { especesAutorise: true })?.includes("espèces") ?? false, true);
verifier("espèces autorisées avec avis : acceptées", validerDecision(saisie({ moyen: "especes_dernier_recours", referenceAvis: "Avis du conseil, point 7" }), contexte({ especesAutorise: true })).ok, true);

// chap chap pay
verifier("chapchap refusé clairement, jamais simulé", erreur({ moyen: "chapchap", referenceAvis: "Avis du conseil, point 7" })?.startsWith("Non disponible : Chap Chap Pay ne propose pas de remboursement") ?? false, true);
verifier("chapchap refusé aussi quand tout le reste est valide et les espèces ouvertes", erreur({ moyen: "chapchap" }, { especesAutorise: true }) !== null, true);

// valeurs fermées et cohérence issue / moyen
verifier("issue inconnue refusée", erreur({ issue: "tout_rembourser" })?.startsWith("Choisissez l'issue") ?? false, true);
verifier("moyen inconnu refusé", erreur({ moyen: "virement" })?.startsWith("Choisissez le moyen") ?? false, true);
verifier("issue absente refusée", erreur({ issue: undefined })?.startsWith("Choisissez l'issue") ?? false, true);
verifier("remboursement avec le moyen « aucun » refusé", erreur({ moyen: "aucun" })?.includes("Non disponible") ?? false, true);
verifier("« ne pas rembourser » avec un vrai moyen refusé", erreur({ issue: "ne_pas_rembourser", moyen: "mobile_money_manuel", referenceAvis: "Avis du conseil, point 4" })?.includes("Non disponible") ?? false, true);

// montants entiers en GNF
verifier("total : un autre montant que le total payé est refusé", erreur({ montantGnf: 1 })?.startsWith("Un remboursement total est du montant payé") ?? false, true);
verifier("total : montant égal au total toléré", validerDecision(saisie({ montantGnf: 30_000 }), contexte()).ok, true);
const partielConforme = (m: unknown) => validerDecision(saisie({ issue: "rembourser_partiel", montantGnf: m, referenceAvis: "Avis du conseil, point 5" }), contexte());
verifier("partiel : montant entier accepté", partielConforme(5_000).ok, true);
verifier("partiel : montant flottant refusé", (partielConforme(5_000.5) as { erreur?: string }).erreur?.includes("nombre entier") ?? false, true);
verifier("partiel : montant en texte refusé", (partielConforme("5000") as { erreur?: string }).erreur?.includes("nombre entier") ?? false, true);
verifier("partiel : NaN refusé", partielConforme(Number.NaN).ok, false);
verifier("partiel : Infinity refusé", partielConforme(Number.POSITIVE_INFINITY).ok, false);
verifier("partiel : montant absent refusé", partielConforme(null).ok, false);
verifier("partiel : zéro refusé", partielConforme(0).ok, false);
verifier("partiel : négatif refusé", partielConforme(-5).ok, false);
verifier("partiel : égal au total refusé (utiliser « en totalité »)", partielConforme(30_000).ok, false);
verifier("partiel : au-dessus du total refusé", partielConforme(30_001).ok, false);
verifier("partiel : un GNF de moins que le total accepté", partielConforme(29_999).ok, true);
verifier("partiel conforme à la règle automatique (montant identique) : avis facultatif", validerDecision(saisie({ issue: "rembourser_partiel", montantGnf: 5_000 }), contexte({ regleAutomatique: reglePartiel })).ok, true);
verifier("partiel différent du montant de la règle : avis exigé", validerDecision(saisie({ issue: "rembourser_partiel", montantGnf: 6_000 }), contexte({ regleAutomatique: reglePartiel })).ok, false);
verifier("sans remboursement : un montant non nul est refusé", erreur({ issue: "ne_pas_rembourser", moyen: "aucun", montantGnf: 100, referenceAvis: "Avis du conseil, point 4" })?.startsWith("Sans remboursement") ?? false, true);
verifier("total payé inconnu ou nul : refusé", [erreur({}, { totalGnf: 0 }), erreur({}, { totalGnf: 12.5 })].every((e) => e !== null), true);

// code marchand
const marchand = { modeOrigine: "code_marchand" as const, regleAutomatique: null };
verifier("code marchand : la décision doit reconnaître que l'argent est chez le restaurant", erreur({ referenceAvis: "Avis du conseil, point 8" }, marchand)?.includes("chez le restaurant") ?? false, true);
verifier("code marchand : reconnu et avis fourni : accepté, reconnaissance consignée", (() => { const r = validerDecision(saisie({ referenceAvis: "Avis du conseil, point 8", reconnaitArgentChezRestaurant: true }), contexte(marchand)); return r.ok && r.valeur.argentChezRestaurantReconnu === true && r.valeur.regleAutomatique === null; })(), true);
verifier("code marchand : sans règle applicable, l'avis est exigé même reconnu", erreur({ reconnaitArgentChezRestaurant: true }, marchand)?.includes("avis juridique") ?? false, true);
verifier("hors code marchand : la reconnaissance n'est pas consignée", conforme.ok && conforme.valeur.argentChezRestaurantReconnu, false);

// motif
verifier("motif trop court refusé", erreur({ motif: "oui" })?.startsWith("Indiquez le motif") ?? false, true);
verifier("motif absent refusé", erreur({ motif: undefined })?.startsWith("Indiquez le motif") ?? false, true);
verifier("motif trop long refusé", erreur({ motif: "x".repeat(301) })?.startsWith("Le motif est trop long") ?? false, true);

// ---------------------------------------------------------------------------------------------------------------- exécution autorisée par la décision
const dec = (issue: "rembourser_total" | "rembourser_partiel" | "ne_pas_rembourser", moyen: "chapchap" | "mobile_money_manuel" | "especes_dernier_recours" | "aucun") => ({ id: "dec-1", issue, moyen, montantGnf: 30_000 });
const exec = (decision: ReturnType<typeof dec> | null, action: Parameters<typeof verifierExecutionAutorisee>[0]["action"], especesAutorise = false) => verifierExecutionAutorisee({ decision, action, especesAutorise });

verifier("espèces refusées si le réglage est faux, même avec une décision espèces (appel direct)", exec(dec("rembourser_total", "especes_dernier_recours"), { type: "rembourser_manuel", moyenManuel: "especes" }, false).ok, false);
verifier("espèces refusées si le réglage est faux : message clair", (exec(null, { type: "rembourser_manuel", moyenManuel: "especes" }, false) as { erreur: string }).erreur.includes("désactivé"), true);
verifier("espèces sans décision, réglage vrai : refusées", exec(null, { type: "rembourser_manuel", moyenManuel: "especes" }, true).ok, false);
verifier("espèces avec une décision espèces et le réglage vrai : autorisées", exec(dec("rembourser_total", "especes_dernier_recours"), { type: "rembourser_manuel", moyenManuel: "especes" }, true), { ok: true, decisionId: "dec-1" });
verifier("espèces alors que la décision prévoit le mobile money : refusées", exec(dec("rembourser_total", "mobile_money_manuel"), { type: "rembourser_manuel", moyenManuel: "especes" }, true).ok, false);
verifier("mobile money sans décision : le parcours existant reste possible", exec(null, { type: "rembourser_manuel", moyenManuel: "orange_money" }), { ok: true, decisionId: null });
verifier("libérer sans décision : le parcours existant reste possible", exec(null, { type: "liberer" }), { ok: true, decisionId: null });
verifier("mobile money avec la décision mobile money : autorisé et lié", exec(dec("rembourser_total", "mobile_money_manuel"), { type: "rembourser_manuel", moyenManuel: "mtn_momo" }), { ok: true, decisionId: "dec-1" });
verifier("mobile money alors que la décision est « ne pas rembourser » : refusé", exec(dec("ne_pas_rembourser", "aucun"), { type: "rembourser_manuel", moyenManuel: "orange_money" }).ok, false);
verifier("libérer alors que la décision est un remboursement : refusé", exec(dec("rembourser_total", "mobile_money_manuel"), { type: "liberer" }).ok, false);
verifier("libérer avec la décision « ne pas rembourser » : autorisé", exec(dec("ne_pas_rembourser", "aucun"), { type: "liberer" }), { ok: true, decisionId: "dec-1" });
verifier("remboursement partiel : non exécutable dans le système", (exec(dec("rembourser_partiel", "mobile_money_manuel"), { type: "rembourser_manuel", moyenManuel: "orange_money" }) as { erreur: string }).erreur.includes("partiel"), true);
verifier("remboursement par le prestataire : refusé avec le message « non disponible »", (exec(dec("rembourser_total", "chapchap"), { type: "rembourser_prestataire" }) as { erreur: string }).erreur.startsWith("Non disponible"), true);
verifier("remboursement par le prestataire alors que la décision prévoit le mobile money : refusé", exec(dec("rembourser_total", "mobile_money_manuel"), { type: "rembourser_prestataire" }).ok, false);

// ---------------------------------------------------------------------------------------------------------------- liens avec le reste du code (sources)
const chapchap = lire("src/lib/paiement/en-ligne/chapchap.ts");
verifier("l'adaptateur Chap Chap Pay déclare « remboursement: false », comme CHAPCHAP_SAIT_REMBOURSER", /remboursement:\s*false/.test(chapchap) === !CHAPCHAP_SAIT_REMBOURSER, true);
const paiements = lire("src/lib/system-admin/paiements.ts");
verifier("rembourserALaMainAction passe par la garde de décision (moyen manuel)", /gardeDecision\(paiementId, \{ type: "rembourser_manuel", moyenManuel: moyen \}\)/.test(paiements), true);
verifier("trancherLitigeAction passe par la garde de décision (libérer / prestataire)", /gardeDecision\(paiementId, decision === "liberer" \? \{ type: "liberer" \} : \{ type: "rembourser_prestataire" \}\)/.test(paiements), true);
verifier("la garde relit la décision et le réglage côté serveur", /lireDecisionCourante\(orderId\), lireEspecesAutorise\(\)/.test(paiements), true);
verifier("une décision illisible fait refuser l'action", /if \(!lecture\.ok\) return \{ erreur:/.test(paiements), true);
verifier("la garde passe la décision lue à verifierExecutionAutorisee", /verifierExecutionAutorisee\(\{ decision: d \?/.test(paiements), true);
verifier("le remboursement fait à la main garde le lien avec la décision", /decision_id: garde\.decisionId/.test(paiements), true);
verifier("l'ancien chemin « rembourser_manuel » de trancherLitigeAction est fermé", /decision === "rembourser_manuel"\) return \{ erreur: "Pour un remboursement fait à la main/.test(paiements), true);
const actionsPaiement = lire("src/app/system/paiements/ActionsPaiement.tsx");
verifier("l'écran ne propose les espèces que si le réglage est vrai ET que l'on est propriétaire", /m !== "especes" \|\| \(peutEspeces && especesAutorise\)/.test(actionsPaiement), true);
const pagePaiements = lire("src/app/system/paiements/page.tsx");
verifier("la page des paiements lit le réglage côté serveur", /lireEspecesAutorise\(\)/.test(pagePaiements) && /especesAutorise=\{especesAutorise\}/.test(pagePaiements), true);

if (ko > 0) {
  console.log(`ECHEC remboursement-decision : ${ko} verification(s) en echec`);
  process.exit(1);
}
console.log("OK remboursement-decision");
