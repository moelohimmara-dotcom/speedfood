"use server";

import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { activerCompte } from "./livreurs-service";

/**
 * Activation d'une fiche livreur par le livreur lui-même. L'identité vient de la SESSION : le lien lie la fiche au compte qui
 * l'ouvre, jamais à un compte désigné par le navigateur. Voir docs/LIVREURS.md §3.
 */
export interface EtatActivation {
  erreur?: string;
}

export async function activerCompteLivreurAction(_prec: EtatActivation, formData: FormData): Promise<EtatActivation> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { erreur: "Votre session a expiré. Reconnectez-vous puis rouvrez votre lien." };
  if (formData.get("consentement") !== "on") return { erreur: "Vous devez accepter l'utilisation de ces informations pour continuer." };

  const r = await activerCompte(String(formData.get("jeton") ?? ""), user.id, {
    pieceType: String(formData.get("piece_type") ?? ""),
    pieceNumero: String(formData.get("piece_numero") ?? ""),
    urgenceNom: String(formData.get("urgence_nom") ?? ""),
    urgenceTelephone: String(formData.get("urgence_telephone") ?? ""),
  });
  if (!r.ok) return { erreur: r.message };
  redirect("/livreur");
}
