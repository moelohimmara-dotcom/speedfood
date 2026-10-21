// Simulation de la marge par commande du modèle « Speedfood encaisse et livre » (docs/cadrage/REFONTE-SPEEDFOOD.md).
// ATTENTION : toutes les valeurs ci-dessous sont des HYPOTHÈSES de travail, pas des mesures. Elles servent à classer ce qui pèse le plus
// sur la marge (sensibilité), pas à prévoir un résultat. À remplacer par les mesures du premier restaurant-test.
// Usage : node scripts/simulation-economie-revente.mjs

const HYPOTHESES = {
  panierGnf: 60_000, // prix des plats d'une commande
  fraisLivraisonClientGnf: 8_000, // payés par le client
  fraisServiceClientGnf: 2_000, // payés par le client
  coutLivreurGnf: 6_000, // payé au livreur par livraison
  partCommissionPct: 5, // commission retenue sur le panier (valeur de départ décidée par Malika le 21/10 : 5 %)
  partEspecesPct: 60, // part des commandes payées en espèces à la livraison
  echecEspecesPct: 10, // commandes en espèces qui échouent (client absent, refus) : livraison perdue, plat perdu une fois sur deux
  echecNumeriquePct: 3,
  fraisMobileFixeGnf: 200, // mesuré sur Chap Chap : 200 GNF + 2 %
  fraisMobilePct: 2,
  manutentionEspecesPct: 1.5, // rapprochement, écarts, fonds de roulement, en % du panier encaissé en espèces
  fraisVirementGnf: 500, // frais d'un virement mobile money (HYPOTHÈSE : à mesurer ; les versements sont quotidiens depuis la décision du 21/10)
  livraisonsParLivreurParJour: 8, // pour répartir le virement quotidien du livreur sur ses commandes
  commandesParRestaurantParJour: 12, // idem pour le virement quotidien du restaurant
  supportGnf: 1_000, // coût moyen de support par commande
  fixesParCommandeGnf: 3_000, // outils, hébergement, administration, répartis par commande (dépend du volume)
};

function contributionParCommande(h) {
  const commission = (h.panierGnf * h.partCommissionPct) / 100;
  const recetteBrute = commission + h.fraisLivraisonClientGnf + h.fraisServiceClientGnf;

  const total = h.panierGnf + h.fraisLivraisonClientGnf + h.fraisServiceClientGnf;
  const fraisMobile = (h.fraisMobileFixeGnf + (total * h.fraisMobilePct) / 100) * (1 - h.partEspecesPct / 100);
  const manutention = (h.panierGnf * h.manutentionEspecesPct) / 100 * (h.partEspecesPct / 100);

  // Une commande échouée coûte la livraison + (une fois sur deux) le plat que Speedfood a déjà réglé au restaurant.
  const tauxEchec = (h.partEspecesPct / 100) * (h.echecEspecesPct / 100) + (1 - h.partEspecesPct / 100) * (h.echecNumeriquePct / 100);
  const coutEchec = tauxEchec * (h.coutLivreurGnf + 0.5 * h.panierGnf);

  const virements = h.fraisVirementGnf / h.livraisonsParLivreurParJour + h.fraisVirementGnf / h.commandesParRestaurantParJour;
  const couts = h.coutLivreurGnf + fraisMobile + manutention + coutEchec + virements + h.supportGnf + h.fixesParCommandeGnf;
  return { recetteBrute, couts, marge: recetteBrute - couts, tauxEchec, fraisMobile, manutention, coutEchec, virements };
}

const fmt = (n) => Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ") + " GNF";

console.log("=== Cas de base (hypothèses) ===");
const base = contributionParCommande(HYPOTHESES);
console.log(`Recette par commande : ${fmt(base.recetteBrute)}`);
console.log(`Coûts par commande   : ${fmt(base.couts)} (livreur ${fmt(HYPOTHESES.coutLivreurGnf)}, frais mobiles ${fmt(base.fraisMobile)}, manutention espèces ${fmt(base.manutention)}, virements quotidiens ${fmt(base.virements)}, échecs ${fmt(base.coutEchec)}, support ${fmt(HYPOTHESES.supportGnf)}, fixes ${fmt(HYPOTHESES.fixesParCommandeGnf)})`);
console.log(`Marge par commande   : ${fmt(base.marge)}\n`);

console.log("=== Sensibilité : ce qui fait bouger la marge (une variable à la fois) ===");
const variations = [
  ["Part d'espèces 60 % → 30 %", { partEspecesPct: 30 }],
  ["Part d'espèces 60 % → 90 %", { partEspecesPct: 90 }],
  ["Échec des espèces 10 % → 20 %", { echecEspecesPct: 20 }],
  ["Échec des espèces 10 % → 4 %", { echecEspecesPct: 4 }],
  ["Commission 5 % → 10 %", { partCommissionPct: 10 }],
  ["Commission 5 % → 15 %", { partCommissionPct: 15 }],
  ["Frais de service client 2 000 → 4 000", { fraisServiceClientGnf: 4_000 }],
  ["Frais de livraison client 8 000 → 11 000", { fraisLivraisonClientGnf: 11_000 }],
  ["Panier 60 000 → 40 000", { panierGnf: 40_000 }],
  ["Panier 60 000 → 90 000", { panierGnf: 90_000 }],
  ["Coût livreur 6 000 → 8 000", { coutLivreurGnf: 8_000 }],
  ["Frais de livraison client 8 000 → 5 000", { fraisLivraisonClientGnf: 5_000 }],
  ["Frais fixes 3 000 → 8 000 (faible volume)", { fixesParCommandeGnf: 8_000 }],
];
const lignes = variations.map(([nom, v]) => {
  const r = contributionParCommande({ ...HYPOTHESES, ...v });
  return { nom, marge: r.marge, ecart: r.marge - base.marge };
});
lignes.sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));
for (const l of lignes) {
  console.log(`${l.nom.padEnd(46)} marge ${fmt(l.marge).padStart(12)}   écart ${(l.ecart >= 0 ? "+" : "") + fmt(l.ecart)}`);
}

console.log("\n=== Seuil : à partir de quel panier la commande est-elle rentable (autres valeurs de base) ? ===");
for (let panier = 20_000; panier <= 120_000; panier += 10_000) {
  const r = contributionParCommande({ ...HYPOTHESES, panierGnf: panier });
  console.log(`${fmt(panier).padStart(12)} -> marge ${fmt(r.marge).padStart(12)}`);
}
