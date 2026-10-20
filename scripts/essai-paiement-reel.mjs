// Essai de bout en bout du paiement en ligne (fournisseur de DÉMONSTRATION) sur la VRAIE base, avec des commandes de test.
//
// Ce que cet essai prouve et que les tests unitaires ne prouvent pas : que le dépôt Supabase (src/lib/paiement/en-ligne/depot-supabase.ts)
// parle bien à la vraie base (noms de colonnes, droits de la clé de service, contraintes, déclencheurs), du paiement à la libération.
//
// Précautions :
//  - aucun argent réel : la passerelle est celle de la démonstration, sa clé est tirée au hasard POUR CET ESSAI et n'est écrite nulle part ;
//  - l'interrupteur `paiement_en_ligne_actif` de la base n'est PAS touché (il reste éteint) : l'essai le force seulement en mémoire, donc
//    aucun client réel ne voit le paiement en ligne pendant l'essai ;
//  - il n'agit que sur les commandes de test passées en argument (elles doivent être marquées est_test) ;
//  - aucune clé ni aucun numéro n'est affiché.
//
// Usage : node scripts/essai-paiement-reel.mjs <retrait> <livraison> <annulee> <expiree> <restaurant> <livreur>
//   (identifiants des quatre commandes de test, du restaurant de test et du livreur de test ; voir docs/PAIEMENT-ARCHITECTURE.md §13)
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------- environnement (.env.local), sans rien afficher
const fichierEnv = join(racine, ".env.local");
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises (.env.local).");
  process.exit(1);
}
const [CMD_RETRAIT, CMD_LIVRAISON, CMD_ANNULEE, CMD_EXPIREE, RESTO, LIVREUR] = process.argv.slice(2);
if (![CMD_RETRAIT, CMD_LIVRAISON, CMD_ANNULEE, CMD_EXPIREE, RESTO, LIVREUR].every((x) => /^[0-9a-f-]{36}$/.test(x ?? ""))) {
  console.error("Six identifiants attendus : retrait, livraison, annulée, expirée, restaurant, livreur.");
  process.exit(1);
}
// Clé de la démonstration : propre à cet essai, jamais écrite.
process.env.PAIEMENT_SIMULATION_CLE = randomBytes(24).toString("hex");

// ---------------------------------------------------------------- copie des sources vers un dossier temporaire (suffixes .ts, alias @/)
const tmp = mkdtempSync(join(tmpdir(), "speedfood-essai-"));
const paquets = { "@supabase/supabase-js": import.meta.resolve("@supabase/supabase-js") };
function copier(rel) {
  const dest = join(tmp, rel);
  mkdirSync(dirname(dest), { recursive: true });
  const contenu = readFileSync(join(racine, rel), "utf8")
    .replace(/import\s+"server-only";?/g, "")
    .replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"')
    .replace(/from\s+"(@supabase\/supabase-js)"/g, (_, nom) => `from "${paquets[nom]}"`)
    .replace(/from\s+"@\/([^"]+?)(?<!\.ts)"/g, (_, chemin) => {
      const relatif = relative(dirname(dest), join(tmp, "src")).split("\\").join("/");
      return `from "${relatif.startsWith(".") ? relatif : "./" + relatif}/${chemin}.ts"`;
    });
  writeFileSync(dest, contenu);
}
for (const f of ["types", "machine", "repartition", "ecritures", "litiges", "signature", "fournisseur", "simulation", "service", "depot-supabase"]) {
  copier(`src/lib/paiement/en-ligne/${f}.ts`);
}
copier("src/lib/db/admin.ts");
copier("src/lib/livraison/lecture.ts");
copier("src/lib/livraison/frais.ts");

let ko = 0;
function verifier(nom, ok, detail = "") {
  if (!ok) ko++;
  console.log(`${ok ? "OK   " : "ECHEC"} ${nom}${!ok && detail ? "\n       " + detail : ""}`);
}

