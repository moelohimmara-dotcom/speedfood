"use server";

import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { estCheminInterneSur } from "./redirection";

/**
 * Double authentification (TOTP : application d'authentification sur le téléphone).
 * FACULTATIVE : personne n'est obligé de l'activer, mais le rappel est visible dans les
 * consoles. Une fois activée, elle est EXIGÉE à chaque connexion (voir `src/proxy.ts` et la
 * migration `double_authentification_aal2` côté base).
 *
 * Fichier "use server" : uniquement des fonctions asynchrones exportées. Les helpers de lecture
 * sont dans `mfa-etat.ts`.
 */

export interface EtatActivationMfa {
  erreur?: string;
  facteurId?: string;
  /** Image du QR code (data URI SVG fournie par Supabase). */
  qr?: string;
  /** Clé à saisir à la main si le QR ne peut pas être scanné ; à conserver dans un gestionnaire de mots de passe. */
  secret?: string;
}

const MESSAGE_CODE = "Code invalide ou expiré. Saisissez les 6 chiffres affichés dans l'application, sans espace.";

function codePropre(brut: string): string | null {
  const code = brut.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** Première étape : crée un facteur « en attente » et renvoie le QR code. Remplace tout facteur non confirmé. */
export async function demarrerActivationMfaAction(): Promise<EtatActivationMfa> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erreur: "Vous devez être connecté." };
  }

  const { data: facteurs } = await supabase.auth.mfa.listFactors();
  if (facteurs?.totp?.length) {
    return { erreur: "La double authentification est déjà activée sur ce compte." };
  }
  // Nettoie d'éventuelles tentatives abandonnées (facteurs jamais confirmés).
  for (const facteur of facteurs?.all ?? []) {
    if (facteur.status !== "verified") {
      await supabase.auth.mfa.unenroll({ factorId: facteur.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Speedfood ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) {
    return { erreur: "Impossible de démarrer l'activation pour le moment. Réessayez dans un instant." };
  }
  return { facteurId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Seconde étape : confirme avec un premier code. La session passe alors au niveau renforcé. */
export async function confirmerActivationMfaAction(
  facteurId: string,
  code: string
): Promise<{ erreur?: string; succes?: boolean }> {
  const propre = codePropre(code);
  if (!propre || typeof facteurId !== "string" || facteurId.length === 0) {
    return { erreur: MESSAGE_CODE };
  }
  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: facteurId, code: propre });
  if (error) {
    return { erreur: MESSAGE_CODE };
  }
  return { succes: true };
}

/** Désactive la double authentification (exige une session renforcée, donc un code récent). */
export async function desactiverMfaAction(facteurId: string): Promise<{ erreur?: string; succes?: boolean }> {
  const supabase = await creerClientServeur();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: facteurId });
  if (error) {
    return {
      erreur:
        "Impossible de désactiver : reconnectez-vous avec votre code puis réessayez. Si vous avez perdu votre téléphone, voir le guide de récupération.",
    };
  }
  return { succes: true };
}

/** Vérification à la connexion : saisie du code après le mot de passe. */
export async function verifierCodeConnexionAction(
  _etatPrecedent: { erreur?: string },
  formData: FormData
): Promise<{ erreur?: string }> {
  const code = codePropre(String(formData.get("code") ?? ""));
  const suite = String(formData.get("suite") ?? "").trim();
  if (!code) {
    return { erreur: MESSAGE_CODE };
  }

  const supabase = await creerClientServeur();
  const { data: facteurs } = await supabase.auth.mfa.listFactors();
  const facteur = facteurs?.totp?.[0];
  if (!facteur) {
    return { erreur: "Aucune double authentification active sur ce compte. Reconnectez-vous." };
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: facteur.id, code });
  if (error) {
    return { erreur: MESSAGE_CODE };
  }

  redirect(estCheminInterneSur(suite) ? suite : "/restaurant");
}
