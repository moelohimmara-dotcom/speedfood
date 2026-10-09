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
 * Les noms eux-mêmes sont encore moins stables : au sondage du 9 octobre 2026,
 * `@cf/moondream/moondream3.1-9B-A2B` répondait sans erreur mais renvoyait un
 * objet vide (même sans image), et `@cf/llava-hf/...`, `@cf/qwen/qwen*-vl-*`
 * comme `@cf/google/gemma-3-27b-it` n'existaient plus. D'où le principe : on
 * essaie dans l'ordre, on ne bascule au suivant que sur échec, et **chaque
 * échec est journalisé avec sa cause**. Sans cela, une régression silencieuse
 * pourrait faire tomber toute la fonction sans qu'on sache pourquoi.
 *
 * ## Choix des modèles
 *
 * 1. **llama-4-scout-17b-16e-instruct** — multimodal, sans porte de licence,
 *    et vérifié bon sur une vraie carte : il a lu les prix, respecté la ligne
 *    sans prix (`prix: null`) et restitué les sections.
 * 2. **llama-3.2-11b-vision-instruct** — repli, à condition que la licence
 *    Meta ait été acceptée sur le compte. On garde sa forme d'appel d'origine
 *    (parties `text`/`image`), différente de celle du premier.
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

/**
 * Ces modèles sont servis derrière une API de type OpenAI, dont le texte vit
 * dans `choices[0].message.content`. Les autres emplacements sont lus aussi :
 * la forme du retour change plus vite que les déploiements, et on a déjà été
 * surpris (`response` pour l'un, `answer` pour un autre).
 */
function texteOpenAi(reponse: Record<string, unknown>): string | null {
  const choix = reponse.choices as { message?: { content?: unknown } }[] | undefined;
  const contenu = choix?.[0]?.message?.content;
  if (typeof contenu === "string" && contenu.trim()) return contenu;
  for (const clef of ["response", "answer"] as const) {
    const valeur = reponse[clef];
    if (typeof valeur === "string" && valeur.trim()) return valeur;
  }
  return null;
}

const MODELES: ModeleVision[] = [
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    construire: (image) => ({
      messages: [
        {
          role: "user",
          content: [
            { type: "input_text", text: construireConsigne() },
            // `detail` est exigé par l'API : sans lui, l'appel est refusé sur une
            // erreur de validation (« Field required: detail »). C'est le
            // réglage « haute précision » du modèle.
            { type: "input_image", detail: "high", image_url: image },
          ],
        },
      ],
      max_tokens: MAX_TOKENS,
    }),
    texte: texteOpenAi,
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
    texte: texteOpenAi,
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
      // Un modèle qui répond sans champ texte exploitable est un cas qu'on ne
      // peut pas deviner à l'avance : on journalise la forme réelle de sa
      // réponse (jamais son contenu, déjà présent dans les logs de l'action).
      console.error(
        "chef_ia_reponse_inattendue",
        modele.id,
        JSON.stringify(brut).slice(0, 400)
      );
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