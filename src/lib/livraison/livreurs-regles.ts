// Pur, sans dépendance serveur : testable seul (npm run test:unit). Voir docs/LIVREURS.md.
import { normaliserTelephone } from "../commande/telephone";

/** Cycle de vie d'une fiche livreur (séparé de son état de travail : hors ligne, en ligne, en course). */
export const CYCLES_LIVREUR = ["cree", "invite", "candidat", "actif", "suspendu", "archive"] as const;
export type CycleLivreur = (typeof CYCLES_LIVREUR)[number];

export function estCycleLivreur(valeur: string): valeur is CycleLivreur {
  return (CYCLES_LIVREUR as readonly string[]).includes(valeur);
}

const TRANSITIONS: Record<CycleLivreur, readonly CycleLivreur[]> = {
  cree: ["invite", "archive"],
  invite: ["invite", "candidat", "actif", "archive"],
  candidat: ["actif", "archive"],
  actif: ["suspendu", "archive"],
  suspendu: ["actif", "archive"],
  archive: [],
};

export function transitionCycleAutorisee(de: CycleLivreur, vers: CycleLivreur): boolean {
  return TRANSITIONS[de].includes(vers);
}

/** Seul un livreur actif peut se mettre en ligne et être sollicité par la répartition. */
export function peutTravailler(cycle: CycleLivreur): boolean {
  return cycle === "actif";
}

/** Suspendre ou archiver un livreur en course est refusé : terminer ou réaffecter la course d'abord. */
export function peutQuitterLeTravail(statutTravail: "hors_ligne" | "disponible" | "en_course"): boolean {
  return statutTravail !== "en_course";
}

export const LIBELLES_CYCLE: Record<CycleLivreur, string> = {
  cree: "Fiche créée",
  invite: "Invité",
  candidat: "À approuver",
  actif: "Actif",
  suspendu: "Suspendu",
  archive: "Archivé",
};

export const VEHICULES_LIVREUR = ["moto", "velo", "voiture", "pied"] as const;
export type VehiculeLivreur = (typeof VEHICULES_LIVREUR)[number];

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** « Moto », « vélo », « à pied »… vers la valeur stockée ; `null` si inconnu. Vide = moto (le cas courant). */
export function normaliserVehicule(brut: string): VehiculeLivreur | null {
  const v = sansAccents(brut);
  if (v === "" || v === "moto" || v === "scooter" || v === "motard") return "moto";
  if (v === "velo" || v === "bicyclette" || v === "bike") return "velo";
  if (v === "voiture" || v === "auto" || v === "car" || v === "taxi") return "voiture";
  if (v === "pied" || v === "a pied" || v === "apied" || v === "marche") return "pied";
  return null;
}

export interface FicheLivreurSaisie {
  nom: string;
  telephone: string;
  vehicule: string;
  email?: string;
}

export interface FicheLivreurValide {
  nom: string;
  telephone: string;
  vehicule: VehiculeLivreur;
  email: string | null;
}

export type ResultatFiche = { ok: true; valeur: FicheLivreurValide } | { ok: false; erreur: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validerFicheLivreur(saisie: FicheLivreurSaisie): ResultatFiche {
  const nom = saisie.nom.replace(/\s+/g, " ").trim();
  if (nom.length < 2 || nom.length > 80) return { ok: false, erreur: "Nom : 2 à 80 caractères." };
  const telephone = normaliserTelephone(saisie.telephone);
  if (!telephone) return { ok: false, erreur: "Téléphone guinéen invalide (9 chiffres commençant par 6 ou 7)." };
  const vehicule = normaliserVehicule(saisie.vehicule);
  if (!vehicule) return { ok: false, erreur: `Véhicule inconnu : « ${saisie.vehicule.trim().slice(0, 20)} » (moto, vélo, voiture ou à pied).` };
  const email = (saisie.email ?? "").trim().toLowerCase();
  if (email !== "" && (!EMAIL.test(email) || email.length > 120)) return { ok: false, erreur: "Adresse e-mail invalide." };
  return { ok: true, valeur: { nom, telephone, vehicule, email: email === "" ? null : email } };
}

// ---------------------------------------------------------------- création groupée

export const LIGNES_MAX_GROUPE = 100;

export interface LigneAnalysee {
  /** Numéro de ligne dans le texte d'origine (à partir de 1). */
  numero: number;
  brut: string;
  fiche: FicheLivreurValide | null;
  erreur: string | null;
}

export interface ListeAnalysee {
  lignes: LigneAnalysee[];
  valides: number;
  invalides: number;
  /** Plus de `LIGNES_MAX_GROUPE` lignes utiles : rien n'est analysé au-delà. */
  tropDeLignes: boolean;
}

function separateur(texte: string): string {
  if (texte.includes("\t")) return "\t";
  if (texte.includes(";")) return ";";
  return ",";
}

/** Découpe une ligne en champs, en respectant les guillemets (un champ peut contenir le séparateur). */
export function decouperLigne(ligne: string, sep: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else {
        entreGuillemets = !entreGuillemets;
      }
    } else if (c === sep && !entreGuillemets) {
      champs.push(courant.trim());
      courant = "";
    } else {
      courant += c;
    }
  }
  champs.push(courant.trim());
  return champs;
}

