"use client";

import { useEffect, useId, useRef, useState } from "react";
import { validerContactAlerte } from "@/lib/site/zone-alerte";

type Etat = "repos" | "envoi" | "fait";

/**
 * « Prévenez-moi quand un restaurant ouvre ici » : liste d'attente d'une zone sans restaurant. Le contact (e-mail ou téléphone)
 * n'est envoyé qu'avec la case de consentement cochée ; le serveur revérifie tout. Sert aussi à savoir où recruter des restaurants.
 * `lieu` complète la phrase (« à Kolia », « dans la région de Kankan »).
 */
export function AlerteZone({ zone, lieu }: { zone: { niveau: "region" | "prefecture" | "commune" | "quartier"; slug: string }; lieu: string }) {
  const identifiant = useId();
  const champ = useRef<HTMLInputElement>(null);
  const caseConsentement = useRef<HTMLInputElement>(null);
  const merci = useRef<HTMLParagraphElement>(null);
  const [contact, setContact] = useState("");
  const [accord, setAccord] = useState(false);
  const [etat, setEtat] = useState<Etat>("repos");
  const [erreurContact, setErreurContact] = useState("");
  const [erreurAccord, setErreurAccord] = useState("");
  const [erreurServeur, setErreurServeur] = useState("");

  // Le formulaire disparaît au succès : le remerciement prend le focus, au lieu de le laisser se perdre.
  useEffect(() => {
    if (etat === "fait") merci.current?.focus();
  }, [etat]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreurServeur("");
    const verifie = validerContactAlerte(contact);
    if (!verifie.ok) {
      setErreurContact(verifie.erreur);
      champ.current?.focus();
      return;
    }
    if (!accord) {
      setErreurAccord("Cochez la case pour accepter d'être contacté.");
      caseConsentement.current?.focus();
      return;
    }
    setEtat("envoi");
    try {
      const reponse = await fetch("/api/zone/alerte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone, contact, consentement: true }),
      });
      if (!reponse.ok) {
        const donnees: { erreur?: string } = await reponse.json().catch(() => ({}));
        throw new Error(donnees.erreur ?? "Impossible d'enregistrer pour le moment.");
      }
      setEtat("fait");
    } catch (erreur) {
      setEtat("repos");
      setErreurServeur(erreur instanceof Error ? erreur.message : "Impossible d'enregistrer pour le moment.");
    }
  }

  if (etat === "fait") {
    return (
      <p className="alerte-zone-merci" role="status" tabIndex={-1} ref={merci}>
        C&apos;est noté. Nous vous préviendrons dès qu&apos;un restaurant sera référencé {lieu}.
      </p>
    );
  }

  const idContact = `${identifiant}-contact`;
  const idAccord = `${identifiant}-accord`;
  const idErreurContact = `${identifiant}-erreur-contact`;
  const idErreurAccord = `${identifiant}-erreur-accord`;

  return (
    <form className="alerte-zone" onSubmit={envoyer} noValidate>
      <p className="alerte-zone-titre">Prévenez-moi quand un restaurant ouvre {lieu}</p>
      <label htmlFor={idContact} className="alerte-zone-etiquette">
        Votre numéro de téléphone ou votre e-mail
      </label>
      <input
        ref={champ}
        id={idContact}
        className="alerte-zone-champ"
        type="text"
        autoComplete="tel"
        value={contact}
        onChange={(e) => {
          setContact(e.target.value);
          setErreurContact("");
        }}
        placeholder="622 00 00 00 ou vous@exemple.com"
        aria-describedby={erreurContact ? idErreurContact : undefined}
        aria-invalid={erreurContact ? true : undefined}
        maxLength={120}
      />
      {erreurContact ? (
        <p id={idErreurContact} className="alerte-zone-erreur" role="alert">
          <IconeErreur />
          {erreurContact}
        </p>
      ) : null}
      <label className="alerte-zone-accord" htmlFor={idAccord}>
        <input
          ref={caseConsentement}
          id={idAccord}
          type="checkbox"
          checked={accord}
          onChange={(e) => {
            setAccord(e.target.checked);
            setErreurAccord("");
          }}
          aria-describedby={erreurAccord ? idErreurAccord : undefined}
          aria-invalid={erreurAccord ? true : undefined}
        />
        <span>
          J&apos;accepte d&apos;être contacté(e) une seule fois, à l&apos;ouverture d&apos;un restaurant dans cette zone. Mon contact n&apos;est pas partagé.
        </span>
      </label>
      {erreurAccord ? (
        <p id={idErreurAccord} className="alerte-zone-erreur" role="alert">
          <IconeErreur />
          {erreurAccord}
        </p>
      ) : null}
      {erreurServeur ? (
        <p className="alerte-zone-erreur" role="alert">
          <IconeErreur />
          {erreurServeur}
        </p>
      ) : null}
      <div>
        <button type="submit" className="pub-btn alerte-zone-bouton" disabled={etat === "envoi"}>
          {etat === "envoi" ? "Envoi…" : "Me prévenir"}
        </button>
      </div>
    </form>
  );
}

function IconeErreur() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </svg>
  );
}
