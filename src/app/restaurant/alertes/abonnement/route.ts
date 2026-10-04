import { creerClientAdmin } from "@/lib/db/admin";
import { estPointAccesPushAutorise } from "@/lib/push/vapid";
import { obtenirMembreCourant, origineValide, reponseJson } from "@/lib/push/session";

export const dynamic = "force-dynamic";

interface CorpsAbonnement {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

const TAILLE_MAX_CORPS = 4000;

async function lireCorps(requete: Request): Promise<CorpsAbonnement | null> {
  const texte = await requete.text();
  if (texte.length === 0 || texte.length > TAILLE_MAX_CORPS) {
    return null;
  }
  try {
    const corps = JSON.parse(texte);
    return typeof corps === "object" && corps !== null ? (corps as CorpsAbonnement) : null;
  } catch {
    return null;
  }
}

/**
 * Enregistre (ou met à jour) l'abonnement push de ce navigateur pour le membre connecté.
 * Le restaurant vient de la session ; le point d'accès doit appartenir à un service de push connu (anti-SSRF) ;
 * un même appareil ne peut appartenir qu'à une personne à la fois (le dernier à s'y connecter le reprend).
 */
export async function POST(requete: Request): Promise<Response> {
  if (!origineValide(requete)) {
    return reponseJson({ code: "NON_AUTORISE" }, 403);
  }
  const resultat = await obtenirMembreCourant();
  if ("erreur" in resultat) {
    return resultat.erreur;
  }

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
  const admin = creerClientAdmin();

  // Un appareil déjà connu (même personne) est simplement rafraîchi ; un appareil d'une autre personne est repris.
  const { data: existant } = await admin.from("push_subscriptions").select("id, utilisateur_id").eq("endpoint", endpoint).maybeSingle();
  if (existant) {
    await admin.from("push_subscriptions").delete().eq("id", existant.id);
  }
  const { error } = await admin.from("push_subscriptions").insert({
    restaurant_id: resultat.membre.restaurantId,
    utilisateur_id: resultat.membre.utilisateurId,
    endpoint,
    p256dh,
    auth,
    agent,
  });
  if (error) {
    // La limite de 10 appareils par personne est portée par un déclencheur de la base.
    const limite = error.message.includes("Trop d'appareils");
    return reponseJson({ code: limite ? "LIMITE_APPAREILS" : "ERREUR_SERVEUR" }, limite ? 409 : 500);
  }
  return reponseJson({ ok: true });
}

/** Retire l'abonnement de ce navigateur (uniquement s'il appartient au membre connecté). */
export async function DELETE(requete: Request): Promise<Response> {
  if (!origineValide(requete)) {
    return reponseJson({ code: "NON_AUTORISE" }, 403);
  }
  const resultat = await obtenirMembreCourant();
  if ("erreur" in resultat) {
    return resultat.erreur;
  }
  const corps = await lireCorps(requete);
  const endpoint = corps?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length < 20 || endpoint.length > 1000) {
    return reponseJson({ code: "VALIDATION" }, 400);
  }
  await creerClientAdmin()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("utilisateur_id", resultat.membre.utilisateurId);
  return reponseJson({ ok: true });
}
