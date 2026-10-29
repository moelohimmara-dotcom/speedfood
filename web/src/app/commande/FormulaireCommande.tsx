"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sousTotalPanier,
  viderPanier,
  type Panier,
} from "@/components/panier/panier";
import { creerCommandeAction } from "@/lib/commande/actions";
import { memoriserCoordonneesAction } from "@/lib/client/actions";
import type { CreationCommandePayload, ModeRetrait } from "@/lib/contracts/commande";
import type { ErreurApi } from "@/lib/contracts/erreurs";
import { Button, Input, Alert } from "@/components/ui";
import { lireCleTableMemorisee, useTableMemorisee } from "@/lib/commande/table-memoire";
import { lireNumeroTable } from "@/lib/commande/mode";
import { Turnstile } from "@/components/Turnstile";
import type { OptionChoix } from "@/components/ui/ListeChoix";
import type { EstimationPublique } from "@/lib/livraison/actions";
import { ChoixLivraison, type DestinationChoisie } from "./ChoixLivraison";
import type { CompteCommande } from "./CommandeClient";

/** Délai au-delà duquel on considère que le défi anti-robot ne sechargera pas (voir la sonde plus bas). */
const DELAI_ANTI_ROBOT_MS = 12000;

interface Props {
  panier: Panier;
  /** Clé de site Turnstile (publique) ; absente = vérification anti-robot désactivée. */
  cleSiteTurnstile?: string;
  compte: CompteCommande;
  /** Quartiers proposés pour calculer la livraison (identifiant, « Quartier, Commune »). */
  quartiersLivraison: OptionChoix[];
  /** Convive sans compte (commande à table autorisée par le restaurant) : à table seulement, téléphone facultatif. */
  invite?: boolean;
}

/**
 * Formulaire de commande invitée (ADR-005) : nom, téléphone, retrait ou
 * livraison (adresse obligatoire uniquement en livraison), consentement
 * explicite au règlement hors portail.
 *
 * La validation serveur fait foi ; celle-ci n'est qu'un confort d'affichage.
 * Aucun montant n'est envoyé : le serveur recalcule tout (ADR-006).
 */
