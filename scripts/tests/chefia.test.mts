/**
 * Tests du « Chef IA » : ce qu'on accepte — ou surtout ce qu'on REFUSE —
 * d'écrire dans le menu à partir d'une photo.
 *
 * Un modèle vision se trompe de façon très spécifique : il confond 25 000 et
 * 250, il rend « 25000F » à côté d'un plat, il recopie une mention
 * (« service compris ») comme un prix. Chaque cas testé ici est un bug réel
 * qui, sans cette couche de validation, aurait mis un prix faux en ligne au
 * nom du restaurateur.
 */
import {
  analyserReponseModele,
  construireConsigne,
  extraireJson,
  lirePrix,
  normaliserLibelle,
  rapprocherSection,
  PLATS_MAX_PAR_ANALYSE,
} from "../../src/lib/menu/chefMenu";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC chef-ia : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    chef-ia : ${nom}`);
  }
}

const SECTIONS = [
  { id: "s1", nom: "Entrées" },
  { id: "s2", nom: "Plats" },
];
const OPTIONS = { prixMax: 100000, sections: SECTIONS };

// --- Lecture des prix ---------------------------------------------------
// Le piège historique de `parseInt("25 000 GNF")` vaut 25 : tout le bloc existe
// pour l'empêcher, et chaque format doit donner le MÊME résultat.
verifier("prix entier direct", lirePrix(25000), 25000);
verifier("prix séparé par des espaces", lirePrix("25 000"), 25000);
verifier("prix avec devise", lirePrix("25 000 GNF"), 25000);
verifier("prix avec suffixe F", lirePrix("40000F"), 40000);
verifier("prix au format guinéen 25.000", lirePrix("25.000"), 25000);
verifier("prix décimal arrondi", lirePrix("25.5"), 26);
verifier("prix absent", lirePrix(null), null);
verifier("prix non numérique", lirePrix("sur demande"), null);
verifier("prix chaîne vide", lirePrix(""), null);
verifier("zéro est un prix valide", lirePrix(0), 0);

// --- Extraction du JSON sous le bruit du modèle -------------------------
// Le cas du tableau nu est celui réellement observé sur une vraie carte : le
// modèle renvoie `[{"nom":…}]` malgré la consigne qui demande un objet. Chercher
// une accolade ouvrante suffisait à faire échouer toute la lecture.
verifier(
  "JSON entouré d'un raisonnement",
  extraireJson('Voici ma lecture :\n{"plats":[{"nom":"Riz","prix":25000}]}\nFin.'),
  '{"plats":[{"nom":"Riz","prix":25000}]}'
);
verifier(
  "tableau nu, sans objet enveloppant",
  extraireJson('[{"nom":"Riz","prix":25000}]'),
  '[{"nom":"Riz","prix":25000}]'
);
verifier(
  "tableau encadré d'un raisonnement",
  extraireJson('Voici :\n[\n  {"nom": "Riz", "prix": 25000}\n]\nFin.'),
  '[\n  {"nom": "Riz", "prix": 25000}\n]'
);
verifier("JSON dans un bloc de code", extraireJson('```json\n{"plats":[]}\n```'), '{"plats":[]}');
verifier("pas de JSON du tout", extraireJson("je ne vois rien"), null);

verifier(
  "un tableau de plats est analysé comme un objet enveloppant",
  analyserReponseModele('[{"nom":"Riz sauce feuille","prix":25000,"section":"Plats"}]', OPTIONS),
  {
    plats: [
      { nom: "Riz sauce feuille", description: "", prix: 25000, section: "Plats", section_id: "s2" },
    ],
    refuses: [],
    sectionsInconnues: [],
    etat: "plats",
  }
);

// --- Rapprochement des sections ----------------------------------------
verifier("section exacte", rapprocherSection("Plats", SECTIONS), "s2");
verifier("section sans accents", rapprocherSection("entrees", SECTIONS), "s1");
verifier("section approchante", rapprocherSection("Poissons", [{ id: "s3", nom: "Poissons" }]), "s3");
verifier("section inconnue, rien n'est créé", rapprocherSection("Desserts", SECTIONS), null);
verifier("pas de section du tout", rapprocherSection(null, SECTIONS), null);

verifier("normalisation des accents", normaliserLibelle("Rôti de bœuf"), "roti de boeuf");

// --- Analyse complète d'une réponse ------------------------------------
verifier(
  "carte complète, deux plats et une section",
  analyserReponseModele(
    JSON.stringify({
      plats: [
        { nom: "Riz sauce feuille", prix: 25000, description: "Riz parfumé", section: "Plats" },
        { nom: "Poulet braisé", prix: "40 000 GNF", description: "", section: "Plats" },
      ],
    }),
    OPTIONS
  ),
  {
    plats: [
      { nom: "Riz sauce feuille", description: "Riz parfumé", prix: 25000, section: "Plats", section_id: "s2" },
      { nom: "Poulet braisé", description: "", prix: 40000, section: "Plats", section_id: "s2" },
    ],
    refuses: [],
    sectionsInconnues: [],
    etat: "plats",
  }
);

verifier(
  "un prix illisible est refusé, pas deviné",
  analyserReponseModele(
    JSON.stringify({ plats: [{ nom: "Pastels", prix: null }, { nom: "Riz", prix: 25000 }] }),
    OPTIONS
  ),
  {
    plats: [{ nom: "Riz", description: "", prix: 25000, section: null, section_id: null }],
    refuses: [{ brut: "Pastels", raison: "prix illisible — à saisir à la main" }],
    sectionsInconnues: [],
    etat: "plats",
  }
);

verifier(
  // Le message contient un nombre formaté à la française, dont l'espace fine
  // insécable varie selon l'ICU du poste : on compare sur du texte normalisé,
  // sinon le test échouerait chez un collègue pour une raison invisible.
  "un prix aberrant est refusé avec sa raison",
  analyserReponseModele(JSON.stringify({ plats: [{ nom: "Plateau", prix: 900000000 }] }), OPTIONS)
    .refuses[0].raison.replace(/\s/g, " "),
  "prix hors limites (0 à 100 000 GNF)"
);

verifier(
  "un doublon n'est compté qu'une fois",
  analyserReponseModele(
    JSON.stringify({
      plats: [
        { nom: "Riz", prix: 25000 },
        { nom: "  riz ", prix: 30000 },
      ],
    }),
    OPTIONS
  ).plats.length,
  1
);

verifier(
  "une section inconnue est signalée sans être créée",
  analyserReponseModele(JSON.stringify({ plats: [{ nom: "Tarte", prix: 10000, section: "Desserts" }] }), OPTIONS),
  {
    plats: [{ nom: "Tarte", description: "", prix: 10000, section: "Desserts", section_id: null }],
    refuses: [],
    sectionsInconnues: ["Desserts"],
    etat: "plats",
  }
);

verifier(
  "une réponse hors JSON ne fait pas planter, elle se signale",
  analyserReponseModele("La photo est trop floue.", OPTIONS),
  {
    plats: [],
    refuses: [{ brut: "La photo est trop floue.", raison: "réponse illisible" }],
    sectionsInconnues: [],
    etat: "indetermine",
  }
);

verifier(
  "le nombre de plats est plafonné",
  analyserReponseModele(
    JSON.stringify({
      plats: Array.from({ length: 80 }, (_, i) => ({ nom: `Plat ${i}`, prix: 10000 })),
    }),
    OPTIONS
  ).plats.length,
  PLATS_MAX_PAR_ANALYSE
);

verifier(
  "la consigne interdit d'inventer un prix",
  construireConsigne().includes("ne devine JAMAIS un prix"),
  true
);

// --- Le modèle ne répond pas toujours dans la langue de la consigne -------
// Constaté le 9 octobre sur une photo penchée : selon l'image, la réponse est
// en `nom`/`prix` ou en `name`/`price`. Ne lire qu'une écriture faisait perdre
// toute la lecture, silencieusement, chaque ligne partant au compteur
// « refusées » et l'écran annonçant « aucun plat lisible ».
verifier(
  "réponse en anglais (name/price)",
  analyserReponseModele(
    JSON.stringify([
      { name: "Riz gras", price: 25000, section: "PLATS" },
      { name: "Gateau", price: null, section: "DESSERTS" },
    ]),
    OPTIONS
  ),
  {
    plats: [{ nom: "Riz gras", description: "", prix: 25000, section: "PLATS", section_id: "s2" }],
    refuses: [{ brut: "Gateau", raison: "prix illisible — à saisir à la main" }],
    // « DESSERTS » n'apparaît pas : une ligne écartée pour son prix n'est jamais
    // rapprochée d'une section, sinon on demanderait au restaurateur de créer
    // une section pour un plat qu'il n'aura pas.
    sectionsInconnues: [],
    etat: "plats",
  }
);

// --- Distinguer « rien trouvé » de « pas compris » -------------------------
verifier("un modèle qui répond vide", analyserReponseModele("[]", OPTIONS).etat, "vide");
verifier("une réponse hors forme", analyserReponseModele('{"titre":"Menu"}', OPTIONS).etat, "indetermine");
verifier("du texte sans JSON", analyserReponseModele("je ne vois pas de menu", OPTIONS).etat, "indetermine");
verifier("des plats refusés ne sont pas un modèle vide", analyserReponseModele(
  JSON.stringify([{ nom: "Riz", prix: null }]),
  OPTIONS
).etat, "indetermine");

if (ko > 0) {
  console.log(`\n${ko} test(s) en échec sur ${total}`);
  process.exit(1);
}
console.log(`\nTout est bon : ${total} tests Chef IA`);