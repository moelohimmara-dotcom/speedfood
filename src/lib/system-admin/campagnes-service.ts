import "server-only";
import { creerEmpreinteCampagne, DEFAUTS_CAMPAGNE, normaliserCode, type Campagne, type RegleRemise } from "./campagnes-regles";

const campagnes: Campagne[] = [
  { id: "campagne-demo", code: "BIENVENUE10", nom: "Bienvenue", regle: { type: "pourcentage", valeur: 10, minimumAchatGnf: 50_000 }, plafondMontantGnf: 100_000, plafondUtilisations: 100, utilisations: 12, debut: "2026-01-01T00:00:00.000Z", fin: "2099-12-31T23:59:59.000Z", etat: "active", ciblage: "Nouveaux clients" },
];
export function listerCampagnes(): Campagne[] { return campagnes.map((c) => ({ ...c, regle: { ...c.regle } })); }
export function apercuCampagne(entree: { nom: string; code: string; regle: RegleRemise; plafondMontantGnf: number; plafondUtilisations: number; debut: string; fin: string; ciblage: string }) {
  const code = normaliserCode(entree.code);
  const doublon = campagnes.some((c) => c.code === code);
  if (doublon) return { ok: false as const, erreur: "Code déjà utilisé : choisissez un code unique.", action: "Modifiez le code." };
  const campagne: Campagne = { ...entree, id: `campagne-${creerEmpreinteCampagne(entree)}`, code, utilisations: 0, etat: "brouillon" };
  return { ok: true as const, campagne, empreinte: creerEmpreinteCampagne(campagne) };
}
export function creerCampagne(campagne: Campagne, empreinte: string): { ok: true; campagne: Campagne } | { ok: false; message: string } {
  if (creerEmpreinteCampagne(campagne) !== empreinte) return { ok: false, message: "L'aperçu a changé : relancez l'aperçu." };
  if (campagnes.some((c) => c.code === campagne.code)) return { ok: false, message: "Code déjà utilisé : aucune campagne créée." };
  campagnes.push(campagne); return { ok: true, campagne };
}
export function valeursParDefaut() { return DEFAUTS_CAMPAGNE; }
