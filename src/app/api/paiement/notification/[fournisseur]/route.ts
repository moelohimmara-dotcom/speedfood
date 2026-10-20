import { NextResponse } from "next/server";
import { ErreurPasserelle, type NomFournisseur } from "@/lib/paiement/en-ligne/fournisseur";
import { obtenirServicePaiement } from "@/lib/paiement/en-ligne/fabrique";

/**
 * Notifications du prestataire de paiement (voir docs/PAIEMENT-ARCHITECTURE.md §3 et §8).
 *
 *  - Le corps est lu BRUT : la signature se calcule sur les octets reçus, jamais sur un JSON relu.
 *  - La signature est vérifiée AVANT tout traitement (dans le service, via la passerelle) ; un refus répond 401 sans détail.
 *  - Un rejeu, une référence inconnue ou une notification sans effet répondent 200 : le prestataire ne doit pas réessayer en boucle.
 *  - Aucun contrôle d'origine navigateur : l'appel vient d'un serveur. La signature est l'authentification.
 *  - Réponse rapide (le guide du prestataire annonce un délai de quelques secondes).
 */

const TAILLE_MAX_OCTETS = 16_384;
const FOURNISSEURS: readonly NomFournisseur[] = ["simulation", "chapchap"];

export async function POST(request: Request, contexte: { params: Promise<{ fournisseur: string }> }) {
  const { fournisseur } = await contexte.params;
  if (!(FOURNISSEURS as readonly string[]).includes(fournisseur)) return new NextResponse(null, { status: 404 });

  const declare = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declare) && declare > TAILLE_MAX_OCTETS) return new NextResponse(null, { status: 413 });
  const corps = await request.text();
  if (corps.length > TAILLE_MAX_OCTETS) return new NextResponse(null, { status: 413 });

  const entetes: Record<string, string | undefined> = {};
  request.headers.forEach((valeur, nom) => {
    entetes[nom.toLowerCase()] = valeur;
  });

  try {
    const service = await obtenirServicePaiement(fournisseur as NomFournisseur);
    const resultat = await service.appliquerNotification(corps, entetes);
    if (resultat.statut === "refuse") return NextResponse.json({ erreur: "Signature invalide." }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (erreur) {
    // Fournisseur non configuré (clés absentes) : la route n'existe pas pour l'extérieur.
    if (erreur instanceof ErreurPasserelle && erreur.code === "non_configuree") return new NextResponse(null, { status: 404 });
    console.error("paiement_notification_echec");
    return NextResponse.json({ erreur: "Traitement impossible." }, { status: 500 });
  }
}
