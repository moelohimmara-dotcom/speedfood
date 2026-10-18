import {
  appliquerAuTexte,
  construireRemplacements,
  correspondA,
  estNonEnregistre,
  filtrerChamps,
  lireMessageApercu,
  niveauCompteur,
  resumerGroupes,
  type EtatChamp,
} from "../../src/lib/cms/apercu-textes";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- remplacements
verifier("seuls les champs changés et non vides", construireRemplacements([
  { enLigne: "Voir les restaurants", saisie: "Trouver un restaurant" },
  { enLigne: "Tous", saisie: "Tous" },
  { enLigne: "Titre", saisie: "   " },
  { enLigne: "", saisie: "Quelque chose" },
]), { "Voir les restaurants": "Trouver un restaurant" });
verifier("espaces de bord ignorés dans la clé et la valeur", construireRemplacements([{ enLigne: "  Bonjour ", saisie: " Salut  " }]), { Bonjour: "Salut" });
verifier("aucun champ : table vide", Object.keys(construireRemplacements([])).length, 0);

// --- application à un nœud texte
const table = { "De la recherche à": "Du choix à" };
verifier("remplace en gardant l'espace final du nœud", appliquerAuTexte("De la recherche à ", table), "Du choix à ");
verifier("remplace en gardant les espaces des deux côtés", appliquerAuTexte("  De la recherche à\n", table), "  Du choix à\n");
verifier("texte inconnu : inchangé", appliquerAuTexte("Autre chose", table), "Autre chose");
verifier("nœud vide ou espaces : inchangé", [appliquerAuTexte("", table), appliquerAuTexte("   ", table)], ["", "   "]);
verifier("les propriétés héritées ne sont pas des textes (constructor, __proto__)", [appliquerAuTexte("constructor", table), appliquerAuTexte("__proto__", table)], ["constructor", "__proto__"]);
verifier("espace insécable conservé à l'intérieur", appliquerAuTexte("Disponibilité :", { "Disponibilité :": "Dispo :" }), "Dispo :");

// --- messages reçus par le pont
verifier("message de textes valide", lireMessageApercu({ type: "sf-textes", remplacements: { a: "b" } })?.type, "sf-textes");
verifier("message « aller » valide", lireMessageApercu({ type: "sf-aller", texte: "Titre" }), { type: "sf-aller", texte: "Titre" });
verifier("type inconnu, absent ou non objet : ignoré", [lireMessageApercu({ type: "autre" }), lireMessageApercu(null), lireMessageApercu("sf-textes"), lireMessageApercu(42)], [null, null, null, null]);
verifier("valeurs non textuelles refusées", lireMessageApercu({ type: "sf-textes", remplacements: { a: 3 } }), null);
verifier("tableau à la place de la table refusé", lireMessageApercu({ type: "sf-textes", remplacements: ["a"] }), null);
verifier("texte trop long refusé", lireMessageApercu({ type: "sf-aller", texte: "x".repeat(1001) }), null);
verifier("trop de remplacements refusé", lireMessageApercu({ type: "sf-textes", remplacements: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, "v"])) }), null);

// --- état des champs
const champ = (cle: string, groupe: string, libelle: string, defaut: string, enLigne: string, saisie: string, personnalise = enLigne !== defaut): EtatChamp => ({ cle, groupe, libelle, defaut, enLigne, personnalise, saisie });
const champs = [
  champ("a.titre", "Haut", "Titre de la page", "Bienvenue", "Bienvenue", "Bienvenue"),
  champ("a.bouton", "Haut", "Bouton principal", "Voir", "Voir", "Voir tout"),
  champ("b.kicker", "Étapes", "Petit titre", "Quatre étapes", "Trois étapes", "Trois étapes"),
  champ("b.titre", "Étapes", "Titre", "Commander", "Commander", " Commander "),
];
verifier("non enregistré : espaces de bord ignorés", champs.map(estNonEnregistre), [false, true, false, false]);
verifier("filtre « personnalisés »", filtrerChamps(champs, "", "personnalises").map((c) => c.cle), ["b.kicker"]);
verifier("filtre « non enregistrés »", filtrerChamps(champs, "", "non_enregistres").map((c) => c.cle), ["a.bouton"]);
verifier("recherche sans accents ni casse", filtrerChamps(champs, "ETAPES", "tous").map((c) => c.cle), ["b.kicker"]);
verifier("recherche dans le libellé", filtrerChamps(champs, "petit", "tous").map((c) => c.cle), ["b.kicker"]);
verifier("recherche dans le texte saisi", filtrerChamps(champs, "voir tout", "tous").map((c) => c.cle), ["a.bouton"]);
verifier("recherche dans le défaut et la clé", [correspondA(champs[2], "quatre"), correspondA(champs[0], "a.titre")], [true, true]);
verifier("recherche + filtre combinés", filtrerChamps(champs, "voir", "non_enregistres").map((c) => c.cle), ["a.bouton"]);
verifier("résumé par groupe, ordre conservé", resumerGroupes(champs), [
  { nom: "Haut", total: 2, personnalises: 0, nonEnregistres: 1 },
  { nom: "Étapes", total: 2, personnalises: 1, nonEnregistres: 0 },
]);

// --- compteur
verifier("compteur : ok / proche / dépasse", [niveauCompteur(50, 100), niveauCompteur(90, 100), niveauCompteur(100, 100), niveauCompteur(101, 100)], ["ok", "proche", "proche", "depasse"]);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
