"use server";

import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientServeur } from "@/lib/db/server";
import { lireJetonSessionSuivi } from "@/lib/commande/sessionSuivi";
import { limiterNotation } from "@/lib/securite/limitation-debit";
import { rattacherCommande, type ResultatRattachement } from "./rattachement";
import { enregistrerAvisClient, type ResultatEnregistrement } from "./service";

export interface SaisieNotation {
  restaurant: { note: number; etiquettes: string[]; commentaire: string };
  livreur: { note: number; etiquettes: string[] } | null;
}

/** Sur la page `/suivi` (session), le lien de suivi n'est jamais envoyé au navigateur : il vient du cookie HttpOnly. */
async function jetonEffectif(jeton: string | undefined): Promise<string | null> {
  return typeof jeton === "string" ? jeton : lireJetonSessionSuivi();
}

/** Le client note le restaurant (et le livreur s'il y en a eu un) pour la commande de ce suivi. Compte connecté obligatoire. */
export async function noterCommandeAction(jetonRecu: string | undefined, saisie: SaisieNotation): Promise<ResultatEnregistrement> {
  const jeton = await jetonEffectif(jetonRecu);
  if (!jeton) return { ok: false, erreur: "Lien de suivi introuvable." };
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { ok: false, erreur: "Connectez-vous pour noter cette commande." };
  if (typeof jeton !== "string" || jeton.length > 200 || !saisie || typeof saisie !== "object") return { ok: false, erreur: "Demande invalide." };
  try {
    await limiterNotation();
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof ErreurMetier ? erreur.message : "Réessayez dans un instant." };
  }
  try {
    return await enregistrerAvisClient({
      jeton,
      utilisateurId: user.id,
      restaurant: { note: saisie.restaurant?.note, etiquettes: saisie.restaurant?.etiquettes, commentaire: saisie.restaurant?.commentaire },
      livreur: saisie.livreur ? { note: saisie.livreur.note, etiquettes: saisie.livreur.etiquettes } : null,
    });
  } catch {
    return { ok: false, erreur: "Enregistrement impossible, réessayez dans un instant." };
  }
}

/** Rattache la commande (passée sans compte) au compte connecté, pour pouvoir la noter. Voir `rattachement.ts`. */
export async function rattacherCommandeAction(jetonRecu: string | undefined): Promise<ResultatRattachement> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { ok: false, erreur: "Connectez-vous pour rattacher cette commande." };
  const jeton = await jetonEffectif(jetonRecu);
  if (!jeton || jeton.length > 200) return { ok: false, erreur: "Lien de suivi introuvable." };
  try {
    await limiterNotation();
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof ErreurMetier ? erreur.message : "Réessayez dans un instant." };
  }
  try {
    return await rattacherCommande({ jeton, utilisateurId: user.id });
  } catch {
    return { ok: false, erreur: "Rattachement impossible, réessayez dans un instant." };
  }
}
