/**
 * Tests du profil client.
 *
 * Ces fonctions produisent les DEUX colonnes que la table `client_profils` refuse d'accepter si elles sont fausses :
 * `pseudo` (3 à 24 caractères, caractères autorisés) et `avatar` (liste fermée). Une valeur hors contrainte fait
 * échouer l'insertion entière — c'est-à-dire perd les coordonnées du client, sans message d'erreur visible.
 */
import { AVATARS, avatarPourGraine, pseudoPourCompte, validerPseudo } from "../../src/lib/client/profil";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC profil : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    profil : ${nom}`);
  }
}
function affirmer(nom: string, condition: boolean) {
  verifier(nom, condition, true);
}

const alea = () => 0.5;

// --- pseudoPourCompte : le nom saisi quand il est conforme, un pseudo amusant sinon ---

verifier("un nom court devient le pseudo", pseudoPourCompte("Awa Diallo", alea), "Awa Diallo");
verifier("des espaces multiples sont réduits", pseudoPourCompte("Awa   Diallo", alea), "Awa Diallo");
verifier("les espaces de début et fin sont retirés", pseudoPourCompte("  Awa Diallo ", alea), "Awa Diallo");
affirmer(
  "un nom trop long pour la contrainte (24 caractères) reçoit un pseudo automatique",
  pseudoPourCompte("Jean-Baptiste Nkoulou Diaw", alea) !== "Jean-Baptiste Nkoulou Diaw"
);
affirmer(
  "un nom avec des caractères interdits reçoit un pseudo automatique",
  pseudoPourCompte("Awa <script>", alea) !== "Awa <script>"
);
affirmer("un nom trop court reçoit un pseudo automatique", pseudoPourCompte("A", alea) !== "A");

// --- dans tous les cas, le pseudo produit passe la validation de la table ---

const nomsEssayes = ["Awa Diallo", "Jean-Baptiste Nkoulou Diaw", "Awa <script>", "A", "", "   ", "Éléonore Kanko"];
for (const nom of nomsEssayes) {
  const propre = nom.replace(/\s+/g, " ").trim();
  const resultat = validerPseudo(pseudoPourCompte(nom, alea));
  affirmer("un pseudo valide meme pour « " + (propre || "vide") + " »", resultat.ok);
}

// --- avatarPourGraine : toujours dans la liste fermée, et stable pour un même compte ---

const cles = AVATARS.map((a) => a.cle);
affirmer("l'avatar par défaut est dans la liste fermée", cles.includes(avatarPourGraine("991fcc7c-6171-4707-a6d5-cd8a0dbf0576")));
verifier(
  "le même compte garde toujours le même avatar",
  avatarPourGraine("991fcc7c-6171-4707-a6d5-cd8a0dbf0576"),
  avatarPourGraine("991fcc7c-6171-4707-a6d5-cd8a0dbf0576")
);
affirmer(
  "deux comptes différents ne finissent pas toujours sur le même avatar",
  avatarPourGraine("aaaaaaaa-1111") !== avatarPourGraine("bbbbbbbb-2222")
);
affirmer("une graine vide ne plante pas", cles.includes(avatarPourGraine("")));
// Le type de retour l'interdit déjà à la compilation : aucune graine ne peut produire « default ».

if (ko) {
  console.log(`\n${ko} test(s) en échec sur ${total}`);
  process.exit(1);
}
console.log(`\nTout est bon : ${total} tests profil`);