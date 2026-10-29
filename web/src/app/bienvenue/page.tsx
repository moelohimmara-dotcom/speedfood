import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { creerClientServeur } from "@/lib/db/server";
import { FormulaireBienvenue } from "./FormulaireBienvenue";

export const metadata: Metadata = { title: "Bienvenue" };

/**
 * Première connexion (ou modification) : choix d'un avatar et d'un pseudo, en deux étapes courtes. Réservé aux comptes
 * connectés ; un compte qui a déjà un profil n'y revient que pour le modifier (`?modifier=1`).
 */
export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; modifier?: string }>;
}) {
  const { suite = "", modifier } = await searchParams;
  const suiteSure = estCheminInterneSur(suite) ? suite : "/compte";

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/entrer?suite=${encodeURIComponent("/bienvenue")}`);
  }

  const { data: profil } = await supabase
    .from("client_profils")
    .select("pseudo, avatar")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (profil && modifier !== "1") {
    redirect(suiteSure);
  }

  return <FormulaireBienvenue suite={suiteSure} pseudoInitial={profil?.pseudo ?? null} avatarInitial={profil?.avatar ?? null} />;
}
