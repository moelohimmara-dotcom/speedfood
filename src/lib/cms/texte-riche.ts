import { estLienBanniereSur } from "../auth/redirection";

/**
 * Texte riche minimal du CMS (Studio, palier 0) : transforme le texte brut d'une page éditoriale en un arbre de blocs typés.
 * AUCUN HTML libre : le composant `TexteRiche` rend cet arbre en éléments React, jamais en `dangerouslySetInnerHTML`.
 * Module PUR (aucun import serveur) pour être testé sans framework.
 *
 * Syntaxe reconnue : `# titre`, `## sous-titre` (une ligne), paragraphes séparés par une ligne vide, listes `- élément`,
 * et dans le texte `**gras**` et `[libellé](lien)`. Tout le reste (y compris `<script>`) est du texte tel quel.
 */

export const MAX_CARACTERES = 20_000;
export const MAX_BLOCS = 200;

export type Segment =
  | { type: "texte"; valeur: string }
  | { type: "gras"; valeur: string }
  | { type: "lien"; libelle: string; href: string }
  | { type: "saut" };

export type Bloc =
  | { type: "titre"; niveau: 1 | 2; segments: Segment[] }
  | { type: "paragraphe"; segments: Segment[] }
  | { type: "liste"; elements: Segment[][] };

const MOTIF_INLINE = /\*\*([^*\n]+?)\*\*|\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/g;

/** Découpe une ligne en segments : texte, gras, lien autorisé. Un lien refusé devient son libellé en texte simple. */
export function segmenter(ligne: string): Segment[] {
  const segments: Segment[] = [];
  const ajouterTexte = (valeur: string) => {
    if (!valeur) return;
    const dernier = segments[segments.length - 1];
    if (dernier && dernier.type === "texte") dernier.valeur += valeur;
    else segments.push({ type: "texte", valeur });
  };
  let curseur = 0;
  for (const m of ligne.matchAll(MOTIF_INLINE)) {
    ajouterTexte(ligne.slice(curseur, m.index));
    if (m[1] !== undefined) {
      segments.push({ type: "gras", valeur: m[1] });
    } else if (estLienBanniereSur(m[3])) {
      segments.push({ type: "lien", libelle: m[2], href: m[3] });
    } else {
      ajouterTexte(m[2]);
    }
    curseur = (m.index ?? 0) + m[0].length;
  }
  ajouterTexte(ligne.slice(curseur));
  return segments;
}

/** Texte brut -> blocs. Entrée vide ou non textuelle -> tableau vide. Lit au plus 20 000 caractères, rend au plus 200 blocs. */
export function analyserTexteRiche(contenu: string): Bloc[] {
  if (typeof contenu !== "string" || contenu.trim() === "") return [];
  const lignes = contenu.slice(0, MAX_CARACTERES).replace(/\r\n?/g, "\n").split("\n");
  const blocs: Bloc[] = [];

  let paragraphe: string[] = [];
  let liste: Segment[][] = [];

  const viderParagraphe = () => {
    if (paragraphe.length === 0) return;
    const segments: Segment[] = [];
    paragraphe.forEach((l, i) => {
      if (i > 0) segments.push({ type: "saut" });
      segments.push(...segmenter(l));
    });
    blocs.push({ type: "paragraphe", segments });
    paragraphe = [];
  };
  const viderListe = () => {
    if (liste.length === 0) return;
    blocs.push({ type: "liste", elements: liste });
    liste = [];
  };

  for (const brute of lignes) {
    const ligne = brute.trimEnd();
    if (ligne.trim() === "") {
      viderParagraphe();
      viderListe();
      continue;
    }
    const titre = /^(#{1,2}) +(\S.*)$/.exec(ligne);
    if (titre) {
      viderParagraphe();
      viderListe();
      blocs.push({ type: "titre", niveau: titre[1].length === 1 ? 1 : 2, segments: segmenter(titre[2]) });
      continue;
    }
    const element = /^- +(\S.*)$/.exec(ligne);
    if (element) {
      viderParagraphe();
      liste.push(segmenter(element[1]));
      continue;
    }
    viderListe();
    paragraphe.push(ligne);
  }
  viderParagraphe();
  viderListe();

  return blocs.slice(0, MAX_BLOCS);
}
