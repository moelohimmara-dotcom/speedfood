import type { Metadata } from "next";
import Link from "next/link";
import { creerClientAdmin } from "@/lib/db/admin";

export const metadata: Metadata = {
  title: "Confidentialité · Speedfood",
  description: "Les informations que Speedfood demande, pourquoi, qui les voit et combien de temps elles sont gardées.",
};

// Lue à chaque affichage : la durée annoncée est TOUJOURS celle réellement appliquée (réglage
// `conservation_coordonnees_jours`, voir docs/CONSERVATION-ET-CONFIDENTIALITE.md §6).
export const dynamic = "force-dynamic";

const RESPONSABLE = "Mo elohim";
const CONTACT = "moelohimmara@gmail.com";
const DERNIERE_MISE_A_JOUR = "3 octobre 2026";
const DUREE_PAR_DEFAUT = 90;

async function lireDureeConservation(): Promise<number> {
  const { data } = await creerClientAdmin()
    .from("parametres_application")
    .select("conservation_coordonnees_jours")
    .eq("id", true)
    .maybeSingle();
  return data?.conservation_coordonnees_jours ?? DUREE_PAR_DEFAUT;
}

export default async function ConfidentialitePage() {
  const duree = await lireDureeConservation();

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "var(--space-8) var(--space-4)", lineHeight: 1.6 }}>
      <Link href="/restaurants" style={{ color: "var(--secondaire)", fontWeight: 700, fontSize: "0.9rem" }}>
        ← Retour aux restaurants
      </Link>
      <h1 style={{ fontSize: "2rem", margin: "var(--space-3) 0 var(--space-4)" }}>Vos données sur Speedfood</h1>
      <p>
        Speedfood est un portail qui vous aide à trouver un restaurant et à lui envoyer une demande de commande. Voici,
        simplement, ce qui se passe avec vos informations.
      </p>

      <h2 style={{ fontSize: "1.2rem", marginTop: "var(--space-5)" }}>Ce que nous demandons</h2>
      <p>
        Pour envoyer une demande, nous vous demandons votre nom et votre numéro de téléphone, et votre adresse seulement si
        vous demandez une livraison. Rien d&apos;autre. Vous n&apos;avez pas besoin de créer de compte.
      </p>

      <h2 style={{ fontSize: "1.2rem", marginTop: "var(--space-5)" }}>Pourquoi</h2>
      <p>
        Uniquement pour que le restaurant puisse traiter votre commande et vous joindre. Nous ne vous envoyons pas de
        publicité et nous ne vendons pas vos informations.
      </p>

      <h2 style={{ fontSize: "1.2rem", marginTop: "var(--space-5)" }}>Qui peut les voir</h2>
      <p>
        Le restaurant que vous avez choisi, pour votre commande. L&apos;équipe Speedfood ne voit votre téléphone et votre adresse
        que si une aide est nécessaire, avec un motif obligatoire qui est enregistré. Votre lien de suivi est secret : ne le
        partagez pas.
      </p>

      <h2 style={{ fontSize: "1.2rem", marginTop: "var(--space-5)" }}>Paiement</h2>
      <p>Speedfood ne reçoit aucun paiement. Vous réglez directement avec le restaurant.</p>

      <h2 style={{ fontSize: "1.2rem", marginTop: "var(--space-5)" }}>Combien de temps</h2>
      <p>
        Votre nom, votre téléphone et votre adresse sont effacés de nos systèmes <strong>{duree} jours</strong> après la fin de
        votre commande. Les montants et les plats restent, sans vous identifier.
      </p>

      <h2 style={{ fontSize: "1.2rem", marginTop: "var(--space-5)" }}>Vos droits</h2>
      <p>
        Vous pouvez demander à voir, corriger ou effacer vos informations, à tout moment, en écrivant à{" "}
        <a href={`mailto:${CONTACT}`} style={{ fontWeight: 700 }}>
          {CONTACT}
        </a>
        . Nous répondons sous 30 jours. Pour aller plus vite, indiquez la référence de votre commande (de la forme SF-XXXXX).
      </p>

      <h2 style={{ fontSize: "1.2rem", marginTop: "var(--space-5)" }}>Où elles sont stockées</h2>
      <p>
        Dans un service d&apos;hébergement situé en Irlande (Supabase) et servies par Cloudflare. Ces prestataires peuvent voir des
        informations techniques de connexion (comme l&apos;adresse IP) selon leurs propres règles ; Speedfood ne les conserve pas.
        Pour vérifier qu&apos;une commande n&apos;est pas envoyée par un robot, nous utilisons le contrôle anti-robot de Cloudflare
        (Turnstile).
      </p>

      <h2 style={{ fontSize: "1.2rem", marginTop: "var(--space-5)" }}>Responsable</h2>
      <p>
        {RESPONSABLE}. Dernière mise à jour : {DERNIERE_MISE_A_JOUR}.
      </p>
    </main>
  );
}
