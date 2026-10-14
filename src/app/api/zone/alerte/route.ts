import { NextResponse } from "next/server";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { limiterZoneAlerte } from "@/lib/securite/limitation-debit";
import { validerContactAlerte } from "@/lib/site/zone-alerte";
import { lireZones, resoudreZone } from "@/lib/site/zones";

/**
 * Liste d'attente par zone : « Prévenez-moi quand un restaurant ouvre ici ».
 * Le contact (e-mail ou téléphone) n'est enregistré qu'avec le consentement explicite de la personne. La zone est revérifiée
 * contre les zones enregistrées (jamais l'identifiant envoyé par le navigateur). Un contact déjà inscrit pour la zone reçoit
 * la même réponse qu'une nouvelle inscription : on ne révèle pas qui est inscrit.
 */
const SANS_CACHE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400, headers: SANS_CACHE });
  }
  const brut = typeof corps === "object" && corps !== null ? (corps as Record<string, unknown>) : {};

  if (brut.consentement !== true) {
    return NextResponse.json({ erreur: "Cochez la case pour accepter d'être contacté." }, { status: 400, headers: SANS_CACHE });
  }
  const contact = validerContactAlerte(typeof brut.contact === "string" ? brut.contact : "");
  if (!contact.ok) {
    return NextResponse.json({ erreur: contact.erreur }, { status: 400, headers: SANS_CACHE });
  }

  try {
    await limiterZoneAlerte();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") {
      return NextResponse.json({ erreur: erreur.message }, { status: 429, headers: SANS_CACHE });
    }
    return NextResponse.json({ erreur: "Réessayez dans un instant." }, { status: 503, headers: SANS_CACHE });
  }

  const zoneBrute = typeof brut.zone === "object" && brut.zone !== null ? (brut.zone as Record<string, unknown>) : {};
  const niveau = zoneBrute.niveau === "quartier" ? "quartier" : "commune";
  const slug = typeof zoneBrute.slug === "string" ? zoneBrute.slug : "";
  const zones = await lireZones();
  const zone = resoudreZone(niveau === "quartier" ? { quartier: slug } : { commune: slug }, zones);
  if (!zone) {
    return NextResponse.json({ erreur: "Cette zone n'existe pas." }, { status: 400, headers: SANS_CACHE });
  }
  const communeId = zone.niveau === "commune" ? zones.find((c) => c.slug === zone.slug)?.id : undefined;
  const ligne = zone.niveau === "quartier" ? { neighborhood_id: zone.id, commune_id: null } : { commune_id: communeId ?? null, neighborhood_id: null };
  if (zone.niveau === "commune" && !communeId) {
    return NextResponse.json({ erreur: "Cette zone n'existe pas." }, { status: 400, headers: SANS_CACHE });
  }

  const { error } = await creerClientAdmin().from("zone_alertes").insert({ ...ligne, contact_type: contact.type, contact: contact.contact });
  // 23505 : déjà inscrit pour cette zone, même réponse qu'une nouvelle inscription.
  if (error && error.code !== "23505") {
    console.error("zone_alerte_echec", error.code);
    return NextResponse.json({ erreur: "Impossible d'enregistrer pour le moment. Réessayez dans un instant." }, { status: 500, headers: SANS_CACHE });
  }
  return NextResponse.json({ ok: true }, { headers: SANS_CACHE });
}
