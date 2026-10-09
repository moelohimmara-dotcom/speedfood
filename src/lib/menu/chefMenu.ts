/**
 * « Chef IA » : lecture d'une photo de menu (ardoise, feuille imprimée, carte
 * photographiée) pour en tirer une liste de plats que le restaurateur valide
 * avant ajout.
 *
 * Ce module ne contient QUE du calcul pur — construction de la consigne,
 * nettoyage de la réponse du modèle, validation des plats. Aucun accès réseau,
 * aucune base, aucun binding : c'est ce qui rend la partie hasardeuse (un modèle
 * répond du texte libre, parfois mal formé) testable sans rien mocker, et
 * c'est le seul endroit où les règles de saisie sont appliquées une fois pour
 * toutes. Le même algorithme valide la sortie de l'IA ET celle du modèle au
 * démarrage : un bugVisible ne peut pas venir de l'un des deux côtés.
 *
 * Rappel du vocabulaire métier (cf. `actions.ts`) : un « plat » a un nom, un
 * prix en GNF entier, une description et, éventuellement, une section.
 */

export const PLATS_MAX_PAR_ANALYSE = 30;
const NOM_MAX = 120;
const DESCRIPTION_MAX = 500;

/** Un plat proposé par le modèle, déjà validé pour être insérable en base. */
export interface PlatPropose {
  nom: string;
  description: string;
  prix: number;
  /** Nom de section tel que l'a écrit le modèle, avant rapprochement (§3). */
  section: string | null;
}

/** Rapproché d'une section réelle du restaurant, si on en a trouvé une. */
export interface PlatValide extends PlatPropose {
  section_id: string | null;
}

/** Plat écarté, avec la raison — affichée au restaurateur, jamais silencieuse. */
export interface PlatRefuse {
  brut: string;
  raison: string;
}

export interface AnalyseMenu {
  plats: PlatValide[];
  refuses: PlatRefuse[];
  /** Sections citées par le modèle qu'aucune section du restaurant ne porte. */
  sectionsInconnues: string[];
}

const CONSIGNE = `Tu es le "Chef IA" d'un restaurant guinéen. Tu lis UNE photo de menu et tu en extrais les plats.

Règles :
- Un plat = un nom et un prix. Le prix est en GNF (francs guinéens).
- Écris les prix en nombres entiers sans séparateur : 25000 pour 25 000 GNF.
- Si le prix est illisible ou absent, mets null pour ce plat : ne devine JAMAIS un prix.
- La description est courte (15 mots maximum), à partir du texte visible sur la photo. Si rien n'est écrit, laisse-la vide.
- La section est le nom d'un regroupement visible sur la photo (Entrées, Poissons, Boissons...). Sinon null.
- Relis la photo DE BOUT EN BOUT avant de répondre : liste toutes les lignes, y compris les boissons, les desserts et les suppléments. Une carte a rarement moins de dix lignes.
- Ne déduis rien, n'invente rien : uniquement ce qui est écrit ou clairement lisible sur la photo.
- Ne réponds qu'avec du JSON, sans texte avant ni après, sans bloc de code.`;

export function construireConsigne(): string {
  return CONSIGNE;
}

/**
 * Extrait le premier objet **ou tableau** JSON d'une réponse de modèle. Le
 * modèle peut entourer sa réponse de texte, la renvoyer entière préfixée par un
 * raisonnement, ou — c'est ce qu'il fait en pratique — produire directement une
 * liste `[{"nom":…}]` au lieu de l'objet enveloppant demandé. Chercher `{` en
 * ouverture ne suffit donc pas : on part du premier `{` ou `[`, et on s'arrête
 * au dernier `}` ou `]`, ce qui tolère tout le bruit possible autour.
 */
export function extraireJson(texte: string): string | null {
  let debut = -1;
  for (const caractere of texte) {
    if (caractere === "{" || caractere === "[") {
      debut = texte.indexOf(caractere);
      break;
    }
  }
  if (debut === -1) return null;
  let fin = -1;
  for (let index = texte.length - 1; index > debut; index--) {
    const caractere = texte[index];
    if (caractere === "}" || caractere === "]") {
      fin = index;
      break;
    }
  }
  if (fin <= debut) return null;
  return texte.slice(debut, fin + 1);
}

/** Minuscules sans accents ni ponctuation, pour comparer des libellés. */
export function normaliserLibelle(valeur: string): string {
  return valeur
    // Les ligatures ne sont PAS décomposées par NFD (« œ » reste « œ ») :
    // sans ce remplacement, « Bœuf » et « Boeuf » — le même plat écrit de deux
    // façons — ne se reconnaîtraient jamais comme(section du modèle = section du
    // restaurateur).
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Prix écrit par un modèle ou lu sur une photo : nombre, « 25 000 », « 25.000
 * GNF », « 40000F ». Tout ce qui n'est pas un chiffre (lettres, symboles,
 * espaces de milliers) est retiré AVANT conversion, ce qui évite `parseInt`
 * qui s'arrête au premier caractère inattendu et tronque en silence
 * (« 25 000 GNF » deviendrait 25, soit un plat à 25 GNF — le pire bug possible
 * ici, car il passe tous les contrôles de plage).
 */
