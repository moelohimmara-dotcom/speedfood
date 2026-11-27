"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { lienIntention, lienSchema, lireRetour } from "@/lib/auth/retour-application";

/**
 * Retour de la connexion Google ou Facebook faite depuis l'application. Avec un code, la page ouvre l'application toute seule (et propose un bouton si le navigateur
 * ne le fait pas : certains refusent une ouverture sans geste). Le code n'est jamais affiché ni envoyé ailleurs qu'à l'application.
 */
export function RetourApplication() {
  const params = useSearchParams();
  const retour = useMemo(() => lireRetour(params), [params]);
  const lien = retour.etat === "code" ? lienIntention(retour.code) : null;
  useEffect(() => {
    if (lien) window.location.replace(lien);
  }, [lien]);

  if (retour.etat === "code") {
    return (
      <>
        <h1>Retour dans l&apos;application Speedfood…</h1>
        <p>Votre connexion se termine dans l&apos;application.</p>
        <p>
          <a className="bouton" href={lien ?? "#"}>
            Ouvrir Speedfood
          </a>
        </p>
        <p>
          Si rien ne s&apos;ouvre, <a href={lienSchema(retour.code)}>essayez ce lien</a>, ou ouvrez Speedfood depuis votre téléphone et recommencez la connexion.
        </p>
      </>
    );
  }
  if (retour.etat === "refus") {
    return (
      <>
        <h1>Connexion annulée</h1>
        <p>Le fournisseur de connexion n&apos;a pas confirmé votre identité. Ouvrez Speedfood et choisissez de nouveau « Continuer avec Google » ou « Continuer avec Facebook », ou connectez-vous avec votre e-mail.</p>
      </>
    );
  }
  return (
    <>
      <h1>Retournez dans l&apos;application Speedfood</h1>
      <p>Aucune connexion n&apos;est en cours sur cette page. Ouvrez Speedfood depuis votre téléphone et choisissez « Continuer avec Google » ou « Continuer avec Facebook ».</p>
      <p>
        <Link href="/restaurants">Voir les restaurants sur le site</Link>
      </p>
    </>
  );
}
