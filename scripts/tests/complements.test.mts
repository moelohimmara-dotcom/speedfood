/**
 * Tests des complements de panier.
 *
 * Ce module promet au client des suggestions **explicables** : chaque
 * proposition doit savoir dire pourquoi elle est faite. Un test qui n'affirme
 * que « il y a une suggestion » laisserait passer une machine à gonfler le
 * panier qui proposerait n'importe quoi.
 */
import {
  famillePlat,
  proposerComplements,
  SUGGESTIONS_MAX,
  type PlatSuggestion,
} from "../../src/lib/panier/complements";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC complements : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    complements : ${nom}`);
  }
}

const plat = (id: string, nom: string, prix = 20000, aConfirmer = false): PlatSuggestion => ({
  id,
  nom,
  prix,
  aConfirmer,
});

const MENU = [
  plat("riz", "Riz sauce feuille", 25000),
  plat("poulet", "Poulet braisé", 40000),
  plat("soupe", "Soupe de gombo", 12000),
  plat("bissap", "Bissap frais", 8000),
  plat("eau", "Eau minérale 50cl", 5000),
  plat("salade", "Salade avocat et crevettes", 18000),
];

// --- Classification ------------------------------------------------------
verifier("un platriz n'est pas une boisson", famillePlat("Riz gras sauce arachide"), "plat");
verifier("bissap est une boisson", famillePlat("Bissap frais"), "boisson");
verifier("eau minerale est une boisson", famillePlat("Eau minérale 50cl"), "boisson");
verifier("la soupe est une entree", famillePlat("Soupe de gombo"), "entree");
verifier("les accents ne trompent pas", famillePlat("Jus d'orange pressé"), "boisson");

// --- Une boisson manquante est proposée ----------------------------------
verifier(
  "un plat seul propose la boisson la moins chere, puis une entree",
  proposerComplements([{ menuItemId: "riz", nom: "Riz sauce feuille" }], MENU),
  [
    { plat: plat("eau", "Eau minérale 50cl", 5000), raison: "Pour accompagner votre plat" },
    { plat: plat("soupe", "Soupe de gombo", 12000), raison: "À partager avant le plat" },
  ]
);

verifier(
  "une entree seule propose la boisson ET un plat pour la completer",
  proposerComplements([{ menuItemId: "soupe", nom: "Soupe de gombo" }], MENU).map((s) => s.plat.id),
  ["eau", "riz"]
);

// --- Pas de doublon -------------------------------------------------------
// Règle 3 : un panier « plat + boisson » sans entrée déclenche la proposition
// d'une entrée à partager. Il ne faut donc pas confondre « pas de boisson
// proposée » avec « rien n'est proposé ».
verifier(
  "un panier plat + boisson propose une entree, pas une seconde boisson",
  proposerComplements(
    [
      { menuItemId: "riz", nom: "Riz sauce feuille" },
      { menuItemId: "bissap", nom: "Bissap frais" },
    ],
    MENU
  ).map((s) => s.plat.id),
  ["soupe"]
);

verifier(
  "un panier deja complet (plat, boisson, entree) ne propose rien",
  proposerComplements(
    [
      { menuItemId: "riz", nom: "Riz sauce feuille" },
      { menuItemId: "bissap", nom: "Bissap frais" },
      { menuItemId: "soupe", nom: "Soupe de gombo" },
    ],
    MENU
  ),
  []
);

verifier(
  "on ne propose jamais un plat deja dans le panier",
  proposerComplements(
    [
      { menuItemId: "riz", nom: "Riz sauce feuille" },
      { menuItemId: "eau", nom: "Eau minérale 50cl" },
      { menuItemId: "bissap", nom: "Bissap frais" },
    ],
    MENU
  ).map((s) => s.plat.id),
  ["soupe"]
);

// --- Complément d'un plat par une entrée ----------------------------------
verifier(
  "un plat et sa boisson propose une entree a partager",
  proposerComplements(
    [
      { menuItemId: "poulet", nom: "Poulet braisé" },
      { menuItemId: "eau", nom: "Eau minérale 50cl" },
    ],
    MENU
  ).map((s) => s.plat.id),
  ["soupe"]
);

// --- Cas limites ----------------------------------------------------------
verifier("un panier vide ne propose rien", proposerComplements([], MENU), []);
verifier("un restaurant sans plat ne propose rien", proposerComplements([{ menuItemId: "riz", nom: "Riz" }], []), []);
verifier(
  "un menu uniquement de plats ne propose pas de boisson inventee",
  proposerComplements([{ menuItemId: "riz", nom: "Riz sauce feuille" }], [plat("riz", "Riz gras", 25000)]),
  []
);
verifier(
  "un prix nul n'est pas propose comme cadeau",
  proposerComplements(
    [{ menuItemId: "riz", nom: "Riz sauce feuille" }],
    [plat("eau", "Eau minérale", 0)]
  ),
  []
);
verifier(
  "le nombre de suggestions est plafonne",
  proposerComplements(
    [{ menuItemId: "riz", nom: "Riz sauce feuille" }],
    MENU
  ).length <= SUGGESTIONS_MAX,
  true
);

// --- Le point qui compte le plus ------------------------------------------
// Si aucune règle ne s'applique, on ne comble pas. Proposer un plat au hasard
// se lirait comme une recommandation : c'est exactement ce que ce bloc promet
// de ne pas faire.
verifier(
  "aucune regle applicable : aucune suggestion plutot qu'un hasard",
  proposerComplements(
    [{ menuItemId: "riz", nom: "Riz sauce feuille" }],
    [plat("riz2", "Riz gras", 25000), plat("poulet2", "Poulet Yassa", 35000)]
  ),
  []
);

// --- Un plat « à confirmer » reste proposé, mais annoncé --------------------
// Le filtrage se fait dans la route (comme sur la fiche restaurant) ; ici on
// vérifie que la proposition porte l'information jusqu'au client.
verifier(
  "la suggestion conserve l'etat a confirmer",
  proposerComplements(
    [{ menuItemId: "riz", nom: "Riz sauce feuille" }],
    [plat("eau", "Eau minérale 50cl", 5000, true)]
  ).map((s) => s.plat.aConfirmer),
  [true]
);