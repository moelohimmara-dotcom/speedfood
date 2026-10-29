import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerClientServeur } from "@/lib/db/server";
import { estPointAccesPushAutorise } from "@/lib/push/vapid";
import { origineValide, reponseJson } from "@/lib/push/session";

export const dynamic = "force-dynamic";

const TAILLE_MAX_CORPS = 4000;

interface CorpsAbonnement {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

async function lireCorps(requete: Request): Promise<CorpsAbonnement | null> {
  const texte = await requete.text();
  if (texte.length === 0 || texte.length > TAILLE_MAX_CORPS) return null;
  try {
    const corps = JSON.parse(texte);
    return typeof corps === "object" && corps !== null ? (corps as CorpsAbonnement) : null;
  } catch {
    return null;
  }
}

async function utilisateurConnecte(): Promise<string | null> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  return user?.id ?? null;
}

const sansTypes = () => creerClientAdmin() as unknown as SupabaseClient;

/**
 * Enregistre l'appareil du CLIENT connecté pour les notifications de suivi. Le point d'accès doit appartenir à un service de push connu
 * (anti-SSRF) ; un appareil déjà connu est repris (le dernier compte connecté le garde) ; cinq appareils au plus par compte (la base le garantit).
 */
export async function POST(requete: Request): Promise<Response> {
  if (!origineValide(requete)) return reponseJson({ code: "NON_AUTORISE" }, 403);
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return reponseJson({ code: "NON_AUTHENTIFIE" }, 401);

  const corps = await lireCorps(requete);
  const endpoint = corps?.endpoint;
  const p256dh = corps?.keys?.p256dh;
  const auth = corps?.keys?.auth;
  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    !estPointAccesPushAutorise(endpoint) ||
    p256dh.length < 10 ||
    p256dh.length > 200 ||
    auth.length < 10 ||
    auth.length > 100
  ) {
    return reponseJson({ code: "VALIDATION" }, 400);
  }

  const agent = (requete.headers.get("user-agent") ?? "").slice(0, 300) || null;
  const db = sansTypes();
  await db.from("client_push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await db.from("client_push_subscriptions").insert({ utilisateur_id: utilisateur, endpoint, p256dh, auth, agent });
  if (error) {
    const limite = error.code === "23514";
    return reponseJson({ code: limite ? "LIMITE_APPAREILS" : "ERREUR_SERVEUR" }, limite ? 409 : 500);
  }
  return reponseJson({ ok: true });
}

/** Retire l'appareil du client (désactivation depuis ses préférences). Seul son propre abonnement est supprimé. */
export async function DELETE(requete: Request): Promise<Response> {
  if (!origineValide(requete)) return reponseJson({ code: "NON_AUTORISE" }, 403);
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return reponseJson({ code: "NON_AUTHENTIFIE" }, 401);
  const corps = await lireCorps(requete);
  const endpoint = corps?.endpoint;
  if (typeof endpoint !== "string") return reponseJson({ code: "VALIDATION" }, 400);
  await sansTypes().from("client_push_subscriptions").delete().eq("endpoint", endpoint).eq("utilisateur_id", utilisateur);
  return reponseJson({ ok: true });
}
