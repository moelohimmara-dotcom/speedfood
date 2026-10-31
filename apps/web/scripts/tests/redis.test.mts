import { readFileSync } from "node:fs";
import { join } from "node:path";
import { executerPipeline, type CommandeRedis } from "../../src/lib/securite/redis-client";
import { cleCompteur, cleConsommation, commandesLimites, decider, franchitSeuil, PREFIXE_REDIS } from "../../src/lib/securite/redis-limites";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- Règles pures ---------------------------------------------------------------------------------------------------------------------------------------
const maintenant = new Date("2026-10-30T12:00:00Z");
verifier("clé de compteur versionnée, sans donnée en clair", cleCompteur("commande-ip", "EMPREINTE"), "sf:v1:rl:commande-ip:EMPREINTE");
verifier("clé de consommation du mois", cleConsommation(maintenant), "sf:v1:conso:2026-10");
verifier("clé de consommation : zéro devant le mois", cleConsommation(new Date("2026-03-05T00:00:00Z")), "sf:v1:conso:2026-03");

const limites = [
  { cle: "sf:v1:rl:a:1", max: 10, fenetreSecondes: 600 },
  { cle: "sf:v1:rl:b:2", max: 3, fenetreSecondes: 3600 },
];
const commandes = commandesLimites(limites, maintenant);
verifier("commandes : deux par limite (créer avec durée de vie, puis compter) + la consommation", commandes, [
  ["SET", "sf:v1:rl:a:1", "0", "EX", 600, "NX"],
  ["INCR", "sf:v1:rl:a:1"],
  ["SET", "sf:v1:rl:b:2", "0", "EX", 3600, "NX"],
  ["INCR", "sf:v1:rl:b:2"],
  ["INCRBY", "sf:v1:conso:2026-10", 5],
]);
verifier("aucune commande ne contient de donnée personnelle ni de jeton", JSON.stringify(commandes).includes("@") || JSON.stringify(commandes).includes("+224"), false);

verifier("décision : sous les plafonds = autorisé", decider(limites, ["OK", 1, "OK", 3, 1200]), { autorise: true, consommationMois: 1200, commandesDuLot: 5 });
verifier("décision : plafond dépassé sur la 2e limite = refusé", (decider(limites, ["OK", 1, "OK", 4, 1200]) as { autorise: boolean }).autorise, false);
verifier("décision : plafond exact = autorisé (on refuse au-delà)", (decider(limites, ["OK", 10, "OK", 3, 1200]) as { autorise: boolean }).autorise, true);
verifier("décision : compteur illisible = repli (null)", decider(limites, ["OK", "abc", "OK", 3, 1200]), null);
verifier("décision : nombre de valeurs inattendu = repli (null)", decider(limites, ["OK", 1]), null);
verifier("décision : consommation illisible mais limites lisibles", (decider(limites, ["OK", 1, "OK", 1, "x"]) as { consommationMois: number | null }).consommationMois, null);

verifier("alerte de quota : franchit 70 %", franchitSeuil(350_003, 5, 500_000, 0.7), true);
verifier("alerte de quota : pas deux fois", franchitSeuil(350_008, 5, 500_000, 0.7), false);
verifier("alerte de quota : pas avant le seuil", franchitSeuil(100_000, 5, 500_000, 0.7), false);
verifier("alerte de quota : franchit 90 %", franchitSeuil(450_001, 5, 500_000, 0.9), true);

// --- Client : réseau simulé ------------------------------------------------------------------------------------------------------------------------------
type Envoi = { url: string; options: RequestInit };
function faux(reponse: () => Promise<Response>, enregistre: Envoi[] = []): typeof fetch {
  return (async (url: string | URL | Request, options?: RequestInit) => {
    enregistre.push({ url: String(url), options: options ?? {} });
    return reponse();
  }) as typeof fetch;
}
const json = (corps: unknown, statut = 200) => async () => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });
const cmd: CommandeRedis[] = [["INCR", "k"], ["INCR", "k"]];