function estEntete(champs: string[]): boolean {
  const premiers = champs.slice(0, 2).map(sansAccents);
  return premiers.some((c) => c === "nom" || c === "name") && champs.slice(0, 4).some((c) => /^t[eé]l/i.test(c) || sansAccents(c) === "telephone");
}

/**
 * Analyse un texte collé ou un fichier CSV : une ligne par livreur, `nom ; téléphone ; véhicule ; e-mail` (les deux derniers
 * facultatifs). Séparateurs tolérés : point-virgule, tabulation (copie depuis un tableur), virgule. Une première ligne d'en-têtes est
 * ignorée. Aucune création ici : l'aperçu dit, ligne par ligne, ce qui sera créé et ce qui sera refusé et pourquoi.
 * `telephonesExistants` : numéros déjà portés par une fiche non archivée.
 */
export function analyserListeLivreurs(texte: string, telephonesExistants: ReadonlySet<string> = new Set()): ListeAnalysee {
  const sep = separateur(texte);
  const brutes = texte.replace(/\r\n?/g, "\n").split("\n");
  const lignes: LigneAnalysee[] = [];
  const vus = new Map<string, number>();
  let tropDeLignes = false;
  let entetePasse = false;

  for (let i = 0; i < brutes.length; i++) {
    const brut = brutes[i];
    if (brut.trim() === "") continue;
    const champs = decouperLigne(brut, sep);
    if (!entetePasse) {
      entetePasse = true;
      if (estEntete(champs)) continue;
    }
    if (lignes.length >= LIGNES_MAX_GROUPE) {
      tropDeLignes = true;
      break;
    }
    const [nom = "", telephone = "", vehicule = "", email = ""] = champs;
    const validation = validerFicheLivreur({ nom, telephone, vehicule, email });
    let erreur: string | null = validation.ok ? null : validation.erreur;
    let fiche: FicheLivreurValide | null = validation.ok ? validation.valeur : null;
    if (fiche) {
      const dejaVuLigne = vus.get(fiche.telephone);
      if (dejaVuLigne !== undefined) {
        erreur = `Doublon dans la liste : même téléphone qu'à la ligne ${dejaVuLigne}.`;
        fiche = null;
      } else if (telephonesExistants.has(fiche.telephone)) {
        erreur = "Ce numéro a déjà une fiche livreur.";
        fiche = null;
      } else {
        vus.set(fiche.telephone, i + 1);
      }
    }
    lignes.push({ numero: i + 1, brut, fiche, erreur });
  }
  const valides = lignes.filter((l) => l.fiche).length;
  return { lignes, valides, invalides: lignes.length - valides, tropDeLignes };
}

// ---------------------------------------------------------------- lien d'activation

const ALPHABET_URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** 24 octets aléatoires, en 32 caractères sûrs pour une adresse web. */
export function genererJetonActivation(): string {
  const octets = crypto.getRandomValues(new Uint8Array(24));
  let sortie = "";
  for (let i = 0; i < octets.length; i += 3) {
    const n = (octets[i] << 16) | (octets[i + 1] << 8) | octets[i + 2];
    sortie += ALPHABET_URL[(n >> 18) & 63] + ALPHABET_URL[(n >> 12) & 63] + ALPHABET_URL[(n >> 6) & 63] + ALPHABET_URL[n & 63];
  }
  return sortie;
}

export function jetonActivationPlausible(jeton: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(jeton);
}

/** Empreinte SHA-256 : seule elle est stockée, le jeton lui-même n'est montré qu'une fois. */
export async function hacherJetonActivation(jeton: string): Promise<string> {
  const condensat = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`speedfood-livreur:${jeton}`));
  return Array.from(new Uint8Array(condensat), (o) => o.toString(16).padStart(2, "0")).join("");
}

/** Fiche telle que l'activation par lien la voit. */
export interface FichePourActivation {
  cycle: string;
  utilisateurId: string | null;
  /** Renseigné : livreur d'un restaurant. */
  restaurantId: string | null;
}

/**
 * Une fiche peut recevoir un lien d'activation (et être activée) si elle n'est liée à aucun compte et :
 *  - fiche du groupe Speedfood : « créée » ou « invitée » (l'exploitation la fait ensuite approuver) ;
 *  - livreur d'un restaurant : « actif » (le restaurateur le connaît : pas d'approbation, pas de dossier d'identité).
 */
