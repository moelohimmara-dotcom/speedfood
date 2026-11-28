import { readFileSync } from "node:fs";
import { join } from "node:path";
import { avecSuite } from "../../src/lib/auth/redirection";

/**
 * Reprise de la commande après connexion (28/11/2026). Défaut reproduit : en visiteur, panier rempli, « Commander → Me connecter ou créer un compte →
 * Connexion client » ramenait sur une autre page que le récapitulatif. Cause : sur /entrer, le lien « Connexion client » pointait vers
 * /connexion?role=client et perdait `suite=/commande` ; l'action de connexion n'avait plus de destination. Corrigé : chaque lien garde `suite`.
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

verifier("ajoute la suite à un lien sans paramètre", avecSuite("/entrer", "/commande"), "/entrer?suite=%2Fcommande");
verifier("ajoute la suite à un lien avec paramètre", avecSuite("/connexion?role=client", "/commande"), "/connexion?role=client&suite=%2Fcommande");
verifier("garde une suite avec paramètres", avecSuite("/entrer", "/suivi?ref=SF-1"), "/entrer?suite=%2Fsuivi%3Fref%3DSF-1");
verifier("sans suite : lien inchangé", [avecSuite("/entrer", ""), avecSuite("/entrer", null), avecSuite("/entrer", undefined)], ["/entrer", "/entrer", "/entrer"]);
verifier("suite dangereuse ignorée (redirection ouverte)", [avecSuite("/entrer", "//evil.example"), avecSuite("/entrer", "https://evil.example"), avecSuite("/entrer", "/" + String.fromCharCode(92) + "evil"), avecSuite("/entrer", "javascript:alert(1)")], ["/entrer", "/entrer", "/entrer", "/entrer"]);

// Gardes sur les pages : la destination de retour ne se perd plus entre récapitulatif, inscription et connexion.
const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
const lire = (chemin: string) => readFileSync(join(racine, chemin), "utf8");
const commande = lire("src/app/commande/CommandeClient.tsx");
verifier("récapitulatif : « Me connecter » mène à la connexion client avec retour vers /commande", /avecSuite\("\/connexion\?role=client", "\/commande"\)/.test(commande), true);
verifier("récapitulatif : « Créer un compte » garde aussi le retour", /avecSuite\("\/entrer", "\/commande"\)/.test(commande), true);
verifier("récapitulatif : plus de bouton unique qui mène au long formulaire", /Me connecter ou créer un compte/.test(commande), false);
const entrer = lire("src/app/entrer/page.tsx");
verifier("inscription : aucun lien de connexion sans la suite", /href="\/connexion\?role=client"/.test(entrer), false);
verifier("inscription : « Me connecter » en tête de page", /entrer-deja-compte/.test(entrer), true);
const connexion = lire("src/app/connexion/page.tsx");
verifier("connexion : la création de compte garde la suite", /avecSuite\("\/entrer", suite\)/.test(connexion), true);
const formulaire = lire("src/app/entrer/InscriptionCompleteForm.tsx");
verifier("le lien « conditions » mène aux conditions d'utilisation", /href="\/conditions"/.test(formulaire), true);
const action = lire("src/lib/auth/actions.ts");
verifier("l'action de connexion renvoie vers la suite validée", /if \(estCheminInterneSur\(suite\)\) \{\s*redirect\(suite\);/.test(action), true);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
console.log("\nTous les contrôles de la reprise de commande passent.");
