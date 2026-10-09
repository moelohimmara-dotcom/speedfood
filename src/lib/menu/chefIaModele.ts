import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { construireConsigne } from "./chefMenu";

/**
 * Accès au modèle vision de Workers AI pour le « Chef IA ».
 *
 * Modèle retenu : `@cf/meta/llama-3.2-11b-vision-instruct`. C'est le plus
 * gros modèle multimodal compatible avec le quota gratuit (10 000 neurons par
 * jour), et l'OCR de menus printed/ardoise est précisément le cas où un 7B se
 * trompe de prix — donc chaque prix est revu par le restaurateur avant d'être
 * écrit (§voir chefMenu.ts).
 *
 * Le passage par Cloudflare n'est pas une option : sur l'offre gratuite, un
 * tiers du marché de l'inférence est interdit. Le secret d'API éventuel ne
 * vit pas ici — le binding `AI` déclaré dans wrangler.jsonc suffit et ne peut
 * pas être exfiltré depuis le code applicatif.
 */

const MODELE = "@cf/meta/llama-3.2-11b-vision-instruct";
// Borne la génération : une carte de restaurant tient largement en 1 500 tokens,
// et chaque token supplémentaire est facturé. Au-delà, la carte serait de toute
// façon tronquée sans que le restaurateur le voie.
const MAX_TOKENS = 1500;

/**
 * L'interface du binding `AI` est fournie par les types Workers, pas par ceux
 * d'OpenNext : on la déclare au plus juste, sans_typer tout le SDK Workers
 * dans le projet.
 */
interface BindingIA {
  run(modele: string, entrees: unknown, options?: unknown): Promise<{ response?: string }>;
}

/**
 * Lecture d'une photo par le modèle. Renvoie la RÉPONSE BRUTE du modèle : ce
 * n'est pas cette couche qui décide de ce qu'on garde (voir `analyserReponseModele`
 * dans chefMenu.ts, qui est pure et testable) mais seulement celle qui parle au
 * modèle. Le découpage évite d'avoir à mocker Cloudflare pour tester l'analyse.
 *
 * `imageEnDataUrl` : image déjà réduite et encodée par le navigateur (JPEG de
 * 1 500 px au plus, quelques centaines de Ko). Un modèle vision est facturé au
 * nombre de pixels : une photo de téléphone brute (12 Mpx) coûterait plusieurs
 * fois plus pour exactement le même résultat.
 */
export async function lireMenuAvecIA(imageEnDataUrl: string): Promise<string> {
  let binding: BindingIA | undefined;
  try {
    const contexte = await getCloudflareContext({ async: true });
    // Le type `CloudflareEnv` d'OpenNext ne connaît que les bindings que le
    // projet déclare ailleurs ; `AI` est lu comme une entrée quelconque plutôt
    // que d'élargir le type global de tout le projet pour un seul binding.
    binding = (contexte?.env as Record<string, unknown> | undefined)?.AI as BindingIA | undefined;
  } catch {
    binding = undefined;
  }

  if (!binding || typeof binding.run !== "function") {
    // Hors Workers (développement local sans proxy, tests), ou binding absent
    // d'un wrangler.jsonc non redéployé : le dire franchement vaut mieux qu'une
    // erreur « undefined is not a function » dix lignes plus loin.
    throw new ErreurMetier(
      "ERREUR_SERVEUR",
      "La lecture de photo n'est pas disponible ici. L'assistant IA fonctionne une fois le site déployé sur Cloudflare."
    );
  }

  let resultat: { response?: string };
  try {
    resultat = await binding.run(
      MODELE,
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: construireConsigne() },
              { type: "image", image: imageEnDataUrl },
            ],
          },
        ],
        max_tokens: MAX_TOKENS,
      },
      { gateway: { error_summarization: true } }
    );
  } catch (erreur) {
    // Le message reste dans les journaux du Worker (accessibles à la seule
    // équipe Speedfood) ; le restaurateur, lui, ne voit que la phrase
    // ci-dessous, qui ne peut rien divulguer du déploiement.
    console.error(
      "chef_ia_appel_modele_echoue",
      erreur instanceof Error ? `${erreur.name}: ${erreur.message}` : String(erreur)
    );
    throw new ErreurMetier(
      "ERREUR_SERVEUR",
      "L'assistant n'a pas pu lire la photo. Réessayez dans un instant, ou ajoutez vos plats à la main."
    );
  }

  const texte = resultat?.response;
  if (!texte || typeof texte !== "string" || !texte.trim()) {
    throw new ErreurMetier(
      "ERREUR_SERVEUR",
      "L'assistant n'a rien trouvé sur cette photo. Vérifiez que le menu est bien visible et suffisamment éclairé."
    );
  }
  return texte;
}