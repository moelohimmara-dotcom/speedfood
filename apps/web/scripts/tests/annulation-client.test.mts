import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transitionAutorisee } from "../../src/lib/contracts/statuts";

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

// Règle métier : le client annule tant que le restaurant n'a pas répondu (en_attente), jamais après (décision de Malika, 29 octobre 2026).
verifier("transition autorisée par le contrat : en_attente → annulee", transitionAutorisee("en_attente", "annulee"), true);

const service = lire("src/lib/commande/annulation-client.ts");
verifier("annulation : écriture conditionnelle sur le statut en_attente (pas d'annulation d'une commande acceptée entre-temps)", /\.update\(\{ statut: "annulee" \}\)[\s\S]{0,80}\.eq\("statut", "en_attente"\)/.test(service), true);
verifier("annulation : refus clair d'une commande déjà acceptée (CONFLIT_ETAT)", /statut !== "en_attente"[\s\S]{0,200}CONFLIT_ETAT/.test(service), true);
verifier("annulation : idempotente (déjà annulée = succès, rien réécrit)", /statut === "annulee"[\s\S]{0,120}return \{ reference/.test(service), true);
verifier("annulation : acteur historisé « client:<référence> », sans jeton", /acteur: `client:\$\{commande\.reference\}`/.test(service) && !/acteur:[^\n]*jeton/.test(service), true);
verifier("annulation : livraison, remboursement et notification après la transition", /apresTransitionCommande\(commande\.id, "annulee"\)/.test(service), true);
verifier("annulation : jeton validé avant tout accès à la base", service.indexOf("estJetonValide(jeton)") < service.indexOf("creerClientAdmin()"), true);

const route = lire("src/app/api/v1/suivi/annuler/route.ts");
verifier("route : méthode POST, jamais GET", /export async function POST/.test(route) && !/export async function GET/.test(route), true);
verifier("route : le jeton voyage dans le corps, jamais dans l'adresse", /lireCorpsJson\(request\)/.test(route) && !/searchParams|new URL\(request\.url\)/.test(route), true);
verifier("route : limitée par IP avant l'annulation", route.indexOf("limiterAnnulationClient()") > -1 && route.indexOf("limiterAnnulationClient()") < route.indexOf("annulerParClient(jeton)"), true);
verifier("route : jamais de mise en cache", /dynamic = "force-dynamic"/.test(route), true);

const limites = lire("src/lib/securite/limitation-debit.ts");
verifier("limiteur d'annulation déclaré", /LIMITE_ANNULATION_CLIENT_PAR_IP/.test(limites) && /export async function limiterAnnulationClient/.test(limites), true);

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nannulation par le client : tous les contrôles passent");
