// Faux serveur — module « équipe » : quarts et affectation (lot L2).
//
// Le faux serveur charge automatiquement les fichiers `mobile/faux-serveur/faux-serveur-<espace>-<domaine>.mjs` :
// ce module ne touche pas `mobile/faux-serveur/faux-serveur-application.mjs`. Il ne simule que les quarts
// (prise, libération, relance) : rien n'est écrit en base, tout reste en mémoire.
//
// DONNÉES FACTICES. Le barème de relance ci-dessous est la SIMULATION de la valeur par défaut
// de l'application (`DELAI_RELANCE_MINUTES_PAR_DEFAUT` dans `apps/web/src/lib/system-admin/quarts-regles.ts`) :
// les deux doivent être changés ensemble quand la propriétaire arrête le délai.

export const espace = "equipe";

/** Barème de relance simulé (minutes) : miroir de la valeur par défaut de l'application. */
const DELAI_RELANCE_MINUTES = 10;

/** Effectif de l'équipe simulé : n'importe quel membre de l'équipe peut tenir un établissement. */
const OPERATEURS = [
  { utilisateurId: "u-equipe", email: "equipe@test.sf", role: "super_admin" },
  { utilisateurId: "u-equipe-2", email: "equipe2@test.sf", role: "support" },
];

const ETABLISSEMENTS = [
  { id: "r-speedfood-1", nom: "Chez Awa (essai)" },
  { id: "r-speedfood-2", nom: "Maquis du Port" },
  { id: "r-speedfood-3", nom: "Gastronomie 24" },
  { id: "r-speedfood-4", nom: "Le Comptoir du Centre" },
];

const ilYA = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const COMMANDES = [
  { id: "c-1", reference: "SF-3001", restaurantId: "r-speedfood-1", restaurantNom: "Chez Awa (essai)", statut: "en_attente", mode: "livraison", creeLe: ilYA(3) },
  { id: "c-2", reference: "SF-3002", restaurantId: "r-speedfood-2", restaurantNom: "Maquis du Port", statut: "acceptee", mode: "retrait", creeLe: ilYA(14) },
  { id: "c-3", reference: "SF-3003", restaurantId: "r-speedfood-3", restaurantNom: "Gastronomie 24", statut: "en_attente", mode: "livraison", creeLe: ilYA(28) },
  { id: "c-4", reference: "SF-3004", restaurantId: "r-speedfood-3", restaurantNom: "Gastronomie 24", statut: "prete", mode: "retrait", creeLe: ilYA(6) },
  { id: "c-5", reference: "SF-3005", restaurantId: "r-speedfood-4", restaurantNom: "Le Comptoir du Centre", statut: "en_attente", mode: "livraison", creeLe: ilYA(1) },
];

// Affectations en cours : un établissement, un seul titulaire actif.
const AFFECTATIONS = [
  { id: "a-1", restaurantId: "r-speedfood-1", operateurId: "u-equipe", commandeId: "c-1", priseLe: ilYA(2), libereLe: null },
  { id: "a-2", restaurantId: "r-speedfood-2", operateurId: "u-equipe-2", commandeId: "c-2", priseLe: ilYA(20), libereLe: null },
];

const RELANCES = [];

const minutesDepuis = (instant) => Math.max(0, Math.floor((Date.now() - new Date(instant).getTime()) / 60_000));

const emailOperateur = (operateurId) => OPERATEURS.find((o) => o.utilisateurId === operateurId)?.email ?? "";

const affectationActive = (restaurantId) => AFFECTATIONS.find((a) => a.restaurantId === restaurantId && !a.libereLe) ?? null;

