import { NextResponse } from "next/server";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterZonePosition } from "@/lib/securite/limitation-debit";
import { arrondirCoordonnee, correspondreZone, positionDansLaGuinee } from "@/lib/site/zone-position";
import { lireZones } from "@/lib/site/zones";

/**
 * « Utiliser ma position » : rattache une position à une zone Speedfood.
 *
 * La position n'est demandée par le navigateur qu'après un clic de la personne. Ici elle est arrondie (≈ 100 m), envoyée au
 * géocodage inverse d'OpenStreetMap (Nominatim) puis oubliée : rien n'est enregistré ni journalisé. Le résultat est rapproché des
 * zones réellement enregistrées ; sans correspondance, la réponse est `zone: null` et la personne choisit à la main.
 * Politique d'usage Nominatim : identification par User-Agent, une requête par action de la personne, jamais en boucle.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const IDENTIFICATION = "Speedfood/1.0 (+https://speedfood-app.moelohimmara.workers.dev)";

const SANS_CACHE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400, headers: SANS_CACHE });
  }

  const brut = typeof corps === "object" && corps !== null ? (corps as Record<string, unknown>) : {};
  const latitude = typeof brut.latitude === "number" ? brut.latitude : Number.NaN;
  const longitude = typeof brut.longitude === "number" ? brut.longitude : Number.NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ erreur: "Position invalide." }, { status: 400, headers: SANS_CACHE });
  }
  if (!positionDansLaGuinee(latitude, longitude)) {
    // Hors de Guinée : aucun service n'est sollicité.
    return NextResponse.json({ zone: null, horsGuinee: true }, { headers: SANS_CACHE });
  }

  try {
    await limiterZonePosition();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") {
      return NextResponse.json({ erreur: erreur.message }, { status: 429, headers: SANS_CACHE });
    }
    return NextResponse.json({ erreur: "Réessayez dans un instant." }, { status: 503, headers: SANS_CACHE });
  }

  const adresseUrl = new URL(NOMINATIM);
  adresseUrl.searchParams.set("format", "jsonv2");
  adresseUrl.searchParams.set("lat", String(arrondirCoordonnee(latitude)));
  adresseUrl.searchParams.set("lon", String(arrondirCoordonnee(longitude)));
  adresseUrl.searchParams.set("zoom", "16");
  adresseUrl.searchParams.set("addressdetails", "1");
  adresseUrl.searchParams.set("accept-language", "fr");

  let adresse: Record<string, unknown> = {};
  try {
    const reponse = await fetch(adresseUrl, {
      headers: { "User-Agent": IDENTIFICATION, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!reponse.ok) throw new Error("geocodage");
    const donnees: unknown = await reponse.json();
    const candidate = typeof donnees === "object" && donnees !== null ? (donnees as { address?: unknown }).address : null;
    if (typeof candidate === "object" && candidate !== null) adresse = candidate as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erreur: "Le service de localisation ne répond pas pour le moment." }, { status: 502, headers: SANS_CACHE });
  }

  const zones = await lireZones();
  const zone = correspondreZone(adresse, zones);
  return NextResponse.json(
    { zone: zone ? { niveau: zone.niveau, slug: zone.slug, nom: zone.nom } : null, horsGuinee: false },
    { headers: SANS_CACHE }
  );
}
