import { construireLienWhatsApp, messageSupportValide, MODELES_REPONSE, statutFilValide } from "../../src/lib/system-admin/support-regles";
let total = 0; let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) { total++; if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) { ko++; console.log(`ECHEC support : ${nom}`); } else console.log(`OK    support : ${nom}`); }
verifier("statut ouvert valide", statutFilValide("ouvert"), true);
verifier("statut inconnu refusé", statutFilValide("ferme"), false);
verifier("message vide refusé", messageSupportValide(" ").ok, false);
verifier("message propre accepté", messageSupportValide(" Bonjour "), { ok: true, valeur: "Bonjour" });
verifier("modèles non vides", MODELES_REPONSE.every((modele) => modele.titre && modele.contenu), true);
verifier("WhatsApp reste externe", construireLienWhatsApp("+2246******54", "Bonjour").startsWith("https://wa.me/?text="), true);
console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