try {
  const importer = (rel) => import(pathToFileURL(join(tmp, rel)).href);
  const { creerServicePaiement } = await importer("src/lib/paiement/en-ligne/service.ts");
  const { creerPasserelleSimulation } = await importer("src/lib/paiement/en-ligne/simulation.ts");
  const { creerDepotSupabase } = await importer("src/lib/paiement/en-ligne/depot-supabase.ts");
  const { soldes } = await importer("src/lib/paiement/en-ligne/ecritures.ts");
  const { creerClientAdmin } = await importer("src/lib/db/admin.ts");

  const db = creerClientAdmin();
  const brut = creerDepotSupabase(db);
  // L'interrupteur reste ÉTEINT en base ; l'essai le force seulement ici, en mémoire.
  const depot = { ...brut, lireReglages: async () => ({ ...(await brut.lireReglages()), actif: true, fournisseur: "simulation" }) };
  const passerelle = creerPasserelleSimulation({ cle: process.env.PAIEMENT_SIMULATION_CLE });
  const service = creerServicePaiement({ depot, passerelle });

  const lire = async (table, colonnes, filtre) => {
    let q = db.from(table).select(colonnes);
    for (const [k, v] of Object.entries(filtre)) q = q.eq(k, v);
    const { data, error } = await q.limit(50);
    if (error) throw new Error(`${table} : ${error.message}`);
    return data ?? [];
  };
  const commande = async (id) => (await lire("orders", "id, statut, paiement_mode, paiement_statut, paiement_recu_le, est_test", { id }))[0];
  const paiementDe = async (orderId) => (await lire("paiements", "id, etat, total_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, frais_mobile_gnf, reference_externe, rembourse_gnf", { order_id: orderId }))[0];
  const ecrituresDe = async (paiementId) =>
    (await lire("paiement_ecritures", "compte, sens, montant_gnf, cle_idempotence", { paiement_id: paiementId })).map((e) => ({ compte: e.compte, sens: e.sens, montantGnf: e.montant_gnf }));
  const versementsDe = async (paiementId) => lire("paiement_versements", "beneficiaire_type, etat, montant_gnf, numero_masque, tentatives, erreur_code", { paiement_id: paiementId });
  const notifier = (p, id, etat = "succes", montant = null) => {
    const f = passerelle.fabriquerNotification({ identifiant: id, referenceExterne: p.reference_externe, referenceInterne: null, etat, montantGnf: montant ?? p.total_gnf });
    return service.appliquerNotification(f.corps, f.entetes);
  };

  // ------------------------------------------------------------ 0. précondition : seulement des commandes de test, interrupteur éteint
  for (const [nom, id] of [["retrait", CMD_RETRAIT], ["livraison", CMD_LIVRAISON], ["annulée", CMD_ANNULEE], ["expirée", CMD_EXPIREE]]) {
    const c = await commande(id);
    verifier(`commande de test « ${nom} » présente et marquée est_test`, c?.est_test === true && c.statut === "acceptee", JSON.stringify(c));
  }
  const reglagesAvant = (await lire("parametres_paiement", "paiement_en_ligne_actif", {}))[0];
  verifier("interrupteur de la base éteint avant l'essai", reglagesAvant?.paiement_en_ligne_actif === false);
  if (ko > 0) throw new Error("Préconditions non remplies : essai interrompu avant toute écriture.");

  // ------------------------------------------------------------ 1. retrait : ouverture, notification, rejeu, libération
  const o1 = await service.ouvrirPaiement({ orderId: CMD_RETRAIT, operateur: "mtn_momo" });
  verifier("retrait : ouverture acceptée", o1.ok === true, JSON.stringify(o1));
  let p1 = await paiementDe(CMD_RETRAIT);
  verifier("retrait : paiement en attente, 25 000 GNF, restaurant 24 000, Speedfood 1 000, frais mobile 425", p1?.etat === "en_attente" && p1.total_gnf === 25000 && p1.restaurant_gnf === 24000 && p1.livreur_gnf === 0 && p1.speedfood_brut_gnf === 1000 && p1.frais_mobile_gnf === 425, JSON.stringify(p1));
  verifier("retrait : la commande est marquée « paiement en ligne » (déclencheur de la base accepte le serveur)", (await commande(CMD_RETRAIT)).paiement_mode === "speedfood");
  const r1 = await notifier(p1, "essai-retrait-1");
  verifier("retrait : notification de succès appliquée", r1.statut === "applique", JSON.stringify(r1));
  p1 = await paiementDe(CMD_RETRAIT);
  const c1 = await commande(CMD_RETRAIT);
  verifier("retrait : paiement confirmé, commande « reçue » avec date de réception posée par la base", p1.etat === "confirme" && c1.paiement_statut === "recu" && c1.paiement_recu_le !== null, JSON.stringify([p1.etat, c1]));
  const e1 = await ecrituresDe(p1.id);
  verifier("retrait : le livre contient 4 lignes (encaissement et frais mobile)", e1.length === 4, `lignes : ${e1.length}`);
  const rejeu = await notifier(p1, "essai-retrait-1");
  verifier("retrait : la même notification rejouée est reconnue (doublon) et n'écrit rien", rejeu.statut === "doublon" && (await ecrituresDe(p1.id)).length === 4, JSON.stringify(rejeu));
  const rejeu2 = await notifier(p1, "essai-retrait-2");
  verifier("retrait : un succès sous un autre identifiant est sans effet (aucune écriture de plus)", rejeu2.statut === "applique" && (await ecrituresDe(p1.id)).length === 4, JSON.stringify(rejeu2));

  // Comptes de versement de test : un compte non vérifié ne reçoit rien ; vérifié, il reçoit.
  const l1 = await service.surCommandeTerminee(CMD_RETRAIT);
  verifier("retrait : commande terminée → paiement libéré", l1?.ok === true && (await paiementDe(CMD_RETRAIT)).etat === "libere", JSON.stringify(l1));
  const v1 = await versementsDe(p1.id);
  verifier("retrait : un versement au restaurant, de 24 000 GNF, numéro masqué", v1.length === 1 && v1[0].beneficiaire_type === "restaurant" && v1[0].montant_gnf === 24000 && !/\d{6,}/.test(v1[0].numero_masque), JSON.stringify(v1));
  verifier("retrait : versement effectué (compte de test vérifié) en une tentative", v1[0]?.etat === "confirme" && v1[0].tentatives === 1, JSON.stringify(v1));
  const s1 = soldes(await ecrituresDe(p1.id));
  verifier("retrait : fin de cycle, plus rien à verser, Speedfood garde 1 000 − 425 = 575", s1.a_verser_restaurant === 0 && s1.fonds_a_liberer === 0 && s1.produit_speedfood === -1000 && s1.charge_frais_mobile === 425 && s1.fonds_operateur === 575, JSON.stringify(s1));
  const l1bis = await service.surCommandeTerminee(CMD_RETRAIT);
  verifier("retrait : terminer deux fois ne reverse rien", l1bis?.ok === true && (await versementsDe(p1.id)).length === 1 && (await ecrituresDe(p1.id)).length === 4 + 3 + 2, `écritures : ${(await ecrituresDe(p1.id)).length}`);

  // ------------------------------------------------------------ 2. livraison : restaurant + livreur
  const o2 = await service.ouvrirPaiement({ orderId: CMD_LIVRAISON, operateur: "orange_money" });
  verifier("livraison : ouverture acceptée", o2.ok === true, JSON.stringify(o2));
  const p2 = await paiementDe(CMD_LIVRAISON);
  verifier("livraison : 30 000 GNF, restaurant 24 000, livreur 5 000, Speedfood 1 000, frais mobile 450", p2?.total_gnf === 30000 && p2.restaurant_gnf === 24000 && p2.livreur_gnf === 5000 && p2.speedfood_brut_gnf === 1000 && p2.frais_mobile_gnf === 450, JSON.stringify(p2));
  await notifier(p2, "essai-livraison-1");
  const l2 = await service.surCommandeTerminee(CMD_LIVRAISON);
  verifier("livraison : libérée, deux versements confirmés", l2?.ok === true && (await versementsDe(p2.id)).filter((v) => v.etat === "confirme").length === 2, JSON.stringify(await versementsDe(p2.id)));
  const s2 = soldes(await ecrituresDe(p2.id));
  verifier("livraison : plus rien à verser ; Speedfood garde 1 000 − 450 = 550", s2.a_verser_restaurant === 0 && s2.a_verser_livreur === 0 && s2.fonds_a_liberer === 0 && s2.fonds_operateur === 550, JSON.stringify(s2));

  // ------------------------------------------------------------ 3. commande payée puis refusée → remboursement
  await service.ouvrirPaiement({ orderId: CMD_ANNULEE, operateur: "orange_money" });
  const p3 = await paiementDe(CMD_ANNULEE);
  await notifier(p3, "essai-annulee-1");
  const rb = await service.surCommandeAnnulee(CMD_ANNULEE);
  const p3b = await paiementDe(CMD_ANNULEE);
  const c3 = await commande(CMD_ANNULEE);
  verifier("annulée : payée puis annulée → remboursée en totalité", rb?.ok === true && p3b.etat === "rembourse" && p3b.rembourse_gnf === p3.total_gnf, JSON.stringify([rb, p3b]));
  verifier("annulée : la commande n'est plus marquée payée", c3.paiement_mode === null && c3.paiement_statut === "non_demande", JSON.stringify(c3));
  const s3 = soldes(await ecrituresDe(p3.id));
  verifier("annulée : le client est rendu, Speedfood n'a perdu que les frais du prestataire", s3.fonds_a_liberer === 0 && s3.fonds_operateur === -p3.frais_mobile_gnf, JSON.stringify(s3));

  // ------------------------------------------------------------ 4. abandon → expiration par l'entretien périodique
  await service.ouvrirPaiement({ orderId: CMD_EXPIREE, operateur: "mtn_momo" });
  const p4 = await paiementDe(CMD_EXPIREE);
  const passe = new Date(Date.now() - 60_000).toISOString();
  await db.from("paiements").update({ expire_le: passe }).eq("id", p4.id);
  const ent = await service.entretien();
  const p4b = await paiementDe(CMD_EXPIREE);
  verifier("expirée : l'entretien périodique expire le paiement abandonné", ent.expires >= 1 && p4b.etat === "expire", JSON.stringify([ent, p4b.etat]));
  verifier("expirée : la commande retrouve les autres modes de paiement", (await commande(CMD_EXPIREE)).paiement_mode === null);
  const tard = await notifier(p4b, "essai-expiree-1");
  const p4c = await paiementDe(CMD_EXPIREE);
  verifier("expirée : l'argent qui arrive APRÈS l'expiration est remboursé automatiquement", tard.statut === "applique" && p4c.etat === "rembourse", JSON.stringify([tard, p4c.etat]));

  // ------------------------------------------------------------ 5. contrôles transversaux
  const toutes = [p1.id, p2.id, p3.id, p4.id];
  let equilibre = true;
  for (const id of toutes) {
    const ligne = await ecrituresDe(id);
    const d = ligne.filter((x) => x.sens === "debit").reduce((n, x) => n + x.montantGnf, 0);
    const c = ligne.filter((x) => x.sens === "credit").reduce((n, x) => n + x.montantGnf, 0);
    if (d !== c) equilibre = false;
  }
  verifier("le livre de comptes est équilibré pour chacun des quatre paiements", equilibre);
  const reglagesApres = (await lire("parametres_paiement", "paiement_en_ligne_actif", {}))[0];
  verifier("interrupteur de la base toujours éteint après l'essai", reglagesApres?.paiement_en_ligne_actif === false);
  const evenements = await lire("paiement_evenements", "identifiant_evenement, resultat", { fournisseur: "simulation" });
  verifier("journal des notifications : les identifiants de l'essai y sont, une seule fois chacun", new Set(evenements.map((e) => e.identifiant_evenement)).size === evenements.length && evenements.some((e) => e.identifiant_evenement === "essai-retrait-1"));
} catch (e) {
  ko++;
  console.log(`ECHEC essai interrompu : ${e instanceof Error ? e.message : "erreur inconnue"}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(ko === 0 ? "\nESSAI DE BOUT EN BOUT RÉUSSI sur la vraie base." : `\n${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
