import Link from "next/link";
import { lireTextes } from "@/lib/cms/textes";
import { FLECHE } from "./commun";

/**
 * Les questions qui peuvent empêcher une commande. Chaque réponse décrit ce que le service fait réellement aujourd'hui :
 * couverture pilote, livraison et retrait précisés par chaque restaurant, règlement direct, heure de confirmation des plats.
 * À mettre à jour avec la couverture et les règles en vigueur (aucun délai, frais ou couverture non confirmés).
 */
const QUESTIONS: { question: string; reponse: string }[] = [
  {
    question: "Speedfood est-il disponible dans ma localité ?",
    reponse:
      "Aujourd'hui, les restaurants référencés sont à Conakry (phase pilote). Choisissez votre commune ou votre quartier pour voir ce qui s'y trouve. D'autres localités s'ajoutent avec les restaurants qui s'inscrivent.",
  },
  {
    question: "Comment savoir si le restaurant livre à mon adresse ?",
    reponse:
      "Chaque restaurant précise comment il sert ses clients (retrait, livraison selon ses propres conditions). Speedfood n'assure pas la livraison et n'annonce aucun délai : les conditions se confirment avec le restaurant.",
  },
  {
    question: "Puis-je retirer ma commande ?",
    reponse: "Oui, si le restaurant propose le retrait : vous choisissez retrait ou livraison au moment d'envoyer votre commande.",
  },
  {
    question: "Comment le paiement se passe-t-il ?",
    reponse:
      "Vous réglez directement le restaurant, en espèces ou avec son code marchand, après son acceptation. Speedfood n'encaisse rien pour le moment.",
  },
  {
    question: "Que signifie l'heure de confirmation d'un plat ?",
    reponse:
      "C'est l'heure à laquelle le restaurant a indiqué que le plat était disponible. Si elle est ancienne ou absente, le plat est marqué « à confirmer » : le restaurant vous le confirmera.",
  },
];

/** FAQ de l'accueil : cinq questions et un accès à toutes les réponses (emplacements `accueil.faq.*`). */
export async function AccueilFaq() {
  const t = await lireTextes();
  return (
    <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-faq">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">{t["accueil.faq.kicker"]}</p>
        <h2 id="accueil-faq" className="pub-titre pub-h2">
          {t["accueil.faq.titre"]}
        </h2>
      </div>
      <div className="pub-faq">
        {QUESTIONS.map((q) => (
          <details key={q.question} className="pub-faq-item">
            <summary>{q.question}</summary>
            <p>{q.reponse}</p>
          </details>
        ))}
      </div>
      <div>
        <Link href="/aide" className="pub-btn pub-btn-clair">
          {t["accueil.faq.bouton"]}
          <span className="pub-btn-point" aria-hidden="true">
            {FLECHE}
          </span>
        </Link>
      </div>
    </section>
  );
}
