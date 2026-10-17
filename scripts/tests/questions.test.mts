import {
  QUESTIONS_SECURITE,
  apresEchec,
  empreinteCode,
  empreinteReponses,
  erreurReponse,
  estCleQuestionValide,
  genererCodesSecours,
  genererSel,
  memeEmpreinte,
  minutesDeBlocage,
  normaliserCode,
  normaliserReponse,
  ressembleACodeSecours,
} from "../../src/lib/auth/questions";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- normalisation
verifier("normalisation : casse, accents et espaces", normaliserReponse("  Cônakry  "), "conakry");
verifier("normalisation : ponctuation de bord", normaliserReponse("Conakry."), "conakry");
verifier("normalisation : espaces multiples", normaliserReponse("Saint   Jean"), "saint jean");
verifier("normalisation : apostrophe et tiret traités comme des espaces", normaliserReponse("N'Zérékoré-Ville"), "n zerekore ville");

// --- empreinte des réponses
const sel = genererSel();
verifier("sel : 32 caractères hexadécimaux", /^[0-9a-f]{32}$/.test(sel), true);
verifier("sel : deux tirages différents", sel !== genererSel(), true);
const e1 = await empreinteReponses("Conakry", "Sékou", sel, 10_000);
verifier("empreinte : 64 caractères hexadécimaux", /^[0-9a-f]{64}$/.test(e1), true);
verifier("empreinte : insensible à la casse, aux accents et aux espaces", memeEmpreinte(e1, await empreinteReponses("  CONAKRY ", "sekou.", sel, 10_000)), true);
verifier("empreinte : une réponse fausse échoue", memeEmpreinte(e1, await empreinteReponses("Conakry", "Sekouba", sel, 10_000)), false);
verifier("empreinte : l'ordre des réponses compte", memeEmpreinte(e1, await empreinteReponses("Sékou", "Conakry", sel, 10_000)), false);
verifier("empreinte : déplacer la frontière entre les deux réponses ne donne pas la même empreinte", memeEmpreinte(await empreinteReponses("ab", "cd", sel, 10_000), await empreinteReponses("abc", "d", sel, 10_000)), false);
verifier("empreinte : un autre sel donne une autre empreinte", memeEmpreinte(e1, await empreinteReponses("Conakry", "Sékou", genererSel(), 10_000)), false);
verifier("comparaison : longueurs différentes", memeEmpreinte("abc", "abcd"), false);

// --- réponses acceptées à l'activation
verifier("réponse trop courte refusée", erreurReponse("ab") !== null, true);
verifier("réponse de ponctuation seule refusée", erreurReponse("...") !== null, true);
verifier("réponse trop longue refusée", erreurReponse("x".repeat(81)) !== null, true);
verifier("réponse normale acceptée", erreurReponse("Conakry"), null);

// --- questions
verifier("liste : 10 questions, clés uniques", [QUESTIONS_SECURITE.length, new Set(QUESTIONS_SECURITE.map((q) => q.cle)).size], [10, 10]);
verifier("clé valide / inconnue", [estCleQuestionValide("premier_ecole"), estCleQuestionValide("inconnue")], [true, false]);

// --- codes de secours
const codes = genererCodesSecours();
verifier("codes : 8 codes distincts", [codes.length, new Set(codes).size], [8, 8]);
verifier("codes : format XXXXX-XXXXX sans caractère ambigu", codes.every((c) => /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/.test(c)), true);
verifier("codes : se reconnaissent à la saisie", codes.every((c) => ressembleACodeSecours(c)), true);
verifier("codes : saisie en minuscules et sans tiret acceptée", normaliserCode(codes[0].toLowerCase().replace("-", " ")), normaliserCode(codes[0]));
verifier("codes : une saisie absurde est écartée", [ressembleACodeSecours("abc"), ressembleACodeSecours("")], [false, false]);
verifier("codes : empreinte stable et insensible à la présentation", await empreinteCode(codes[0]), await empreinteCode(codes[0].toLowerCase().replace("-", " ")));
verifier("codes : deux codes ont deux empreintes", (await empreinteCode(codes[0])) !== (await empreinteCode(codes[1])), true);

// --- essais et blocage
const t = new Date("2026-10-17T12:00:00Z");
verifier("essais : un échec ne bloque pas", apresEchec(0, t), { essais: 1, bloqueJusqu: null });
verifier("essais : le quatrième échec ne bloque pas", apresEchec(3, t), { essais: 4, bloqueJusqu: null });
const cinq = apresEchec(4, t);
verifier("essais : le cinquième échec bloque 15 minutes et remet le compteur à zéro", [cinq.essais, cinq.bloqueJusqu?.toISOString()], [0, "2026-10-17T12:15:00.000Z"]);
verifier("blocage : minutes restantes arrondies au-dessus", minutesDeBlocage("2026-10-17T12:15:00Z", new Date("2026-10-17T12:00:30Z")), 15);
verifier("blocage : terminé", minutesDeBlocage("2026-10-17T12:15:00Z", new Date("2026-10-17T12:15:00Z")), 0);
verifier("blocage : absent", minutesDeBlocage(null, t), 0);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
