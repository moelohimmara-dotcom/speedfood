import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Test STATIQUE sur le source de restaurant/cablage.ts (la couche qui choisit, en production, QUEL client reçoit chaque service). Les autres tests injectent des doublures :
// ils ne voient pas ce fichier. Celui-ci échoue si le client administrateur est utilisé, DANS cablage.ts, ailleurs que pour lister les seconds facteurs (le service partagé du site utilise lui-même le client de service pour deux effets système bornés à une commande dont l'appartenance est déjà vérifiée : échéance d'une proposition et clôture à l'annulation), si un service reçoit autre chose que
// le client lié au jeton, ou si le filtre « second facteur confirmé » est neutralisé. Il ne prouve pas que le Worker démarre (voir « Ce qui n'est PAS vérifié »).
const source = readFileSync(fileURLToPath(new URL("../src/restaurant/cablage.ts", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""));
const code = sansCommentaires.join("\n");

const unique = (motif: RegExp, message: string) => assert.equal(sansCommentaires.filter((l) => motif.test(l)).length, 1, message);

test("cablage : le client administrateur n'est APPELÉ directement qu'une fois, pour `clientAdmin` (seconds facteurs) ; l'unique lecture système indirecte est le paramètre global des prix et de la fraîcheur (voir D4a et D4b)", () => {
  assert.equal((code.match(/creerClientAdmin\(/g) ?? []).length, 1, "creerClientAdmin() appelé ailleurs que dans clientAdmin");
  unique(/^\s*clientAdmin:\s*\(\)\s*=>\s*creerClientAdmin\(\),\s*$/, "clientAdmin doit être la seule ligne qui appelle creerClientAdmin()");
  assert.ok(!/creerClientAdmin\s*[,)]/.test(code.replace(/import[^\n]*\n/g, "").replace(/typeof creerClientAdmin/g, "")), "creerClientAdmin passé comme valeur");
});

test("cablage : le client lié au jeton est celui de `clientJeton`", () => {
  unique(/^\s*clientJeton:\s*\(jeton\)\s*=>\s*creerClientJeton\(jeton\),\s*$/, "clientJeton");
});

test("cablage : lecture, écriture, questions et appartenance reçoivent leur paramètre `client` (le client du jeton), jamais un autre", () => {
  unique(/^\s*questionsRequises:\s*async\s*\(client\)\s*=>\s*\(await lireEtatQuestions\(client as SupabaseClient\)\)\.requise,\s*$/, "questionsRequises");
  unique(/^\s*const \{ data \} = await \(client as SupabaseClient\)\.from\("restaurant_memberships"\)\.select\("restaurant_id, role"\)\.eq\("utilisateur_id", utilisateurId\)\.maybeSingle\(\);\s*$/, "appartenance");
  unique(/^\s*appartenance:\s*async\s*\(client,\s*utilisateurId\)\s*=>\s*\{\s*$/, "signature de appartenance");
  unique(/^\s*lireCommandes:\s*\(client,\s*restaurantId,\s*origine\)\s*=>\s*lireCommandesRestaurant\(client as SupabaseClient,\s*restaurantId,\s*origine\),\s*$/, "lireCommandes");
  unique(/^\s*traiterCommande:\s*\(client,\s*utilisateurId,\s*restaurantId,\s*commandeId,\s*action\)\s*=>\s*traiterCommande\(client as ClientCommandeDb,\s*utilisateurId,\s*restaurantId,\s*commandeId,\s*action\),\s*$/, "traiterCommande");
  unique(/^\s*confirmerPaiement:\s*\(client,\s*restaurantId,\s*commandeId,\s*decision\)\s*=>\s*confirmerPaiement\(client as ClientCommandeDb,\s*restaurantId,\s*commandeId,\s*decision\),\s*$/, "confirmerPaiement");
  unique(/^\s*proposerRevision:\s*\(client,\s*restaurantId,\s*commandeId,\s*valeurs\)\s*=>\s*proposerRevision\(client as ClientCommandeDb,\s*restaurantId,\s*commandeId,\s*valeurs\),\s*$/, "proposerRevision");
});

test("cablage D4a : statut, réglages, menu et disponibilité reçoivent le client du jeton (paramètre `client`), jamais un autre", () => {
  unique(/^\s*lireReglages:\s*\(client,\s*restaurantId,\s*fraicheurHeures\)\s*=>\s*lireReglagesRestaurant\(client as SupabaseClient,\s*restaurantId,\s*fraicheurHeures\),\s*$/, "lireReglages");
  unique(/^\s*ecrireStatut:\s*\(client,\s*restaurantId,\s*demande\)\s*=>\s*ecrireStatutRestaurant\(client as SupabaseClient,\s*restaurantId,\s*demande\),\s*$/, "ecrireStatut");
  unique(/^\s*ecrireReglages:\s*\(client,\s*restaurantId,\s*valeurs\)\s*=>\s*ecrireReglagesRestaurant\(client as SupabaseClient,\s*restaurantId,\s*valeurs\),\s*$/, "ecrireReglages");
  unique(/^\s*lireMenu:\s*\(client,\s*restaurantId\)\s*=>\s*lireMenuRestaurant\(client as SupabaseClient,\s*restaurantId\),\s*$/, "lireMenu");
  unique(/^\s*basculerDisponibilite:\s*\(client,\s*restaurantId,\s*platId,\s*disponible\)\s*=>\s*basculerDisponibilite\(client as SupabaseClient,\s*restaurantId,\s*platId,\s*disponible\),\s*$/, "basculerDisponibilite");
  unique(/^\s*confirmerDisponibilite:\s*\(client,\s*restaurantId,\s*platId\)\s*=>\s*confirmerDisponibilite\(client as SupabaseClient,\s*restaurantId,\s*platId\),\s*$/, "confirmerDisponibilite");
  unique(/^\s*confirmerToutesDisponibilites:\s*\(client,\s*restaurantId\)\s*=>\s*confirmerToutesDisponibilites\(client as SupabaseClient,\s*restaurantId\),\s*$/, "confirmerToutesDisponibilites");
});

test("cablage D4b : création, modification, archivage, ajout et retrait de supplément reçoivent le client du jeton (paramètre `client`), jamais un autre, et le restaurant du CONTEXTE", () => {
  unique(/^\s*creerPlat:\s*\(client,\s*restaurantId,\s*plat\)\s*=>\s*creerPlat\(client as SupabaseClient,\s*restaurantId,\s*plat\),\s*$/, "creerPlat");
  unique(/^\s*modifierPlat:\s*\(client,\s*restaurantId,\s*platId,\s*plat\)\s*=>\s*modifierPlat\(client as SupabaseClient,\s*restaurantId,\s*platId,\s*plat\),\s*$/, "modifierPlat");
  unique(/^\s*archiverPlat:\s*\(client,\s*restaurantId,\s*platId\)\s*=>\s*archiverPlat\(client as SupabaseClient,\s*restaurantId,\s*platId\),\s*$/, "archiverPlat");
  unique(/^\s*ajouterOption:\s*\(client,\s*restaurantId,\s*platId,\s*option\)\s*=>\s*ajouterOption\(client as SupabaseClient,\s*restaurantId,\s*platId,\s*option\),\s*$/, "ajouterOption");
  unique(/^\s*retirerOption:\s*\(client,\s*restaurantId,\s*optionId\)\s*=>\s*retirerOption\(client as SupabaseClient,\s*restaurantId,\s*optionId\),\s*$/, "retirerOption");
  assert.ok(!/creerClientAdmin\(\)\s*as\s+SupabaseClient/.test(code));
});

test("cablage D4b : le câblage n'importe que les services du menu prévus (aucune photo, aucun document, aucune suppression de plat)", () => {
  const importMenu = source.match(/import \{([^}]*)\} from "@\/lib\/menu\/service-menu";/);
  assert.ok(importMenu, "import du service du menu");
  const noms = importMenu![1].split(",").map((n) => n.trim().replace(/ as .*/, "")).sort();
  assert.deepEqual(noms, ["ajouterOption", "archiverPlat", "basculerDisponibilite", "confirmerDisponibilite", "confirmerToutesDisponibilites", "creerPlat", "lireMenu", "modifierPlat", "retirerOption"]);
  // Lot D4c : la photo d'un plat a ses lignes dédiées (épinglées plus bas) ; hors de ces lignes, toujours aucune photo, aucun document, aucune suppression de plat.
  const reste = code.replace(/import[^\n]*\n/g, "").split("\n").filter((l) => !LIGNES_PHOTO.some((m) => m.test(l))).join("\n");
  assert.ok(!/photo|document|supprimer/i.test(reste), "aucune photo (hors lignes D4c), aucun document, aucune suppression de plat dans le câblage");
});

const LIGNES_PHOTO = [
  /^const STOCKAGE_IMAGES: StockageImages = \{$/,
  /^\s*televerser:\s*\(fichier,\s*dossier,\s*restaurantId\)\s*=>\s*televerserImage\(fichier,\s*dossier,\s*restaurantId\),\s*$/,
  /^\s*supprimerOrphelin:\s*\(url\)\s*=>\s*supprimerTeleversementOrphelin\(url\),\s*$/,
  /^\s*supprimerAncienne:\s*\(url\)\s*=>\s*supprimerImage\(url\),\s*$/,
  /^\s*definirPhoto:\s*\(client,\s*restaurantId,\s*platId,\s*fichier\)\s*=>\s*definirPhotoPlat\(client as SupabaseClient,\s*restaurantId,\s*platId,\s*fichier,\s*STOCKAGE_IMAGES\),\s*$/,
  /^\s*retirerPhoto:\s*\(client,\s*restaurantId,\s*platId\)\s*=>\s*retirerPhotoPlat\(client as SupabaseClient,\s*restaurantId,\s*platId,\s*STOCKAGE_IMAGES\),\s*$/,
];

test("cablage D4c : la photo reçoit le client du jeton et le restaurant du CONTEXTE ; le stockage ne branche que les trois fonctions du site ; le client administrateur n'est jamais passé à photo.ts", () => {
  for (const motif of LIGNES_PHOTO) unique(motif, String(motif));
  assert.equal(sansCommentaires.filter((l) => /STOCKAGE_IMAGES/.test(l)).length, 3, "STOCKAGE_IMAGES : déclaration + deux usages, pas un de plus");
  const importImages = source.match(/import \{([^}]*)\} from "@\/lib\/storage\/images";/);
  assert.ok(importImages, "import du stockage");
  assert.deepEqual(importImages![1].split(",").map((n) => n.trim()).sort(), ["supprimerImage", "supprimerTeleversementOrphelin", "televerserImage"]);
  assert.ok(!/creerClientAdmin[^\n]*photo|photo[^\n]*creerClientAdmin/i.test(code), "le client administrateur n'est jamais passé à la photo");
});

// Le stockage est le SEUL usage système du lot D4c. Il vit dans le service du site (images.ts) : on fige ce qu'il touche pour qu'une évolution soit revue.
const sansComm = (brut: string) => brut.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, "")).join("\n");

