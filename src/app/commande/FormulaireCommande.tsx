"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sousTotalPanier,
  viderPanier,
  type Panier,
} from "@/components/panier/panier";
import { creerCommandeAction } from "@/lib/commande/actions";
import type { CreationCommandePayload, ModeRetrait } from "@/lib/contracts/commande";
import type { ErreurApi } from "@/lib/contracts/erreurs";
import { Button, Input, Alert } from "@/components/ui";
import { Turnstile } from "@/components/Turnstile";

interface Props {
  panier: Panier;
  /** Clé de site Turnstile (publique) ; absente = vérification anti-robot désactivée. */
  cleSiteTurnstile?: string;
}

/**
 * Formulaire de commande invitée (ADR-005) : nom, téléphone, retrait ou
 * livraison (adresse obligatoire uniquement en livraison), consentement
 * explicite au règlement hors portail.
 *
 * La validation serveur fait foi ; celle-ci n'est qu'un confort d'affichage.
 * Aucun montant n'est envoyé : le serveur recalcule tout (ADR-006).
 */
export function FormulaireCommande({ panier, cleSiteTurnstile }: Props) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [mode, setMode] = useState<ModeRetrait>("retrait");
  const [adresse, setAdresse] = useState("");
  const [consentement, setConsentement] = useState(false);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [jetonVerification, setJetonVerification] = useState<string | null>(null);
  const [renouvelerVerification, setRenouvelerVerification] = useState(0);

  // Une seule clé d'idempotence par passage au formulaire : un double clic ou un
  // retry réseau ne créera jamais deux commandes (voir lib/commande/creation.ts).
  const [cleIdempotence] = useState(() => {
    // UUID v4 exigé par le serveur ; `randomUUID` n'existe qu'en contexte sécurisé (HTTPS),
    // sinon on le fabrique à partir de `getRandomValues` (jamais de Math.random).
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    const o = crypto.getRandomValues(new Uint8Array(16));
    o[6] = (o[6] & 0x0f) | 0x40;
    o[8] = (o[8] & 0x3f) | 0x80;
    const h = Array.from(o, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  });

  // Total que le client a réellement sous les yeux. Il vaut le total du panier, sauf si le
  // serveur a signalé un changement de prix : il affiche alors le nouveau total, que le
  // client confirme explicitement en validant de nouveau.
  const [totalServeur, setTotalServeur] = useState<number | null>(null);
  const totalAffiche = totalServeur ?? sousTotalPanier(panier);

  function soumettre() {
    const erreurs: Record<string, string> = {};
    if (nom.trim().length < 2 || nom.trim().length > 120) {
      erreurs.nom = "Indiquez votre nom (2 à 120 caractères).";
    }
    if (telephone.trim().length < 8) {
      erreurs.telephone =
        "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (ex. +224 622 12 34 56).";
    }
    if (mode === "livraison" && adresse.trim().length < 5) {
      erreurs.adresse = "L'adresse de livraison est obligatoire.";
    }
    if (!consentement) {
      erreurs.consentement =
        "Vous devez confirmer avoir pris connaissance des modalités de règlement.";
    }
    if (!panier.restaurantId || panier.lignes.length === 0) {
      erreurs.lignes = "Votre panier est vide.";
    }
    if (cleSiteTurnstile && !jetonVerification) {
      erreurs.verification = "Confirmez que vous n'êtes pas un robot.";
    }
    setChamps(erreurs);
    if (Object.keys(erreurs).length > 0) {
      return;
    }

    const payload: CreationCommandePayload = {
      cleIdempotence,
      sousTotalAffiche: totalAffiche,
      restaurantId: panier.restaurantId as string,
      client: {
        nom: nom.trim(),
        telephone: telephone.trim(),
        adresse: adresse.trim().length > 0 ? adresse.trim() : null,
      },
      mode,
      lignes: panier.lignes.map((ligne) => ({
        menuItemId: ligne.menuItemId,
        quantite: ligne.quantite,
        optionIds: ligne.options.map((o) => o.id),
      })),
      consentementReglement: true,
      jetonVerification: jetonVerification ?? undefined,
    };

    setErreurGenerale(null);
    demarrer(async () => {
      const resultat = await creerCommandeAction(payload);
      // Un jeton ne se valide qu'une fois : un jeton neuf est redemandé après chaque envoi.
      setRenouvelerVerification((n) => n + 1);
      if (resultat.ok) {
        viderPanier();
        router.push(`/suivi/${resultat.jeton}`);
        return;
      }
      appliquerErreur(resultat.erreur);
    });
  }

  function appliquerErreur(erreur: ErreurApi) {
    const nouveauTotal = Number(erreur.champs?.sousTotalServeur);
    if (erreur.code === "CONFLIT_ETAT" && Number.isSafeInteger(nouveauTotal)) {
      setTotalServeur(nouveauTotal);
    }
    setChamps(erreur.champs ?? {});
    setErreurGenerale(erreur.message);
  }

  return (
    <form
      onSubmit={(evenement) => {
        evenement.preventDefault();
        soumettre();
      }}
      noValidate
    >
      <Input
        label="Votre nom"
        name="nom"
        type="text"
        required
        maxLength={120}
        autoComplete="name"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        erreur={champs.nom}
      />
      <Input
        label="Numéro de téléphone"
        name="telephone"
        type="tel"
        required
        maxLength={24}
        autoComplete="tel"
        placeholder="+224 622 12 34 56"
        value={telephone}
        onChange={(e) => setTelephone(e.target.value)}
        erreur={champs.telephone}
      />

      <fieldset style={{ border: 0, padding: 0, margin: "0 0 var(--space-4)" }}>
        <legend style={{ fontWeight: 700, marginBottom: 8 }}>Mode de réception</legend>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <input
            type="radio"
            name="mode"
            value="retrait"
            checked={mode === "retrait"}
            onChange={() => setMode("retrait")}
          />
          Retrait sur place
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="radio"
            name="mode"
            value="livraison"
            checked={mode === "livraison"}
            onChange={() => setMode("livraison")}
          />
          Livraison (à confirmer avec le restaurant)
        </label>
      </fieldset>

      {mode === "livraison" ? (
        <Input
          label="Adresse de livraison"
          name="adresse"
          type="text"
          required
          maxLength={300}
          autoComplete="street-address"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          erreur={champs.adresse}
        />
      ) : null}

      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>Règlement et confirmation</p>
        <p style={{ margin: 0, color: "var(--secondaire)", fontSize: "0.9rem" }}>
          Speedfood n&apos;encaisse aucun paiement : vous réglez directement avec le restaurant
          (espèces ou mobile money), selon ses modalités. Votre commande n&apos;est pas confirmée
          tant que le restaurant ne l&apos;a pas acceptée. Les prix et la disponibilité viennent du
          menu du restaurant et sont revérifiés à l&apos;envoi.
        </p>
      </div>

      <label
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          marginBottom: "var(--space-4)",
          fontSize: "0.9rem",
        }}
      >
        <input
          type="checkbox"
          name="consentement"
          checked={consentement}
          onChange={(e) => setConsentement(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          J&apos;accepte que mon nom, mon numéro de téléphone et, le cas échéant, mon adresse soient
          transmis au restaurant uniquement pour traiter ma commande. Je comprends que le règlement
          se fait directement avec le restaurant et que ma commande doit être confirmée par ce
          dernier.{" "}
          <a href="/confidentialite" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
            Voir comment mes données sont utilisées
          </a>
        </span>
      </label>
      {champs.consentement ? (
        <p className="field-error" style={{ marginTop: -8, marginBottom: "var(--space-4)" }}>
          {champs.consentement}
        </p>
      ) : null}

      {cleSiteTurnstile ? (
        <>
          <Turnstile
            siteKey={cleSiteTurnstile}
            onToken={setJetonVerification}
            renouveler={renouvelerVerification}
          />
          {champs.verification ? (
            <p className="field-error" style={{ marginTop: -8, marginBottom: "var(--space-4)" }}>
              {champs.verification}
            </p>
          ) : null}
        </>
      ) : null}

      {champs.lignes ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {champs.lignes}
        </Alert>
      ) : null}
      {erreurGenerale ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {erreurGenerale}
        </Alert>
      ) : null}

      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours
          ? "Envoi de la commande…"
          : `Confirmer la commande · ${totalAffiche.toLocaleString("fr-FR")} GNF`}
      </Button>
    </form>
  );
}
