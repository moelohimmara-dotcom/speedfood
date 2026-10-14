"use client";

import { useId, useState } from "react";
import { validerContactAlerte } from "@/lib/site/zone-alerte";

type Etat = "repos" | "envoi" | "fait" | "erreur";

/**
 * « Prévenez-moi quand un restaurant ouvre ici » : liste d'attente d'une zone sans restaurant. Le contact (e-mail ou téléphone)
 * n'est envoyé qu'avec la case de consentement cochée ; le serveur revérifie tout. Sert aussi à savoir où recruter des restaurants.
 */
export function AlerteZone({ zone, zoneNom }: { zone: { niveau: "region" | "prefecture" | "commune" | "quartier"; slug: string }; zoneNom: string }) {
  const identifiant = useId();
  const [contact, setContact] = useState("");
  const [accord, setAccord] = useState(false);
  const [etat, setEtat] = useState<Etat>("repos");
  const [message, setMessage] = useState("");

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const verifie = validerContactAlerte(contact);
    if (!verifie.ok) {
      setEtat("erreur");
      setMessage(verifie.erreur);
      return;
    }
    if (!accord) {
      setEtat("erreur");
      setMessage("Cochez la case pour accepter d'être contacté.");
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
      setEtat("erreur");
      setMessage(erreur instanceof Error ? erreur.message : "Impossible d'enregistrer pour le moment.");
    }
  }

  if (etat === "fait") {
    return (
      <p className="alerte-zone-merci" role="status">
        C&apos;est noté. Nous vous préviendrons dès qu&apos;un restaurant sera référencé à {zoneNom}.
      </p>
    );
  }

  return (
    <form className="alerte-zone" onSubmit={envoyer} noValidate>
      <p className="alerte-zone-titre">Prévenez-moi quand un restaurant ouvre à {zoneNom}</p>
      <label htmlFor={`${identifiant}-contact`} className="alerte-zone-etiquette">
        Votre e-mail ou votre numéro de téléphone
      </label>
      <div className="alerte-zone-ligne">
        <input
          id={`${identifiant}-contact`}
          type="text"
          inputMode="email"
          autoComplete="email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="vous@exemple.com ou 622 00 00 00"
          aria-describedby={etat === "erreur" ? `${identifiant}-erreur` : undefined}
          aria-invalid={etat === "erreur"}
          maxLength={120}
        />
        <button type="submit" className="pub-btn" disabled={etat === "envoi"}>
          {etat === "envoi" ? "Envoi…" : "Me prévenir"}
        </button>
      </div>
      <label className="alerte-zone-accord">
        <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
        <span>
          J&apos;accepte d&apos;être contacté(e) une seule fois, à l&apos;ouverture d&apos;un restaurant dans cette zone. Mon contact n&apos;est pas partagé.
        </span>
      </label>
      {etat === "erreur" ? (
        <p id={`${identifiant}-erreur`} className="alerte-zone-erreur" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