export function lirePrix(valeur: unknown): number | null {
  if (typeof valeur === "number") {
    return Number.isFinite(valeur) ? Math.round(valeur) : null;
  }
  if (typeof valeur !== "string") return null;
  const brut = valeur.trim();
  if (!brut) return null;
  // Chiffres, espaces (et insécables) et points : séparateurs de milliers.
  const nettoye = brut.replace(/[^\d\s.]/g, "").replace(/[\s  ]/g, "");
  // Points : séparateur de milliers (« 25.000 ») quand TOUS les groupes après
  // le premier en comptent trois — c'est la seule façon de distinguer
  // « 25.000 » (vingt-cinq mille) de « 25.5 » (vingt-cinq virgule cinq) sans
  // laisser trancher le format par l'auteur du prix.
  const segments = nettoye.split(".");
  const tousSeparateurs =
    segments.length > 1 && segments[0].length >= 1 && segments.slice(1).every((s) => s.length === 3);
  const nombre = tousSeparateurs ? segments.join("") : nettoye;
  if (tousSeparateurs) {
    const entier = Number.parseInt(nombre, 10);
    return Number.isFinite(entier) ? entier : null;
  }
  // Sinon c'est un décimal : arrondi au franc près, la base n'acceptant que des
  // entiers.
  const decimal = Number.parseFloat(nombre);
  return Number.isFinite(decimal) ? Math.round(decimal) : null;
}

function nettoyer(valeur: unknown, max: number): string {
  if (typeof valeur !== "string") return "";
  return valeur.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Rapproche le nom de section écrit par le modèle d'une section réellement
 * existante chez ce restaurateur. Correspondance exacte d'abord, puis
 * « la section du modèle contient le nom de la section » (le modèle écrit
 * « Poissons grillés », le restaurateur a « Poissons »). Sans correspondance,
 * on NE crée aucune section : un import ne doit jamais inventer une section
 * qu'il n'a pas demandée. Le restaurateur corrige au passage si besoin.
 */
export function rapprocherSection(
  nomModele: string | null,
  sections: { id: string; nom: string }[]
): string | null {
  if (!nomModele) return null;
  const cible = normaliserLibelle(nomModele);
  if (!cible) return null;
  const exacte = sections.find((s) => normaliserLibelle(s.nom) === cible);
  if (exacte) return exacte.id;
  const contient = sections.find((s) => cible.includes(normaliserLibelle(s.nom)));
  if (contient) return contient.id;
  return null;
}

/**
 * Analyse la réponse du modèle et n'en garde que des plats réellement
 * insérables. Tout le reste est renvoyé avec sa raison : afficher « 4 plats
 * reconnus sur 7 » sans dire pourquoi les 3 autres manquent est le meilleur
 * moyen de faire croire à l'utilisateur que la photo a été mal lue quand c'est
 * souvent juste un prix illisible.
 */
export function analyserReponseModele(
  texteReponse: string,
  options: { prixMax: number; sections: { id: string; nom: string }[] }
): AnalyseMenu {
  const brut = extraireJson(texteReponse);
  if (!brut) {
    return {
      plats: [],
      refuses: [{ brut: texteReponse.slice(0, 120), raison: "réponse illisible" }],
      sectionsInconnues: [],
    };
  }

  let lus: unknown;
  try {
    lus = JSON.parse(brut);
  } catch {
    return {
      plats: [],
      refuses: [{ brut: brut.slice(0, 120), raison: "réponse illisible" }],
      sectionsInconnues: [],
    };
  }

  const liste = Array.isArray(lus)
    ? lus
    : typeof lus === "object" && lus !== null && Array.isArray((lus as { plats?: unknown }).plats)
      ? (lus as { plats: unknown[] }).plats
      : [];

  const plats: PlatValide[] = [];
  const refuses: PlatRefuse[] = [];
  const sectionsInconnues = new Set<string>();
  const vus = new Set<string>();

  for (const entree of liste.slice(0, PLATS_MAX_PAR_ANALYSE * 2)) {
    if (typeof entree !== "object" || entree === null) {
      refuses.push({ brut: String(entree).slice(0, 60), raison: "ligne illisible" });
      continue;
    }
    const champ = entree as Record<string, unknown>;
    const nom = nettoyer(champ.nom ?? champ.plat ?? champ.name, NOM_MAX);
    const resume = (): string => (typeof entree === "object" ? JSON.stringify(entree).slice(0, 60) : "");

    if (!nom) {
      refuses.push({ brut: resume(), raison: "nom manquant ou illisible" });
      continue;
    }
    // Deux lignes identiques sont presque toujours une double lecture de la
    // même ligne du menu : on garde la première, on ne fait pas hissed-up.
    const cle = normaliserLibelle(nom);
    if (vus.has(cle)) continue;
    vus.add(cle);

    const prix = lirePrix(champ.prix);
    if (prix === null) {
      refuses.push({ brut: nom, raison: "prix illisible — à saisir à la main" });
      continue;
    }
    if (prix < 0 || prix > options.prixMax) {
      refuses.push({
        brut: `${nom} (${prix.toLocaleString("fr-FR")} GNF)`,
        raison: `prix hors limites (0 à ${options.prixMax.toLocaleString("fr-FR")} GNF)`,
      });
      continue;
    }

    const sectionModele = nettoyer(champ.section, 60) || null;
    const sectionId = rapprocherSection(sectionModele, options.sections);
    if (sectionModele && !sectionId) sectionsInconnues.add(sectionModele);

    plats.push({
      nom,
      description: nettoyer(champ.description, DESCRIPTION_MAX),
      prix,
      section: sectionModele,
      section_id: sectionId,
    });
    if (plats.length >= PLATS_MAX_PAR_ANALYSE) break;
  }

  return { plats, refuses, sectionsInconnues: [...sectionsInconnues] };
}