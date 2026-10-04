import "server-only";
import { headers } from "next/headers";

/** Adresse de repli : celle de la production actuelle. Un domaine définitif se déclare avec la variable `SITE_URL`. */
const ORIGINE_PAR_DEFAUT = "https://speedfood-app.moelohimmara.workers.dev";

function hoteAutorise(hote: string): boolean {
  if (/^localhost(:\d+)?$/.test(hote)) return true;
  try {
    const attendu = process.env.SITE_URL ? new URL(process.env.SITE_URL).host : null;
    if (attendu && hote === attendu) return true;
  } catch {
    // SITE_URL mal formée : ignorée, on retombe sur la liste fixe.
  }
  return new URL(ORIGINE_PAR_DEFAUT).host === hote;
}

/**
 * Origine publique du site (ex. https://speedfood-app.moelohimmara.workers.dev). Elle sert à construire des liens
 * envoyés par e-mail et des retours d'identification : un client ne doit donc jamais pouvoir la choisir. Audit du
 * 4 octobre 2026 : `x-forwarded-host` (contrôlable par l'appelant) n'est plus lu, et l'hôte reçu doit appartenir à une
 * liste fixe (production actuelle, `SITE_URL`, localhost en développement), sinon on retombe sur l'adresse de production.
 */
export async function origineDuSite(): Promise<string> {
  const hote = (await headers()).get("host") ?? "";
  if (!hoteAutorise(hote)) {
    return process.env.SITE_URL?.replace(/\/$/, "") ?? ORIGINE_PAR_DEFAUT;
  }
  return `${hote.startsWith("localhost") ? "http" : "https"}://${hote}`;
}
