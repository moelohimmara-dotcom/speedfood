// Faux serveur L4 — fil de support par commande. Données factices uniquement.
export const espace = "equipe";
const COMMANDES = new Set(["c-1", "c-2", "c-3"]);
const FILS = new Map([
  ["c-1", { statut: "ouvert", messages: [{ id: "m-1", commandeId: "c-1", auteur: "client", contenu: "Ma commande est-elle bien prise en compte ?", creeLe: new Date().toISOString() }] }],
]);
const MODELES = [
  { id: "prise-en-charge", titre: "Prise en charge", contenu: "Bonjour, nous avons bien reçu votre demande et nous la traitons." },
  { id: "suivi-commande", titre: "Suivi de commande", contenu: "Bonjour, nous vérifions l'état de votre commande et revenons vers vous rapidement." },
];
export const routes = {
  "support": async ({ compte }) => compte?.roles?.equipe ? { ok: true, modeles: MODELES, fils: [...FILS.entries()] } : { statut: 403, code: "NON_AUTORISE", message: "Ce compte n'a pas de rôle équipe." },
  "support/message": async ({ compte, corps }) => {
    if (!compte?.roles?.equipe) return { statut: 403, code: "NON_AUTORISE", message: "Ce compte n'a pas de rôle équipe." };
    const commandeId = String(corps.commandeId ?? ""); const contenu = String(corps.contenu ?? "").trim();
    if (!COMMANDES.has(commandeId)) return { statut: 404, code: "INTROUVABLE", message: "Commande introuvable." };
    if (!contenu || contenu.length > 1000) return { statut: 400, code: "VALIDATION", message: "Message invalide." };
    const fil = FILS.get(commandeId) ?? { statut: "ouvert", messages: [] }; fil.messages.push({ id: `m-${Date.now()}`, commandeId, auteur: "equipe", contenu, creeLe: new Date().toISOString() }); FILS.set(commandeId, fil);
    return { ok: true, fil };
  },
};
