import {
  LIGNES_MAX_PANIER,
  PANIER_VIDE,
  QUANTITE_MAX_LIGNE,
  ajouterAuPanier,
  assainirPanier,
  cleLigne,
  modifierQuantite,
  nombreArticlesPanier,
  photoSure,
  prixLigne,
  retirerDuPanier,
  sousTotalPanier,
  type ArticlePanier,
  type Panier,
} from "../../src/lib/panier/gestion";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const A = { id: "r-a", nom: "Resto A" };
const B = { id: "r-b", nom: "Resto B" };
const riz: ArticlePanier = { id: "riz", nom: "Riz sauce feuille", prix: 25000 };
const poulet: ArticlePanier = { id: "poulet", nom: "Poulet braisé", prix: 40000 };
const piment = { id: "o-piment", nom: "Piment", prix: 2000 };
const oeuf = { id: "o-oeuf", nom: "Oeuf", prix: 3000 };

// --- clé de ligne
verifier("clé : l'ordre des suppléments ne compte pas", cleLigne("riz", ["b", "a"]), cleLigne("riz", ["a", "b"]));
verifier("clé : sans supplément", cleLigne("riz", []), "riz|");

// --- ajout
const un = ajouterAuPanier(PANIER_VIDE, A, riz);
verifier("ajout : premier plat", [un.resultat, un.panier.restaurantId, un.panier.lignes.length, un.panier.lignes[0].quantite], ["ajoute", "r-a", 1, 1]);
verifier("ajout : le panier d'origine n'est jamais modifié", [PANIER_VIDE.restaurantId, PANIER_VIDE.lignes.length], [null, 0]);
const deux = ajouterAuPanier(un.panier, A, riz);
verifier("ajout : même plat = quantité 2, une seule ligne", [deux.panier.lignes.length, deux.panier.lignes[0].quantite], [1, 2]);
verifier("ajout : l'entrée n'est pas modifiée", un.panier.lignes[0].quantite, 1);
const avecOptions = ajouterAuPanier(deux.panier, A, { ...riz, options: [piment] });
verifier("ajout : mêmes plat avec supplément = ligne distincte", avecOptions.panier.lignes.length, 2);
const ordreA = ajouterAuPanier(PANIER_VIDE, A, { ...riz, options: [piment, oeuf] }).panier;
const ordreB = ajouterAuPanier(ordreA, A, { ...riz, options: [oeuf, piment] }).panier;
verifier("ajout : suppléments dans un autre ordre = même ligne", [ordreB.lignes.length, ordreB.lignes[0].quantite], [1, 2]);

// --- un seul restaurant
const conflit = ajouterAuPanier(un.panier, B, poulet);
verifier("conflit : autre restaurant refusé", conflit.resultat, "conflit");
verifier("conflit : le panier rendu est le même objet", conflit.panier === un.panier, true);
const remplace = ajouterAuPanier(un.panier, B, poulet, { remplacerSiConflit: true });
verifier("conflit : remplacement confirmé", [remplace.resultat, remplace.panier.restaurantId, remplace.panier.restaurantNom, remplace.panier.lignes.map((l) => l.menuItemId)], ["ajoute", "r-b", "Resto B", ["poulet"]]);

// --- limites
let plein: Panier = PANIER_VIDE;
for (let i = 0; i < LIGNES_MAX_PANIER; i++) plein = ajouterAuPanier(plein, A, { id: `p${i}`, nom: `Plat ${i}`, prix: 1000 }).panier;
verifier("limite : 50 lignes au plus", plein.lignes.length, LIGNES_MAX_PANIER);
const refus = ajouterAuPanier(plein, A, { id: "nouveau", nom: "Nouveau", prix: 1000 });
verifier("limite : une 51e ligne est refusée, panier inchangé", [refus.resultat, refus.panier === plein], ["plein", true]);
const encore = ajouterAuPanier(plein, A, { id: "p0", nom: "Plat 0", prix: 1000 });
verifier("limite : un plat déjà présent s'ajoute même panier plein", [encore.resultat, encore.panier.lignes[0].quantite], ["ajoute", 2]);
let max = ajouterAuPanier(PANIER_VIDE, A, riz).panier;
for (let i = 0; i < 40; i++) max = ajouterAuPanier(max, A, riz).panier;
verifier("limite : quantité plafonnée à 30 par ligne", max.lignes[0].quantite, QUANTITE_MAX_LIGNE);

