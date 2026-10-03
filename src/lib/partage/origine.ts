import "server-only";
import { headers } from "next/headers";

/**
 * Origine publique du site (ex. https://speedfood-app.moelohimmara.workers.dev), déduite de la
 * requête : suit automatiquement un futur nom de domaine, sans variable à maintenir.
 */
export async function origineDuSite(): Promise<string> {
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "localhost:3000";
  const protocole = entetes.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  return `${protocole}://${hote}`;
}
