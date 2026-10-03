import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lireEtatMfa } from "@/lib/auth/mfa-etat";

/**
 * Rappel visible tant que la double authentification n'est pas activée. Elle reste FACULTATIVE :
 * le rappel explique pourquoi elle compte, sans rien bloquer. Plus insistant pour un compte
 * d'administration (un mot de passe volé donne accès aux coordonnées de tous les clients).
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
    <div
      className={`alerte ${administrateur ? "alerte-danger" : "alerte-info"}`}
      role="note"
      style={{ marginBottom: "var(--space-5)", fontSize: "0.9rem" }}
    >
      <strong>
        {administrateur
          ? "Protégez ce compte d'administration : activez la double authentification."
          : "Protégez votre compte : activez la double authentification."}
      </strong>{" "}
      {administrateur
        ? "Un mot de passe seul suffit à lire les coordonnées de tous les clients. "
        : "Un mot de passe découvert suffit à gérer vos commandes à votre place. "}
      Facultatif, deux minutes avec une application sur votre téléphone.{" "}
      <Link href="/compte/securite" style={{ fontWeight: 700 }}>
        Activer maintenant
      </Link>
    </div>
  );
}