const envois: Envoi[] = [];
const bon = await executerPipeline({ url: "https://exemple.upstash.io/", jeton: "secret-de-test", envoyer: faux(json([{ result: 1 }, { result: 2 }]), envois) }, cmd);
verifier("pipeline : renvoie la valeur de chaque commande", bon, [1, 2]);
verifier("pipeline : POST sur /pipeline (sans double barre)", [envois[0].url, envois[0].options.method], ["https://exemple.upstash.io/pipeline", "POST"]);
verifier("pipeline : jeton en en-tête, jamais dans l'adresse ni dans le corps", [
  (envois[0].options.headers as Record<string, string>).Authorization === "Bearer secret-de-test",
  envois[0].url.includes("secret-de-test") || String(envois[0].options.body).includes("secret-de-test"),
], [true, false]);
verifier("pipeline : le corps est la liste des commandes", JSON.parse(String(envois[0].options.body)), cmd);

verifier("pipeline : liste vide = résultat vide, aucun envoi", await executerPipeline({ url: "https://x", jeton: "t", envoyer: faux(json([]), envois) }, []), []);
verifier("pipeline : HTTP 500 = repli (null)", await executerPipeline({ url: "https://x", jeton: "t", envoyer: faux(json({}, 500)) }, cmd), null);
verifier("pipeline : jeton refusé (401) = repli (null)", await executerPipeline({ url: "https://x", jeton: "t", envoyer: faux(json({ error: "Unauthorized" }, 401)) }, cmd), null);
verifier("pipeline : une commande en erreur invalide tout le lot", await executerPipeline({ url: "https://x", jeton: "t", envoyer: faux(json([{ result: 1 }, { error: "ERR" }])) }, cmd), null);
verifier("pipeline : mauvais nombre de réponses = repli (null)", await executerPipeline({ url: "https://x", jeton: "t", envoyer: faux(json([{ result: 1 }])) }, cmd), null);
verifier("pipeline : corps inattendu = repli (null)", await executerPipeline({ url: "https://x", jeton: "t", envoyer: faux(json({ result: 1 })) }, cmd), null);
verifier("pipeline : coupure réseau = repli (null)", await executerPipeline({ url: "https://x", jeton: "t", envoyer: (async () => { throw new TypeError("réseau coupé"); }) as typeof fetch }, cmd), null);
verifier("pipeline : délai dépassé = repli (null), sans attendre indéfiniment", await executerPipeline({ url: "https://x", jeton: "t", delaiMs: 30, envoyer: ((_u: unknown, o?: RequestInit) => new Promise((_ok, ko2) => o?.signal?.addEventListener("abort", () => ko2(new Error("délai"))))) as typeof fetch }, cmd), null);

// --- Branchement dans la limitation de débit (lecture du code) ---------------------------------------------------------------------------------------
const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const code = readFileSync(join(racine, "src/lib/securite/limitation-debit.ts"), "utf8");
verifier("repli sur la base conservé (fn_limiter_debit)", /appliquerLimiteBase[\s\S]{0,200}fn_limiter_debit/.test(code), true);
verifier("Redis inactif sans les deux secrets, et coupable par LIMITEUR_REDIS=non", /!url \|\| !jeton \|\| process\.env\.LIMITEUR_REDIS === "non"/.test(code), true);
verifier("panne de Redis : journal sans donnée, puis repli (jamais de refus)", /redis_indisponible_repli_base[\s\S]{0,400}appliquerLimiteBase/.test(code), true);
verifier("la création de commande envoie toutes ses limites en un seul lot", /await appliquerLimites\(paires\)/.test(code), true);
verifier("les clés Redis utilisent l'empreinte HMAC (jamais l'adresse ni le téléphone en clair)", /cleCompteur\(regle\.nom, empreinte\(identifiant\)\)/.test(code), true);
verifier("aucun journal ne contient l'adresse ni le jeton Redis", /console\.(log|error|warn)\([^)]*(UPSTASH|jeton|url)/.test(code), false);

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log(`\nRedis (limitation de débit) : tous les contrôles passent (préfixe ${PREFIXE_REDIS})`);