// --- quantités et retrait
const cle = un.panier.lignes[0].cle;
verifier("quantité : fixée", modifierQuantite(un.panier, cle, 5).lignes[0].quantite, 5);
verifier("quantité : plafonnée", modifierQuantite(un.panier, cle, 99).lignes[0].quantite, QUANTITE_MAX_LIGNE);
verifier("quantité : moins de 1 retire la ligne et vide le panier", modifierQuantite(un.panier, cle, 0) === PANIER_VIDE, true);
verifier("quantité : clé inconnue, rien ne change", modifierQuantite(deux.panier, "inconnue", 3).lignes[0].quantite, 2);
const deuxPlats = ajouterAuPanier(un.panier, A, poulet).panier;
const reste = retirerDuPanier(deuxPlats, cle);
verifier("retrait : une ligne partie, le restaurant reste", [reste.lignes.length, reste.restaurantId], [1, "r-a"]);
verifier("retrait : la dernière ligne rend LE panier vide (même référence)", retirerDuPanier(un.panier, cle) === PANIER_VIDE, true);

// --- totaux (GNF entiers)
const garni = ajouterAuPanier(ajouterAuPanier(PANIER_VIDE, A, { ...riz, options: [piment, oeuf] }).panier, A, { ...riz, options: [piment, oeuf] }).panier;
verifier("prix d'une ligne : suppléments inclus", prixLigne(garni.lignes[0]), 30000);
verifier("sous-total : prix x quantité", sousTotalPanier(garni), 60000);
verifier("nombre d'articles : somme des quantités", nombreArticlesPanier(ajouterAuPanier(garni, A, poulet).panier), 3);
verifier("totaux : panier vide", [sousTotalPanier(PANIER_VIDE), nombreArticlesPanier(PANIER_VIDE)], [0, 0]);

// --- miniature
verifier("photo : https gardée", photoSure("https://exemple.org/a.jpg"), "https://exemple.org/a.jpg");
verifier("photo : http refusée", photoSure("http://exemple.org/a.jpg"), null);
verifier("photo : script refusé", photoSure("javascript:alert(1)"), null);
verifier("photo : trop longue refusée", photoSure("https://x.org/" + "a".repeat(500)), null);
verifier("photo : pas une chaîne", photoSure(42), null);

// --- assainissement (le stockage local n'est pas fiable)
verifier("assainir : null, nombre, tableau, texte = panier vide", [null, 3, "x", undefined].map((v) => assainirPanier(v) === PANIER_VIDE), [true, true, true, true]);
verifier("assainir : restaurant manquant = panier vide", assainirPanier({ lignes: [] }) === PANIER_VIDE, true);
verifier("assainir : lignes absentes = panier vide", assainirPanier({ restaurantId: "r-a" }) === PANIER_VIDE, true);
const sale = assainirPanier({
  restaurantId: "r-a",
  restaurantNom: 12,
  lignes: [
    { menuItemId: "ok", nom: "Bon", prix: 1000, quantite: 2, options: [{ id: "o1", nom: "O", prix: 500 }, { id: "x", nom: "Mauvais", prix: -5 }, "n'importe quoi"], photoUrl: "http://non" },
    { menuItemId: "flottant", nom: "Prix décimal", prix: 10.5, quantite: 1 },
    { menuItemId: "negatif", nom: "Prix négatif", prix: -1, quantite: 1 },
    { menuItemId: "zero", nom: "Quantité nulle", prix: 1000, quantite: 0 },
    { menuItemId: "texte", nom: "Quantité texte", prix: 1000, quantite: "2" },
    { menuItemId: 7, nom: "Identifiant numérique", prix: 1000, quantite: 1 },
    { menuItemId: "enorme", nom: "Trop", prix: 1000, quantite: 500 },
    null,
    "ligne",
  ],
});
verifier("assainir : seules les lignes valides restent", sale.lignes.map((l) => l.menuItemId), ["ok", "enorme"]);
verifier("assainir : nom de restaurant non texte = null", sale.restaurantNom, null);
verifier("assainir : suppléments invalides écartés", sale.lignes[0].options.map((o) => o.id), ["o1"]);
verifier("assainir : clé recalculée", sale.lignes[0].cle, "ok|o1");
verifier("assainir : miniature non https écartée", sale.lignes[0].photoUrl, null);
verifier("assainir : quantité plafonnée", sale.lignes[1].quantite, QUANTITE_MAX_LIGNE);
const rond = assainirPanier(JSON.parse(JSON.stringify(garni)));
verifier("assainir : un panier valide traverse le stockage sans changement", rond, { ...garni, lignes: garni.lignes.map((l) => ({ ...l, photoUrl: null })) });

if (ko > 0) process.exit(1);
