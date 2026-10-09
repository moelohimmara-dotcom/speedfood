import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { construireConsigne } from "./chefMenu";

/**
 * Accès à Workers AI pour le « Chef IA ».
 *
 * ## Pourquoi une liste de modèles et pas un seul
 *
 * Le premier modèle choisi, `@cf/meta/llama-3.2-11b-vision-instruct`, est
 * refusé tant que la licence communautaire Meta n'a pas été acceptée dans le
 * compte Cloudflare (erreur 5016) — un verrou administratif, pas technique,
 * qui varie d'un compte à l'autre. Un appel qui ne dépend que d'un nom de
 * modèle nous mettrait à l'arrêt dès qu'un de eux devient indisponible.
 *
 * On essaie donc les modèles dans l'ordre, et on ne bascule au suivant que si
 * le précédent échoue. Chaque tentative échouée est journalisée avec sa cause
 * dans les logs du Worker (réservés à l'équipe) : sans cela, une régression
 * silencieuse pourrait faire tomber toute la fonction sans qu'on sache
 * pourquoi.
 *
 * ## Choix des modèles
 *
 * 1. **moondream3.1-9B-A2B** — modèle d'UC Berkeley construit pour l'OCR et la
 *    sortie structurée, 2B paramètres actifs seulement (donc bon marché en
 *    neurones), et sans porte de licence. C'est le modèle le mieux aligné avec
 *    le besoin : lire des prix sur une image.
 * 2. **llama-3.2-11b-vision-instruct** — plus fort sur le raisonnement visuel
 *    général, mais conditionné à l'acceptation de licence. On le garde en
 *    repli pour les cartes dont le texte est vraiment difficile.
 *
 * Le secret d'API éventuel ne vit pas ici : le binding `AI` déclaré dans
 * wrangler.jsonc suffit et ne peut pas être exfiltré depuis le code
 * applicatif.
 */

/** Borne la génération : une carte de restaurant tient largement en 1 500 tokens,
 *  et chaque token supplémentaire est facturé. Au-delà, la carte serait de toute
 *  façon tronquée sans que le restaurateur le voie. */
const MAX_TOKENS = 1500;

interface ModeleVision {
  id: string;
  construire(imageEnDataUrl: string): Record<string, unknown>;
  texte(reponse: Record<string, unknown>): string | null;
}

const MODELES: ModeleVision[] = [
  {
    id: "@cf/moondream/moondream3.1-9B-A2B",
    construire: (image) => ({
      task: "query",
      image,
      question: construireConsigne(),
      // Le raisonnement trace coûte des tokens pour rien ici : on veut la
      // réponse, pas le chemin qu'elle a emprunté.
      reasoning: false,
      max_tokens: MAX_TOKENS,
    }),
    texte: (reponse) => (typeof reponse.answer === "string" ? reponse.answer : null),
  },
  {
    id: "@cf/meta/llama-3.2-11b-vision-instruct",
    construire: (image) => ({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: construireConsigne() },
            { type: "image", image },
          ],
        },
      ],
      max_tokens: MAX_TOKENS,
    }),
    texte: (reponse) => (typeof reponse.response === "string" ? reponse.response : null),
  },
];

/**
 * L'interface du binding `AI` est fournie par les types Workers, pas par ceux
 * d'OpenNext : on la déclare au plus juste, sans typer tout le SDK Workers
 * dans le projet.
 */
interface BindingIA {
  run(modele: string, entrees: unknown, options?: unknown): Promise<unknown>;
}

function lireBindingIA(): BindingIA | null {
  // Accès synchrone à `getCloudflareContext` : la version `await` de l'API est
  // réservée aux contextes asynchrones, et nous sommes dans une Server Action
  // donc déjà dans un contexte de requête. La forme non-await lève si elle est
  // appelée hors requête, ce qu'on rattrape pour ne planter ni en test ni en
  // développement local.
  try {
    const contexte = getCloudflareContext();
    const env = contexte?.env as Record<string, unknown> | undefined;
    const binding = env?.AI as BindingIA | undefined;
    return binding && typeof binding.run === "function" ? binding : null;
  } catch {
    return null;
  }
}

/**
 * Lecture d'une photo par les modèles, l'un après l'autre. Renvoie la PREMIÈRE
 * réponse non vide : le modèle le plus simple et le moins cher suffit dans la
 * très grande majorité des cas.
 *
 * `imageEnDataUrl` : image déjà réduite et encodée par le navigateur. Un modèle
 * vision est facturé au nombre de pixels : une photo de téléphone brute (12 Mpx)
 * coûterait plusieurs fois plus pour exactement le même résultat.
 */
export async function lireMenuAvecIA(imageEnDataUrl: string): Promise<string> {
  const binding = lireBindingIA();
  if (!binding) {
    // Hors Workers (développement local sans proxy, tests), ou binding absent
    // d'un wrangler.jsonc non redéployé : le dire franchement vaut mieux qu'une
    // erreur technique incompréhensible affichée au restaurateur.
    throw new ErreurMetier(
      "ERREUR_SERVEUR",
      "La lecture de photo n'est pas disponible ici. L'assistant IA fonctionne une fois le site déployé sur Cloudflare."
    );
  }

  const echecs: string[] = [];

  for (const modele of MODELES) {
    try {
      const brut = await binding.run(modele.id, modele.construire(imageEnDataUrl));
      const texte = modele.texte((brut ?? {}) as Record<string, unknown>);
      if (texte && texte.trim()) {
        return texte;
      }
      echecs.push(`${modele.id}: reponse vide`);
    } catch (erreur) {
      // Le message reste dans les journaux du Worker (accessibles à la seule
      // équipe Speedfood) ; le restaurateur ne voit qu'une phrase, qui ne peut
      // rien divulguer du déploiement.
      const cause = erreur instanceof Error ? `${erreur.name}: ${erreur.message}` : String(erreur);
      echecs.push(`${modele.id}: ${cause}`);
      console.error("chef_ia_appel_modele_echoue", cause);
    }
  }

  console.error("chef_ia_aucun_modele_disponible", echecs.join(" | "));
  throw new ErreurMetier(
    "ERREUR_SERVEUR",
    "L'assistant n'a pas pu lire la photo. Réessayez dans un instant, ou ajoutez vos plats à la main."
  );
}