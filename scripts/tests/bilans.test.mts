import { bilansJourEtSemaine, debutDuJour, repartitionStatuts } from "../../src/lib/api/bilans";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const maintenant = Date.parse("2026-10-22T15:00:00Z");
verifier("début du jour = 00:00 UTC", new Date(debutDuJour(maintenant)).toISOString(), "2026-10-22T00:00:00.000Z");

const lignes = [
  { quand: "2026-10-22T09:00:00Z", montantGnf: 30000 }, // aujourd'hui
  { quand: "2026-10-22T14:59:00Z", montantGnf: 20000 }, // aujourd'hui
  { quand: "2026-10-21T23:59:00Z", montantGnf: 10000 }, // hier : semaine seulement
  { quand: "2026-10-16T00:00:00Z", montantGnf: 5000 }, // il y a 6 jours : dans la semaine
  { quand: "2026-10-15T23:59:00Z", montantGnf: 99999 }, // il y a 7 jours : hors semaine
  { quand: "pas une date", montantGnf: 1234 }, // ignorée
  { quand: "2026-10-23T09:00:00Z", montantGnf: 7777 }, // dans le futur : ignorée
  { quand: "2026-10-22T10:00:00Z", montantGnf: -500 }, // montant invalide : compté sans montant
];
const b = bilansJourEtSemaine(lignes, maintenant);
verifier("aujourd'hui : nombre et montant", b.aujourdhui, { nombre: 3, montantGnf: 50000 });
verifier("semaine : nombre et montant", b.semaine, { nombre: 5, montantGnf: 65000 });
verifier("aucune ligne : zéros", bilansJourEtSemaine([], maintenant), { aujourdhui: { nombre: 0, montantGnf: 0 }, semaine: { nombre: 0, montantGnf: 0 } });
verifier("montants entiers", Number.isInteger(b.semaine.montantGnf), true);

verifier(
  "répartition des commandes par issue",
  repartitionStatuts(["terminee", "terminee", "refusee", "annulee", "en_attente", "acceptee", "prete"]),
  { recues: 7, terminees: 2, refusees: 1, annulees: 1, enCours: 3 }
);

if (ko > 0) process.exit(1);
