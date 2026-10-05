"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sousTotalPanier,
  viderPanier,
  type Panier,
} from "@/components/panier/panier";
import Link from "next/link";
import { creerCommandeAction } from "@/lib/commande/actions";
import { memoriserCoordonneesAction } from "@/lib/client/actions";
import type { CreationCommandePayload, ModeRetrait } from "@/lib/contracts/commande";
import type { ErreurApi } from "@/lib/contracts/erreurs";
import { Button, Input, Alert } from "@/components/ui";
import { useTableMemorisee } from "@/lib/commande/table-memoire";
import { lireNumeroTable } from "@/lib/commande/mode";
import { Turnstile } from "@/components/Turnstile";
import type { CompteCommande } from "./CommandeClient";

interface Props {
  panier: Panier;
  /** Clé de site Turnstile (publique) ; absente = vérification anti-robot désactivée. */
  cleSiteTurnstile?: string;
  compte: CompteCommande;
}

/**
 * Formulaire de commande invitée (ADR-005) : nom, téléphone, retrait ou
 * livraison (adresse obligatoire uniquement en livraison), consentement
 * explicite au règlement hors portail.
 *
 * La validation serveur fait foi ; celle-ci n'est qu'un confort d'affichage.
 * Aucun montant n'est envoyé : le serveur recalcule tout (ADR-006).
 */
export function FormulaireCommande({ panier, cleSiteTurnstile, compte }: Props) {
  const router = useRouter();
  const [nom, setNom] = useState(compte.prefill?.nom ?? "");
  const [telephone, setTelephone] = useState(compte.prefill?.telephone ?? "");
  const [adresse, setAdresse] = useState(compte.prefill?.adresse ?? "");
  // Numéro de table du QR scanné (mémoire du navigateur, 6 h) : propose le service à table, sans jamais l'imposer.
  const tableScannee = useTableMemorisee(panier.restaurantId);
  const [modeChoisi, setMode] = useState<ModeRetrait | null>(null);
  const [tableSaisie, setTable] = useState<string | null>(null);
  const mode: ModeRetrait = modeChoisi ?? (tableScannee ? "sur_place" : "retrait");
  const table = tableSaisie ?? tableScannee ?? "";
  // Mémoriser les coordonnées dans le compte : jamais coché d'office, c'est un choix explicite du client.
  const [memoriser, setMemoriser] = useState(false);
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
    if (mode === "sur_place" && !lireNumeroTable(table)) {
      erreurs.table = "Indiquez votre numéro de table (1 à 10 caractères).";
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
        // L'adresse n'est transmise au restaurant qu'en livraison (minimisation des données), même si elle est préremplie.
        adresse: mode === "livraison" && adresse.trim().length > 0 ? adresse.trim() : null,
      },
      mode,
      table: mode === "sur_place" ? lireNumeroTable(table) : null,
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
        if (memoriser && compte.estClient) {
          // Confort : un échec ici ne doit jamais retarder ni bloquer l'accès au suivi de la commande.
          await memoriserCoordonneesAction({
            nom: nom.trim(),
            telephone: telephone.trim(),
            adresse: adresse.trim().length > 0 ? adresse.trim() : null,
          }).catch(() => undefined);
        }
        viderPanier();
        router.push(`/suivi/${resultat.jeton}?nouvelle=1`);
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
      {compte.prefill ? (
        <p className="commande-prefill" role="status">
          Vos informations enregistrées sont déjà remplies. Modifiez-les si besoin.
        </p>
      ) : compte.actif && !compte.estClient ? (
        <p className="commande-prefill">
          Déjà un compte ?{" "}
          <Link href="/entrer?suite=/commande" className="lien-texte">
            Connectez-vous pour remplir vos informations en un geste
          </Link>
          .
        </p>
      ) : null}
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

      <fieldset className="choix-groupe">
        <legend>Mode de réception</legend>
        {tableScannee ? (
          <label className="choix-carte">
            <input type="radio" name="mode" value="sur_place" checked={mode === "sur_place"} onChange={() => setMode("sur_place")} />
            <span className="choix-texte">
              <strong>À table</strong>
              <small>On vous sert à votre table</small>
            </span>
          </label>
        ) : null}
        <label className="choix-carte">
          <input
            type="radio"
            name="mode"
            value="retrait"
            checked={mode === "retrait"}
            onChange={() => setMode("retrait")}
          />
          <span className="choix-texte">
            <strong>Retrait sur place</strong>
            <small>Vous passez récupérer votre commande</small>
          </span>
        </label>
        <label className="choix-carte">
          <input
            type="radio"
            name="mode"
            value="livraison"
            checked={mode === "livraison"}
            onChange={() => setMode("livraison")}
          />
          <span className="choix-texte">
            <strong>Livraison</strong>
            <small>À confirmer avec le restaurant</small>
          </span>
        </label>
      </fieldset>

      {mode === "sur_place" ? (
        <Input
          label="Numéro de table"
          name="table"
          type="text"
          required
          maxLength={10}
          autoComplete="off"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          erreur={champs.table}
        />
      ) : null}

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

      <div className="bloc-reglement">
        <p className="bloc-reglement-cle">Vous payez le restaurant directement, pas Speedfood.</p>
        <p className="bloc-reglement-detail">
          Espèces ou mobile money, selon ses modalités. La commande n&apos;est confirmée que lorsque le
          restaurant l&apos;accepte. Prix et disponibilité sont revérifiés à l&apos;envoi.
        </p>
      </div>

      {compte.estClient ? (
        <label className="consentement">
          <input type="checkbox" name="memoriser" checked={memoriser} onChange={(e) => setMemoriser(e.target.checked)} />
          <span>
            Mémoriser ces informations dans mon compte pour mes prochaines commandes. Je pourrai les effacer à tout moment
            depuis « Mon compte ».
          </span>
        </label>
      ) : null}

      <label className="consentement">
        <input
          type="checkbox"
          name="consentement"
          checked={consentement}
          onChange={(e) => setConsentement(e.target.checked)}
        />
        <span>
          J&apos;accepte que mon nom, mon numéro de téléphone et, le cas échéant, mon adresse soient
          transmis au restaurant uniquement pour traiter ma commande. Je comprends que le règlement
          se fait directement avec le restaurant et que ma commande doit être confirmée par ce
          dernier.{" "}
          <a href="/confidentialite" target="_blank" rel="noopener noreferrer">
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
