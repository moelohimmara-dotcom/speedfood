import "server-only";
import { cookies } from "next/headers";
import { estJetonValide } from "./jetons";

export const NOM_COOKIE_SUIVI = "speedfood_suivi";
const DUREE_SESSION_SECONDES = 60 * 60 * 24;

export async function lireJetonSessionSuivi(): Promise<string | null> {
  const valeur = (await cookies()).get(NOM_COOKIE_SUIVI)?.value;
  return estJetonValide(valeur) ? valeur : null;
}

export function optionsCookieSuivi() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/suivi",
    maxAge: DUREE_SESSION_SECONDES,
  };
}
