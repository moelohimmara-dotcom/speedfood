import "server-only";

import { creerClientAdmin } from "@/lib/db/admin";
import { cssDepuisJetons, resoudreJetons, LIBELLES_GROUPES, type Groupe, type LigneJeton } from "./jetons";

/**
 * Lecture des jetons de design et production du CSS correspondant (palier 4, phase 1).
 *
 * Séparé de `jetons.ts` (pur) parce que celui-ci ne doit importer ni Supabase ni le cache :
 * c'est ce qui le rend testable sans base et exécutable dans un test unitaire.
 *
 * PRUDENCE. Tout ce module est en ÉCHEC FERMÉ vers les valeurs de `globals.css` : si la base est
 * injoignable, si la table n'existe pas encore, si une ligne est illisible, on rend le CSS tel
 * que le code le définit. Un design cassé qui n'affiche plus rien serait bien pire qu'un design
 * qui ne suit pas la base pendant quelques secondes.
 */

const TTL_SECONDES = 60;

interface LigneBase {
  cle: string;
  valeur: string;
  libelle: string;
  groupe: LigneJeton["groupe"];
}

/**
 * Défauts de repli, lus dans `globals.css` au moment de la compilation. Dupliqués ici exprès :
 * une constante ne peut pas être extraite d'une feuille de style, et il ne faut surtout pas que
 * cette liste devienne la source de vérité — `globals.css` doit rester la référence, et c'est
 * `scripts/tests/design.test.mts` qui garantit que les deux ne divergent pas.
 */
const DEFAUTS: readonly LigneBase[] = [
  { cle: "couleur.rouge", valeur: "#d9362b", libelle: "Rouge principal", groupe: "couleurs" },
  { cle: "couleur.rouge-fonce", valeur: "#b82a20", libelle: "Rouge foncé", groupe: "couleurs" },
  { cle: "couleur.orange", valeur: "#ff7a1a", libelle: "Orange", groupe: "couleurs" },
  { cle: "couleur.mangue", valeur: "#ffc247", libelle: "Mangue", groupe: "couleurs" },
  { cle: "couleur.creme", valeur: "#fff6ed", libelle: "Crème", groupe: "couleurs" },
  { cle: "couleur.surface", valeur: "#fffefc", libelle: "Surface", groupe: "couleurs" },
  { cle: "couleur.encre", valeur: "#2b211d", libelle: "Encre", groupe: "couleurs" },
  { cle: "couleur.secondaire", valeur: "#75695f", libelle: "Gris secondaire", groupe: "couleurs" },
  { cle: "couleur.bordure", valeur: "#e9dcd2", libelle: "Bordure", groupe: "couleurs" },
  { cle: "couleur.succes", valeur: "#2e7d32", libelle: "Succès", groupe: "couleurs" },
  { cle: "couleur.succes-fond", valeur: "#e7f4e8", libelle: "Fond de succès", groupe: "couleurs" },
  { cle: "couleur.danger", valeur: "#c62828", libelle: "Danger", groupe: "couleurs" },
  { cle: "couleur.danger-fond", valeur: "#fbeaea", libelle: "Fond de danger", groupe: "couleurs" },
  { cle: "couleur.gradient-marque", valeur: "linear-gradient(135deg, #d4430f 0%, #b82a20 70%)", libelle: "Dégradé de marque", groupe: "couleurs" },
  { cle: "police.corps", valeur: "var(--font-manrope), system-ui, sans-serif", libelle: "Police du texte", groupe: "typographie" },
  { cle: "police.titre", valeur: "var(--font-bricolage), system-ui, sans-serif", libelle: "Police des titres", groupe: "typographie" },
  { cle: "police.condensee", valeur: "var(--font-barlow), system-ui, sans-serif", libelle: "Police condensée", groupe: "typographie" },
  { cle: "espace.1", valeur: "4px", libelle: "Espace 1", groupe: "espacements" },
  { cle: "espace.2", valeur: "8px", libelle: "Espace 2", groupe: "espacements" },
  { cle: "espace.3", valeur: "12px", libelle: "Espace 3", groupe: "espacements" },
  { cle: "espace.4", valeur: "16px", libelle: "Espace 4", groupe: "espacements" },
  { cle: "espace.5", valeur: "20px", libelle: "Espace 5", groupe: "espacements" },
  { cle: "espace.6", valeur: "24px", libelle: "Espace 6", groupe: "espacements" },
  { cle: "espace.8", valeur: "32px", libelle: "Espace 8", groupe: "espacements" },
  { cle: "forme.rayon-sm", valeur: "8px", libelle: "Rayon petit", groupe: "formes" },
  { cle: "forme.rayon-md", valeur: "14px", libelle: "Rayon moyen", groupe: "formes" },
  { cle: "forme.rayon-lg", valeur: "20px", libelle: "Rayon grand", groupe: "formes" },
  { cle: "forme.rayon-pill", valeur: "999px", libelle: "Pastille", groupe: "formes" },
  { cle: "forme.ombre-sm", valeur: "0 1px 2px rgba(43, 33, 29, 0.06), 0 1px 1px rgba(43, 33, 29, 0.04)", libelle: "Ombre petite", groupe: "formes" },
  { cle: "forme.ombre-md", valeur: "0 6px 16px rgba(43, 33, 29, 0.1), 0 2px 4px rgba(43, 33, 29, 0.06)", libelle: "Ombre moyenne", groupe: "formes" },
  { cle: "forme.ombre-lg", valeur: "0 16px 32px rgba(43, 33, 29, 0.14), 0 4px 8px rgba(43, 33, 29, 0.08)", libelle: "Ombre grande", groupe: "formes" },
  { cle: "forme.ombre-focus", valeur: "0 0 0 3px rgba(255, 122, 26, 0.35)", libelle: "Focus clavier", groupe: "formes" },
  { cle: "forme.ease", valeur: "cubic-bezier(0.2, 0.7, 0.3, 1)", libelle: "Courbe d'animation", groupe: "formes" },
  { cle: "forme.duree-fast", valeur: "120ms", libelle: "Animation rapide", groupe: "formes" },
  { cle: "forme.duree-base", valeur: "200ms", libelle: "Animation normale", groupe: "formes" },
];

