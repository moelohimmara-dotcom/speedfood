import { NextResponse } from "next/server";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { creerClientServeur } from "@/lib/db/server";

/**
 * Arrivée depuis le lien d'un e-mail d'authentification (réinitialisation du mot de passe) :
 * échange le code à usage unique contre une session, puis redirige vers un chemin INTERNE
 * (jamais une adresse fournie dans le lien). Lien invalide ou expiré : retour à la page d'oubli.
 */
export async function GET(requete: Request): Promise<Response> {
  const url = new URL(requete.url);
  const code = url.searchParams.get("code");
  const suiteDemandee = url.searchParams.get("suite") ?? "";
  const suite = estCheminInterneSur(suiteDemandee) ? suiteDemandee : "/restaurant";

  if (code) {
    const supabase = await creerClientServeur();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(suite, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/connexion/oubli?lien=invalide", url.origin));
}
