"use server";

import { creerClientServeur } from "@/lib/db/server";
import { lireEtatLivreur, type EtatLivreur } from "./livreur";
import { avancerMaCourse, basculerEnLigne, envoyerPosition, repondreOffreLivreur, type ResultatLivreur } from "./service-livreur";

/**
 * Actions du livreur depuis sa console web. L'identité vient de la SESSION (compte lié à une fiche livreur) : un identifiant de livreur envoyé par le
 * navigateur n'est jamais cru. Les règles sont dans `service-livreur.ts`, partagé avec l'application native.
 */

async function compteConnecte(): Promise<string | null> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  return user?.id ?? null;
}

const NON_CONNECTE: ResultatLivreur = { ok: false, message: "Ce compte n'est pas un compte livreur." };

export type { ResultatLivreur };

export async function lireMonEtatAction(): Promise<EtatLivreur | null> {
  const id = await compteConnecte();
  return id ? lireEtatLivreur(id) : null;
}

export async function basculerEnLigneAction(enLigne: boolean): Promise<ResultatLivreur> {
  const id = await compteConnecte();
  return id ? basculerEnLigne(id, enLigne) : NON_CONNECTE;
}

export async function envoyerPositionAction(latitude: number, longitude: number): Promise<ResultatLivreur> {
  const id = await compteConnecte();
  return id ? envoyerPosition(id, latitude, longitude) : NON_CONNECTE;
}

export async function repondreOffreLivreurAction(offreId: string, reponse: "acceptee" | "refusee"): Promise<ResultatLivreur> {
  const id = await compteConnecte();
  return id ? repondreOffreLivreur(id, offreId, reponse) : NON_CONNECTE;
}

export async function avancerMaCourseAction(vers: string, code?: string, raison?: string): Promise<ResultatLivreur> {
  const id = await compteConnecte();
  return id ? avancerMaCourse(id, vers, code, raison) : NON_CONNECTE;
}
