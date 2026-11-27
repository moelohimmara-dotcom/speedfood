import { calculerScore, etapeDegradation, pourcentage } from "../../src/lib/restaurant/score-qualite.ts";

let echecs = 0;
function verifier(nom: string, reel: unknown, attendu: unknown) {
  const ok = JSON.stringify(reel) === JSON.stringify(attendu);
  if (!ok) echecs += 1;
  console.log(`${ok ? "OK  " : "ECHEC"} ${nom}${ok ? "" : ` : recu ${JSON.stringify(reel)}, attendu ${JSON.stringify(attendu)}`}`);
}

const plein = { acceptationDelai: 100, preparationTenue: 100, exactitude: 100, note: 100, ficheComplete: 100, disponibilite: 100 };
verifier("score parfait : 100, excellent, tous les avantages", calculerScore(plein), { score: 100, palier: "excellent", avantages: { miseEnAvant: true, badge: true, promotions: true, commissionReduite: true } });
verifier("score nul : 0, mauvais, aucun avantage", calculerScore({ acceptationDelai: 0, preparationTenue: 0, exactitude: 0, note: 0, ficheComplete: 0, disponibilite: 0 }).palier, "mauvais");
verifier("sans avis : la note absente ne compte ni pour ni contre", calculerScore({ ...plein, note: null }).score, 100);
verifier("aucun indicateur : 0", calculerScore({ acceptationDelai: null, preparationTenue: null, exactitude: null, note: null, ficheComplete: null, disponibilite: null }).score, 0);
verifier("paliers : 80 excellent, 65 très bon, 50 bon, 35 moyen, 34 mauvais", [80, 65, 50, 35, 34].map((s) => calculerScore({ ...plein, acceptationDelai: s, preparationTenue: s, exactitude: s, note: s, ficheComplete: s, disponibilite: s }).palier), ["excellent", "tres_bon", "bon", "moyen", "mauvais"]);
verifier("pourcentage : dénominateur vide = absent, pas zéro", [pourcentage(3, 4), pourcentage(1, 0)], [75, null]);
verifier("seuils réglés en console : 70 devient excellent, le score ne bouge pas", (() => { const ind = { ...plein, acceptationDelai: 70, preparationTenue: 70, exactitude: 70, note: 70, ficheComplete: 70, disponibilite: 70 }; const r = calculerScore(ind, { excellent: 70, tresBon: 55, bon: 40, moyen: 25 }); return [r.score, r.palier, calculerScore(ind).palier]; })(), [70, "excellent", "tres_bon"]);
verifier("dégradation : échelle complète, retrait jamais automatique", [0, 1, 2, 3, 4, 5, 9].map(etapeDegradation), ["aucune", "avertissement_1", "avertissement_2_contact", "retrait_avantages", "suspension", "retrait_decision_humaine", "retrait_decision_humaine"]);

console.log(echecs === 0 ? "\nSCORE QUALITÉ : tous les contrôles passent." : `\n${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
