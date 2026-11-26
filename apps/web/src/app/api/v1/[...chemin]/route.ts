import { repondreErreur } from "@/lib/api/v1";

/**
 * Chemin inconnu sous `/api/v1/` : une réponse JSON « Route inconnue. » (404), comme l'API Hono, au lieu de la page HTML 404 du site (29 Ko) que l'application ne sait pas lire.
 * Les routes existantes passent avant ce capteur (Next.js choisit toujours la route la plus précise). Aucune donnée n'est lue, aucun jeton n'est regardé.
 */
const inconnue = () => repondreErreur({ code: "INTROUVABLE", message: "Route inconnue." });

export const GET = inconnue;
export const POST = inconnue;
export const PUT = inconnue;
export const PATCH = inconnue;
export const DELETE = inconnue;

export const dynamic = "force-dynamic";
