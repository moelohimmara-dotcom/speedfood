import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lireEtatMfa } from "@/lib/auth/mfa-etat";
import { RappelMasquable } from "@/components/RappelMasquable";

/**
 * Rappel visible tant que la double authentification n'est pas activée. Elle reste FACULTATIVE :
 * le rappel explique pourquoi elle compte, sans rien bloquer. Plus insistant pour un compte
 * d'administration (un mot de passe volé donne accès aux coordonnées de tous les clients).
 *
 * Une seule ligne (deux sur téléphone) au lieu d'un bloc de ~100 px répété sur chaque page, et
 * masquable pour la session (audit du 4 octobre 2026, Y4).
 */
export async function RappelDoubleAuthentification({
  supabase,
  administrateur = false,
}: {
  supabase: SupabaseClient;
  administrateur?: boolean;
}) {
  const etat = await lireEtatMfa(supabase);
  if (etat.actif) {
    return null;
  }

  return (
    <RappelMasquable>
      <div className={`rappel-securite${administrateur ? " rappel-securite-admin" : ""}`} role="note">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rappel-securite-icone">
          <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <p className="rappel-securite-texte">
          <strong>
            {administrateur
              ? "Protégez ce compte d'administration : activez la double authentification."
              : "Protégez votre compte : activez la double authentification."}
          </strong>{" "}
          <span className="rappel-securite-detail">
            {administrateur
              ? "Un mot de passe seul suffit à lire les coordonnées de tous les clients. "
              : "Un mot de passe découvert suffit à gérer vos commandes à votre place. "}
            Facultatif, deux minutes avec une application sur votre téléphone.
          </span>
        </p>
        <Link href="/compte/securite" className="btn btn-secondary rappel-securite-action">
          Activer
        </Link>
      </div>
    </RappelMasquable>
  );
}