export function FormulaireCommande({ panier, cleSiteTurnstile, compte, quartiersLivraison, invite = false }: Props) {
  const router = useRouter();
  const [nom, setNom] = useState(compte.prefill?.nom ?? "");
  const [telephone, setTelephone] = useState(compte.prefill?.telephone ?? "");
  // Adresse de départ : celle mémorisée avec les coordonnées, sinon l'adresse par défaut du carnet de l'espace client.
  const [adresse, setAdresse] = useState(compte.prefill?.adresse || compte.adresses.find((a) => a.parDefaut)?.adresse || "");
  // Numéro de table du QR scanné (mémoire du navigateur, 6 h) : propose le service à table, sans jamais l'imposer.
  const tableScannee = useTableMemorisee(panier.restaurantId);
  const [modeChoisi, setMode] = useState<ModeRetrait | null>(null);
  const [tableSaisie, setTable] = useState<string | null>(null);
  // Un QR de table scanné prime sur la préférence ; la préférence du client prime sur le retrait par défaut.
  const mode: ModeRetrait = invite ? "sur_place" : (modeChoisi ?? (tableScannee ? "sur_place" : (compte.modePrefere ?? "retrait")));
  const table = tableSaisie ?? tableScannee ?? "";
  // Mémoriser les coordonnées dans le compte : jamais coché d'office, c'est un choix explicite du client.
  const [memoriser, setMemoriser] = useState(false);
  const [consentement, setConsentement] = useState(false);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [jetonVerification, setJetonVerification] = useState<string | null>(null);
  const [renouvelerVerification, setRenouvelerVerification] = useState(0);
  // Distingue « le widget n'a pas encore répondu » de « le widget a échoué » (réseau qui
  // ne résout pas un hôte Cloudflare, extension qui bloque). Sans cela, un visiteur honnête
  // dont le réseau coupe le défi se voit annoncer qu'il est un robot : c'est à la fois faux
  // et inutilisable, et le message ne lui donne aucun moyen d'agir.
  const [problemeVerification, setProblemeVerification] = useState<"erreur" | "expire" | null>(null);

  useEffect(() => {
    // Sonde de temps : sur un réseau qui ne résout pas un hôte Cloudflare, le widget se charge
    // et appelle `render()`, puis le défi expire EN SILENCE — ni `callback`, ni `error-callback`,
    // ni `expired-callback`. Sans cette sonde, le visiteur reste devant « terminez la
    // vérification » alors qu'elle est impossible à terminer, sans aucun moyen d'agir.
    // Nul effet sur la sécurité : le jeton reste obligatoire, seule la qualité du message change.
    if (!cleSiteTurnstile || jetonVerification || problemeVerification) {
      return;
    }
    const minuteur = setTimeout(() => setProblemeVerification("erreur"), DELAI_ANTI_ROBOT_MS);
    return () => clearTimeout(minuteur);
  }, [cleSiteTurnstile, jetonVerification, problemeVerification]);

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
  const sousTotalAffiche = totalServeur ?? sousTotalPanier(panier);
  // Livraison : destination et frais calculés par le serveur (ChoixLivraison). Sans calcul actif, les frais restent à convenir.
  const [livraison, setLivraison] = useState<{ destination: DestinationChoisie | null; estimation: EstimationPublique | null }>({
    destination: null,
    estimation: null,
  });
  const fraisCalcules = mode === "livraison" && livraison.estimation?.statut === "ok" ? livraison.estimation.fraisGnf : null;
  const totalAffiche = sousTotalAffiche + (fraisCalcules ?? 0);

  function soumettre() {
    const erreurs: Record<string, string> = {};
    // À table, le nom et le numéro sont facultatifs pour un convive sans compte : la commande part au nom de la table.
    if (!(invite && nom.trim() === "") && (nom.trim().length < 2 || nom.trim().length > 120)) {
      erreurs.nom = "Indiquez votre nom (2 à 120 caractères).";
    }
    if (mode === "sur_place" ? telephone.trim() !== "" && telephone.trim().length < 8 : telephone.trim().length < 8) {
      erreurs.telephone =
        "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (ex. +224 622 12 34 56).";
    }
    if (mode === "livraison" && adresse.trim().length < 5) {
      erreurs.adresse = "L'adresse de livraison est obligatoire.";
    }
    if (mode === "livraison" && livraison.estimation?.statut === "erreur") {
      erreurs.livraison = livraison.estimation.message;
    }
    if (mode === "livraison" && livraison.estimation?.statut === "ok" && !livraison.destination) {
      erreurs.livraison = "Indiquez où livrer.";
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
      erreurs.verification = problemeVerification
        ? "La vérification anti-robot n'a pas pu démarrer sur ce réseau. Vérifiez votre connexion, puis réessayez."
        : "Terminez la vérification anti-robot avant de valider votre commande.";
    }
    setChamps(erreurs);
    if (Object.keys(erreurs).length > 0) {
      return;
    }

    const payload: CreationCommandePayload = {
      cleIdempotence,
      sousTotalAffiche,
      restaurantId: panier.restaurantId as string,
      client: {
        nom: nom.trim() || `Table ${lireNumeroTable(table) ?? ""}`.trim(),
        telephone: telephone.trim(),
        // L'adresse n'est transmise au restaurant qu'en livraison (minimisation des données), même si elle est préremplie.
        adresse: mode === "livraison" && adresse.trim().length > 0 ? adresse.trim() : null,
      },
      mode,
      table: mode === "sur_place" ? lireNumeroTable(table) : null,
      cleTable: mode === "sur_place" ? lireCleTableMemorisee(panier.restaurantId, lireNumeroTable(table)) : null,
      lignes: panier.lignes.map((ligne) => ({
        menuItemId: ligne.menuItemId,
        quantite: ligne.quantite,
        optionIds: ligne.options.map((o) => o.id),
      })),
      consentementReglement: true,
      jetonVerification: jetonVerification ?? undefined,
      ...(mode === "livraison" && livraison.destination ? { destination: livraison.destination } : {}),
      ...(fraisCalcules !== null ? { fraisAffiches: fraisCalcules } : {}),
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
        router.push(`/suivi#${resultat.jeton}`);
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
    // Frais recalculés par le serveur : on redemande l'estimation (nouveau sous-total, donc nouveaux frais éventuels).
    if (erreur.code === "CONFLIT_ETAT" && erreur.champs?.fraisServeur !== undefined) {
      setLivraison((l) => ({ ...l, estimation: null }));
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
      ) : null}
      <Input
        label={invite ? "Votre prénom (facultatif)" : "Votre nom"}
        name="nom"
        type="text"
        required={!invite}
        maxLength={120}
        autoComplete="name"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        erreur={champs.nom}
      />
      <Input
        label={mode === "sur_place" ? "Numéro de téléphone (facultatif)" : "Numéro de téléphone"}
        name="telephone"
        type="tel"
        required={mode !== "sur_place"}
        maxLength={24}
        autoComplete="tel"
        placeholder="+224 622 12 34 56"
        value={telephone}
        onChange={(e) => setTelephone(e.target.value)}
        erreur={champs.telephone}
      />

      {invite ? (
        <p className="commande-prefill" role="status">
          Vous commandez à table, sans compte. Le serveur validera votre première commande.
        </p>
      ) : null}
      <fieldset className="choix-groupe" hidden={invite}>
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
            <small>{livraison.estimation?.statut === "ok" ? "Frais calculés selon la distance" : "À confirmer avec le restaurant"}</small>
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
        <ChoixLivraison
          restaurantId={panier.restaurantId as string}
          sousTotalGnf={sousTotalAffiche}
          quartiers={quartiersLivraison}
          onChange={setLivraison}
        />
      ) : null}
      {mode === "livraison" && champs.livraison ? (
        <p className="field-error commande-erreur-champ">
          {champs.livraison}
        </p>
      ) : null}

      {mode === "livraison" && compte.adresses.length > 0 ? (
        <div className="field">
          <label htmlFor="adresse-enregistree">Mes adresses</label>
          <select id="adresse-enregistree" value={compte.adresses.find((a) => a.adresse === adresse)?.id ?? ""} onChange={(e) => setAdresse(compte.adresses.find((a) => a.id === e.target.value)?.adresse ?? adresse)}>
            <option value="">Autre adresse (saisie ci-dessous)</option>
            {compte.adresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle}
                {a.parDefaut ? " (par défaut)" : ""}
              </option>
            ))}
          </select>
        </div>
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
        <p className="field-error commande-erreur-champ">
          {champs.consentement}
        </p>
      ) : null}

      {cleSiteTurnstile ? (
        <>
          <Turnstile
            siteKey={cleSiteTurnstile}
            onToken={(jeton) => {
              setJetonVerification(jeton);
              if (jeton) setProblemeVerification(null);
            }}
            onProbleme={(raison) => {
              setJetonVerification(null);
              setProblemeVerification(raison);
            }}
            renouveler={renouvelerVerification}
          />
          {champs.verification ? (
            <p className="field-error commande-erreur-champ">
              {champs.verification}
            </p>
          ) : null}
        </>
      ) : null}

      {champs.lignes ? (
        <Alert ton="danger" className="commande-alerte">
          {champs.lignes}
        </Alert>
      ) : null}
      {erreurGenerale ? (
        <Alert ton="danger" className="commande-alerte">
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