export function ficheActivable(f: FichePourActivation, pourGenerationDeLien = false): boolean {
  if (f.utilisateurId) return false;
  if (f.restaurantId) return f.cycle === "actif";
  return pourGenerationDeLien ? f.cycle === "cree" || f.cycle === "invite" : f.cycle === "invite";
}

/** Cycle d'une fiche juste après son activation : un livreur de restaurant reste actif, un livreur du groupe attend l'approbation si elle est requise. */
export function cycleApresActivation(f: FichePourActivation, approbationRequise: boolean): CycleLivreur {
  if (f.restaurantId) return "actif";
  return approbationRequise ? "candidat" : "actif";
}

/** Le dossier d'identité (pièce, contact d'urgence) ne se demande qu'aux livreurs du groupe Speedfood, qui manipulent l'argent de tous. */
export function dossierExigible(f: FichePourActivation): boolean {
  return f.restaurantId === null;
}

export function messageWhatsAppActivationRestaurant(nom: string, restaurant: string, lien: string, validiteJours: number): string {
  const prenom = nom.split(" ")[0] ?? nom;
  return `Bonjour ${prenom}, ${restaurant} vous ajoute comme livreur sur Speedfood : ${lien}\nIl ne sert qu'une fois et reste valable ${validiteJours} jour${validiteJours > 1 ? "s" : ""}. Ouvrez-le sur votre téléphone, créez votre compte ou connectez-vous : vous verrez ici les livraisons de ${restaurant}.`;
}

export function messageWhatsAppActivation(nom: string, lien: string, validiteJours: number): string {
  const prenom = nom.split(" ")[0] ?? nom;
  return `Bonjour ${prenom}, voici votre lien pour devenir livreur Speedfood : ${lien}\nIl ne sert qu'une fois et reste valable ${validiteJours} jour${validiteJours > 1 ? "s" : ""}. Ouvrez-le sur votre téléphone, créez votre compte ou connectez-vous, puis suivez les étapes.`;
}

export function lienWhatsAppVers(telephone: string, message: string): string {
  return `https://wa.me/${telephone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

/** Date d'expiration d'un lien créé maintenant. */
export function expirationLien(maintenant: Date, validiteJours: number): string {
  return new Date(maintenant.getTime() + validiteJours * 86_400_000).toISOString();
}

// ---------------------------------------------------------------- dossier demandé selon les réglages

export interface ReglagesDossier {
  pieceRequise: boolean;
  urgenceRequise: boolean;
}

export interface DossierSaisi {
  pieceType?: string;
  pieceNumero?: string;
  urgenceNom?: string;
  urgenceTelephone?: string;
}

export const TYPES_PIECE = ["carte_identite", "passeport", "permis", "autre"] as const;

export type ResultatDossier =
  | { ok: true; dossier: { pieceType: string | null; pieceNumero: string | null; urgenceNom: string | null; urgenceTelephone: string | null } }
  | { ok: false; erreur: string };

/** Vérifie le dossier selon ce que la console exige ; un champ non exigé mais saisi doit rester valide. */
export function validerDossier(saisi: DossierSaisi, reglages: ReglagesDossier): ResultatDossier {
  const pieceType = (saisi.pieceType ?? "").trim();
  const pieceNumero = (saisi.pieceNumero ?? "").replace(/\s+/g, " ").trim();
  const urgenceNom = (saisi.urgenceNom ?? "").replace(/\s+/g, " ").trim();
  const urgenceBrut = (saisi.urgenceTelephone ?? "").trim();

  const pieceSaisie = pieceType !== "" || pieceNumero !== "";
  if (reglages.pieceRequise || pieceSaisie) {
    if (!(TYPES_PIECE as readonly string[]).includes(pieceType)) return { ok: false, erreur: "Choisissez le type de pièce d'identité." };
    if (pieceNumero.length < 4 || pieceNumero.length > 40) return { ok: false, erreur: "Numéro de pièce : 4 à 40 caractères." };
  }
  const urgenceSaisie = urgenceNom !== "" || urgenceBrut !== "";
  let urgenceTelephone: string | null = null;
  if (reglages.urgenceRequise || urgenceSaisie) {
    if (urgenceNom.length < 2 || urgenceNom.length > 80) return { ok: false, erreur: "Contact d'urgence : indiquez son nom (2 à 80 caractères)." };
    urgenceTelephone = normaliserTelephone(urgenceBrut);
    if (!urgenceTelephone) return { ok: false, erreur: "Contact d'urgence : téléphone guinéen invalide." };
  }
  return {
    ok: true,
    dossier: {
      pieceType: pieceSaisie || reglages.pieceRequise ? pieceType : null,
      pieceNumero: pieceSaisie || reglages.pieceRequise ? pieceNumero : null,
      urgenceNom: urgenceTelephone ? urgenceNom : null,
      urgenceTelephone,
    },
  };
}
