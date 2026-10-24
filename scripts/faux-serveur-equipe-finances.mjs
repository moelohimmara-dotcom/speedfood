// Faux serveur du lot L3 : relevés, contrats et versements manuels simulés, sans écriture en base.
export const espace = "equipe";
const TAUX_DEFAUT = 0.10;
const CONTRATS = [
  { etablissementId: "r-speedfood-1", etablissementNom: "Chez Awa, l'essai", taux: TAUX_DEFAUT, effectifLe: "2026-10-01T00:00:00Z" },
  { etablissementId: "r-speedfood-2", etablissementNom: "Maquis du Port", taux: 0.12, effectifLe: "2026-10-14T00:00:00Z" },
];
const VENTES = [
  { id: "v-1", etablissementId: "r-speedfood-1", etablissementNom: "Chez Awa, l'essai", reference: "SF-4101", creeLe: "2026-10-22T12:00:00Z", montantPlatsGnf: 30000, fraisLivraisonGnf: 5000, remboursementGnf: 0 },
  { id: "v-2", etablissementId: "r-speedfood-1", etablissementNom: "Chez Awa, l'essai", reference: "SF-4102", creeLe: "2026-10-18T12:00:00Z", montantPlatsGnf: 25000, fraisLivraisonGnf: 0, remboursementGnf: 5000 },
  { id: "v-3", etablissementId: "r-speedfood-2", etablissementNom: "Maquis du Port", reference: "SF-4103", creeLe: "2026-10-20T12:00:00Z", montantPlatsGnf: 40000, fraisLivraisonGnf: 6000, remboursementGnf: 10000 },
];
const VERSEMENTS = new Map();
const dansPeriode = (v, debut, fin) => v.creeLe >= debut && v.creeLe < fin;
const releve = (debut, fin) => CONTRATS.map((c) => {
  const liste = VENTES.filter((v) => v.etablissementId === c.etablissementId && dansPeriode(v, debut, fin));
  const ventes = liste.reduce((s, v) => s + v.montantPlatsGnf, 0);
  const remboursements = liste.reduce((s, v) => s + v.remboursementGnf, 0);
  const livraison = liste.reduce((s, v) => s + v.fraisLivraisonGnf, 0);
  const commission = Math.round((ventes - remboursements) * c.taux);
  return { ...c, ventesGnf: ventes, commissionGnf: commission, fraisLivraisonGnf: livraison, remboursementsGnf: remboursements, netAReverserGnf: ventes - remboursements - commission + livraison, versement: VERSEMENTS.get(c.etablissementId) ?? { statut: "a_verser", reference: null } };
}).filter((x) => x.ventesGnf > 0);

export const routes = {
  "finances": async ({ compte, requete }) => {
    if (!compte?.roles?.equipe) return { statut: 403, code: "NON_AUTORISE", message: "Ce compte n'a pas de rôle équipe." };
    const url = new URL(requete?.url ?? "http://faux/finances");
    return { parametres: { tauxDefaut: TAUX_DEFAUT, rythme: "hebdomadaire", devise: "GNF" }, contrats: CONTRATS, releve: releve(url.searchParams.get("debut") ?? "2026-10-01", url.searchParams.get("fin") ?? "2026-11-01") };
  },
  "finances/versement": async ({ compte, corps }) => {
    if (compte?.id !== "u-equipe") return { statut: 403, code: "NON_AUTORISE", message: "Seul l'opérateur de validation peut marquer un versement." };
    const id = String(corps.etablissementId ?? ""); const reference = String(corps.reference ?? "").trim();
    if (!CONTRATS.some((c) => c.etablissementId === id)) return { statut: 404, code: "INTROUVABLE", message: "Établissement introuvable." };
    if (reference.length < 4) return { statut: 400, code: "VALIDATION", message: "La référence factice doit contenir au moins 4 caractères." };
    const versement = { statut: "verse", reference, dateVersement: new Date().toISOString(), operateur: compte.id }; VERSEMENTS.set(id, versement);
    return { ok: true, message: "Versement manuel simulé et tracé.", versement };
  },
};
