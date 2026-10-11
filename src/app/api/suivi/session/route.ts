import { NextResponse } from "next/server";
import { estJetonValide } from "@/lib/commande/jetons";
import { chargerSuiviParJeton } from "@/lib/commande/requetes";
import { NOM_COOKIE_SUIVI, optionsCookieSuivi } from "@/lib/commande/sessionSuivi";

/** Échange ponctuel du jeton reçu dans le fragment contre une session HttpOnly. */
export async function POST(request: Request) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }

  const jeton = typeof corps === "object" && corps !== null && "jeton" in corps ? corps.jeton : null;
  if (!estJetonValide(jeton)) {
    return NextResponse.json({ erreur: "Lien de suivi invalide." }, { status: 400 });
  }

  const suivi = await chargerSuiviParJeton(jeton);
  if (!suivi) {
    return NextResponse.json({ erreur: "Lien de suivi introuvable." }, { status: 404 });
  }

  const reponse = new NextResponse(null, { status: 204 });
  reponse.cookies.set(NOM_COOKIE_SUIVI, jeton, optionsCookieSuivi());
  return reponse;
}
