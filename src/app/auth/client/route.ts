import { NextResponse } from "next/server";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { creerClientServeur } from "@/lib/db/server";

/**
 * Retour de la connexion Facebook d'un client : échange le code à usage unique contre une session, puis oriente.
 * Première connexion (pas encore de profil) : écran de bienvenue amusant, qui garde la suite demandée. Sinon : la suite.
 * La suite est toujours un chemin INTERNE (jamais une adresse fournie dans le lien). Refus ou erreur : retour à `/entrer`.
 */
export async function GET(requete: Request): Promise<Response> {
  const url = new URL(requete.url);
  const code = url.searchParams.get("code");
  const suiteDemandee = url.searchParams.get("suite") ?? "";
  const suite = estCheminInterneSur(suiteDemandee) ? suiteDemandee : "/compte";

  if (url.searchParams.get("error") || !code) {
    return NextResponse.redirect(new URL("/entrer?erreur=annule", url.origin));
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/entrer?erreur=echange", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/entrer?erreur=echange", url.origin));
  }
  const { data: profil } = await supabase.from("client_profils").select("utilisateur_id").eq("utilisateur_id", user.id).maybeSingle();

  const destination = profil ? suite : `/bienvenue?suite=${encodeURIComponent(suite)}`;
  return NextResponse.redirect(new URL(destination, url.origin));
}