export const JETONS_DEFAUT: readonly LigneBase[] = DEFAUTS;

const GROUPES_VALIDES = Object.keys(LIBELLES_GROUPES) as Groupe[];

/** Un jeton modifié, avec la portée à laquelle il s'applique. Sert à l'écran d'édition. */
export interface JetonEnregistre extends LigneBase {
  portee: "site" | "restaurant";
  restaurantId: string | null;
  /** `true` si la valeur vient de la base, `false` si c'est le repli du code. */
  personnalise: boolean;
}

/**
 * Tous les jetons d'une portée. En ÉCHEC FERMÉ : une ligne illisible est ignorée silencieusement
 * et le défaut du code prend le relais, plutôt que de faire échouer le rendu de la page.
 */
export async function lireJetons(portee: "site" | "restaurant", restaurantId: string | null = null): Promise<JetonEnregistre[]> {
  let data: { cle: string; valeur: string; libelle: string; groupe: string }[] = [];
  try {
    const requete = creerClientAdmin().from("design_tokens").select("cle, valeur, libelle, groupe").eq("portee", portee);
    const { data: lu, error } = restaurantId
      ? await requete.eq("restaurant_id", restaurantId)
      : await requete.is("restaurant_id", null);
    if (!error && lu) data = lu;
  } catch {
    // Table absente (migration pas encore appliquée) ou réseau coupé : on garde les défauts.
  }

  const personnalises = new Map<string, { cle: string; valeur: string; libelle: string; groupe: string }>();
  for (const d of data) personnalises.set(d.cle, d);

  return DEFAUTS.map((d) => {
    const personnalise = personnalises.get(d.cle);
    // Un groupe illisible en base ne doit pas faire tomber le rendu : on retombe sur le groupe du
    // code, qui est la référence, et la valeur reste affichable (elle est validée à l'écriture).
    if (personnalise) {
      const groupe = (GROUPES_VALIDES as readonly string[]).includes(personnalise.groupe) ? (personnalise.groupe as Groupe) : d.groupe;
      return { ...personnalise, groupe, portee, restaurantId, personnalise: true };
    }
    return { ...d, portee, restaurantId, personnalise: false };
  });
}

/** Le CSS `:root` du site, jetons résolus. Toujours non vide : au pire les valeurs du code. */
export async function cssJetonsSite(): Promise<string> {
  return cssDepuisJetons(new Map((await lireJetons("site")).map((j) => [j.cle, j.valeur])));
}

/** Le CSS `:root` pour la fiche d'un restaurant : ses jetons ownent sur ceux du site. */
export async function cssJetonsRestaurant(restaurantId: string): Promise<string> {
  const site = await lireJetons("site");
  const propres = await lireJetons("restaurant", restaurantId);
  return cssDepuisJetons(resoudreJetons(DEFAUTS, site, propres));
}