/** Vue des quarts : les trois files, l'indicateur et les relances. */
function vueQuarts() {
  const moi = "u-equipe";
  const etablissements = ETABLISSEMENTS.map((etablissement) => {
    const titulaire = affectationActive(etablissement.id);
    return {
      id: etablissement.id,
      nom: etablissement.nom,
      titulaireId: titulaire?.operateurId ?? null,
      titulaireEmail: titulaire ? emailOperateur(titulaire.operateurId) : null,
      priseLe: titulaire?.priseLe ?? null,
      nonPris: !titulaire,
      commandes: COMMANDES.filter((c) => c.restaurantId === etablissement.id),
    };
  });

  const idsNonPris = new Set(etablissements.filter((e) => e.nonPris).map((e) => e.id));
  const alertes = COMMANDES.filter((c) => idsNonPris.has(c.restaurantId) && minutesDepuis(c.creeLe) >= DELAI_RELANCE_MINUTES)
    .map((commande) => ({
      commande,
      minutesAttente: minutesDepuis(commande.creeLe),
      derniereRelance: RELANCES.find((r) => r.commandeId === commande.id)?.relanceLe ?? null,
    }));

  return {
    etablissements,
    moi: etablissements.filter((e) => e.titulaireId === moi),
    nonPris: etablissements.filter((e) => e.nonPris),
    autres: etablissements.filter((e) => e.titulaireId && e.titulaireId !== moi),
    alertes,
    operateurs: OPERATEURS,
    delaiMinutes: DELAI_RELANCE_MINUTES,
  };
}

export const routes = {
  /** Lecture de l'écran des quarts. */
  "quarts": async ({ compte }) => {
    if (!compte?.roles?.equipe) return { statut: 403, code: "NON_AUTORISE", message: "Ce compte n'a pas de rôle équipe." };
    return { ok: true, affectations: AFFECTATIONS, ...vueQuarts() };
  },

  /** Prise, libération ou relance. */
  "quarts/action": async ({ corps, compte }) => {
    if (!compte?.roles?.equipe) return { statut: 403, code: "NON_AUTORISE", message: "Ce compte n'a pas de rôle équipe." };
    const action = String(corps.action ?? "");
    const restaurantId = String(corps.restaurantId ?? "");
    const operateurId = String(corps.operateurId ?? compte.id);

    if (action === "prendre") {
      if (!restaurantId) return { statut: 400, code: "VALIDATION", message: "Indiquez l'établissement." };
      if (!ETABLISSEMENTS.some((e) => e.id === restaurantId)) return { statut: 404, code: "INTROUVABLE", message: "Établissement introuvable." };
      const titulaire = affectationActive(restaurantId);
      if (titulaire && titulaire.operateurId !== operateurId) {
        return { statut: 409, code: "CONFLIT_ETAT", message: "Cet établissement est déjà tenu par un autre opérateur." };
      }
      if (!titulaire) {
        AFFECTATIONS.push({
          id: `a-${AFFECTATIONS.length + 1}`,
          restaurantId,
          operateurId,
          commandeId: corps.commandeId ?? null,
          priseLe: new Date().toISOString(),
          libereLe: null,
        });
      }
      return { ok: true, message: "Affectation enregistrée." };
    }

    if (action === "liberer") {
      if (!restaurantId) return { statut: 400, code: "VALIDATION", message: "Indiquez l'établissement." };
      const titulaire = affectationActive(restaurantId);
      if (!titulaire || titulaire.operateurId !== operateurId) {
        return { statut: 409, code: "CONFLIT_ETAT", message: "Cet établissement n'est pas tenu par cet opérateur." };
      }
      titulaire.libereLe = new Date().toISOString();
      return { ok: true, message: "Affectation enregistrée." };
    }

    if (action === "relancer") {
      const commandeId = String(corps.commandeId ?? "");
      if (!commandeId) return { statut: 400, code: "VALIDATION", message: "Indiquez la commande." };
      const commande = COMMANDES.find((c) => c.id === commandeId);
      if (!commande) return { statut: 404, code: "INTROUVABLE", message: "Commande introuvable." };
      RELANCES.push({ commandeId, operateurId: compte.id, relanceLe: new Date().toISOString(), motif: String(corps.motif ?? "") });
      return { ok: true, message: `Relance tracée pour ${commande.reference}.` };
    }

    return { statut: 400, code: "VALIDATION", message: "Indiquez l'action." };
  },
};
