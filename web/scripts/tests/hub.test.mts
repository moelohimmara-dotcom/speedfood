import { etatsHub, motHub, type DonneesHub } from "../../src/lib/restaurant/hub";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const complet: DonneesHub = { publie: true, photo: true, logo: true, horaires: true, paiement: true, quartierChoisi: true, zonesDesservies: 3, identiteDocuments: true };
const carte = (d: Partial<DonneesHub>, cle: string) => etatsHub({ ...complet, ...d }).cartes.find((c) => c.cle === cle);

verifier("hub : tout est prêt", [etatsHub(complet).pretes, etatsHub(complet).total], [4, 4]);
verifier("hub : la sécurité n'a pas d'état et ne compte pas", carte({}, "securite"), { cle: "securite", etat: null, etiquette: null });
verifier("hub : photo manquante", carte({ photo: false }, "page")?.etiquette, "Photo manquante");
verifier("hub : logo manquant", carte({ logo: false }, "page")?.etiquette, "Logo manquant");
verifier("hub : horaires manquants", carte({ horaires: false }, "page")?.etiquette, "Horaires manquants");
verifier("hub : paiement à choisir", carte({ paiement: false }, "page")?.etiquette, "Paiement à choisir");
verifier("hub : une seule chose manquante est annoncée, la première", carte({ photo: false, logo: false, paiement: false }, "page")?.etiquette, "Photo manquante");
verifier("hub : page incomplète = à compléter", carte({ logo: false }, "page")?.etat, "a_completer");
verifier("hub : zones, pluriel", carte({ zonesDesservies: 3 }, "zones")?.etiquette, "3 zones");
verifier("hub : zones, singulier", carte({ zonesDesservies: 1 }, "zones")?.etiquette, "1 zone");
verifier("hub : quartier choisi sans zone de livraison = prêt", [carte({ zonesDesservies: 0 }, "zones")?.etat, carte({ zonesDesservies: 0 }, "zones")?.etiquette], ["pret", "Prêt"]);
verifier("hub : quartier non choisi", [carte({ quartierChoisi: false }, "zones")?.etat, carte({ quartierChoisi: false }, "zones")?.etiquette], ["a_completer", "Quartier à choisir"]);
verifier("hub : affiche avant publication", [carte({ publie: false }, "affiche")?.etat, carte({ publie: false }, "affiche")?.etiquette], ["a_completer", "Après publication"]);
verifier("hub : documents sans identité", [carte({ identiteDocuments: false }, "documents")?.etat, carte({ identiteDocuments: false }, "documents")?.etiquette], ["a_completer", "À compléter"]);
verifier("hub : décompte avec deux manques", [etatsHub({ ...complet, logo: false, identiteDocuments: false }).pretes, etatsHub({ ...complet, logo: false, identiteDocuments: false }).total], [2, 4]);
verifier("hub : mot, avancement partiel (deux détails)", motHub(2, 4).includes("2 petits détails"), true);
verifier("hub : mot, un seul détail", motHub(3, 4).includes("Un petit détail"), true);
verifier("hub : mot, tout est prêt", motHub(4, 4).startsWith("Tout est en place"), true);

if (ko > 0) process.exit(1);
