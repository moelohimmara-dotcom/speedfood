import {
  CIBLES_JOURNAL_AUDIT,
  INDICATEURS_AUDIT,
  PERIODES_JOURNAL_AUDIT,
  actionJournalAuditConnue,
  cheminCibleJournalAudit,
  identifiantCibleCourt,
  libelleAuteurJournalAudit,
  libelleCibleJournalAudit,
  libellePeriodeJournalAudit,
  periodeJournalAuditValide,
  texteCibleJournalAudit,
} from "../../src/lib/system-admin/audit-equipe-regles";
import { ACTIONS_AUDIT_CONNUES, LIBELLES_ACTIONS_AUDIT } from "../../src/lib/system-admin/actionsAuditConnues";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC audit équipe : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    audit équipe : ${nom}`);
  }
}

// --- Filtre de période ------------------------------------------------------
verifier("période 24 heures", periodeJournalAuditValide(1), 1);
verifier("période 7 jours", periodeJournalAuditValide(7), 7);
verifier("période 30 jours", periodeJournalAuditValide(30), 30);
verifier("période reçue en texte", periodeJournalAuditValide("7"), 7);
verifier("période absente = tout l'historique", periodeJournalAuditValide(undefined), undefined);
verifier("période vide = tout l'historique", periodeJournalAuditValide(""), undefined);
verifier("période illisible = tout l'historique", periodeJournalAuditValide("hier"), undefined);
verifier("période hors liste = tout l'historique", periodeJournalAuditValide(3), undefined);
verifier("période nulle = tout l'historique", periodeJournalAuditValide(0), undefined);
verifier("période nulle = tout l'historique (texte)", periodeJournalAuditValide(null), undefined);
verifier("libellé de période « tout »", libellePeriodeJournalAudit(undefined), "Tout l'historique");
verifier("libellé de période 7 jours", libellePeriodeJournalAudit(7), "7 jours");
verifier("libellé de période inconnue", libellePeriodeJournalAudit(99), "Tout l'historique");
verifier("les quatre périodes du site", PERIODES_JOURNAL_AUDIT.length, 4);

// --- Filtre de type d'action ------------------------------------------------
verifier("action du catalogue acceptée", actionJournalAuditConnue("restaurant.approbation"), "restaurant.approbation");
verifier("action inconnue ignorée", actionJournalAuditConnue("action.inexistante"), undefined);
verifier("action vide ignorée", actionJournalAuditConnue(""), undefined);
verifier("action absente ignorée", actionJournalAuditConnue(undefined), undefined);
verifier("action non textuelle ignorée", actionJournalAuditConnue(42), undefined);
verifier("action avec espaces acceptée", actionJournalAuditConnue("  restaurant.approbation  "), "restaurant.approbation");
verifier("toutes les actions du catalogue ont un libellé", ACTIONS_AUDIT_CONNUES.every((a) => Boolean(LIBELLES_ACTIONS_AUDIT[a])), true);
verifier("le catalogue n'a pas d'action en double", new Set(ACTIONS_AUDIT_CONNUES).size, ACTIONS_AUDIT_CONNUES.length);

// --- Cibles -----------------------------------------------------------------
verifier("libellé d'une cible connue", libelleCibleJournalAudit("restaurant"), "Restaurant");
verifier("libellé d'une cible inconnue", libelleCibleJournalAudit("inconnu"), "inconnu");
verifier("cible restaurant : la fiche exacte", cheminCibleJournalAudit("restaurant", "abc123"), "/system/catalogue/restaurants/abc123");
verifier("cible commande : la fiche exacte", cheminCibleJournalAudit("commande", "cmd9"), "/system/commandes/cmd9");
verifier("cible compte : la section", cheminCibleJournalAudit("utilisateur", "u1"), "/system/acces/comptes");
verifier("cible bannière : la section", cheminCibleJournalAudit("content_banner", "b1"), "/system/contenu/bannieres");
verifier("cible inconnue : sans adresse", cheminCibleJournalAudit("inconnu", "x1"), null);
verifier("identifiant court", identifiantCibleCourt("0123456789abcdef"), "01234567");
verifier("identifiant déjà court", identifiantCibleCourt("abc"), "abc");
verifier("cible affichée", texteCibleJournalAudit("restaurant", "0123456789abcdef"), "Restaurant 01234567");
verifier("cible affichée, type inconnu", texteCibleJournalAudit("inconnu", "0123456789"), "inconnu 01234567");
verifier("auteur connu", libelleAuteurJournalAudit("moi@speedfood.gn"), "moi@speedfood.gn");
verifier("auteur inconnu", libelleAuteurJournalAudit(null), "acteur inconnu");
verifier("auteur vide", libelleAuteurJournalAudit("   "), "acteur inconnu");
verifier("toutes les cibles connues ont libellé et section", Object.values(CIBLES_JOURNAL_AUDIT).every((c) => Boolean(c.libelle) && Boolean(c.section)), true);

// --- Indicateurs ------------------------------------------------------------
verifier("les quatre indicateurs du site", INDICATEURS_AUDIT.length, 4);
verifier("clés d'indicateurs uniques", new Set(INDICATEURS_AUDIT.map((i) => i.cle)).size, INDICATEURS_AUDIT.length);
verifier("chaque indicateur porte une définition écrite", INDICATEURS_AUDIT.every((i) => i.definition.trim().length > 20), true);
verifier("chaque indicateur porte un libellé", INDICATEURS_AUDIT.every((i) => i.libelle.trim().length > 0), true);

console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
