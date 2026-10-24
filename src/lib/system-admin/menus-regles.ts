// Règles pures du lot L8 : prix en lot, copie et import CSV de menus.

export const COLONNES_CSV_MENU = ["nom", "description", "prix", "prix_promo"] as const;
export const LIMITE_LIGNES_IMPORT = 500;

export interface PlatMenuSaisi {
  nom: string;
  description: string;
  prix: number;
  prixPromo: number | null;
}
export interface LigneImportMenu { ligne: number; valeurs: PlatMenuSaisi | null; erreur: string | null; }
export interface RapportImportMenu { lignes: LigneImportMenu[]; appliquees: number; rejetees: number; }
export interface ApercuMenu { operation: "prix" | "copie" | "import"; lignes: number; empreinte: string; rapport?: RapportImportMenu; }

function montant(brut: unknown): number | null | "invalide" {
  const s = String(brut ?? "").trim();
  if (!/^\d[\d\s.,]*$/.test(s) || s === "") return "invalide";
  if (/^\d{1,9}$/.test(s)) return Number(s);
  if (/^\d{1,3}([\s  .,]\d{3}){1,2}$/.test(s)) return Number(s.replace(/[\s  .,]/g, ""));
  return "invalide";
}

export function validerPrixLot(brut: unknown, prixMaxGnf = 5_000_000): { ok: true; prix: number } | { ok: false; erreur: string } {
  const p = montant(brut);
  if (p === "invalide" || p === null || p < 0 || p > prixMaxGnf) return { ok: false, erreur: `Le prix doit être un entier GNF entre 0 et ${prixMaxGnf.toLocaleString("fr-FR")} .` };
  return { ok: true, prix: p };
}

export function validerLigneMenu(brut: Record<string, unknown>, prixMaxGnf = 5_000_000): { ok: true; valeurs: PlatMenuSaisi } | { ok: false; erreur: string } {
  const nom = String(brut.nom ?? "").replace(/\s+/g, " ").trim();
  if (!nom) return { ok: false, erreur: "Nom manquant : indiquez le nom du plat." };
  if (nom.length > 120) return { ok: false, erreur: "Nom trop long : 120 caractères maximum." };
  const description = String(brut.description ?? "").trim();
  if (description.length > 500) return { ok: false, erreur: "Description trop longue : 500 caractères maximum." };
  const prix = montant(brut.prix);
  if (prix === "invalide" || prix === null || prix > prixMaxGnf) return { ok: false, erreur: `Prix invalide : entier GNF entre 0 et ${prixMaxGnf.toLocaleString("fr-FR")}.` };
  const promo = brut.prix_promo === "" || brut.prix_promo == null ? null : montant(brut.prix_promo);
  if (promo === "invalide" || (promo !== null && promo > prix)) return { ok: false, erreur: "Prix promo invalide : il doit être inférieur ou égal au prix normal." };
  return { ok: true, valeurs: { nom, description, prix, prixPromo: promo } };
}

function separerCsv(ligne: string): string[] {
  const resultat: string[] = []; let courant = ""; let guillemet = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i];
    if (c === '"' && ligne[i + 1] === '"' && guillemet) { courant += '"'; i += 1; continue; }
    if (c === '"') { guillemet = !guillemet; continue; }
    if (c === ";" && !guillemet) { resultat.push(courant.trim()); courant = ""; } else courant += c;
  }
  resultat.push(courant.trim()); return resultat;
}

export function analyserCsvMenu(contenu: unknown, prixMaxGnf = 5_000_000): RapportImportMenu | { erreur: string } {
  if (typeof contenu !== "string" || contenu.trim() === "") return { erreur: "Fichier CSV illisible ou vide : fournissez un fichier UTF-8." };
  const lignes = contenu.replace(/^\uFEFF/, "").split(/\r?\n/);
  const entetes = separerCsv(lignes.shift() ?? "").map((x) => x.toLowerCase());
  if (entetes.length !== COLONNES_CSV_MENU.length || entetes.some((x, i) => x !== COLONNES_CSV_MENU[i])) return { erreur: `Colonnes invalides : utilisez exactement ${COLONNES_CSV_MENU.join("; ")}.` };
  if (lignes.filter((x) => x.trim()).length > LIMITE_LIGNES_IMPORT) return { erreur: `Import limité à ${LIMITE_LIGNES_IMPORT} lignes.` };
  const resultats: LigneImportMenu[] = [];
  let index = 1;
  for (const texte of lignes) {
    if (!texte.trim()) { index += 1; continue; }
    const cellules = separerCsv(texte);
    const valeurs = Object.fromEntries(COLONNES_CSV_MENU.map((cle, i) => [cle, cellules[i] ?? ""]));
    const validation = validerLigneMenu(valeurs, prixMaxGnf);
    resultats.push({ ligne: index + 1, valeurs: validation.ok ? validation.valeurs : null, erreur: validation.ok ? null : validation.erreur });
    index += 1;
  }
  return { lignes: resultats, appliquees: 0, rejetees: resultats.filter((x) => x.erreur).length };
}

export function creerRapportApplique(rapport: RapportImportMenu, appliquees: number): RapportImportMenu { return { ...rapport, appliquees, rejetees: rapport.lignes.filter((x) => x.erreur).length + (rapport.lignes.filter((x) => x.valeurs).length - appliquees) }; }
export function creerEmpreinte(texte: string): string { let h = 2166136261; for (let i = 0; i < texte.length; i += 1) h = Math.imul(h ^ texte.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, "0"); }
