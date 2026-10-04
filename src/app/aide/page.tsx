import type { Metadata } from "next";
import { LienRetour } from "@/components/LienRetour";
import { origineDuSite } from "@/lib/partage/origine";

const CONTACT = "moelohimmara@gmail.com";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Aide et questions fréquentes",
    description: "Comment commander sur Speedfood, payer, suivre sa commande et protéger vos données.",
    alternates: { canonical: `${origine}/aide` },
  };
}

/**
 * Questions fréquentes (lot D). Chaque réponse ne dit que ce que l'application fait réellement : pas de délai de
 * livraison promis, pas de paiement en ligne, pas d'annulation par le client (seul le restaurant peut annuler).
 */
const QUESTIONS: { question: string; reponse: string }[] = [
  {
    question: "Faut-il un compte ou une application pour commander ?",
    reponse:
      "Non. Vous choisissez un restaurant et vos plats, puis vous indiquez votre nom et votre numéro de téléphone (et votre adresse si vous demandez une livraison). Aucun compte, aucune application à installer.",
  },
  {
    question: "Comment payer ?",
    reponse:
      "Speedfood ne reçoit aucun paiement. Vous réglez directement avec le restaurant. Sa fiche indique les moyens de paiement qu'il déclare accepter (espèces, Orange Money, MTN MoMo) ; s'il n'en indique aucun, convenez-en avec lui.",
  },
  {
    question: "Que veut dire « confirmé » à côté d'un plat ?",
    reponse:
      "Le restaurant a confirmé que le plat était disponible, et l'heure de cette confirmation est affichée. Si la confirmation est ancienne, la fiche indique « à confirmer » : le restaurant la refera quand il traitera votre commande.",
  },
  {
    question: "Comment suivre ma commande ?",
    reponse:
      "Après l'envoi, vous recevez un lien de suivi privé : la page se met à jour quand le restaurant accepte, prépare ou termine votre commande. Gardez ce lien pour vous, il donne accès à votre commande.",
  },
  {
    question: "Le restaurant veut changer un prix ou des frais, que se passe-t-il ?",
    reponse:
      "Il vous soumet une proposition sur votre page de suivi. Rien ne part en préparation sans votre accord. Si vous refusez, ou si le délai indiqué est dépassé, la commande est annulée et rien n'est dû.",
  },
  {
    question: "Puis-je annuler ma commande ?",
    reponse:
      "Contactez directement le restaurant : seul lui peut annuler une commande en cours. Vous pouvez en revanche refuser une proposition de changement de prix, ce qui annule la commande.",
  },
  {
    question: "Speedfood livre-t-il ?",
    reponse:
      "Non. La livraison, quand elle existe, est assurée par le restaurant, qui fixe ses conditions et ses frais. Speedfood ne promet aucun délai de livraison.",
  },
  {
    question: "Que devient mon numéro de téléphone ?",
    reponse:
      "Il n'est visible que du restaurant que vous avez choisi, et il est effacé de nos systèmes quelque temps après la fin de votre commande. Pas de publicité, rien n'est vendu. Le détail est sur la page Confidentialité.",
  },
  {
    question: "Je suis restaurateur : comment apparaître sur Speedfood ?",
    reponse:
      "Créez votre compte et votre établissement, complétez votre page (photo, menu, horaires), puis une personne de l'équipe la valide avant publication. Les étapes sont détaillées sur la page « Devenir partenaire ».",
  },
];

export default function AidePage() {
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QUESTIONS.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.reponse },
    })),
  };

  return (
    <main className="page-texte">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees).replace(/</g, "\\u003c") }}
      />
      <LienRetour href="/restaurants">Retour aux restaurants</LienRetour>
      <h1>Aide et questions fréquentes</h1>
      <p className="page-texte-intro">Commander, payer, suivre sa commande : l&apos;essentiel en quelques réponses.</p>

      <div className="faq">
        {QUESTIONS.map((q) => (
          <details key={q.question} className="faq-item">
            <summary>{q.question}</summary>
            <p>{q.reponse}</p>
          </details>
        ))}
      </div>

      <p className="page-texte-contact">
        Une question qui n&apos;est pas ici ? Écrivez à{" "}
        <a href={`mailto:${CONTACT}`} className="lien-texte">
          {CONTACT}
        </a>
        , en indiquant la référence de votre commande (de la forme SF-XXXXX) si vous en avez une.
      </p>
    </main>
  );
}