test("images.ts (site) : le client administrateur n'y sert qu'au bucket `medias` et à COMPTER les références d'une image (head: true, aucune donnée de restaurant lue)", () => {
  const images = sansComm(readFileSync(fileURLToPath(new URL("../../web/src/lib/storage/images.ts", import.meta.url)), "utf8"));
  assert.equal((images.match(/creerClientAdmin\(\)/g) ?? []).length, 3, "trois usages : téléversement, orphelin, suppression");
  assert.equal((images.match(/\.storage\.from\("medias"\)/g) ?? []).length, 4, "upload, getPublicUrl, remove (orphelin), remove (ancienne)");
  assert.equal((images.match(/admin\.from\(/g) ?? []).length, 4, "quatre comptages de références");
  assert.equal((images.match(/\{ count: "exact", head: true \}/g) ?? []).length, 4, "chaque lecture est un simple comptage");
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(images), "aucune écriture en base avec le client administrateur");
  assert.equal((images.match(/^import /gm) ?? []).length, 6, "liste des imports figée : toute nouvelle dépendance doit être revue");
  assert.ok(/await limiterTeleversement\(restaurantId\)/.test(images), "quota d'envois par restaurant");
});

test("photo.ts (API) : aucun client administrateur ni lecture d'environnement ; la seule colonne écrite est photo_url, filtrée sur le restaurant et le plat non archivé", () => {
  const photo = sansComm(readFileSync(fileURLToPath(new URL("../src/restaurant/photo.ts", import.meta.url)), "utf8"));
  assert.ok(!/creerClientAdmin|db\/admin|service_role|SERVICE_ROLE|process\.env|console\./.test(photo));
  assert.equal((photo.match(/\.update\(/g) ?? []).length, 1, "une seule écriture");
  assert.ok(/\.update\(\{ photo_url: url \}\)\.eq\("id", platId\)\.eq\("restaurant_id", restaurantId\)\.is\("archive_le", null\)\.select\("id"\)/.test(photo), "écriture filtrée");
  assert.equal((photo.match(/\.eq\("restaurant_id", restaurantId\)\.is\("archive_le", null\)/g) ?? []).length, 2, "lecture et écriture filtrées sur le restaurant du contexte et le plat non archivé");
  assert.ok(!/\.insert\(|\.delete\(|\.upsert\(|\.rpc\(/.test(photo));
});

test("cablage D4a : la SEULE lecture système du lot est le seuil de fraîcheur global (paramètre non sensible, policy réservée aux administrateurs), jamais une donnée de restaurant", () => {
  assert.equal((code.match(/obtenirParametresApplication\(/g) ?? []).length, 1, "obtenirParametresApplication appelé ailleurs que pour le seuil de fraîcheur");
  unique(/^\s*fraicheurDisponibiliteHeures:\s*async\s*\(\)\s*=>\s*\(await obtenirParametresApplication\(\)\)\.disponibiliteFraicheurHeures,\s*$/, "fraicheurDisponibiliteHeures");
  assert.ok(!/creerClientAdmin\(\)\s*as\s+SupabaseClient/.test(code), "le client administrateur ne sert jamais de client de restaurant");
});

test("cablage : second facteur = facteurs au statut « verified » lus avec le client administrateur reçu en paramètre, pour le compte du jeton", () => {
  unique(/^\s*aSecondFacteurConfirme:\s*async\s*\(admin,\s*utilisateurId\)\s*=>\s*\{\s*$/, "signature de aSecondFacteurConfirme");
  unique(/^\s*const \{ data \} = await \(admin as ReturnType<typeof creerClientAdmin>\)\.auth\.admin\.mfa\.listFactors\(\{ userId: utilisateurId \}\);\s*$/, "listFactors");
  unique(/^\s*return \(data\?\.factors \?\? \[\]\)\.some\(\(f\) => f\.status === "verified"\);\s*$/, "filtre « verified »");
});

test("cablage : plafond par compte et origine du site câblés sur les bons services du site", () => {
  unique(/^\s*limiter:\s*limiterRestaurantApplication,\s*$/, "limiter");
  unique(/^\s*origineSite:\s*origineDuSite,\s*$/, "origineSite");
});

test("cablage : aucune lecture d'environnement ni journal dans le câblage", () => {
  assert.ok(!/process\.env|console\./.test(code));
});

test("l'analyseur D4a : une variante qui passe le client administrateur au statut serait détectée", () => {
  const faux = "ecrireStatut: (client, restaurantId, demande) => ecrireStatutRestaurant(creerClientAdmin() as SupabaseClient, restaurantId, demande),";
  assert.ok(!/^\s*ecrireStatut:\s*\(client,\s*restaurantId,\s*demande\)\s*=>\s*ecrireStatutRestaurant\(client as SupabaseClient,/.test(faux));
  assert.ok(/creerClientAdmin\(\)\s*as\s+SupabaseClient/.test(faux));
  assert.equal(((faux + "\nclientAdmin: () => creerClientAdmin(),").match(/creerClientAdmin\(/g) ?? []).length, 2);
});

test("l'analyseur : une variante qui passe le client administrateur à un service serait détectée", () => {
  const faux = "lireCommandes: (client, restaurantId, origine) => lireCommandesRestaurant(creerClientAdmin() as SupabaseClient, restaurantId, origine),";
  assert.ok(!/^\s*lireCommandes:\s*\(client,\s*restaurantId,\s*origine\)\s*=>\s*lireCommandesRestaurant\(client as SupabaseClient,/.test(faux));
  assert.equal(((faux + "\nclientAdmin: () => creerClientAdmin(),").match(/creerClientAdmin\(/g) ?? []).length, 2);
});

// Relecture D4b (m-5) : le service du site réutilisé par l'API ne doit pas se mettre à utiliser un client administrateur ni une autre lecture système.
test("service-menu (site) : aucun client administrateur ; une seule lecture système indirecte (paramètres globaux), trois appels", () => {
  const brut = readFileSync(fileURLToPath(new URL("../../web/src/lib/menu/service-menu.ts", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
  const sansCom = brut.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, "")).join("\n");
  assert.ok(!/db\/admin|creerClientAdmin|service_role|SERVICE_ROLE/.test(sansCom), "client administrateur dans service-menu.ts");
  assert.equal((sansCom.match(/from "@\/lib\/parametres\/lire"/g) ?? []).length, 1);
  assert.equal((sansCom.match(/obtenirParametresApplication\(\)/g) ?? []).length, 3, "creerPlat, modifierPlat, ajouterOption");
  assert.equal((sansCom.match(/^import /gm) ?? []).length, 5, "liste des imports figée : toute nouvelle dépendance doit être revue");
});

// ---------- Lot D5 : livraison par le restaurant ----------
// L'EXCEPTION du lot, acceptée par Malika : les tables de livraison n'ont aucune policy d'écriture, donc `avancerLivraison` du site (clé de service) est réutilisée telle quelle. Elle n'est atteinte qu'APRÈS
// le contrôle d'appartenance de la livraison (livraison.ts, client du jeton). Ces tests épinglent où elle est branchée, qu'elle n'est appelée nulle part ailleurs, et ce que le service du site fait avec la clé de service.
const lire = (relatif: string) => readFileSync(fileURLToPath(new URL(relatif, import.meta.url)), "utf8").replace(/\r\n/g, "\n");

test("cablage D5 : l'avancement de livraison est UNE constante branchée sur `avancerLivraison` du site, passée seule à livraison.ts ; la lecture reçoit le client du jeton", () => {
  unique(/^const AVANCEMENT_LIVRAISON: AvancementLivraison = \(demande\) => avancerLivraison\(demande\);$/, "AVANCEMENT_LIVRAISON");
  unique(/^\s*lireLivraisons:\s*\(client,\s*restaurantId,\s*commandeIds\)\s*=>\s*lireLivraisonsDesCommandes\(client as SupabaseClient,\s*restaurantId,\s*commandeIds\),\s*$/, "lireLivraisons");
  unique(/^\s*agirSurLivraison:\s*\(client,\s*restaurantId,\s*livraisonId,\s*action,\s*code\)\s*=>\s*agirSurLivraisonRestaurant\(client as SupabaseClient,\s*restaurantId,\s*livraisonId,\s*action,\s*code,\s*AVANCEMENT_LIVRAISON\),\s*$/, "agirSurLivraison");
  assert.equal(sansCommentaires.filter((l) => /AVANCEMENT_LIVRAISON/.test(l)).length, 2, "AVANCEMENT_LIVRAISON : déclaration + un seul usage");
  assert.equal((code.match(/avancerLivraison\(/g) ?? []).length, 1, "avancerLivraison appelé une seule fois dans le câblage");
  const importService = source.match(/import \{([^}]*)\} from "@\/lib\/livraison\/service";/);
  assert.ok(importService, "import du service de livraison");
  assert.deepEqual(importService![1].split(",").map((n) => n.trim()), ["avancerLivraison"], "aucune autre fonction du service de livraison (ni repartir, ni assignerManuellement)");
  assert.ok(!/creerClientAdmin\(\)[^\n]*(livraison|Livraison)|(livraison|Livraison)[^\n]*creerClientAdmin\(\)/.test(code), "le client administrateur n'est jamais passé à la livraison par le câblage");
});

test("livraison.ts (API) : aucun client administrateur, aucune écriture directe, aucune lecture d'environnement ; lit `livraisons` avec le client reçu, filtré sur le restaurant ; acteur « restaurant » imposé", () => {
  const livraison = sansComm(lire("../src/restaurant/livraison.ts"));
  assert.ok(!/creerClientAdmin|db\/admin|service_role|SERVICE_ROLE|process\.env|console\./.test(livraison));
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/.test(livraison), "aucune écriture directe : tout passe par l'avancement du site");
  assert.equal((livraison.match(/\.from\(/g) ?? []).length, 2, "deux lectures : appartenance et liste");
  assert.equal((livraison.match(/\.from\("livraisons"\)/g) ?? []).length, 2);
  assert.ok(/\.from\("livraisons"\)\.select\("id"\)\.eq\("id", livraisonId\)\.eq\("restaurant_id", restaurantId\)\.maybeSingle\(\)/.test(livraison), "appartenance filtrée sur la livraison ET le restaurant du contexte");
  assert.ok(/\.from\("livraisons"\)\.select\("id, order_id, mode, statut"\)\.eq\("restaurant_id", restaurantId\)\.in\("order_id", /.test(livraison), "liste : trois champs utiles, filtrée sur le restaurant du contexte");
  assert.equal((livraison.match(/acteur: "restaurant",/g) ?? []).length, 1, "l'acteur est imposé ici, une seule fois");
  assert.equal((livraison.match(/avancer\(/g) ?? []).length, 1, "un seul appel de l'avancement (avec ou sans await)");
  assert.ok(livraison.indexOf("await lireAppartenance(") < livraison.indexOf("avancer("), "le contrôle d'appartenance précède l'avancement");
  assert.deepEqual(livraison.match(/^import .*$/gm), [
    'import type { SupabaseClient } from "@supabase/supabase-js";',
    'import type { ResultatActionCommande } from "@speedfood/shared/contracts/commande";',
    'import { lireLivraisonApi, type ActionLivraisonApp, type LivraisonRestaurateurApi } from "@speedfood/shared/contracts/restaurant-livraison";',
  ], "imports figés : aucun import du site (@/), jamais clientLivraison");
  assert.ok(!/clientLivraison|from "@\//.test(livraison));
  assert.ok(/if \(lecture\.etat === "absent"\) return INTROUVABLE;/.test(livraison) && /if \(lecture\.etat === "panne"\) return PANNE;/.test(livraison));
});

test("route D5 : contexte, puis corps, puis validation partagée, puis service ; le restaurant n'est jamais lu dans le corps", () => {
  const routes = sansComm(lire("../src/routes/restaurant.ts"));
  const debut = routes.indexOf('route.post("/livraison/action"');
  assert.ok(debut > 0, "route présente");
  const bloc = routes.slice(debut, routes.indexOf("return route;", debut));
  const ordre = ["await contexte(c)", "await lireCorpsJson(c)", "lireDemandeLivraisonApp(lu.corps)", "deps.restaurant.agirSurLivraison("];
  const positions = ordre.map((m) => bloc.indexOf(m));
  assert.ok(positions.every((p) => p >= 0), "les quatre étapes sont présentes");
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "ordre : contexte, corps, validation, service");
  assert.ok(!/restaurantId|restaurant_id/.test(bloc), "aucune lecture d'un restaurant dans la route");
  assert.ok(!/console\.|process\.env/.test(bloc));
  assert.ok(/deps\.restaurant\.agirSurLivraison\(ctx, demande\.livraisonId, demande\.action, demande\.code\)/.test(bloc), "le service ne reçoit que le contexte, la livraison, l'action et le code");
});

test("service de livraison (site) : c'est lui qui écrit avec la clé de service ; ses imports, ses contrôles de machine à états et de plafond d'essais sont figés", () => {
  const service = sansComm(lire("../../web/src/lib/livraison/service.ts"));
  assert.equal((service.match(/^import /gm) ?? []).length, 9, "liste des imports figée : toute nouvelle dépendance doit être revue");
  assert.equal((service.match(/creerClientAdmin\(\)/g) ?? []).length, 1, "un seul usage direct du client de service (clôture de la commande), le reste passe par clientLivraison()");
  assert.ok(/if \(!acteurPeut\(d\.acteur, de, d\.vers, mode\)\) return refuser/.test(service), "machine à états et droits par acteur");
  assert.ok(/if \(l\.essais_code >= ESSAIS_CODE_MAX\) return refuser/.test(service), "plafond d'essais du code");
  assert.ok(/!codeRemiseCorrect\(ligneCode\.code as string, d\.code \?\? ""\)/.test(service), "comparaison du code en temps constant");
  assert.ok(/\.update\(\{ essais_code: l\.essais_code \+ 1 \}\)\.eq\("id", l\.id\)\.eq\("essais_code", l\.essais_code\)\.lt\("essais_code", ESSAIS_CODE_MAX\)\.select\("id"\)/.test(service), "l'essai est réservé par une mise à jour CONDITIONNELLE (valeur lue + plafond)");
  assert.ok(service.indexOf("essaiReserve = true") < service.indexOf("codeRemiseCorrect(ligneCode"), "la réservation précède la comparaison du code");
  assert.ok(!/update\(\{ essais_code: l\.essais_code \+ 1 \}\)\.eq\("id", l\.id\);/.test(service), "plus d'écriture non conditionnelle du compteur");
  assert.ok(!/console\.(log|info|warn)\(/.test(service) && (service.match(/console\.error\("[a-z_]+"\)/g) ?? []).length === 1, "aucune journalisation de valeur : un seul message fixe d'erreur");
});

test("actions-restaurant (site, référence) : la livraison doit appartenir au restaurant du membre avant l'avancement ; l'API reproduit ce contrôle", () => {
  const site = sansComm(lire("../../web/src/lib/livraison/actions-restaurant.ts"));
  assert.ok(/ligne\.restaurant_id !== membership\.restaurant_id\) return \{ ok: false, message: "Livraison introuvable\." \}/.test(site));
  assert.ok(site.indexOf("ligne.restaurant_id !== membership.restaurant_id") < site.indexOf("await avancerLivraison("));
});
